const {
  asText,
  assertCondition,
  findOne,
  insert,
  update,
  getOpenId,
  makeId,
  requireMember,
  normalizeJson,
  handle
} = require('./_shared')

const allowedActions = ['accept', 'dismiss']

exports.main = async (event, context) => handle(async (input) => {
  const openid = getOpenId()
  const workspaceId = asText(input.workspaceId, 80)
  const action = asText(input.action, 20)
  const guidanceId = asText(input.guidanceId, 80)
  assertCondition(workspaceId && allowedActions.includes(action), 'INVALID_ARGUMENT', '缺少建议反馈参数')
  await requireMember(workspaceId, openid)
  const workspace = await findOne('workspaces', { id: workspaceId })
  assertCondition(workspace, 'NOT_FOUND', '任务空间不存在')
  const metadata = normalizeJson(workspace.metadata, {})
  const guidance = normalizeJson(metadata.guidance, {})
  assertCondition(guidance && guidance.text, 'NOT_FOUND', '当前没有可反馈的建议')
  if (guidanceId) {
    assertCondition(!guidance.id || guidance.id === guidanceId, 'VERSION_CONFLICT', '建议已更新，请刷新后重试')
  }
  const now = new Date()
  const nextGuidance = {
    ...guidance,
    status: action === 'accept' ? 'accepted' : 'dismissed',
    respondedAt: now.toISOString(),
    respondedBy: openid
  }
  await update('workspaces', {
    metadata: { ...metadata, guidance: nextGuidance },
    updated_at: now
  }, { id: workspaceId })
  await insert('events', {
    id: makeId('event'),
    workspace_id: workspaceId,
    actor_id: openid,
    event_type: action === 'accept' ? 'guidance.accepted' : 'guidance.dismissed',
    payload_json: {
      text: action === 'accept' ? '采纳了 AI 建议' : '忽略了 AI 建议',
      guidanceId: guidance.id || null,
      findingCodes: guidance.findingCodes || []
    },
    idempotency_key: `${workspaceId}:guidance.${action}:${guidance.id || 'current'}:${openid}`,
    created_at: now
  })
  return { workspaceId, action, guidance: nextGuidance }
}, event, context)
