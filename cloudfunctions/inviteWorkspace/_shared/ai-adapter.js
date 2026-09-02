const { buildPlan } = require('./templates')

const SYSTEM_PROMPT = `你是 Orbit 任务工作空间的 Intent 解析器。只输出一个 JSON 对象，不要 markdown 代码块。

规则：
1. schemaVersion 固定为 "intent.v1"，planSchemaVersion 固定为 "plan.v1"
2. 不要虚构具体日期；无法从输入确定时 date 必须为 null
3. 不要虚构预算；无法确定时 budgetLimit 必须为 null
4. 不要输出任何小程序 AppID、path 或 shortLink
5. tasks 数组每项包含：title, type (service_task|coordination_task|decision_task|tracking_task), owner, description, requiredInputs, expectedOutputs, resultSchema, source ("template"|"llm"), enabled (true)
6. resultSchema 对服务任务使用 { "kind": "transport"|"lodging"|"shopping"|"meal"|"service"|"budget"|"assignment" }
7. assumptions 列出需要用户确认的假设；missingFields 列出缺失字段名
8. 保持中文标题和描述简洁`

function extractJson(text) {
  const raw = String(text || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : raw
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch (error) {
    return null
  }
}

function normalizeLlmPlan(parsed, rawInput, scenarioHint, version) {
  const fallback = buildPlan(rawInput, scenarioHint)
  if (!parsed || typeof parsed !== 'object') return null
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : fallback.tasks
  return {
    schemaVersion: 'intent.v1',
    planSchemaVersion: 'plan.v1',
    version: version || 1,
    rawInput: String(rawInput).slice(0, 240),
    scenario: parsed.scenario || fallback.scenario,
    title: String(parsed.title || fallback.title).slice(0, 80),
    goal: String(parsed.goal || fallback.goal).slice(0, 240),
    participants: Array.isArray(parsed.participants) ? parsed.participants : [],
    origins: Array.isArray(parsed.origins) ? parsed.origins : [],
    destination: parsed.destination || null,
    date: parsed.date || null,
    dateRange: parsed.dateRange || null,
    budgetLimit: parsed.budgetLimit === undefined ? fallback.budgetLimit : parsed.budgetLimit,
    serviceNeeds: Array.isArray(parsed.serviceNeeds) ? parsed.serviceNeeds : fallback.serviceNeeds,
    preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
    peopleLabel: String(parsed.peopleLabel || fallback.peopleLabel).slice(0, 120),
    locationsLabel: String(parsed.locationsLabel || fallback.locationsLabel).slice(0, 120),
    assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.slice(0, 8) : fallback.assumptions,
    missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields : fallback.missingFields,
    tasks: tasks.map((task, index) => ({
      id: task.id || `draft_task_${index + 1}`,
      title: String(task.title || `任务 ${index + 1}`).slice(0, 80),
      type: ['service_task', 'coordination_task', 'decision_task', 'tracking_task'].includes(task.type) ? task.type : 'service_task',
      tag: task.tag || '建议',
      owner: String(task.owner || '待分配').slice(0, 40),
      description: String(task.description || '').slice(0, 240),
      requiredInputs: Array.isArray(task.requiredInputs) ? task.requiredInputs : [],
      expectedOutputs: Array.isArray(task.expectedOutputs) ? task.expectedOutputs : [],
      resultSchema: task.resultSchema || { kind: 'service' },
      source: task.source || 'llm',
      enabled: task.enabled !== false,
      dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn : []
    })),
    needsConfirmation: true,
    adapter: 'external_llm'
  }
}

async function callLlm(rawInput, scenarioHint, currentPlan) {
  const apiBase = process.env.LLM_API_BASE
  const apiKey = process.env.LLM_API_KEY
  if (!apiBase || !apiKey) {
    return { ok: false, reason: 'missing_credentials' }
  }
  const model = process.env.LLM_MODEL || 'deepseek-chat'
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 8000)
  const userContent = currentPlan
    ? `原始输入：${rawInput}\n场景提示：${scenarioHint || 'auto'}\n当前计划版本：${currentPlan.version || 1}\n请根据用户最新意图修订计划，输出完整 JSON。`
    : `原始输入：${rawInput}\n场景提示：${scenarioHint || 'auto'}\n请输出完整 JSON 计划。`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${apiBase.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent }
        ]
      }),
      signal: controller.signal
    })
    clearTimeout(timer)
    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}` }
    }
    const payload = await response.json()
    const content = payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content
    const parsed = extractJson(content)
    if (!parsed) return { ok: false, reason: 'invalid_json' }
    return {
      ok: true,
      plan: normalizeLlmPlan(parsed, rawInput, scenarioHint, currentPlan ? Number(currentPlan.version || 1) + 1 : 1),
      model,
      usage: payload.usage || null
    }
  } catch (error) {
    clearTimeout(timer)
    return { ok: false, reason: error.name === 'AbortError' ? 'timeout' : 'network_error' }
  }
}

async function parseIntent(rawInput, scenarioHint, currentPlan) {
  const startedAt = Date.now()
  let attempt = await callLlm(rawInput, scenarioHint, currentPlan)
  if (!attempt.ok) {
    attempt = await callLlm(rawInput, scenarioHint, currentPlan)
  }
  if (attempt.ok && attempt.plan) {
    return {
      plan: attempt.plan,
      meta: {
        adapter: 'external_llm',
        model: attempt.model,
        durationMs: Date.now() - startedAt,
        status: 'ok',
        errorCode: null,
        usage: attempt.usage
      }
    }
  }
  const fallbackPlan = buildPlan(rawInput, scenarioHint)
  if (currentPlan) {
    fallbackPlan.version = Number(currentPlan.version || 1) + 1
  }
  return {
    plan: { ...fallbackPlan, adapter: 'template_fallback' },
    meta: {
      adapter: 'template_fallback',
      model: null,
      durationMs: Date.now() - startedAt,
      status: 'fallback',
      errorCode: attempt.reason || 'fallback',
      usage: null
    }
  }
}

module.exports = {
  parseIntent,
  extractJson,
  normalizeLlmPlan
}
