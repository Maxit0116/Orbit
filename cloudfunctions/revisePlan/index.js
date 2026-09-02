const { parseIntent } = require('./_shared/ai-adapter')
const {
  asText,
  assertCondition,
  insert,
  getOpenId,
  handle,
  makeId
} = require('./_shared')

async function recordAgentRun(openid, meta, plan, requestId) {
  if (!openid) return
  const run = {
    id: makeId('run'),
    workspace_id: null,
    run_type: 'plan_revise',
    adapter: meta.adapter,
    model: meta.model,
    input_version: 'intent.v1',
    output_json: {
      scenario: plan.scenario,
      version: plan.version,
      taskCount: plan.tasks.length
    },
    duration_ms: meta.durationMs,
    status: meta.status,
    error_code: meta.errorCode,
    created_at: new Date()
  }
  try {
    await insert('agent_runs', run)
  } catch (error) {
    console.error(`[${requestId}] agent_runs write skipped`, error.message)
  }
}

exports.main = async (event, context) => handle(async (input, runtime, requestId) => {
  const rawInput = asText(input.rawInput, 240).trim()
  const currentPlan = input.plan
  assertCondition(rawInput.length >= 2 || currentPlan, 'INVALID_ARGUMENT', '请提供输入或当前计划')
  const scenarioId = input.scenarioId || (currentPlan && currentPlan.scenario) || undefined
  const { plan, meta } = await parseIntent(rawInput || (currentPlan && currentPlan.rawInput) || '', scenarioId, currentPlan)
  const openid = getOpenId()
  await recordAgentRun(openid, meta, plan, requestId)
  return { ...plan, adapter: meta.adapter, revised: true, requestId }
}, event, context)
