const {
  assertCondition,
  getOpenId,
  findOne,
  findMany,
  handle,
  computeDerived,
  normalizeJson
} = require('./_shared')

exports.main = async (event, context) => handle(async () => {
  const openid = getOpenId()
  assertCondition(openid, 'UNAUTHENTICATED', '请先完成微信登录')
  const members = await findMany('workspace_members', { user_id: openid, status: 'active' })
  if (!members.length) return { items: [] }
  const items = []
  for (const member of members) {
    const workspace = await findOne('workspaces', { id: member.workspace_id })
    if (!workspace) continue
    const tasks = await findMany('tasks', { workspace_id: workspace.id }, { order: 'sort_order' })
    const doneCount = tasks.filter(task => task.status === 'done').length
    const derived = computeDerived({ workspace, tasks, facts: [] })
    const metadata = normalizeJson(workspace.metadata, {})
    items.push({
      workspaceId: workspace.id,
      title: workspace.title,
      goal: workspace.goal,
      scenario: workspace.scenario,
      status: workspace.status,
      progress: derived.progress,
      doneCount,
      taskCount: tasks.length,
      budgetUsed: derived.budgetUsed,
      budgetLimit: workspace.budget_limit === null ? null : Number(workspace.budget_limit),
      peopleLabel: metadata.peopleLabel || '参与者待确认',
      updatedAt: workspace.updated_at,
      createdAt: workspace.created_at
    })
  }
  items.sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
  return { items }
}, event, context)
