const {
  asMoney,
  asDate,
  asText,
  assertCondition,
  getOpenId,
  findOne,
  insert,
  makeId,
  validateTask,
  handle,
  readWorkspaceBundle,
  enrichMembers,
  toClientBundle
} = require('./_shared')

function assertPlan(plan) {
  assertCondition(plan && asText(plan.title, 80), 'INVALID_PLAN', '计划标题不能为空')
  assertCondition(Array.isArray(plan.tasks) && plan.tasks.length > 0, 'INVALID_PLAN', '计划至少需要一个任务')
  assertCondition(plan.tasks.length <= 30, 'TOO_MANY_TASKS', '任务数量不能超过 30')
  plan.tasks.forEach(validateTask)
}

exports.main = async (event, context) => handle(async (input) => {
  const plan = input.plan
  assertPlan(plan)
  const openid = getOpenId()
  assertCondition(openid, 'UNAUTHENTICATED', '请先完成微信登录')
  const now = new Date()
  const workspaceId = makeId('ws')
  const workspace = {
    id: workspaceId,
    owner_id: openid,
    title: asText(plan.title, 80),
    goal: asText(plan.goal, 240),
    scenario: asText(plan.scenario, 40, 'generic_task'),
    status: 'in_progress',
    budget_limit: asMoney(plan.budgetLimit),
    start_at: asDate(plan.date),
    end_at: plan.dateRange && plan.dateRange.end ? asDate(plan.dateRange.end) : null,
    metadata: {
      peopleLabel: asText(plan.peopleLabel, 120, '参与者待确认'),
      locationsLabel: asText(plan.locationsLabel, 120, '地点待确认'),
      rawInput: asText(plan.rawInput, 240)
    },
    version: 1,
    created_at: now,
    updated_at: now
  }
  await insert('workspaces', workspace)
  await insert('workspace_members', {
    id: makeId('member'),
    workspace_id: workspaceId,
    user_id: openid,
    role: 'owner',
    status: 'active',
    joined_at: now
  })
  const tasks = plan.tasks.filter(task => task.enabled !== false).map((task, index) => ({
    id: makeId('task'),
    workspace_id: workspaceId,
    parent_id: null,
    title: asText(task.title, 80),
    description: asText(task.description, 240),
    task_type: task.type || 'service_task',
    status: 'todo',
    owner_id: task.owner === '我' ? openid : null,
    owner_label: asText(task.owner, 40, '待分配'),
    depends_on: Array.isArray(task.dependsOn) ? task.dependsOn : [],
    required_inputs: Array.isArray(task.requiredInputs) ? task.requiredInputs : [],
    expected_outputs: Array.isArray(task.expectedOutputs) ? task.expectedOutputs : [],
    result_schema: task.resultSchema || {},
    source: task.source || 'user_confirmed',
    sort_order: index,
    version: 1,
    created_at: now,
    updated_at: now
  }))
  await Promise.all(tasks.map(task => insert('tasks', task)))
  const manualProgram = await findOne('mini_programs', { id: 'orbit_manual_capture' })
  if (manualProgram) {
    await Promise.all(tasks.map(task => insert('task_tools', {
      id: makeId('tool'),
      task_id: task.id,
      mini_program_id: manualProgram.id,
      rank: 1,
      match_reason: '当前工具尚未完成真机核验，提供安全的用户手动记录入口。',
      missing_inputs: [],
      expected_output: ['userConfirmedResult'],
      availability: 'manual_capture',
      created_at: now
    })))
  }
  await insert('facts', {
    id: makeId('fact'),
    workspace_id: workspaceId,
    task_id: null,
    key: 'intent.participants',
    value_json: { label: '参与者', value: workspace.metadata.peopleLabel },
    source_type: 'user_confirmed',
    source_ref: 'confirmed_plan',
    confidence: 'confirmed',
    captured_at: now,
    confirmed_by: openid,
    is_current: true,
    idempotency_key: `${workspaceId}:intent.participants`
  })
  if (workspace.budget_limit !== null) {
    await insert('facts', {
      id: makeId('fact'),
      workspace_id: workspaceId,
      task_id: null,
      key: 'budget.limit',
      value_json: { label: '预算上限', value: `¥${workspace.budget_limit}`, limit: Number(workspace.budget_limit) },
      source_type: 'user_confirmed',
      source_ref: 'confirmed_plan',
      confidence: 'confirmed',
      captured_at: now,
      confirmed_by: openid,
      is_current: true,
      idempotency_key: `${workspaceId}:budget.limit`
    })
  }
  await insert('events', {
    id: makeId('event'),
    workspace_id: workspaceId,
    actor_id: openid,
    event_type: 'workspace.created',
    payload_json: { title: workspace.title, text: '创建了一个新的任务空间' },
    idempotency_key: `${workspaceId}:workspace.created`,
    created_at: now
  })
  await insert('events', {
    id: makeId('event'),
    workspace_id: workspaceId,
    actor_id: openid,
    event_type: 'plan.confirmed',
    payload_json: { taskCount: tasks.length, text: '确认了初始任务计划' },
    idempotency_key: `${workspaceId}:plan.confirmed`,
    created_at: now
  })
  const bundle = await readWorkspaceBundle(workspaceId, openid)
  bundle.members = await enrichMembers(bundle.members)
  return {
    ...toClientBundle(bundle, openid),
    peopleLabel: workspace.metadata.peopleLabel,
    locationsLabel: workspace.metadata.locationsLabel
  }
}, event, context)
