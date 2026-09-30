import hashlib
import importlib.util
import os
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from alembic.migration import MigrationContext
from alembic.operations import Operations
from botocore.exceptions import ClientError
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, update
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import auth
from app.api.v0.auth import router
from app.data.db import (
    app_user_table,
    email_verification_token_table,
    metadata,
    password_reset_token_table,
    refresh_session_table,
)

ENVIRONMENT = {
    "APP_ENV": "test",
    "AUTH_JWT_SECRET": "a" * 32,
    "AUTH_REFRESH_PEPPER": "b" * 32,
    "PUBLIC_APP_URL": "https://plantperform.example.com",
}
EMAIL = "farmer@example.com"
PASSWORD = "old-password"
NEW_PASSWORD = "new-password"
FORGOT = "/api/v0/auth/password/forgot"
RESET = "/api/v0/auth/password/reset"


class PasswordResetTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        self.addCleanup(self.engine.dispose)
        metadata.create_all(
            self.engine,
            tables=[
                app_user_table,
                email_verification_token_table,
                password_reset_token_table,
                refresh_session_table,
            ],
        )
        self.sessions = sessionmaker(bind=self.engine)
        self.enterContext(patch.dict(os.environ, ENVIRONMENT))
        self.enterContext(patch.object(auth, "SessionLocal", self.sessions))
        self.mail = self.enterContext(patch.object(auth, "_send_password_reset_email"))
        app = FastAPI()
        app.include_router(router, prefix="/api/v0")
        self.client = self.enterContext(TestClient(app))
        with self.sessions.begin() as session:
            session.execute(
                app_user_table.insert().values(
                    email=EMAIL,
                    password_hash=auth.hash_password(PASSWORD),
                    verified_at=datetime.now(UTC),
                )
            )

    def request_link(self) -> str:
        response = self.client.post(FORGOT, json={"email": EMAIL})
        self.assertEqual(response.status_code, 202)
        return self.mail.call_args.args[1]

    def reset(self, token: str, password: str = NEW_PASSWORD):
        return self.client.post(RESET, json={"token": token, "password": password})

    def age_request(self) -> None:
        with self.sessions.begin() as session:
            session.execute(
                update(password_reset_token_table).values(
                    created_at=datetime.now(UTC) - timedelta(minutes=2)
                )
            )

    def test_full_flow_changes_password_and_revokes_refresh_sessions(self) -> None:
        old_login = self.client.post(
            "/api/v0/auth/login", json={"email": EMAIL, "password": PASSWORD}
        )
        self.assertEqual(old_login.status_code, 200)
        old_refresh = self.client.cookies.get(auth.REFRESH_COOKIE_NAME)
        second_refresh = auth.login_user(EMAIL, PASSWORD).refresh_token
        token = self.request_link()
        # Requesting the link alone must not change the password or sessions.
        auth.login_user(EMAIL, PASSWORD)
        response = self.reset(token)
        self.assertEqual(response.status_code, 200)
        self.assertIn("Max-Age=0", response.headers["set-cookie"])
        self.assertIsNone(self.client.cookies.get(auth.REFRESH_COOKIE_NAME))
        with self.sessions() as session:
            user = session.execute(select(app_user_table)).one()
            self.assertNotEqual(user.password_hash, NEW_PASSWORD)
            self.assertTrue(auth.verify_password(user.password_hash, NEW_PASSWORD))
            sessions = session.execute(select(refresh_session_table)).all()
            self.assertTrue(all(row.revoked_at is not None for row in sessions))
        for refresh in (old_refresh, second_refresh):
            with self.assertRaises(auth.InvalidRefreshTokenError):
                auth.refresh_user(refresh)
        with self.assertRaises(auth.InvalidCredentialsError):
            auth.login_user(EMAIL, PASSWORD)
        self.assertEqual(auth.login_user(EMAIL, NEW_PASSWORD).email, EMAIL)
        self.assertEqual(self.reset(token, "another-password").status_code, 400)

    def test_only_hash_is_stored_and_link_expires_in_one_hour(self) -> None:
        token = self.request_link()
        with self.sessions() as session:
            row = session.execute(select(password_reset_token_table)).one()
        self.assertGreaterEqual(len(token), 32)
        self.assertNotEqual(row.token_hash, token)
        self.assertEqual(row.token_hash, hashlib.sha256(token.encode()).hexdigest())
        self.assertEqual(row.expires_at - row.created_at, timedelta(hours=1))
        self.assertIsNone(row.used_at)

    def test_unknown_address_has_same_response_without_email_or_account_creation(self) -> None:
        unknown = self.client.post(FORGOT, json={"email": "missing@example.com"})
        self.mail.assert_not_called()
        known = self.client.post(FORGOT, json={"email": EMAIL})
        self.assertEqual(unknown.status_code, known.status_code)
        self.assertEqual(unknown.json(), known.json())
        with self.sessions() as session:
            self.assertEqual(len(session.execute(select(app_user_table)).all()), 1)

    def test_email_is_normalized(self) -> None:
        response = self.client.post(FORGOT, json={"email": "  FARMER@EXAMPLE.COM  "})
        self.assertEqual(response.status_code, 202)
        self.assertEqual(self.mail.call_args.args[0], EMAIL)

    def test_resend_cooldown_preserves_existing_link(self) -> None:
        token = self.request_link()
        self.client.post(FORGOT, json={"email": EMAIL})
        self.mail.assert_called_once()
        self.assertEqual(self.reset(token).status_code, 200)

    def test_new_request_invalidates_previous_link(self) -> None:
        first_token = self.request_link()
        self.age_request()
        second_token = self.request_link()
        self.assertNotEqual(first_token, second_token)
        self.assertEqual(self.reset(first_token).status_code, 400)
        self.assertEqual(self.reset(second_token).status_code, 200)

    def test_failed_delivery_preserves_previous_link_and_does_not_block_retry(self) -> None:
        first_token = self.request_link()
        self.age_request()
        self.mail.side_effect = RuntimeError("Private SES failure detail")
        response = self.client.post(FORGOT, json={"email": EMAIL})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "Password reset email could not be sent")
        self.assertEqual(self.reset(first_token).status_code, 200)
        self.mail.side_effect = None
        self.assertNotEqual(self.request_link(), first_token)

    def test_expired_and_unknown_tokens_do_not_change_password(self) -> None:
        token = self.request_link()
        with self.sessions.begin() as session:
            session.execute(
                update(password_reset_token_table).values(
                    expires_at=datetime.now(UTC) - timedelta(seconds=1)
                )
            )
        for candidate in (token, "unknown-token-with-at-least-twenty-characters"):
            response = self.reset(candidate)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["detail"], "Invalid or expired password reset token")
        self.assertEqual(auth.login_user(EMAIL, PASSWORD).email, EMAIL)

    def test_verification_tokens_cannot_reset_password(self) -> None:
        with self.sessions.begin() as session:
            token = auth._create_verification_token(session, EMAIL)
        self.assertEqual(self.reset(token).status_code, 400)
        self.assertEqual(auth.login_user(EMAIL, PASSWORD).email, EMAIL)

    def test_reset_does_not_bypass_email_verification(self) -> None:
        with self.sessions.begin() as session:
            session.execute(update(app_user_table).values(verified_at=None))
        self.assertEqual(self.reset(self.request_link()).status_code, 200)
        with self.assertRaises(auth.UnverifiedAccountError):
            auth.login_user(EMAIL, NEW_PASSWORD)

    def test_reset_does_not_change_another_accounts_password_or_sessions(self) -> None:
        with self.sessions.begin() as session:
            session.execute(
                app_user_table.insert().values(
                    email="other@example.com",
                    password_hash=auth.hash_password(PASSWORD),
                    verified_at=datetime.now(UTC),
                )
            )
        auth.login_user("other@example.com", PASSWORD)
        self.assertEqual(self.reset(self.request_link()).status_code, 200)
        with self.sessions() as session:
            other_session = session.execute(
                select(refresh_session_table).where(
                    refresh_session_table.c.email == "other@example.com"
                )
            ).one()
            self.assertIsNone(other_session.revoked_at)
        self.assertEqual(auth.login_user("other@example.com", PASSWORD).email, "other@example.com")

    def test_invalid_payloads_are_rejected_without_consuming_token(self) -> None:
        self.assertEqual(self.client.post(FORGOT, json={"email": "invalid"}).status_code, 422)
        token = self.request_link()
        for password in ("", "short", "x" * 1025):
            self.assertEqual(self.reset(token, password).status_code, 422)
        for invalid_token in ("", "short", "x" * 257):
            self.assertEqual(self.reset(invalid_token).status_code, 422)
        self.assertEqual(self.reset(token).status_code, 200)

    def test_untrusted_browser_origin_cannot_request_or_complete_reset(self) -> None:
        headers = {"Origin": "https://untrusted.example.com"}
        self.assertEqual(
            self.client.post(FORGOT, json={"email": EMAIL}, headers=headers).status_code, 403
        )
        self.mail.assert_not_called()
        token = self.request_link()
        self.assertEqual(
            self.client.post(
                RESET, json={"token": token, "password": NEW_PASSWORD}, headers=headers
            ).status_code,
            403,
        )
        self.assertEqual(self.reset(token).status_code, 200)


class PasswordResetEmailTests(unittest.TestCase):
    def setUp(self) -> None:
        self.enterContext(
            patch.dict(
                os.environ,
                ENVIRONMENT
                | {
                    "APP_ENV": "production",
                    "AWS_DEFAULT_REGION": "eu-central-1",
                    "SES_FROM_EMAIL": "noreply@example.com",
                },
                clear=True,
            )
        )
        self.ses = self.enterContext(patch("app.auth.boto3.client"))

    def test_email_contains_frontend_link_and_expiry(self) -> None:
        auth._send_password_reset_email(EMAIL, "secret-token")
        message = self.ses.return_value.send_email.call_args.kwargs
        self.assertEqual(message["Destination"], {"ToAddresses": [EMAIL]})
        self.assertEqual(message["FromEmailAddress"], "PlantPerform <noreply@example.com>")
        body = message["Content"]["Simple"]["Body"]["Text"]["Data"]
        link = next(line for line in body.splitlines() if line.startswith("https://"))
        parsed = urlsplit(link)
        self.assertEqual(parsed.netloc, "plantperform.example.com")
        self.assertEqual(parsed.path, "/reset-password")
        self.assertEqual(parsed.query, "")
        self.assertEqual(parse_qs(parsed.fragment), {"token": ["secret-token"]})
        self.assertIn("1 time", body)

    def test_delivery_failure_does_not_log_recipient_or_token(self) -> None:
        self.ses.return_value.send_email.side_effect = ClientError(
            {"Error": {"Code": "MessageRejected", "Message": f"Private detail: {EMAIL}"}},
            "SendEmail",
        )
        with (
            self.assertLogs("app.auth", level="ERROR") as logs,
            self.assertRaisesRegex(RuntimeError, "Password reset email delivery failed"),
        ):
            auth._send_password_reset_email(EMAIL, "secret-token")
        output = "\n".join(logs.output)
        self.assertIn("code=MessageRejected", output)
        self.assertNotIn(EMAIL, output)
        self.assertNotIn("secret-token", output)

    def test_development_prints_link_without_sending_email(self) -> None:
        with (
            patch.dict(os.environ, {"APP_ENV": "development"}),
            self.assertLogs("app.auth") as logs,
        ):
            auth._send_password_reset_email(EMAIL, "development-token")
        self.ses.assert_not_called()
        self.assertIn("/reset-password#token=development-token", "\n".join(logs.output))


class PasswordResetMigrationTests(unittest.TestCase):
    def test_upgrade_and_downgrade(self) -> None:
        path = (
            Path(__file__).resolve().parents[1]
            / "database/migrations/versions/20260930_0001_password_reset_tokens.py"
        )
        spec = importlib.util.spec_from_file_location("password_reset_migration", path)
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        engine = create_engine("sqlite://")
        self.addCleanup(engine.dispose)
        app_user_table.create(engine)
        with engine.begin() as connection:
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
                schema = inspect(connection)
                columns = {column["name"] for column in schema.get_columns("password_reset_token")}
                self.assertEqual(columns, set(password_reset_token_table.c.keys()))
                foreign_key = schema.get_foreign_keys("password_reset_token")[0]
                self.assertEqual(foreign_key["referred_table"], "app_user")
                self.assertEqual(foreign_key["options"]["ondelete"], "CASCADE")
                self.assertEqual(
                    schema.get_unique_constraints("password_reset_token")[0]["column_names"],
                    ["token_hash"],
                )
                migration.downgrade()
                self.assertNotIn("password_reset_token", inspect(connection).get_table_names())
                self.assertIn("app_user", inspect(connection).get_table_names())


if __name__ == "__main__":
    unittest.main()
