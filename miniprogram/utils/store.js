const { createPlan, createWorkspaceFromPlan } = require('./mock-data')

const STORAGE_KEY = 'orbit_workspace'
const ACTIVE_ID_KEY = 'orbit_active_workspace_id'

function seedWorkspace() {
  const existing = wx.getStorageSync(STORAGE_KEY)
  if (!existing) {
    const plan = createPlan('春节和家人一起回老家过年，安排交通、住宿、年货和家庭分工，预算6000')
    wx.setStorageSync(STORAGE_KEY, createWorkspaceFromPlan(plan))
  }
}

function getWorkspace(workspaceId) {
  if (workspaceId) {
    const cache = wx.getStorageSync(`${STORAGE_KEY}:${workspaceId}`)
    if (cache) return cache
  }
  return wx.getStorageSync(STORAGE_KEY) || null
}

function saveWorkspace(workspace) {
  const next = {
    ...workspace,
    updatedAt: new Date().toISOString()
  }
  const id = next.workspaceId || next.id
  if (id) {
    wx.setStorageSync(`${STORAGE_KEY}:${id}`, next)
    wx.setStorageSync(ACTIVE_ID_KEY, id)
  }
  wx.setStorageSync(STORAGE_KEY, next)
  return next
}

function getActiveWorkspaceId() {
  const workspace = getWorkspace()
  return wx.getStorageSync(ACTIVE_ID_KEY) || (workspace && (workspace.workspaceId || workspace.id)) || ''
}

function resetWorkspace(plan) {
  const next = createWorkspaceFromPlan(plan)
  wx.setStorageSync(STORAGE_KEY, next)
  return next
}

function toggleTask(taskId) {
  const workspace = getWorkspace()
  if (!workspace) return null
  const now = new Date().toISOString()
  const tasks = workspace.tasks.map(task => {
    if (task.id !== taskId) return task
    const done = task.status !== 'done'
    return {
      ...task,
      status: done ? 'done' : 'todo',
      completedAt: done ? now : null
    }
  })
  const task = tasks.find(item => item.id === taskId)
  const event = {
    id: `event_${Date.now()}`,
    type: task.status === 'done' ? 'task.completed' : 'task.reopened',
    text: `${task.title}${task.status === 'done' ? '已完成' : '重新打开'}`,
    at: '刚刚'
  }
  return saveWorkspace({ ...workspace, tasks, events: [event, ...workspace.events] })
}

function addDemoResult(taskId) {
  const workspace = getWorkspace()
  if (!workspace) return null
  const now = new Date().toISOString()
  const resultMap = {
    task_2: { label: '交通方案', value: '12 月 28 日 09:00 到达', cost: 2080 },
    task_3: { label: '住宿安排', value: '12 月 28 日 14:00 入住', cost: 680 },
    task_4: { label: '配送时间', value: '12 月 29 日 18:00 送达', cost: 900 },
    task_5: { label: '聚餐安排', value: '12 月 28 日 18:00', cost: 520 },
    task_6: { label: '当前支出', value: '¥4,180', cost: 4180 }
  }
  const task = workspace.tasks.find(item => item.id === taskId)
  if (!task) return workspace
  const result = resultMap[taskId] || {
    label: '服务结果',
    value: '已由用户确认',
    cost: 0
  }
  const tasks = workspace.tasks.map(task => task.id === taskId
    ? { ...task, status: 'done', completedAt: now, result }
    : task)
  const facts = [
    ...workspace.facts.filter(fact => fact.key !== `task.${taskId}`),
    { key: `task.${taskId}`, label: result.label, value: result.value, source: '用户确认', at: '刚刚' }
  ]
  const event = {
    id: `event_${Date.now()}`,
    type: 'fact.confirmed',
    text: `确认了${result.label}：${result.value}`,
    at: '刚刚'
  }
  const guidance = taskId === 'task_4'
    ? {
      title: '发现一个时间依赖',
      text: '聚餐在 12 月 28 日 18:00，年货要到 12 月 29 日 18:00 才送达。建议让一位成员先在本地采购当天食材。'
    }
    : workspace.guidance
  return saveWorkspace({ ...workspace, tasks, facts, guidance, events: [event, ...workspace.events] })
}

module.exports = {
  seedWorkspace,
  getWorkspace,
  saveWorkspace,
  getActiveWorkspaceId,
  resetWorkspace,
  toggleTask,
  addDemoResult
}
