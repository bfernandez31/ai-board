/**
 * Script to create real test image fixtures using sharp
 * Run with: node tests/fixtures/images/create-real-fixtures.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createFixtures() {
  const fixturesDir = __dirname;

  // Create a real PNG image (10x10 pixel red square)
  await sharp({
    create: {
      width: 10,
      height: 10,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  })
    .png()
    .toFile(path.join(fixturesDir, 'valid-image.png'));
  console.log('✓ Created valid-image.png');

  // Create a real JPEG image (10x10 pixel blue square)
  await sharp({
    create: {
      width: 10,
      height: 10,
      channels: 3,
      background: { r: 0, g: 0, b: 255 }
    }
  })
    .jpeg({ quality: 90 })
    .toFile(path.join(fixturesDir, 'valid-jpeg.jpg'));
  console.log('✓ Created valid-jpeg.jpg');

  // Create a large PNG (exceeds 10MB limit) - 3000x3000 pixel image
  await sharp({
    create: {
      width: 3000,
      height: 3000,
      channels: 4,
      background: { r: 0, g: 255, b: 0, alpha: 1 }
    }
  })
    .png({ compressionLevel: 0 }) // No compression to make it larger
    .toFile(path.join(fixturesDir, 'large-image.png'));
  console.log('✓ Created large-image.png (exceeds 10MB limit)');

  // Create an invalid file (text content with .png extension)
  fs.writeFileSync(
    path.join(fixturesDir, 'invalid-signature.txt'),
    'This is a text file, not an image. Testing signature validation.'
  );
  console.log('✓ Created invalid-signature.txt');

  console.log('\n✅ All real test fixtures created successfully!');
}

createFixtures().catch(console.error);
