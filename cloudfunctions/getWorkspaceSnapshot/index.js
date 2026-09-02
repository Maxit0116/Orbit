const {
  assertCondition,
  getOpenId,
  readWorkspaceBundle,
  enrichMembers,
  toClientBundle,
  handle
} = require('./_shared')

exports.main = async (event, context) => handle(async (input) => {
  const workspaceId = String(input.workspaceId || '')
  const openid = getOpenId()
  assertCondition(workspaceId, 'INVALID_ARGUMENT', '缺少 Workspace ID')
  const bundle = await readWorkspaceBundle(workspaceId, openid)
  bundle.members = await enrichMembers(bundle.members)
  return {
    ...toClientBundle(bundle, openid),
    peopleLabel: bundle.workspace.metadata && bundle.workspace.metadata.peopleLabel,
    locationsLabel: bundle.workspace.metadata && bundle.workspace.metadata.locationsLabel
  }
}, event, context)
