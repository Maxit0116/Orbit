const crypto = require('crypto')
const {
  asText,
  assertCondition,
  findOne,
  insert,
  update,
  getOpenId,
  makeId,
  handle
} = require('./_shared')

exports.main = async (event, context) => handle(async (input) => {
  const openid = getOpenId()
  assertCondition(openid, 'UNAUTHENTICATED', '请先完成微信登录')
  const workspaceId = asText(input.workspaceId, 80)
  const inviteToken = asText(input.inviteToken, 120)
  assertCondition(workspaceId && inviteToken, 'INVALID_ARGUMENT', '缺少加入参数')

  const workspace = await findOne('workspaces', { id: workspaceId })
  assertCondition(workspace, 'NOT_FOUND', '任务空间不存在')

  const tokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex')
  const invite = await findOne('invites', { workspace_id: workspaceId, token_hash: tokenHash, status: 'active' })
  assertCondition(invite, 'FORBIDDEN', '邀请无效或已失效')
  assertCondition(new Date(invite.expires_at).getTime() > Date.now(), 'FORBIDDEN', '邀请已过期')
  assertCondition(Number(invite.used_count) < Number(invite.max_uses), 'FORBIDDEN', '邀请已达到使用上限')

  const existing = await findOne('workspace_members', { workspace_id: workspaceId, user_id: openid })
  if (existing && existing.status === 'active') {
    return { workspaceId, role: existing.role, joined: false, alreadyMember: true }
  }

  const now = new Date()
  if (existing) {
    await update('workspace_members', { role: 'member', status: 'active', joined_at: now }, { id: existing.id })
  } else {
    await insert('workspace_members', {
      id: makeId('member'),
      workspace_id: workspaceId,
      user_id: openid,
      role: 'member',
      status: 'active',
      joined_at: now
    })
  }
  await update('invites', { used_count: Number(invite.used_count) + 1 }, { id: invite.id })
  await insert('events', {
    id: makeId('event'),
    workspace_id: workspaceId,
    actor_id: openid,
    event_type: 'member.joined',
    payload_json: { text: '加入了任务空间' },
    idempotency_key: `${workspaceId}:member.joined:${openid}:${invite.id}`,
    created_at: now
  })
  return { workspaceId, role: 'member', joined: true, alreadyMember: false }
}, event, context)
