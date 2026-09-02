const TASK_TYPES = ['service_task', 'coordination_task', 'decision_task', 'tracking_task']
const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done', 'skipped']

function isValidDate(value) {
  return value === null || value === undefined || value === '' || !Number.isNaN(new Date(value).getTime())
}

function validateIntentDraft(plan) {
  const errors = []
  if (!plan || typeof plan !== 'object') errors.push('计划不是对象')
  if (plan && (!plan.title || typeof plan.title !== 'string')) errors.push('缺少计划标题')
  if (plan && (!plan.goal || typeof plan.goal !== 'string')) errors.push('缺少目标')
  if (plan && !Array.isArray(plan.tasks)) errors.push('缺少任务列表')
  if (plan && !isValidDate(plan.date)) errors.push('日期格式不合法')
  if (plan && plan.budgetLimit !== null && plan.budgetLimit !== undefined && (!Number.isFinite(Number(plan.budgetLimit)) || Number(plan.budgetLimit) < 0)) {
    errors.push('预算格式不合法')
  }
  if (plan && Array.isArray(plan.tasks)) {
    plan.tasks.forEach(task => {
      if (!task.title) errors.push('任务标题不能为空')
      if (!TASK_TYPES.includes(task.type)) errors.push(`任务类型不合法：${task.title || '未命名任务'}`)
    })
  }
  return { valid: errors.length === 0, errors }
}

function validateTaskUpdate(task) {
  return Boolean(task && task.title && TASK_TYPES.includes(task.type) && TASK_STATUSES.includes(task.status))
}

function validateServiceResult(result) {
  if (!result || typeof result !== 'object') return { valid: false, errors: ['结果格式不合法'] }
  const hasValue = ['serviceName', 'location', 'startsAt', 'endsAt', 'checkInAt', 'deliveryAt', 'price', 'amount', 'note']
    .some(key => result[key] !== undefined && result[key] !== null && result[key] !== '')
  return {
    valid: hasValue,
    errors: hasValue ? [] : ['至少填写一项结果']
  }
}

module.exports = {
  TASK_TYPES,
  TASK_STATUSES,
  validateIntentDraft,
  validateTaskUpdate,
  validateServiceResult
}
