const {
  asMoney,
  asText,
  assertCondition,
  findOne,
  findMany,
  update,
  insert,
  getOpenId,
  makeId,
  requireMember,
  validateTask,
  normalizeJson,
  handle
} = require('./_shared')

const allowedStatuses = ['todo', 'in_progress', 'blocked', 'done', 'skipped']

exports.main = async (event, context) => handle(async (input) => {
  const openid = getOpenId()
  const workspaceId = asText(input.workspaceId, 80)
  const expectedVersion = Number(input.version)
  assertCondition(workspaceId && Number.isInteger(expectedVersion), 'INVALID_ARGUMENT', '缺少 Workspace 版本')
  const member = await requireMember(workspaceId, openid)
  const workspace = await findOne('workspaces', { id: workspaceId })
  assertCondition(workspace, 'NOT_FOUND', '任务空间不存在')

  if (Array.isArray(input.tasks) && input.tasks.length) {
    assertCondition(member.role === 'owner', 'FORBIDDEN', '只有空间创建者可以修订计划')
    const metadata = normalizeJson(workspace.metadata, {})
    const deletedTaskTitles = Array.isArray(metadata.deletedTaskTitles) ? metadata.deletedTaskTitles : []
    const existingTasks = await findMany('tasks', { workspace_id: workspaceId })
    const existingById = new Map(existingTasks.map(task => [task.id, task]))
    const now = new Date()
    for (const draft of input.tasks) {
      validateTask(draft)
      if (draft.enabled === false || draft.status === 'skipped') {
        if (draft.id && existingById.has(draft.id)) {
          await update('tasks', { status: 'skipped', updated_at: now }, { id: draft.id })
        } else if (draft.title) {
          deletedTaskTitles.push(draft.title)
        }
        continue
      }
      if (draft.id && existingById.has(draft.id)) {
        await update('tasks', {
          title: asText(draft.title, 80),
          description: asText(draft.description, 240),
          owner_label: asText(draft.owner || draft.ownerLabel, 40, '待分配'),
          status: allowedStatuses.includes(draft.status) ? draft.status : existingById.get(draft.id).status,
          updated_at: now
        }, { id: draft.id })
      } else {
        await insert('tasks', {
          id: makeId('task'),
          workspace_id: workspaceId,
          parent_id: null,
          title: asText(draft.title, 80),
          description: asText(draft.description, 240, ''),
          task_type: draft.type || 'service_task',
          status: 'todo',
          owner_id: null,
          owner_label: asText(draft.owner || draft.ownerLabel, 40, '待分配'),
          depends_on: Array.isArray(draft.dependsOn) ? draft.dependsOn : [],
          required_inputs: Array.isArray(draft.requiredInputs) ? draft.requiredInputs : [],
          expected_outputs: Array.isArray(draft.expectedOutputs) ? draft.expectedOutputs : [],
          result_schema: draft.resultSchema || {},
          source: 'user_added',
          sort_order: existingTasks.length + 1,
          version: 1,
          created_at: now,
          updated_at: now
        })
      }
    }
    const updatedWorkspace = await update('workspaces', {
      title: input.title ? asText(input.title, 80) : workspace.title,
      goal: input.goal ? asText(input.goal, 240) : workspace.goal,
      budget_limit: input.budgetLimit === undefined ? workspace.budget_limit : asMoney(input.budgetLimit),
      metadata: {
        ...metadata,
        peopleLabel: input.peopleLabel || metadata.peopleLabel,
        locationsLabel: input.locationsLabel || metadata.locationsLabel,
        deletedTaskTitles: [...new Set(deletedTaskTitles)],
        planVersion: (metadata.planVersion || 1) + 1
      },
      updated_at: now,
      version: expectedVersion + 1
    }, { id: workspaceId, version: expectedVersion })
    assertCondition(updatedWorkspace.length > 0, 'VERSION_CONFLICT', '空间已被更新，请刷新后重试')
    await insert('events', {
      id: makeId('event'),
      workspace_id: workspaceId,
      actor_id: openid,
      event_type: 'plan.revised',
      payload_json: { text: '修订了任务计划', taskCount: input.tasks.length },
      idempotency_key: `${workspaceId}:plan.revised:v${expectedVersion + 1}`,
      created_at: now
    })
    return { workspaceId, version: expectedVersion + 1, revised: true }
  }

  assertCondition(member.role === 'owner', 'FORBIDDEN', '只有空间创建者可以修改空间')
  const updated = await update('workspaces', {
    title: asText(input.title, 80, workspace.title),
    goal: asText(input.goal, 240, workspace.goal),
    budget_limit: input.budgetLimit === undefined ? workspace.budget_limit : asMoney(input.budgetLimit),
    updated_at: new Date(),
    version: expectedVersion + 1
  }, { id: workspaceId, version: expectedVersion })
  assertCondition(updated.length > 0, 'VERSION_CONFLICT', '空间已被更新，请刷新后重试')
  await insert('events', {
    id: makeId('event'),
    workspace_id: workspaceId,
    actor_id: openid,
    event_type: 'workspace.updated',
    payload_json: { text: '更新了任务空间信息' },
    idempotency_key: `${workspaceId}:workspace:v${expectedVersion + 1}`,
    created_at: new Date()
  })
  return { workspaceId, version: expectedVersion + 1 }
}, event, context)
