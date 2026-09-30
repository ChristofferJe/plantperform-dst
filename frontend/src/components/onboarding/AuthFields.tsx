import {
  EMAIL_FIELD_ID,
  PASSWORD_FIELD_ID,
  type AuthFieldsState,
} from '@/components/onboarding/auth-fields'
import { EmailField } from '@/components/onboarding/EmailField'
import { FieldError } from '@/components/ui/field-error'
import { PasswordInput } from '@/components/onboarding/PasswordInput'
import { Label } from '@/components/ui/label'

type AuthFieldsProps = {
  fields: AuthFieldsState
  passwordAutoComplete: 'current-password' | 'new-password'
  autoFocus?: 'email' | 'password' | 'none'
  rejected?: boolean
}

export const AuthFields = ({
  fields,
  passwordAutoComplete,
  autoFocus = 'none',
  rejected = false,
}: AuthFieldsProps) => (
  <>
    <EmailField
      id={EMAIL_FIELD_ID}
      value={fields.email}
      error={fields.errors.email}
      onChange={fields.changeEmail}
      onBlur={fields.blurEmail}
      autoFocus={autoFocus === 'email'}
      invalid={rejected}
    />
    <div className="space-y-2">
      <Label htmlFor={PASSWORD_FIELD_ID}>Adgangskode</Label>
      <PasswordInput
        id={PASSWORD_FIELD_ID}
        value={fields.password}
        onChange={fields.changePassword}
        onBlur={fields.blurPassword}
        autoComplete={passwordAutoComplete}
        autoFocus={autoFocus === 'password'}
        invalid={rejected || Boolean(fields.errors.password)}
        describedBy={fields.errors.password ? 'password-error' : undefined}
      />
      <FieldError id="password-error" message={fields.errors.password} />
    </div>
  </>
)
