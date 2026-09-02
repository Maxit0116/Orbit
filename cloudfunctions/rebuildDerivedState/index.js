const {
  asText,
  assertCondition,
  getOpenId,
  readWorkspaceBundle,
  computeDerived,
  handle
} = require('./_shared')

exports.main = async (event, context) => handle(async (input) => {
  const workspaceId = asText(input.workspaceId, 80)
  assertCondition(workspaceId, 'INVALID_ARGUMENT', '缺少 Workspace ID')
  const bundle = await readWorkspaceBundle(workspaceId, getOpenId())
  return computeDerived(bundle)
}, event, context)
