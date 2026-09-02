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

function buildGuidanceContext(bundle) {
  const workspace = bundle.workspace || {}
  const metadata = normalizeJson(workspace.metadata, {})
  const facts = (bundle.facts || []).map(fact => ({
    id: fact.id,
    key: fact.key,
    taskId: fact.task_id,
    value: normalizeJson(fact.value_json, {}),
    capturedAt: fact.captured_at
  }))
  const openTasks = (bundle.tasks || [])
    .filter(task => task.status !== 'done' && task.status !== 'skipped')
    .map(task => ({
      id: task.id,
      title: task.title,
      ownerLabel: task.owner_label,
      ownerId: task.owner_id,
      status: task.status
    }))
  return {
    goal: workspace.goal || workspace.title,
    budgetLimit: workspace.budget_limit === null ? null : Number(workspace.budget_limit),
    peopleLabel: metadata.peopleLabel || '参与者待确认',
    locationsLabel: metadata.locationsLabel || '地点待确认',
    confirmedFacts: facts,
    openTasks,
    findings: bundle.derived ? bundle.derived.findings : []
  }
}

function buildRuleGuidance(bundle, derived) {
  const findings = derived.findings || []
  const facts = bundle.facts || []
  const openTasks = (bundle.tasks || []).filter(task => task.status !== 'done' && task.status !== 'skipped')
  const unassigned = openTasks.filter(task => !task.owner_id && (!task.owner_label || task.owner_label === '待分配' || task.owner_label === '未分配'))

  if (!findings.length && !unassigned.length) {
    return {
      id: null,
      title: '当前进展正常',
      text: derived.nextAction || '继续推进下一项任务。',
      evidenceIds: facts.slice(0, 3).map(f => f.id),
      findingCodes: [],
      confidence: 'medium',
      adapter: 'rule',
      requiresConfirmation: false
    }
  }

  const primary = findings[0]
  const evidenceIds = facts
    .filter(fact => {
      if (primary.code === 'delivery_after_meal') {
        return /meal|shopping|聚餐|年货/i.test(fact.key)
      }
      if (primary.code === 'budget_over_limit') {
        return /price|amount|budget|transport|lodging|shopping/i.test(fact.key)
      }
      return true
    })
    .slice(0, 4)
    .map(f => f.id)

  let text = primary ? primary.message : derived.nextAction
  if (unassigned.length) {
    const names = unassigned.map(task => task.title).join('、')
    text = `${text}。另有未分配负责人任务：${names}，建议邀请成员认领。`
  }
  if (primary && primary.code === 'delivery_after_meal') {
    text = `${text} 建议由一名成员在本地采购当天食材，或将聚餐时间调整到年货送达之后。`
  }

  return {
    id: `guid_${Date.now()}`,
    title: primary ? '发现一个需要处理的风险' : '协作建议',
    text,
    evidenceIds,
    findingCodes: findings.map(item => item.code),
    confidence: primary && primary.severity === 'high' ? 'high' : 'medium',
    adapter: 'rule',
    requiresConfirmation: Boolean(primary)
  }
}

function mergeGuidanceStatus(previous, next) {
  const prev = normalizeJson(previous, {})
  if (prev.status === 'accepted' || prev.status === 'dismissed') {
    if (prev.findingCodes && next.findingCodes
      && JSON.stringify(prev.findingCodes) === JSON.stringify(next.findingCodes)) {
      return { ...next, status: prev.status, respondedAt: prev.respondedAt }
    }
  }
  return { ...next, status: 'active', respondedAt: null }
}

module.exports = {
  buildGuidanceContext,
  buildRuleGuidance,
  mergeGuidanceStatus
}
