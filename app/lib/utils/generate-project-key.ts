import { prisma } from '@/lib/db/client';

/**
 * Generates a unique project key from a project name
 *
 * @param name - Project name to derive key from
 * @returns A unique 3-6 character uppercase alphanumeric project key
 *
 * Algorithm:
 * 1. Extract first 3-6 alphanumeric characters from name
 * 2. Convert to uppercase
 * 3. Pad to minimum 3 characters if needed
 * 4. Check for collisions with existing keys
 * 5. If collision, append digit suffix and retry
 *
 * Examples:
 * - "Mobile App" → "MOBILE" or "MOB" (no collision) or "MOB1" (collision)
 * - "Backend" → "BACK"
 * - "AI" → "AIX" (padded to 3 chars)
 * - "123Project" → "123PRO"
 */
export async function generateProjectKey(name: string): Promise<string> {
  // Step 1: Extract alphanumeric characters from name
  const alphanumeric = name.replace(/[^A-Za-z0-9]/g, '');

  if (!alphanumeric) {
    // If name has no alphanumeric characters, generate a random key
    return generateRandomKey();
  }

  // Step 2: Take first 3-6 characters and convert to uppercase
  let baseKey = alphanumeric.substring(0, 6).toUpperCase();

  // Step 3: Pad to minimum 3 characters if needed
  if (baseKey.length < 3) {
    baseKey = baseKey.padEnd(3, 'X');
  }

  // Step 4: Check for collisions and resolve
  let key = baseKey;
  let suffix = 1;
  const maxAttempts = 100; // Prevent infinite loops

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Check if key already exists
    const existing = await prisma.project.findUnique({
      where: { key },
      select: { id: true },
    });

    if (!existing) {
      // Key is unique, return it
      return key;
    }

    // Collision detected, append suffix
    // Ensure total length stays within 6 characters
    const suffixStr = suffix.toString();
    const baseLength = Math.min(6 - suffixStr.length, baseKey.length);
    key = baseKey.substring(0, baseLength) + suffixStr;
    suffix++;
  }

  // If we exhausted all attempts, generate a random key
  console.warn(
    `Failed to generate unique key for project "${name}" after ${maxAttempts} attempts. Generating random key.`
  );
  return generateRandomKey();
}

/**
 * Generates a random 3-character alphanumeric key
 * Used as fallback when collision resolution fails
 */
function generateRandomKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (0/O, 1/I)
  let key = '';

  for (let i = 0; i < 3; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    key += chars[randomIndex];
  }

  return key;
}

/**
 * Validates a custom project key provided by the user
 *
 * @param key - The custom key to validate
 * @returns True if valid, false otherwise
 *
 * Rules:
 * - Length: 3-6 characters
 * - Format: Uppercase alphanumeric only (A-Z, 0-9)
 * - No special characters or spaces
 */
export function isValidProjectKey(key: string): boolean {
  const keyRegex = /^[A-Z0-9]{3,6}$/;
  return keyRegex.test(key);
}

/**
 * Checks if a project key is available (not already in use)
 *
 * @param key - The key to check
 * @returns True if available, false if already in use
 */
export async function isProjectKeyAvailable(key: string): Promise<boolean> {
  const existing = await prisma.project.findUnique({
    where: { key },
    select: { id: true },
  });

  return !existing;
}
