const cloud = require('wx-server-sdk')
const cloudbase = require('@cloudbase/node-sdk')
const { buildRuleGuidance, mergeGuidanceStatus } = require('./guidance')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const app = cloudbase.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = app.rdb({
  instance: process.env.CLOUDBASE_PG_INSTANCE || 'pgdb-b0pp5mb7',
  database: process.env.CLOUDBASE_PG_DATABASE || 'public'
})

const TASK_TYPES = ['service_task', 'coordination_task', 'decision_task', 'tracking_task']
const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done', 'skipped']
const SOURCE_TYPES = ['user_input', 'user_confirmed', 'partner_return', 'manual_capture']

function getOpenId() {
  const context = cloud.getWXContext()
  return context && (context.OPENID || context.openId || context.openid)
}

function getRequestId(context) {
  return (context && (context.request_id || context.requestId)) || `req_${Date.now()}`
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function success(data, requestId) {
  return {
    requestId,
    code: 'OK',
    data,
    message: 'success'
  }
}

function failure(code, message, requestId, details) {
  return {
    requestId,
    code,
    data: details || null,
    message
  }
}

function assertCondition(condition, code, message) {
  if (!condition) {
    const error = new Error(message)
    error.code = code
    throw error
  }
}

function asText(value, maxLength, fallback = '') {
  const text = value === undefined || value === null ? fallback : String(value)
  return text.slice(0, maxLength)
}

function asMoney(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  assertCondition(Number.isFinite(number) && number >= 0 && number <= 100000000, 'INVALID_AMOUNT', '金额格式不合法')
  return Math.round(number * 100) / 100
}

function asDate(value) {
  if (value === null || value === undefined || value === '') return null
  const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)
    ? value.replace(' ', 'T')
    : value
  const date = new Date(normalized)
  assertCondition(!Number.isNaN(date.getTime()), 'INVALID_DATE', '日期格式不合法')
  return date.toISOString()
}

function validateTask(task) {
  assertCondition(task && asText(task.title, 80), 'INVALID_TASK', '任务标题不能为空')
  assertCondition(TASK_TYPES.includes(task.type || task.taskType), 'INVALID_TASK_TYPE', '任务类型不合法')
  assertCondition(!task.status || TASK_STATUSES.includes(task.status), 'INVALID_TASK_STATUS', '任务状态不合法')
  if (task.dependsOn) {
    assertCondition(Array.isArray(task.dependsOn), 'INVALID_DEPENDENCY', '任务依赖必须是数组')
  }
  return true
}

function validateSourceType(sourceType) {
  assertCondition(SOURCE_TYPES.includes(sourceType), 'INVALID_SOURCE', '结果来源不合法')
}

async function query(table, builder) {
  const response = await builder
  if (response.error) {
    const error = new Error(response.error.message || `DATABASE_${table}_ERROR`)
    error.code = response.error.code || 'DATABASE_ERROR'
    throw error
  }
  return response.data || []
}

async function insert(table, values) {
  return query(table, db.from(table).insert(values).select())
}

async function update(table, values, filters) {
  let request = db.from(table).update(values)
  Object.keys(filters || {}).forEach(key => {
    request = request.eq(key, filters[key])
  })
  return query(table, request.select())
}

async function findOne(table, filters) {
  let request = db.from(table).select('*')
  Object.keys(filters || {}).forEach(key => {
    request = request.eq(key, filters[key])
  })
  const rows = await query(table, request.limit(1))
  return rows[0] || null
}

async function findMany(table, filters, options = {}) {
  let request = db.from(table).select('*')
  Object.keys(filters || {}).forEach(key => {
    request = request.eq(key, filters[key])
  })
  if (options.order) request = request.order(options.order, { ascending: options.ascending !== false })
  if (options.limit) request = request.limit(options.limit)
  return query(table, request)
}

async function requireMember(workspaceId, openid) {
  assertCondition(openid, 'UNAUTHENTICATED', '请先完成微信登录')
  const member = await findOne('workspace_members', { workspace_id: workspaceId, user_id: openid, status: 'active' })
  assertCondition(member, 'FORBIDDEN', '你没有权限访问这个任务空间')
  return member
}

async function readWorkspaceBundle(workspaceId, openid) {
  await requireMember(workspaceId, openid)
  const workspace = await findOne('workspaces', { id: workspaceId })
  assertCondition(workspace, 'NOT_FOUND', '任务空间不存在')
  const [tasks, members, facts, events, tools, miniPrograms] = await Promise.all([
    findMany('tasks', { workspace_id: workspaceId }, { order: 'sort_order' }),
    findMany('workspace_members', { workspace_id: workspaceId }, { order: 'joined_at' }),
    findMany('facts', { workspace_id: workspaceId, is_current: true }, { order: 'captured_at', ascending: false }),
    findMany('events', { workspace_id: workspaceId }, { order: 'created_at', ascending: false, limit: 100 }),
    findMany('task_tools', {}, { order: 'rank' }),
    findMany('mini_programs', {}, { order: 'name' })
  ])
  const taskIds = new Set(tasks.map(task => task.id))
  const miniProgramById = new Map(miniPrograms.map(program => [program.id, program]))
  return {
    workspace,
    members,
    tasks,
    facts,
    events,
    tools: tools
      .filter(tool => taskIds.has(tool.task_id))
      .map(tool => ({ ...tool, mini_program: miniProgramById.get(tool.mini_program_id) || null }))
  }
}

function normalizeJson(value, fallback) {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch (error) {
      return fallback
    }
  }
  return value
}

function computeDerived(bundle) {
  const tasks = bundle.tasks || []
  const facts = bundle.facts || []
  const budgetUsed = facts.reduce((sum, fact) => {
    const value = normalizeJson(fact.value_json, {})
    const amount = Number(value.price ?? value.amount ?? value.cost)
    return Number.isFinite(amount) && amount >= 0 ? sum + amount : sum
  }, 0)
  const doneCount = tasks.filter(task => task.status === 'done').length
  const requiredOpenTasks = tasks.filter(task => task.status !== 'done' && task.status !== 'skipped')
  const unassignedTasks = requiredOpenTasks.filter(task => !task.owner_id && (!task.owner_label || task.owner_label === '待分配' || task.owner_label === '未分配'))
  const findings = []
  if (bundle.workspace && bundle.workspace.budget_limit !== null && budgetUsed > Number(bundle.workspace.budget_limit)) {
    findings.push({ code: 'budget_over_limit', severity: 'high', message: '已确认支出超过预算上限' })
  }
  const taskById = new Map(tasks.map(task => [task.id, task]))
  tasks.forEach(task => {
    const dependencies = normalizeJson(task.depends_on, [])
    if (task.status !== 'done' && Array.isArray(dependencies) && dependencies.some(id => taskById.get(id) && taskById.get(id).status !== 'done')) {
      findings.push({ code: 'task_dependency_not_done', severity: 'medium', taskId: task.id, message: `${task.title} 依赖的任务尚未完成` })
    }
  })
  if (unassignedTasks.length) {
    findings.push({ code: 'unassigned_required_task', severity: 'medium', taskIds: unassignedTasks.map(task => task.id), message: '仍有必需任务没有负责人' })
  }
  const timeFacts = facts.map(fact => ({ fact, value: normalizeJson(fact.value_json, {}) }))
  const arrival = timeFacts.find(item => item.value.arrivalAt || item.value.arrivesAt)
  const checkIn = timeFacts.find(item => item.value.checkInAt)
  if (arrival && checkIn && new Date(arrival.value.arrivalAt || arrival.value.arrivesAt) > new Date(checkIn.value.checkInAt)) {
    findings.push({ code: 'arrival_after_check_in', severity: 'high', message: '到达时间晚于入住时间' })
  }
  const delivery = timeFacts.find(item => item.value.deliveryAt)
  const meal = timeFacts.find(item => item.value.startsAt && /meal|聚餐|family\.meal/i.test(item.fact.key))
  if (delivery && meal && new Date(delivery.value.deliveryAt) > new Date(meal.value.startsAt)) {
    findings.push({ code: 'delivery_after_meal', severity: 'high', message: '年货送达晚于家庭聚餐时间' })
  }
  const nextTask = tasks.find(task => task.status !== 'done' && task.status !== 'skipped')
  return {
    progress: tasks.length ? Math.round(doneCount / tasks.length * 100) : 0,
    doneCount,
    taskCount: tasks.length,
    budgetUsed: Math.round(budgetUsed * 100) / 100,
    budgetRemaining: bundle.workspace && bundle.workspace.budget_limit !== null
      ? Math.round((Number(bundle.workspace.budget_limit) - budgetUsed) * 100) / 100
      : null,
    findings,
    nextAction: nextTask ? `下一步：${nextTask.title}` : '所有任务已完成',
    unassignedTaskCount: unassignedTasks.length,
    updatedAt: new Date().toISOString()
  }
}

function resolveDemoProgram(program) {
  if (!program || !String(program.id || '').startsWith('orbit_demo_')) return program
  const appId = process.env.DEMO_MP_APPID || 'wx88c4f0c87a9fa17f'
  const pathMap = {
    orbit_demo_transport: process.env.DEMO_MP_PATH_TRANSPORT || 'pages/home/home',
    orbit_demo_lodging: process.env.DEMO_MP_PATH_LODGING || 'pages/home/home',
    orbit_demo_shopping: process.env.DEMO_MP_PATH_SHOPPING || 'pages/home/home'
  }
  const demoPath = pathMap[program.id] || program.path || 'pages/home/home'
  return {
    ...program,
    app_id: appId || null,
    path: demoPath || null
  }
}

function toClientTask(task, taskTools) {
  const toolRows = (taskTools || []).filter(tool => tool.task_id === task.id)
  return {
    id: task.id,
    title: task.title,
    type: task.task_type,
    tag: task.source === 'user_added'
      ? '用户新增'
      : task.task_type === 'service_task' ? '服务' : task.task_type === 'coordination_task' ? '协作' : task.task_type === 'decision_task' ? '先确认' : '追踪',
    owner: task.owner_label,
    ownerId: task.owner_id,
    description: task.description,
    dependsOn: normalizeJson(task.depends_on, []),
    requiredInputs: normalizeJson(task.required_inputs, []),
    expectedOutputs: normalizeJson(task.expected_outputs, []),
    resultSchema: normalizeJson(task.result_schema, {}),
    source: task.source,
    status: task.status,
    version: task.version,
    tools: toolRows.map(tool => {
      const program = resolveDemoProgram(tool.mini_program)
      return {
      id: tool.mini_program_id,
      name: program ? program.name : 'Orbit 手动记录',
      appId: program ? program.app_id : null,
      path: program ? program.path : null,
      shortLink: program ? program.short_link : null,
      category: program ? program.category : 'orbit',
      verificationStatus: program ? program.verification_status : 'verified',
      fallback: program ? normalizeJson(program.fallback, {}) : { manualCaptureEnabled: true },
      handoffMode: program ? program.handoff_mode : 'manual_capture',
      rank: tool.rank,
      reason: tool.match_reason,
      missingInputs: normalizeJson(tool.missing_inputs, []),
      expectedOutput: normalizeJson(tool.expected_output, []),
      availability: tool.availability
    }
    })
  }
}

async function enrichMembers(members) {
  const rows = await Promise.all((members || []).map(member => findOne('users', { id: member.user_id })))
  const userById = new Map(rows.filter(Boolean).map(user => [user.id, user]))
  return (members || []).map(member => ({
    userId: member.user_id,
    role: member.role,
    status: member.status,
    joinedAt: member.joined_at,
    nickname: (userById.get(member.user_id) || {}).nickname || '成员',
    avatarUrl: (userById.get(member.user_id) || {}).avatar_url || null
  }))
}

async function refreshWorkspaceGuidance(workspaceId, openid, bundleInput) {
  const bundle = bundleInput || await readWorkspaceBundle(workspaceId, openid)
  const derived = computeDerived(bundle)
  bundle.derived = derived
  const workspace = bundle.workspace
  const metadata = normalizeJson(workspace.metadata, {})
  const nextGuidance = mergeGuidanceStatus(metadata.guidance, buildRuleGuidance(bundle, derived))
  const now = new Date()
  await update('workspaces', {
    metadata: { ...metadata, guidance: nextGuidance },
    updated_at: now
  }, { id: workspaceId })
  bundle.workspace = { ...workspace, metadata: { ...metadata, guidance: nextGuidance } }
  return bundle
}

function toClientBundle(bundle, viewerOpenId) {
  const derived = bundle.derived || computeDerived(bundle)
  const metadata = normalizeJson(bundle.workspace.metadata, {})
  const storedGuidance = normalizeJson(metadata.guidance, null)
  const firstFinding = derived.findings[0]
  const fallbackGuidance = firstFinding
    ? { title: '发现一个需要处理的风险', text: firstFinding.message, status: 'active' }
    : { title: '先确认关键约束', text: derived.nextAction, status: 'active' }
  const guidance = storedGuidance && storedGuidance.text
    ? {
      id: storedGuidance.id,
      title: storedGuidance.title,
      text: storedGuidance.text,
      evidenceIds: storedGuidance.evidenceIds || [],
      findingCodes: storedGuidance.findingCodes || [],
      confidence: storedGuidance.confidence || 'medium',
      adapter: storedGuidance.adapter || 'rule',
      status: storedGuidance.status || 'active',
      requiresConfirmation: storedGuidance.requiresConfirmation !== false
    }
    : fallbackGuidance
  return {
    id: bundle.workspace.id,
    workspaceId: bundle.workspace.id,
    title: bundle.workspace.title,
    goal: bundle.workspace.goal,
    scenario: bundle.workspace.scenario,
    budgetLimit: bundle.workspace.budget_limit === null ? null : Number(bundle.workspace.budget_limit),
    status: bundle.workspace.status,
    version: bundle.workspace.version,
    createdAt: bundle.workspace.created_at,
    updatedAt: bundle.workspace.updated_at,
    tasks: bundle.tasks.map(task => {
      const clientTask = toClientTask(task, bundle.tools)
      const fact = bundle.facts.find(item => item.task_id === task.id)
      if (fact) {
        const value = normalizeJson(fact.value_json, {})
        clientTask.result = {
          label: value.serviceName || fact.key,
          value: value.displayValue || value.location || value.startsAt || value.deliveryAt || (value.price !== undefined ? `¥${value.price}` : ''),
          cost: value.price || value.amount || 0
        }
      }
      return clientTask
    }),
    facts: bundle.facts.map(fact => ({
      id: fact.id,
      key: fact.key,
      taskId: fact.task_id,
      value: normalizeJson(fact.value_json, {}),
      label: normalizeJson(fact.value_json, {}).label || fact.key,
      displayValue: (() => {
        const value = normalizeJson(fact.value_json, {})
        return value.displayValue || value.value || value.location || value.serviceName || value.deliveryAt || value.startsAt || (value.price !== undefined ? `¥${value.price}` : fact.key)
      })(),
      source: fact.source_type,
      sourceRef: fact.source_ref,
      confirmedBy: fact.confirmed_by,
      capturedAt: fact.captured_at
    })),
    events: bundle.events.map(event => ({
      id: event.id,
      type: event.event_type,
      payload: normalizeJson(event.payload_json, {}),
      text: normalizeJson(event.payload_json, {}).text || event.event_type,
      at: event.created_at
    })),
    members: (bundle.members || []).map(member => ({
      userId: member.userId || member.user_id,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt || member.joined_at,
      nickname: member.nickname || '成员',
      avatarUrl: member.avatarUrl || member.avatar_url || null,
      isMe: viewerOpenId ? (member.userId || member.user_id) === viewerOpenId : false
    })),
    derived,
    guidance,
    peopleLabel: normalizeJson(bundle.workspace.metadata, {}).peopleLabel || '参与者待确认',
    locationsLabel: normalizeJson(bundle.workspace.metadata, {}).locationsLabel || '地点待确认'
  }
}

async function handle(main, event, context) {
  const requestId = getRequestId(context)
  try {
    const data = await main(event || {}, context || {}, requestId)
    return success(data, requestId)
  } catch (error) {
    const code = error.code || 'INTERNAL_ERROR'
    const safeMessages = {
      INVALID_ARGUMENT: '请求参数不合法',
      INVALID_PLAN: '计划内容不合法',
      UNAUTHENTICATED: '请先完成微信登录',
      FORBIDDEN: '你没有权限执行此操作',
      NOT_FOUND: '内容不存在',
      VERSION_CONFLICT: '数据已更新，请刷新后重试',
      DUPLICATE_REQUEST: '请求已处理，请刷新查看结果',
      DATABASE_ERROR: '数据暂时无法保存，请稍后重试'
    }
    console.error(`[${requestId}] ${code}`, error.message)
    return failure(code, safeMessages[code] || '操作失败，请稍后重试', requestId)
  }
}

module.exports = {
  app,
  cloud,
  db,
  TASK_TYPES,
  TASK_STATUSES,
  SOURCE_TYPES,
  getOpenId,
  getRequestId,
  makeId,
  success,
  failure,
  assertCondition,
  asText,
  asMoney,
  asDate,
  validateTask,
  validateSourceType,
  query,
  insert,
  update,
  findOne,
  findMany,
  requireMember,
  readWorkspaceBundle,
  normalizeJson,
  computeDerived,
  enrichMembers,
  refreshWorkspaceGuidance,
  toClientBundle,
  resolveDemoProgram,
  handle
}
