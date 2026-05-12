import { auth } from '@/lib/auth'

type AdminUserCandidate = {
  role?: string | null
  email?: string | null
} | null | undefined

export function checkAdminAccess(user: AdminUserCandidate): boolean {
  if (!user) {
    return false
  }

  if (user.role === 'ADMIN') {
    return true
  }

  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || []
  if (user.email && adminEmails.includes(user.email)) {
    return true
  }

  return false
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
