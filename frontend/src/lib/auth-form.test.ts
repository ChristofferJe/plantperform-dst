import { describe, expect, it } from 'vitest'

import {
  isWellFormedResetToken,
  loginFailure,
  validatePassword,
  validatePasswordConfirmation,
} from '@/lib/auth-form'

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

describe('password reset validation', () => {
  it('requires a new password within the API length limits', () => {
    expect(validatePassword('', 'reset')).not.toBeNull()
    expect(validatePassword('short', 'reset')).not.toBeNull()
    expect(validatePassword('123456', 'reset')).toBeNull()
    expect(validatePassword('x'.repeat(1024), 'reset')).toBeNull()
    expect(validatePassword('x'.repeat(1025), 'reset')).not.toBeNull()
  })

  it('requires an exact confirmation without trimming passwords', () => {
    expect(validatePasswordConfirmation('password', '')).not.toBeNull()
    expect(validatePasswordConfirmation('password', 'different')).not.toBeNull()
    expect(validatePasswordConfirmation('password', 'password ')).not.toBeNull()
    expect(validatePasswordConfirmation('password', 'password')).toBeNull()
  })

  it('accepts only reset tokens within the API length limits', () => {
    expect(isWellFormedResetToken('')).toBe(false)
    expect(isWellFormedResetToken('x'.repeat(19))).toBe(false)
    expect(isWellFormedResetToken('x'.repeat(20))).toBe(true)
    expect(isWellFormedResetToken('x'.repeat(256))).toBe(true)
    expect(isWellFormedResetToken('x'.repeat(257))).toBe(false)
  })
})
