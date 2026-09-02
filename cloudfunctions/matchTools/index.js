const {
  asText,
  assertCondition,
  findMany,
  findOne,
  insert,
  update,
  getOpenId,
  makeId,
  normalizeJson,
  requireMember,
  resolveDemoProgram,
  handle
} = require('./_shared')

function taskCapability(task) {
  if (/交通|出行|搬家公司/.test(task.title)) return 'transport'
  if (/住宿|酒店/.test(task.title)) return 'lodging'
  if (/年货|家具|家电|采购/.test(task.title)) return 'shopping'
  if (/聚餐|餐厅|活动/.test(task.title)) return 'meal'
  if (/分工|安排|时间/.test(task.title)) return 'coordination'
  if (/预算|记账/.test(task.title)) return 'tracking'
  return task.task_type === 'service_task' ? 'service' : 'coordination'
}

function matchScore(program, task, knownInputs) {
  const supportedTasks = normalizeJson(program.supported_tasks, [])
  const requiredInputs = normalizeJson(program.required_inputs, [])
  const capability = taskCapability(task)
  const capabilityMatch = supportedTasks.includes(capability) ? 1 : 0
  const inputMatch = requiredInputs.length
    ? requiredInputs.filter(input => knownInputs.includes(input)).length / requiredInputs.length
    : 1
  const verification = program.verification_status === 'verified' ? 1 : 0
  const handoff = program.handoff_mode === 'manual_capture' || program.handoff_mode === 'navigate_and_manual_confirm' ? 1 : 0
  const demoBoost = String(program.id || '').startsWith('orbit_demo_') ? 0.05 : 0
  const manualPenalty = program.id === 'orbit_manual_capture' ? -0.2 : 0
  return capabilityMatch * 0.35 + inputMatch * 0.2 + 0.15 + verification * 0.15 + handoff * 0.15 + demoBoost + manualPenalty
}

exports.main = async (event, context) => handle(async (input) => {
  const workspaceId = asText(input.workspaceId, 80)
  const taskId = asText(input.taskId, 80)
  assertCondition(workspaceId && taskId, 'INVALID_ARGUMENT', '缺少工具匹配参数')
  await requireMember(workspaceId, getOpenId())
  const task = await findOne('tasks', { id: taskId, workspace_id: workspaceId })
  assertCondition(task, 'NOT_FOUND', '任务不存在')
  const knownInputs = Array.isArray(input.knownInputs) ? input.knownInputs : []
  const programs = await findMany('mini_programs')
  const candidates = programs
    .filter(program => {
      if (program.id === 'orbit_manual_capture') return true
      if (program.verification_status === 'verified') return true
      return false
    })
    .map(program => {
      const resolved = resolveDemoProgram(program)
      const requiredInputs = normalizeJson(program.required_inputs, [])
      const missingInputs = requiredInputs.filter(item => !knownInputs.includes(item))
      const score = matchScore(program, task, knownInputs) - missingInputs.length * 0.05
      return { program: resolved, score, missingInputs }
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
  const nonManual = candidates.filter(item => item.program.id !== 'orbit_manual_capture')
  const manual = candidates.find(item => item.program.id === 'orbit_manual_capture')
  const ordered = manual ? nonManual.concat([manual]) : nonManual
  await Promise.all(ordered.map(async (candidate, index) => {
    const row = {
      task_id: taskId,
      mini_program_id: candidate.program.id,
      rank: index + 1,
      match_reason: candidate.program.id === 'orbit_manual_capture'
        ? '当前任务没有可核验的外部入口，提供用户确认的手动记录。'
        : candidate.program.id.startsWith('orbit_demo_')
          ? `演示工具：按${task.title}的能力匹配，完成后需回到 Orbit 确认结果。`
          : `按${task.title}的能力、输入字段和核验状态匹配。`,
      missing_inputs: candidate.missingInputs,
      expected_output: normalizeJson(candidate.program.expected_outputs, []),
      availability: candidate.program.verification_status === 'verified'
        ? (candidate.program.handoff_mode === 'manual_capture' ? 'manual_capture' : 'available')
        : 'manual_capture',
      created_at: new Date()
    }
    const existing = await findOne('task_tools', { task_id: taskId, mini_program_id: candidate.program.id })
    if (existing) {
      return update('task_tools', row, { id: existing.id })
    }
    return insert('task_tools', { id: makeId('tool'), ...row })
  }))
  return ordered.map(candidate => ({
    id: candidate.program.id,
    name: candidate.program.name,
    appId: candidate.program.app_id,
    path: candidate.program.path,
    shortLink: candidate.program.short_link,
    category: candidate.program.category,
    verificationStatus: candidate.program.verification_status,
    score: Math.round(candidate.score * 100) / 100,
    missingInputs: candidate.missingInputs,
    expectedOutput: normalizeJson(candidate.program.expected_outputs, []),
    fallback: normalizeJson(candidate.program.fallback, {}),
    handoffMode: candidate.program.handoff_mode
  }))
}, event, context)
