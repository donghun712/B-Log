# B-log backend

## Local run

```powershell
.\gradlew.bat bootRun
```

The default profile uses an H2 file database under `backend/data`. For MySQL, set `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`, then run:

```powershell
.\gradlew.bat bootRun --args='--spring.profiles.active=mysql'
```

For local secrets, `config/local-secrets.properties` is loaded when present and ignored by source control.

## Environment

| Variable | Purpose |
| --- | --- |
| `FIREBASE_ENABLED` | Set `true` outside local development to verify Firebase ID tokens. |
| `FIREBASE_SERVICE_ACCOUNT` | Path to a Firebase Admin service account JSON file. |
| `FIREBASE_PROJECT_ID` | Optional Firebase project id override. |
| `DEV_AUTH_HEADERS_ENABLED` | Local-only fallback for `X-Blog-User-Id`; disable in production. |
| `OPENAI_API_KEY` | AI feedback and nearby summary proxy. |
| `OPENAI_MODEL` | Responses API model, default `gpt-4.1-mini`. |
| `KAKAO_REST_API_KEY` | Kakao Local keyword search for nearby place context. |
| `KAKAO_LOGIN_CLIENT_SECRET` | Kakao Login REST token exchange client secret when the Kakao secret is enabled. |
| `ADMIN_USERNAME` | Separate admin HTTP Basic username. |
| `ADMIN_PASSWORD` | Separate admin HTTP Basic password. |

## Server-owned APIs

- `/api/me`
- `/api/ranges`, `/api/ranges/nearby`
- `/api/practice-summaries`, `/api/practice-summaries/trust-check`
- `/api/rankings/overall`, `/api/rankings/range`, `/api/rankings/groups/{groupId}`
- `/api/groups`
- `/api/backups/latest`
- `/api/ai/feedback`, `/api/ai/nearby`
- `/api/admin/overview`

Detailed shot directions and notes stay on device except when the user explicitly sends a JSON backup.
