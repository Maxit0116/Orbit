const {
  asDate,
  asMoney,
  asText,
  assertCondition,
  findOne,
  insert,
  update,
  getOpenId,
  makeId,
  readWorkspaceBundle,
  toClientBundle,
  enrichMembers,
  refreshWorkspaceGuidance,
  validateSourceType,
  handle
} = require('./_shared')

function normalizeResult(result) {
  assertCondition(result && typeof result === 'object' && !Array.isArray(result), 'INVALID_RESULT', '结果格式不合法')
  const normalized = {
    serviceName: asText(result.serviceName, 80),
    location: asText(result.location, 160),
    startsAt: asDate(result.startsAt),
    endsAt: asDate(result.endsAt),
    checkInAt: asDate(result.checkInAt),
    deliveryAt: asDate(result.deliveryAt),
    price: asMoney(result.price),
    participants: result.participants === undefined ? null : Number(result.participants),
    amount: asMoney(result.amount),
    note: asText(result.note, 240)
  }
  assertCondition(normalized.participants === null || (Number.isInteger(normalized.participants) && normalized.participants > 0 && normalized.participants <= 10000), 'INVALID_PEOPLE_COUNT', '人数格式不合法')
  assertCondition(normalized.serviceName || normalized.location || normalized.startsAt || normalized.deliveryAt || normalized.price !== null || normalized.amount !== null, 'INVALID_RESULT', '至少填写一项服务结果')
  return normalized
}

function resolveFactKey(task) {
  if (/聚餐|餐厅|meal/i.test(task.title)) return 'family.meal'
  if (/年货|采购|shopping/i.test(task.title)) return 'family.shopping'
  if (/交通|出行|transport/i.test(task.title)) return 'family.transport'
  if (/住宿|酒店|lodging/i.test(task.title)) return 'family.lodging'
  return `task.${task.id}`
}

exports.main = async (event, context) => handle(async (input) => {
  const openid = getOpenId()
  const workspaceId = asText(input.workspaceId, 80)
  const taskId = asText(input.taskId, 80)
  const idempotencyKey = asText(input.idempotencyKey, 120)
  assertCondition(workspaceId && taskId && idempotencyKey, 'INVALID_ARGUMENT', '缺少结果提交参数')
  const member = await require('./_shared').requireMember(workspaceId, openid)
  const task = await findOne('tasks', { id: taskId, workspace_id: workspaceId })
  assertCondition(task, 'NOT_FOUND', '任务不存在')
  assertCondition(task.owner_id === null || task.owner_id === openid || member.role === 'owner', 'FORBIDDEN', '你不能提交这个任务的结果')
  const sourceType = input.sourceType || 'user_confirmed'
  validateSourceType(sourceType)
  const existingFact = await findOne('facts', { workspace_id: workspaceId, idempotency_key: idempotencyKey })
  if (existingFact) {
    const existingBundle = await readWorkspaceBundle(workspaceId, openid)
    existingBundle.members = await enrichMembers(existingBundle.members)
    return { ...toClientBundle(existingBundle, openid), duplicate: true }
  }
  const result = normalizeResult(input.result)
  const now = new Date()
  const factId = makeId('fact')
  const factKey = resolveFactKey(task)
  await update('facts', { is_current: false }, { workspace_id: workspaceId, key: factKey, is_current: true })
  await insert('facts', {
    id: factId,
    workspace_id: workspaceId,
    task_id: taskId,
    key: factKey,
    value_json: result,
    source_type: sourceType,
    source_ref: asText(input.sourceRef, 160, 'manual_result_form'),
    confidence: 'confirmed',
    captured_at: now,
    confirmed_by: openid,
    is_current: true,
    idempotency_key: idempotencyKey
  })
  const updatedTasks = await update('tasks', {
    status: 'done',
    version: Number(task.version || 1) + 1,
    updated_at: now
  }, { id: taskId, version: Number(task.version || 1) })
  assertCondition(updatedTasks.length > 0, 'VERSION_CONFLICT', '任务已被更新，请刷新后重试')
  await insert('events', {
    id: makeId('event'),
    workspace_id: workspaceId,
    actor_id: openid,
    event_type: 'fact.confirmed',
    payload_json: { factId, taskId, text: `确认了${task.title}的服务结果` },
    idempotency_key: `${workspaceId}:fact:${idempotencyKey}`,
    created_at: now
  })
  const workspace = await findOne('workspaces', { id: workspaceId })
  if (workspace) {
    await update('workspaces', {
      version: Number(workspace.version || 1) + 1,
      updated_at: now
    }, { id: workspaceId, version: Number(workspace.version || 1) })
  }
  const bundle = await refreshWorkspaceGuidance(workspaceId, openid)
  bundle.members = await enrichMembers(bundle.members)
  await insert('events', {
    id: makeId('event'),
    workspace_id: workspaceId,
    actor_id: openid,
    event_type: 'guidance.generated',
    payload_json: {
      text: '根据最新事实更新了建议',
      findingCodes: (bundle.workspace.metadata && bundle.workspace.metadata.guidance && bundle.workspace.metadata.guidance.findingCodes) || []
    },
    idempotency_key: `${workspaceId}:guidance:${factId}`,
    created_at: now
  })
  return toClientBundle(bundle, openid)
}, event, context)
