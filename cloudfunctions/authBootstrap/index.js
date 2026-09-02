const crypto = require('crypto')
const {
  asText,
  getOpenId,
  findOne,
  insert,
  update,
  makeId,
  assertCondition,
  handle
} = require('./_shared')

exports.main = async (event, context) => handle(async (input) => {
  const openid = getOpenId()
  assertCondition(openid, 'UNAUTHENTICATED', '请先完成微信登录')
  const existing = await findOne('users', { id: openid })
  const nickname = asText(input.nickname, 40, 'Orbit 用户') || 'Orbit 用户'
  const avatarUrl = asText(input.avatarUrl, 500) || null
  const openidHash = crypto.createHash('sha256').update(openid).digest('hex')
  if (existing) {
    await update('users', { nickname, avatar_url: avatarUrl, openid_hash: openidHash, updated_at: new Date() }, { id: openid })
  } else {
    await insert('users', {
      id: openid,
      openid_hash: openidHash,
      nickname,
      avatar_url: avatarUrl,
      created_at: new Date(),
      updated_at: new Date()
    })
  }
  return {
    id: openid,
    nickname,
    avatarUrl,
    bootstrapped: !existing,
    requestId: makeId('auth')
  }
}, event, context)
