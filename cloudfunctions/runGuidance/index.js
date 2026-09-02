const {
  asText,
  assertCondition,
  getOpenId,
  insert,
  makeId,
  requireMember,
  readWorkspaceBundle,
  enrichMembers,
  refreshWorkspaceGuidance,
  toClientBundle,
  handle
} = require('./_shared')

exports.main = async (event, context) => handle(async (input) => {
  const openid = getOpenId()
  const workspaceId = asText(input.workspaceId, 80)
  assertCondition(workspaceId, 'INVALID_ARGUMENT', '缺少 Workspace ID')
  await requireMember(workspaceId, openid)
  const bundle = await refreshWorkspaceGuidance(workspaceId, openid)
  bundle.members = await enrichMembers(bundle.members)
  const guidance = bundle.workspace.metadata && bundle.workspace.metadata.guidance
  await insert('events', {
    id: makeId('event'),
    workspace_id: workspaceId,
    actor_id: openid,
    event_type: 'guidance.generated',
    payload_json: {
      text: '刷新了 AI 建议',
      findingCodes: guidance && guidance.findingCodes ? guidance.findingCodes : []
    },
    idempotency_key: `${workspaceId}:guidance.manual:${Date.now()}`,
    created_at: new Date()
  })
  return toClientBundle(bundle, openid)
}, event, context)
