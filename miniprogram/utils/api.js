const mockData = require('./mock-data')
const { MOCK_MODE } = require('./config')

function callFunction(name, data) {
  return wx.cloud.callFunction({ name, data }).then(response => {
    const result = response && response.result
    if (!result || result.code !== 'OK') {
      const error = new Error(result && result.message ? result.message : '云函数调用失败')
      error.code = result && result.code
      error.requestId = result && result.requestId
      throw error
    }
    return result.data
  }).catch(error => {
    const rawMessage = error && error.errMsg ? error.errMsg : ''
    if (rawMessage.indexOf('-601034') !== -1) {
      error.message = '当前 AppID 尚未开通云开发，请在开发者工具中启用云开发后重试'
      error.code = 'CLOUD_NOT_ENABLED'
    } else if (rawMessage.indexOf('network') !== -1 || rawMessage.indexOf('timeout') !== -1) {
      error.message = '网络暂时不可用，已保留本地输入，请稍后重试'
      error.code = 'NETWORK_ERROR'
    }
    throw error
  })
}

function createPlan(rawInput, scenarioId) {
  if (MOCK_MODE) {
    return Promise.resolve(mockData.createPlan(rawInput, scenarioId))
  }
  return callFunction('createPlan', { rawInput, scenarioId, schemaVersion: 'intent.v1' })
}

function revisePlan(rawInput, plan, scenarioId) {
  if (MOCK_MODE) {
    return Promise.resolve(mockData.createPlan(rawInput || plan.rawInput, scenarioId || plan.scenario))
  }
  return callFunction('revisePlan', { rawInput, plan, scenarioId, schemaVersion: 'intent.v1' })
}

function createWorkspace(plan) {
  if (MOCK_MODE) {
    return Promise.resolve(mockData.createWorkspaceFromPlan(plan))
  }
  return callFunction('createWorkspace', { plan, schemaVersion: 'workspace.v1' })
}

function bootstrapUser(profile) {
  if (MOCK_MODE) return Promise.resolve({ id: 'demo-user', ...profile })
  return callFunction('authBootstrap', profile || {})
}

function getWorkspaceSnapshot(workspaceId) {
  if (MOCK_MODE) return Promise.resolve(require('./store').getWorkspace())
  return callFunction('getWorkspaceSnapshot', { workspaceId })
}

function listWorkspaces() {
  if (MOCK_MODE) {
    const workspace = require('./store').getWorkspace()
    return Promise.resolve({ items: workspace ? [{
      workspaceId: workspace.workspaceId || workspace.id,
      title: workspace.title,
      goal: workspace.goal,
      status: workspace.status || 'in_progress',
      progress: workspace.derived ? workspace.derived.progress : 0,
      updatedAt: workspace.updatedAt
    }] : [] })
  }
  return callFunction('listWorkspaces', {})
}

function submitTaskResult(data) {
  if (MOCK_MODE) {
    require('./store').addDemoResult(data.taskId)
    return Promise.resolve(require('./store').getWorkspace())
  }
  return callFunction('submitTaskResult', data)
}

function updateTask(data) {
  if (MOCK_MODE) return Promise.resolve(mockData.getWorkspace())
  return callFunction('updateTask', data)
}

function updateWorkspace(data) {
  if (MOCK_MODE) return Promise.resolve({ workspaceId: data.workspaceId, version: (data.version || 1) + 1 })
  return callFunction('updateWorkspace', data)
}

function recordToolOpened(data) {
  if (MOCK_MODE) return Promise.resolve({ recorded: true })
  return callFunction('updateTask', { ...data, action: 'tool.opened' })
}

function inviteWorkspace(workspaceId) {
  if (MOCK_MODE) {
    return Promise.resolve({
      workspaceId,
      inviteToken: 'demo-invite-token',
      sharePath: `/pages/workspace/workspace?workspaceId=${workspaceId}&inviteToken=demo-invite-token`
    })
  }
  return callFunction('inviteWorkspace', { workspaceId })
}

function joinWorkspace(workspaceId, inviteToken) {
  if (MOCK_MODE) return Promise.resolve({ workspaceId, role: 'member', joined: true })
  return callFunction('joinWorkspace', { workspaceId, inviteToken })
}

function runGuidance(workspaceId) {
  if (MOCK_MODE) return Promise.resolve(require('./store').getWorkspace())
  return callFunction('runGuidance', { workspaceId })
}

function respondGuidance(data) {
  if (MOCK_MODE) return Promise.resolve({ action: data.action, guidance: {} })
  return callFunction('respondGuidance', data)
}

function claimTask(data) {
  if (MOCK_MODE) return Promise.resolve({ taskId: data.taskId, claimed: true })
  return callFunction('updateTask', { ...data, action: 'claim' })
}

function matchTools(data) {
  if (MOCK_MODE) return Promise.resolve([])
  return callFunction('matchTools', data)
}

module.exports = {
  MOCK_MODE,
  callFunction,
  bootstrapUser,
  createPlan,
  revisePlan,
  createWorkspace,
  getWorkspaceSnapshot,
  listWorkspaces,
  submitTaskResult,
  updateTask,
  updateWorkspace,
  recordToolOpened,
  inviteWorkspace,
  joinWorkspace,
  runGuidance,
  respondGuidance,
  claimTask,
  matchTools
}
