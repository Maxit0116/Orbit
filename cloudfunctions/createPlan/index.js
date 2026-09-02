const { parseIntent } = require('./_shared/ai-adapter')
const {
  asText,
  assertCondition,
  insert,
  getOpenId,
  handle,
  makeId
} = require('./_shared')

async function recordAgentRun(openid, runType, meta, plan, requestId) {
  if (!openid) return
  const run = {
    id: makeId('run'),
    workspace_id: null,
    run_type: runType,
    adapter: meta.adapter,
    model: meta.model,
    input_version: 'intent.v1',
    output_json: {
      scenario: plan.scenario,
      missingFields: plan.missingFields,
      taskCount: plan.tasks.length,
      adapter: meta.adapter
    },
    input_tokens: meta.usage && meta.usage.prompt_tokens ? meta.usage.prompt_tokens : null,
    output_tokens: meta.usage && meta.usage.completion_tokens ? meta.usage.completion_tokens : null,
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
  assertCondition(rawInput.length >= 2, 'INVALID_ARGUMENT', '请输入至少两个字符')
  const scenarioId = input.scenarioId || input.scenario || undefined
  const { plan, meta } = await parseIntent(rawInput, scenarioId)
  const openid = getOpenId()
  await recordAgentRun(openid, 'intent_parse', meta, plan, requestId)
  return { ...plan, adapter: meta.adapter, requestId }
}, event, context)
