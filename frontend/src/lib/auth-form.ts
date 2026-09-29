export const PASSWORD_MIN_LENGTH = 6

const EMAIL_MAX_LENGTH = 320
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_VERIFICATION_REQUIRED = 'Email verification required'

export type PasswordPurpose = 'login' | 'register'

export type LoginFailure = 'unverified' | 'credentials' | 'unavailable'

export const LOGIN_FAILURE_MESSAGES: Record<LoginFailure, string> = {
  unverified:
    'Din e-mail er ikke bekræftet endnu. Klik på linket i mailen, eller få den sendt igen.',
  credentials: 'E-mail eller adgangskode er forkert.',
  unavailable: 'Kunne ikke logge ind lige nu. Prøv igen om lidt.',
}

export const loginFailure = (
  status: number | null,
  message: string,
): LoginFailure => {
  if (status === 403 && message === EMAIL_VERIFICATION_REQUIRED) {
    return 'unverified'
  }
  if (status === 401) return 'credentials'
  return 'unavailable'
}

export const validateEmail = (value: string): string | null => {
  const email = value.trim()
  if (!email) return 'Skriv din e-mailadresse.'
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    return 'Skriv en gyldig e-mailadresse.'
  }
  return null
}

export const validatePassword = (
  value: string,
  purpose: PasswordPurpose,
): string | null => {
  if (!value) {
    return purpose === 'login'
      ? 'Skriv din adgangskode.'
      : 'Vælg en adgangskode.'
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Adgangskoden skal være mindst ${PASSWORD_MIN_LENGTH} tegn.`
  }
  return null
}
