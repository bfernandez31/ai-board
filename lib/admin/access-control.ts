export interface AdminCandidate {
  role?: string | null
  email?: string | null
}

// Mock auth for testing - in real implementation, this would import from '@/auth'
async function auth(): Promise<{ user: AdminCandidate | null }> {
  return { user: null }
}

export function checkAdminAccess(user: AdminCandidate | null | undefined): boolean {
  if (!user) {
    return false
  }

  if (user.role === 'ADMIN') {
    return true
  }

  const adminEmails = process.env.ADMIN_EMAILS?.split(',') ?? []
  return !!user.email && adminEmails.includes(user.email)
}

export async function getCurrentUser() {
  const session = await auth()
  return session?.user || null
}

export async function requireAdminAccess() {
  const user = await getCurrentUser()
  const hasAccess = await checkAdminAccess(user)
  
  if (!hasAccess) {
    throw new Error('Admin access required')
  }
  
  return user
}
