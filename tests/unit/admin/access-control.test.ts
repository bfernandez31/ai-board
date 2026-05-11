import { describe, it, expect } from 'vitest'
import { checkAdminAccess } from '../../../lib/admin/access-control'

describe('Admin Access Control Unit Tests', () => {
  it('should allow access for admin users', () => {
    const mockUser = { role: 'ADMIN', email: 'admin@example.com' }
    const result = checkAdminAccess(mockUser)
    expect(result).toBe(true)
  })

  it('should deny access for non-admin users', () => {
    const mockUser = { role: 'USER', email: 'user@example.com' }
    const result = checkAdminAccess(mockUser)
    expect(result).toBe(false)
  })

  it('should deny access for null users', () => {
    const result = checkAdminAccess(null)
    expect(result).toBe(false)
  })

  it('should deny access for users without proper role', () => {
    const mockUser = { email: 'user@example.com' }
    const result = checkAdminAccess(mockUser)
    expect(result).toBe(false)
  })
})
