const api = require('../../utils/api')
const { getWorkspace, getActiveWorkspaceId } = require('../../utils/store')

Page({
  data: {
    mockMode: false,
    workspace: {},
    workspaces: [],
    activeWorkspaces: [],
    completedWorkspaces: [],
    doneCount: 0,
    taskCount: 0,
    progress: 0,
    examples: [
      { id: 'new_year_reunion', mark: '家', title: '异地过年', copy: '把家人、年货和时间安排到一起', tone: 'warm' },
      { id: 'moving_home', mark: '迁', title: '搬家', copy: '从旧住址到新生活，一步步安排', tone: 'blue' },
      { id: 'friend_gathering', mark: '聚', title: '朋友聚会', copy: '预约、活动、AA，不再重复确认', tone: 'purple' }
    ]
  },

  onShow() {
    const app = getApp()
    this.setData({ mockMode: Boolean(app.globalData && app.globalData.mockMode) })
    this.refresh()
    this.loadWorkspaces()
  },

  refresh() {
    const workspace = getWorkspace(getActiveWorkspaceId()) || getWorkspace() || {}
    const tasks = workspace.tasks || []
    const doneCount = tasks.filter(task => task.status === 'done').length
    this.setData({
      workspace,
      doneCount,
      taskCount: tasks.length,
      progress: tasks.length ? Math.round(doneCount / tasks.length * 100) : 0
    })
  },

  loadWorkspaces() {
    api.listWorkspaces()
      .then(result => {
        const items = (result && result.items) || []
        const activeWorkspaces = items.filter(item => item.status !== 'completed')
        const completedWorkspaces = items.filter(item => item.status === 'completed')
        this.setData({ workspaces: items, activeWorkspaces, completedWorkspaces })
      })
      .catch(() => {})
  },

  openCreate() {
    wx.navigateTo({ url: '/pages/create/create' })
  },

  openWorkspace(event) {
    const workspaceId = event && event.currentTarget && event.currentTarget.dataset.id
    const url = workspaceId
      ? `/pages/workspace/workspace?workspaceId=${workspaceId}`
      : '/pages/workspace/workspace'
    wx.navigateTo({ url })
  },

  createFromExample(event) {
    const scenarioId = event.currentTarget.dataset.scenario
    wx.navigateTo({ url: `/pages/create/create?scenario=${scenarioId}` })
  }
})
