# Orbit Phase 0 Verification Log

This log records the evidence required before a capability becomes an MVP
dependency. A `pending` record must never produce a direct mini-program jump.

## Environment

- Checked at: 2026-09-01 (Phase 0–5 gap fill)
- Mini Program AppID: `wx88c4f0c87a9fa17f`
- CloudBase environment: `orbit-cloudbase-d7fieg8385dce685`
- Region: `ap-shanghai`
- Base library: `3.17.2`
- Runtime backend: PostgreSQL
- PostgreSQL instance: `pgdb-b0pp5mb7`
- iOS device: pending physical-device verification
- Android device: pending physical-device verification

## Capability matrix

| Capability | Status | Evidence / limitation | Fallback |
| --- | --- | --- | --- |
| Native mini-program jump | partial | Internal demo tools (`orbit_demo_*`) seeded; `DEMO_MP_APPID` resolves at runtime; iOS/Android not yet verified | Search phrase + manual capture |
| Return from external mini-program | partial | `pendingToolSession` + onShow resume prompt implemented | User returns and confirms |
| Read third-party page/order/login | not_available | No general API | User-confirmed structured result |
| PostgreSQL access from cloud functions | implemented, verified | RLS + anon role; seed migration applied (8 mini_program rows) | Local mock mode |
| Two-device realtime watch | partial | Workspace 页 5s 轮询 `getWorkspaceSnapshot`；真机双设备待验收 | Manual refresh |
| AI model channel | partial | `ai-adapter.js` supports OpenAI-compatible LLM; template fallback when credentials missing | Template adapter |
| Privacy authorization | partial | 网络状态监听；核心路径仍为文本输入 | Do not request unused permissions |
| Workspace list | implemented | `listWorkspaces` cloud function + home UI | Local cache |
| Plan revision | implemented | `revisePlan` + `plan.revised` via `updateWorkspace` | Local edit before create |
| Share & join | implemented | `inviteWorkspace` + `joinWorkspace` + `onShareAppMessage` | — |
| Task claim | implemented | `updateTask` action `claim` + UI | — |
| AI Guidance | partial | Rule-based `refreshWorkspaceGuidance` + accept/dismiss; LLM guidance deferred | Rule-only文案 |
| Single-user E2E | partial | Handoff + facts + guidance + collaboration APIs | Mock mode demo |

## Latest runtime evidence

- Intent regression (local template): **10/10 passed** via `node scripts/run-intent-regression.js`
- Phase 5 derived-state smoke: **5/5 passed** via `node scripts/run-phase5-smoke.js`
- Phase 6–8 P0: `inviteWorkspace`, `joinWorkspace`, `runGuidance`, `respondGuidance`; task `claim`; 5s polling sync; members UI; guidance accept/dismiss
- `invites` table migration `20260901140000` applied to PostgreSQL
- Cloud functions: **15 total** (11 existing + 4 new); deploy pending DevTools confirmation
- Demo script: `docs/demo-script.md` (3-minute storyboard)

## Tool verification records

- `transport_candidate` / `lodging_candidate` / `shopping_candidate` / `local_service_candidate`: pending, no AppID
- `orbit_manual_capture`: verified, manual capture only
- `orbit_demo_transport` / `orbit_demo_lodging` / `orbit_demo_shopping`: verified internal demo; AppID defaults to Orbit (`wx88c4f0c87a9fa17f`) when `DEMO_MP_APPID` unset

## Pending real-device gates

- iOS full demo path
- Android full demo path
- Verified external mini program jump on physical devices
- LLM channel 10/10 with live API credentials in cloud env

## Risk decisions

1. Orbit never treats opening another mini program as task completion.
2. Orbit never reads an arbitrary third-party page, order, session, or database.
3. Prices and schedules enter Context only after user confirmation.
4. Unverified tools always expose manual capture fallback.
