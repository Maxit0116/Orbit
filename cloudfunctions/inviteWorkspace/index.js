const crypto = require('crypto')
const {
  asText,
  assertCondition,
  findOne,
  insert,
  getOpenId,
  makeId,
  requireMember,
  handle
} = require('./_shared')

const INVITE_TTL_HOURS = 72

exports.main = async (event, context) => handle(async (input) => {
  const openid = getOpenId()
  const workspaceId = asText(input.workspaceId, 80)
  assertCondition(workspaceId, 'INVALID_ARGUMENT', '缺少 Workspace ID')
  const member = await requireMember(workspaceId, openid)
  assertCondition(member.role === 'owner', 'FORBIDDEN', '只有空间创建者可以邀请成员')
  const workspace = await findOne('workspaces', { id: workspaceId })
  assertCondition(workspace, 'NOT_FOUND', '任务空间不存在')

  const inviteToken = crypto.randomBytes(18).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex')
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000)
  const inviteId = makeId('invite')
  await insert('invites', {
    id: inviteId,
    workspace_id: workspaceId,
    token_hash: tokenHash,
    created_by: openid,
    expires_at: expiresAt,
    max_uses: Number(input.maxUses || 10),
    used_count: 0,
    status: 'active',
    created_at: new Date()
  })
  await insert('events', {
    id: makeId('event'),
    workspace_id: workspaceId,
    actor_id: openid,
    event_type: 'member.invited',
    payload_json: { text: '生成了新的协作邀请', inviteId },
    idempotency_key: `${workspaceId}:member.invited:${inviteId}`,
    created_at: new Date()
  })
  return {
    workspaceId,
    inviteToken,
    expiresAt: expiresAt.toISOString(),
    sharePath: `/pages/workspace/workspace?workspaceId=${workspaceId}&inviteToken=${inviteToken}`
  }
}, event, context)
