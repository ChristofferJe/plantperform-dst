import { describe, expect, it } from 'vitest'

import { loginFailure } from '@/lib/auth-form'

describe('loginFailure', () => {
  it('asks for verification when the email is not verified', () => {
    expect(loginFailure(403, 'Email verification required')).toBe('unverified')
  })

  it('does not ask for verification when the origin is rejected', () => {
    expect(loginFailure(403, 'Invalid request origin')).toBe('unavailable')
  })

  it('rejects the email and password on 401', () => {
    expect(loginFailure(401, 'Invalid email or password')).toBe('credentials')
  })

  it('reports any other error as a general failure', () => {
    expect(loginFailure(502, 'API-kald fejlede med status 502')).toBe(
      'unavailable',
    )
    expect(loginFailure(null, 'Failed to fetch')).toBe('unavailable')
  })
})
