import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Mail, MailCheck } from 'lucide-react'

import { postJson } from '@/api/client'
import { AuthIcon, AuthLayout } from '@/components/onboarding/AuthLayout'
import { AuthNotice } from '@/components/onboarding/AuthNotice'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validateEmail } from '@/lib/auth-form'

export const ForgotPasswordPage = () => {
  const location = useLocation()
  const [email, setEmail] = useState(
    (location.state as { email?: string } | null)?.email ?? '',
  )
  const [emailError, setEmailError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return
    const nextError = validateEmail(email)
    setEmailError(nextError)
    setError(null)
    if (nextError) {
      document.getElementById('reset-email')?.focus()
      return
    }
    setIsSubmitting(true)
    try {
      await postJson<{ message: string }, { email: string }>(
        '/auth/password/forgot',
        { email: email.trim().toLowerCase() },
      )
      setSent(true)
    } catch {
      setError('Kunne ikke sende mailen lige nu. Prøv igen om lidt.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      icon={<AuthIcon icon={sent ? MailCheck : Mail} />}
      title={sent ? 'Tjek din e-mail' : 'Glemt adgangskode?'}
      description={
        sent
          ? 'Hvis der findes en konto med denne e-mailadresse, har vi sendt et link til at vælge en ny adgangskode.'
          : 'Skriv den e-mail, du oprettede kontoen med, så sender vi et link til en ny adgangskode.'
      }
      footer={
        <Link
          className="font-medium text-foreground underline underline-offset-4"
          to="/login"
        >
          Tilbage til login
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-6" role="status">
          <p className="text-sm text-muted-foreground">
            Linket virker i 1 time og kan kun bruges én gang. Kig i spam, hvis
            mailen ikke dukker op inden for et par minutter. Vent mindst et
            minut, før du beder om en ny mail.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setSent(false)}
          >
            Send et nyt link
          </Button>
        </div>
      ) : (
        <form className="space-y-6" noValidate onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="reset-email">E-mail</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              aria-invalid={Boolean(emailError) || undefined}
              aria-describedby={emailError ? 'reset-email-error' : undefined}
              className="h-11 aria-invalid:border-red-600 aria-invalid:ring-1 aria-invalid:ring-red-600"
              onChange={(event) => {
                setEmail(event.target.value)
                if (emailError) setEmailError(validateEmail(event.target.value))
              }}
              onBlur={() => {
                if (email.trim()) setEmailError(validateEmail(email))
              }}
            />
            <FieldError id="reset-email-error" message={emailError} />
          </div>
          {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
          <Button size="lg" className="w-full" loading={isSubmitting}>
            {isSubmitting ? 'Sender...' : 'Send link til ny adgangskode'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
