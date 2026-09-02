const {
  asText,
  assertCondition,
  findOne,
  update,
  insert,
  getOpenId,
  makeId,
  requireMember,
  handle
} = require('./_shared')

const allowedStatuses = ['todo', 'in_progress', 'blocked', 'done', 'skipped']

exports.main = async (event, context) => handle(async (input) => {
  const openid = getOpenId()
  const workspaceId = asText(input.workspaceId, 80)
  const taskId = asText(input.taskId, 80)
  assertCondition(workspaceId && taskId, 'INVALID_ARGUMENT', '缺少任务参数')
  const member = await requireMember(workspaceId, openid)
  const task = await findOne('tasks', { id: taskId, workspace_id: workspaceId })
  assertCondition(task, 'NOT_FOUND', '任务不存在')
  assertCondition(member.role === 'owner' || !task.owner_id || task.owner_id === openid, 'FORBIDDEN', '你不能修改这个任务')

  if (input.action === 'tool.opened') {
    const toolId = asText(input.toolId, 80)
    await insert('events', {
      id: makeId('event'),
      workspace_id: workspaceId,
      actor_id: openid,
      event_type: 'tool.opened',
      payload_json: { taskId, toolId, text: `打开了任务工具：${task.title}` },
      idempotency_key: `${workspaceId}:tool.opened:${taskId}:${toolId}:${Date.now()}`,
      created_at: new Date()
    })
    return { taskId, toolId, recorded: true }
  }

  if (input.action === 'claim') {
    assertCondition(task.status !== 'done' && task.status !== 'skipped', 'FORBIDDEN', '该任务无法认领')
    assertCondition(!task.owner_id || task.owner_id === openid, 'FORBIDDEN', '任务已有负责人')
    const user = await findOne('users', { id: openid })
    const ownerLabel = asText(input.ownerLabel, 40, (user && user.nickname) || '成员')
    const expectedVersion = Number(input.version || task.version || 1)
    const updated = await update('tasks', {
      owner_id: openid,
      owner_label: ownerLabel,
      status: task.status === 'todo' ? 'in_progress' : task.status,
      updated_at: new Date(),
      version: expectedVersion + 1
    }, { id: taskId, version: expectedVersion })
    assertCondition(updated.length > 0, 'VERSION_CONFLICT', '任务已被更新，请刷新后重试')
    await insert('events', {
      id: makeId('event'),
      workspace_id: workspaceId,
      actor_id: openid,
      event_type: 'task.assigned',
      payload_json: { taskId, ownerLabel, text: `认领了任务：${task.title}` },
      idempotency_key: `${workspaceId}:task.assigned:${taskId}:${openid}`,
      created_at: new Date()
    })
    return { taskId, ownerId: openid, ownerLabel, version: expectedVersion + 1 }
  }

  const nextStatus = input.status || task.status
  assertCondition(allowedStatuses.includes(nextStatus), 'INVALID_TASK_STATUS', '任务状态不合法')
  if (nextStatus === 'done') {
    assertCondition(task.task_type !== 'service_task' || input.confirmedResult === true, 'RESULT_CONFIRM_REQUIRED', '服务任务需要确认结果后才能完成')
  }
  const expectedVersion = Number(input.version || task.version || 1)
  const payload = {
    title: asText(input.title, 80, task.title),
    description: asText(input.description, 240, task.description),
    owner_label: asText(input.ownerLabel, 40, task.owner_label),
    status: nextStatus,
    updated_at: new Date(),
    version: expectedVersion + 1
  }
  const updated = await update('tasks', payload, { id: taskId, version: expectedVersion })
  assertCondition(updated.length > 0, 'VERSION_CONFLICT', '任务已被更新，请刷新后重试')
  await insert('events', {
    id: makeId('event'),
    workspace_id: workspaceId,
    actor_id: openid,
    event_type: nextStatus === 'skipped' ? 'task.skipped' : 'task.updated',
    payload_json: { taskId, status: nextStatus, text: `更新了任务：${payload.title}` },
    idempotency_key: `${workspaceId}:task:${taskId}:v${payload.version}`,
    created_at: new Date()
  })
  return { taskId, version: payload.version, status: nextStatus }
}, event, context)
