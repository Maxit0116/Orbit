-- Seed mini program knowledge base and internal demo tools.

insert into public.mini_programs (
  id, name, app_id, path, short_link, category,
  capabilities, supported_tasks, target_users, geographic_scope,
  required_inputs, expected_outputs, handoff_mode,
  verification, verification_status, last_checked_at, fallback, updated_at
) values
(
  'transport_candidate', '交通出行候选', null, null, null, 'transport',
  '["transport_search"]'::jsonb, '["transport"]'::jsonb, '["organizer","family"]'::jsonb, '["china"]'::jsonb,
  '["date","origins","destination","participants"]'::jsonb,
  '["serviceName","startsAt","endsAt","price","location"]'::jsonb,
  'manual_capture',
  '{"status":"pending","lastCheckedAt":null,"checkedOnDevice":false,"source":"phase0_pending"}'::jsonb,
  'pending', null,
  '{"searchPhrase":"查询跨城交通","manualCaptureEnabled":true}'::jsonb, now()
),
(
  'lodging_candidate', '住宿服务候选', null, null, null, 'lodging',
  '["lodging_search"]'::jsonb, '["lodging"]'::jsonb, '["organizer","family"]'::jsonb, '["china"]'::jsonb,
  '["date","destination","participants"]'::jsonb,
  '["serviceName","startsAt","endsAt","price","location"]'::jsonb,
  'manual_capture',
  '{"status":"pending","lastCheckedAt":null,"checkedOnDevice":false,"source":"phase0_pending"}'::jsonb,
  'pending', null,
  '{"searchPhrase":"查询住宿服务","manualCaptureEnabled":true}'::jsonb, now()
),
(
  'shopping_candidate', '年货采购候选', null, null, null, 'shopping',
  '["shopping_delivery"]'::jsonb, '["shopping"]'::jsonb, '["organizer","family"]'::jsonb, '["china"]'::jsonb,
  '["date","destination"]'::jsonb,
  '["serviceName","deliveryAt","price","location"]'::jsonb,
  'manual_capture',
  '{"status":"pending","lastCheckedAt":null,"checkedOnDevice":false,"source":"phase0_pending"}'::jsonb,
  'pending', null,
  '{"searchPhrase":"查询年货配送","manualCaptureEnabled":true}'::jsonb, now()
),
(
  'local_service_candidate', '本地生活候选', null, null, null, 'local_service',
  '["meal_booking","local_shopping"]'::jsonb, '["meal","coordination"]'::jsonb, '["organizer","family"]'::jsonb, '["china"]'::jsonb,
  '["date","destination","participants"]'::jsonb,
  '["serviceName","startsAt","price","location"]'::jsonb,
  'manual_capture',
  '{"status":"pending","lastCheckedAt":null,"checkedOnDevice":false,"source":"phase0_pending"}'::jsonb,
  'pending', null,
  '{"searchPhrase":"查询本地生活服务","manualCaptureEnabled":true}'::jsonb, now()
),
(
  'orbit_manual_capture', 'Orbit 手动记录', null, null, null, 'orbit',
  '["manual_capture"]'::jsonb,
  '["transport","lodging","shopping","meal","coordination","tracking"]'::jsonb,
  '["organizer","family","team"]'::jsonb, '["any"]'::jsonb,
  '[]'::jsonb, '["userConfirmedResult"]'::jsonb,
  'manual_capture',
  '{"status":"verified","lastCheckedAt":"2026-08-31","checkedOnDevice":false,"source":"internal_capability"}'::jsonb,
  'verified', '2026-08-31'::timestamptz,
  '{"searchPhrase":null,"manualCaptureEnabled":true}'::jsonb, now()
),
(
  'orbit_demo_transport', '演示 · 交通查询', null, null, null, 'transport',
  '["transport_search"]'::jsonb, '["transport"]'::jsonb, '["organizer","family"]'::jsonb, '["china"]'::jsonb,
  '["date","origins","destination"]'::jsonb,
  '["serviceName","startsAt","endsAt","price","location"]'::jsonb,
  'navigate_and_manual_confirm',
  '{"status":"verified","lastCheckedAt":"2026-09-01","checkedOnDevice":false,"source":"internal_demo"}'::jsonb,
  'verified', now(),
  '{"searchPhrase":"查询跨城交通","manualCaptureEnabled":true}'::jsonb, now()
),
(
  'orbit_demo_lodging', '演示 · 住宿预订', null, null, null, 'lodging',
  '["lodging_search"]'::jsonb, '["lodging"]'::jsonb, '["organizer","family"]'::jsonb, '["china"]'::jsonb,
  '["date","destination","participants"]'::jsonb,
  '["serviceName","checkInAt","price","location"]'::jsonb,
  'navigate_and_manual_confirm',
  '{"status":"verified","lastCheckedAt":"2026-09-01","checkedOnDevice":false,"source":"internal_demo"}'::jsonb,
  'verified', now(),
  '{"searchPhrase":"查询住宿服务","manualCaptureEnabled":true}'::jsonb, now()
),
(
  'orbit_demo_shopping', '演示 · 年货采购', null, null, null, 'shopping',
  '["shopping_delivery"]'::jsonb, '["shopping"]'::jsonb, '["organizer","family"]'::jsonb, '["china"]'::jsonb,
  '["date","destination"]'::jsonb,
  '["serviceName","deliveryAt","price","location"]'::jsonb,
  'navigate_and_manual_confirm',
  '{"status":"verified","lastCheckedAt":"2026-09-01","checkedOnDevice":false,"source":"internal_demo"}'::jsonb,
  'verified', now(),
  '{"searchPhrase":"查询年货配送","manualCaptureEnabled":true}'::jsonb, now()
)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  capabilities = excluded.capabilities,
  supported_tasks = excluded.supported_tasks,
  required_inputs = excluded.required_inputs,
  expected_outputs = excluded.expected_outputs,
  handoff_mode = excluded.handoff_mode,
  verification = excluded.verification,
  verification_status = excluded.verification_status,
  fallback = excluded.fallback,
  updated_at = now();
