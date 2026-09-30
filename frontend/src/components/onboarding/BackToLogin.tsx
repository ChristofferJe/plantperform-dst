import { Link } from 'react-router-dom'

export const BackToLogin = () => (
  <p>
    <Link
      className="font-medium text-foreground underline underline-offset-4"
      to="/login"
    >
      Tilbage til login
    </Link>
  </p>
)
