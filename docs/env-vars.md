# Cloud Function Environment Variables

Configure these in the CloudBase console for `createPlan`, `revisePlan`, and related functions. **Never commit secrets to Git.**

## External LLM (OpenAI-compatible)

| Variable | Required | Example | Description |
| --- | --- | --- | --- |
| `LLM_API_BASE` | Yes (for LLM) | `https://api.deepseek.com` | API base URL without trailing slash |
| `LLM_API_KEY` | Yes (for LLM) | `sk-...` | API key |
| `LLM_MODEL` | No | `deepseek-chat` | Model name (default: `deepseek-chat`) |
| `LLM_TIMEOUT_MS` | No | `8000` | Request timeout in ms |

When LLM credentials are missing or the call fails, `createPlan` / `revisePlan` fall back to the deterministic template adapter.

## Internal demo mini program jump

| Variable | Required | Example | Description |
| --- | --- | --- | --- |
| `DEMO_MP_APPID` | For demo jump | `wx88c4f0c87a9fa17f` | Target mini program AppID (defaults to Orbit AppID when unset) |
| `DEMO_MP_PATH_TRANSPORT` | No | `pages/home/home` | Path for `orbit_demo_transport` |
| `DEMO_MP_PATH_LODGING` | No | `pages/home/home` | Path for `orbit_demo_lodging` |
| `DEMO_MP_PATH_SHOPPING` | No | `pages/home/home` | Path for `orbit_demo_shopping` |

Demo tool records in PostgreSQL use `null` app_id/path; runtime resolves them from these variables in `resolveDemoProgram()`. For same-AppID self-navigation demo, set `DEMO_MP_APPID` to Orbit's AppID and point paths at an existing page (e.g. `pages/home/home`).

## Recommended DeepSeek setup

In CloudBase console → Cloud Functions → `createPlan` / `revisePlan` → Environment variables:

```
LLM_API_BASE=https://api.deepseek.com
LLM_API_KEY=<your-key>
LLM_MODEL=deepseek-chat
```

Optional for demo jump (same mini program):

```
DEMO_MP_APPID=wx88c4f0c87a9fa17f
DEMO_MP_PATH_TRANSPORT=pages/home/home
DEMO_MP_PATH_LODGING=pages/home/home
DEMO_MP_PATH_SHOPPING=pages/home/home
```

## PostgreSQL (existing)

| Variable | Default |
| --- | --- |
| `CLOUDBASE_PG_INSTANCE` | `pgdb-b0pp5mb7` |
| `CLOUDBASE_PG_DATABASE` | `public` |
