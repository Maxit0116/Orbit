const {
  getWorkspace,
  saveWorkspace,
  resetWorkspace,
  toggleTask,
  addDemoResult,
  getActiveWorkspaceId
} = require('../../utils/store')
const { createPlan } = require('../../utils/mock-data')
const { getResultFields, buildScheduleItems } = require('../../utils/result-form')
const api = require('../../utils/api')

Page({
  data: {
    workspaceId: '',
    workspace: {
      tasks: [],
      facts: [],
      events: [],
      guidance: {}
    },
    progress: 0,
    doneCount: 0,
    taskCount: 0,
    openCount: 0,
    budgetUsed: 0,
    budgetPercent: 0,
    nextAction: '先确认日期、参与者和所在城市',
    scheduleItems: [],
    showRisk: true,
    syncing: false,
    syncLabel: '未同步',
    showResultForm: false,
    resultTaskId: '',
    resultFields: [],
    resultDraft: {},
    allTasks: [],
    showPlanSheet: false,
    planDraft: [],
    planSaving: false,
    members: [],
    isOwner: false,
    shareInvitePath: '',
    inviteToken: '',
    offline: false,
    guidanceStatus: 'active'
  },

  onLoad(options) {
    const workspaceId = options.workspaceId || getActiveWorkspaceId() || ''
    const inviteToken = options.inviteToken || ''
    this.setData({ workspaceId, inviteToken })
    if (!api.MOCK_MODE && workspaceId && inviteToken) {
      this.joinWithInvite(workspaceId, inviteToken)
    }
  },

  onShow() {
    this.syncOfflineState()
    this.refresh()
    this.resumePendingToolSession()
    this.startPolling()
  },

  onUnload() {
    this.stopPolling()
  },

  onShareAppMessage() {
    const workspace = this.data.workspace
  const path = this.data.shareInvitePath
      || (this.data.workspaceId
        ? `/pages/workspace/workspace?workspaceId=${this.data.workspaceId}`
        : '/pages/home/home')
    return {
      title: workspace.title ? `一起完成：${workspace.title}` : '加入我的 Orbit 任务空间',
      path
    }
  },

  syncOfflineState() {
    const app = getApp()
    const offline = app.globalData && app.globalData.networkAvailable === false
    this.setData({ offline })
  },

  startPolling() {
    this.stopPolling()
    if (api.MOCK_MODE || !this.data.workspaceId) return
    this.pollTimer = setInterval(() => {
      if (!this.data.syncing) this.refresh({ silent: true })
    }, 5000)
  },

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  },

  joinWithInvite(workspaceId, inviteToken) {
    api.joinWorkspace(workspaceId, inviteToken)
      .then(result => {
        if (result.joined) {
          wx.showToast({ title: '已加入任务空间', icon: 'success' })
        }
        this.refresh()
      })
      .catch(error => wx.showToast({ title: error.message || '无法加入空间', icon: 'none' }))
  },

  prefetchShareInvite(workspaceId, members) {
    if (api.MOCK_MODE || !workspaceId) return
    const me = (members || []).find(member => member.isMe)
    if (!me || me.role !== 'owner') return
    api.inviteWorkspace(workspaceId)
      .then(result => {
        if (result && result.sharePath) {
          this.setData({ shareInvitePath: result.sharePath })
        }
      })
      .catch(() => {})
  },

  resumePendingToolSession() {
    const pending = wx.getStorageSync('pendingToolSession')
    if (!pending || !pending.taskId) return
    if (pending.workspaceId && this.data.workspaceId && pending.workspaceId !== this.data.workspaceId) return
    wx.showModal({
      title: '填写刚才的操作结果？',
      content: '你刚从外部工具返回，可以把确认后的结构化结果写回 Workspace。',
      confirmText: '去填写',
      cancelText: '稍后',
      success: result => {
        if (result.confirm) this.openResultForm(pending.taskId)
        wx.removeStorageSync('pendingToolSession')
      }
    })
  },

  refresh(options = {}) {
    const silent = Boolean(options.silent)
    const workspaceId = this.data.workspaceId
    const cached = getWorkspace(workspaceId)
    if (!cached && !workspaceId) return
    if (!api.MOCK_MODE && workspaceId) {
      if (!silent) this.setData({ syncing: true, syncLabel: '正在同步' })
      api.getWorkspaceSnapshot(workspaceId)
        .then(workspace => {
          saveWorkspace(workspace)
          this.applyWorkspace(workspace)
        })
        .catch(error => {
          if (!silent) {
            this.setData({ syncLabel: `未同步${error.requestId ? ` · ${error.requestId}` : ''}` })
            if (cached) this.applyWorkspace(cached)
            wx.showToast({ title: error.message || '暂时无法同步，已显示最近快照', icon: 'none' })
          }
        })
        .finally(() => {
          if (!silent) this.setData({ syncing: false })
        })
      return
    }
    if (cached) this.applyWorkspace(cached)
  },

  applyWorkspace(workspace) {
    if (!workspace) return
    const allTasks = workspace.tasks || []
    const tasks = allTasks.filter(task => task.status !== 'skipped')
    const doneCount = tasks.filter(task => task.status === 'done').length
    const budgetUsed = workspace.derived
      ? workspace.derived.budgetUsed
      : tasks.reduce((sum, task) => sum + (task.result && task.result.cost ? task.result.cost : 0), 0)
    const budgetPercent = workspace.budgetLimit ? Math.min(100, Math.round(budgetUsed / workspace.budgetLimit * 100)) : 0
    const nextAction = workspace.derived && workspace.derived.nextAction
      ? workspace.derived.nextAction
      : '先确认日期、参与者和所在城市'
    const members = workspace.members || []
    const me = members.find(member => member.isMe)
    const guidance = workspace.guidance || {}
    this.setData({
      workspace: { ...workspace, tasks },
      allTasks,
      members,
      isOwner: Boolean(me && me.role === 'owner'),
      guidanceStatus: guidance.status || 'active',
      workspaceId: workspace.workspaceId || workspace.id || this.data.workspaceId,
      doneCount,
      taskCount: tasks.length,
      openCount: tasks.length - doneCount,
      progress: tasks.length ? Math.round(doneCount / tasks.length * 100) : 0,
      budgetUsed,
      budgetPercent,
      nextAction,
      scheduleItems: buildScheduleItems(workspace.facts),
      showRisk: Boolean(guidance.text && guidance.status !== 'dismissed'),
      syncLabel: api.MOCK_MODE ? '本地演示' : (this.data.offline ? '离线快照' : '已同步 · 自动刷新')
    })
    this.prefetchShareInvite(workspace.workspaceId || workspace.id, members)
  },

  goBack() {
    wx.navigateBack()
  },

  toggleTask(event) {
    const taskId = event.currentTarget.dataset.id
    const task = this.data.workspace.tasks.find(item => item.id === taskId)
    if (!task) return
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    if (!api.MOCK_MODE && nextStatus === 'done' && task.type === 'service_task' && !task.result) {
      wx.showToast({ title: '先确认服务结果', icon: 'none' })
      return
    }
    if (api.MOCK_MODE) {
      const next = toggleTask(taskId)
      if (next) this.refresh()
      return
    }
    api.updateTask({
      workspaceId: this.data.workspace.workspaceId,
      taskId,
      status: nextStatus,
      version: task.version,
      confirmedResult: Boolean(task.result)
    }).then(() => this.refresh())
      .catch(error => wx.showToast({ title: error.message || '任务更新失败', icon: 'none' }))
  },

  skipTask(event) {
    const taskId = event.currentTarget.dataset.id
    const task = this.data.workspace.tasks.find(item => item.id === taskId)
    if (!task || api.MOCK_MODE) return
    api.updateTask({
      workspaceId: this.data.workspace.workspaceId,
      taskId,
      status: 'skipped',
      version: task.version
    }).then(() => this.refresh())
      .catch(error => wx.showToast({ title: error.message || '无法跳过任务', icon: 'none' }))
  },

  editOwner(event) {
    const taskId = event.currentTarget.dataset.id
    const task = (this.data.allTasks.length ? this.data.allTasks : this.data.workspace.tasks)
      .find(item => item.id === taskId)
    if (!task || api.MOCK_MODE) return
    wx.showModal({
      title: '修改负责人',
      editable: true,
      placeholderText: task.owner || '待分配',
      content: task.owner || '',
      success: result => {
        if (!result.confirm) return
        const ownerLabel = (result.content || '').trim()
        if (!ownerLabel || ownerLabel === task.owner) return
        api.updateTask({
          workspaceId: this.data.workspace.workspaceId,
          taskId,
          ownerLabel,
          version: task.version
        }).then(() => this.refresh())
          .catch(error => wx.showToast({ title: error.message || '负责人更新失败', icon: 'none' }))
      }
    })
  },

  openPlanRevision() {
    if (api.MOCK_MODE) {
      wx.showToast({ title: '演示模式不支持修订', icon: 'none' })
      return
    }
    const source = this.data.allTasks.length ? this.data.allTasks : this.data.workspace.tasks
    const planDraft = source.map(task => ({
      id: task.id,
      title: task.title,
      owner: task.owner || '待分配',
      enabled: task.status !== 'skipped',
      status: task.status
    }))
    this.setData({ showPlanSheet: true, planDraft })
  },

  closePlanRevision() {
    this.setData({ showPlanSheet: false, planDraft: [], planSaving: false })
  },

  onPlanInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    const update = {}
    update[`planDraft[${index}].${field}`] = event.detail.value
    this.setData(update)
  },

  togglePlanTask(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ [`planDraft[${index}].enabled`]: event.detail.value })
  },

  submitPlanRevision() {
    if (this.data.planSaving) return
    const tasks = this.data.planDraft.map(item => ({
      id: item.id,
      title: (item.title || '').trim(),
      owner: (item.owner || '').trim() || '待分配',
      enabled: item.enabled,
      status: item.enabled ? (item.status || 'todo') : 'skipped'
    })).filter(item => item.title)
    if (!tasks.length) {
      wx.showToast({ title: '至少保留一个任务', icon: 'none' })
      return
    }
    this.setData({ planSaving: true })
    api.updateWorkspace({
      workspaceId: this.data.workspace.workspaceId,
      version: this.data.workspace.version,
      tasks
    }).then(() => {
      this.closePlanRevision()
      this.refresh()
      wx.showToast({ title: '计划已修订', icon: 'success' })
    }).catch(error => {
      this.setData({ planSaving: false })
      wx.showToast({ title: error.message || '计划修订失败', icon: 'none' })
    })
  },

  claimTask(event) {
    const taskId = event.currentTarget.dataset.id
    const task = this.data.workspace.tasks.find(item => item.id === taskId)
    if (!task || api.MOCK_MODE) return
    api.claimTask({
      workspaceId: this.data.workspace.workspaceId,
      taskId,
      version: task.version
    }).then(() => {
      wx.showToast({ title: '已认领任务', icon: 'success' })
      this.refresh()
    }).catch(error => wx.showToast({ title: error.message || '认领失败', icon: 'none' }))
  },

  acceptGuidance() {
    if (api.MOCK_MODE) {
      wx.showToast({ title: '已采纳建议', icon: 'success' })
      return
    }
    const guidance = this.data.workspace.guidance || {}
    api.respondGuidance({
      workspaceId: this.data.workspace.workspaceId,
      action: 'accept',
      guidanceId: guidance.id
    }).then(() => {
      wx.showToast({ title: '已采纳建议', icon: 'success' })
      this.refresh()
    }).catch(error => wx.showToast({ title: error.message || '操作失败', icon: 'none' }))
  },

  dismissGuidance() {
    if (api.MOCK_MODE) return
    const guidance = this.data.workspace.guidance || {}
    api.respondGuidance({
      workspaceId: this.data.workspace.workspaceId,
      action: 'dismiss',
      guidanceId: guidance.id
    }).then(() => this.refresh())
      .catch(error => wx.showToast({ title: error.message || '操作失败', icon: 'none' }))
  },

  openTool(event) {
    const task = this.data.workspace.tasks.find(item => item.id === event.currentTarget.dataset.id)
    if (!task) return
    const tool = task.tools && task.tools[0]
    if (tool && tool.verificationStatus === 'verified' && tool.appId && (tool.path || tool.shortLink) && tool.handoffMode !== 'manual_capture') {
      wx.setStorageSync('pendingToolSession', {
        workspaceId: this.data.workspace.workspaceId,
        taskId: task.id,
        toolId: tool.id,
        openedAt: new Date().toISOString()
      })
      wx.navigateToMiniProgram({
        appId: tool.appId,
        path: tool.path || '',
        shortLink: tool.shortLink || '',
        extraData: { source: 'orbit', workspaceId: this.data.workspace.workspaceId, taskId: task.id },
        success: () => {
          api.recordToolOpened({
            workspaceId: this.data.workspace.workspaceId,
            taskId: task.id,
            toolId: tool.id
          }).catch(() => {})
        },
        fail: () => wx.showModal({
          title: '工具暂时不可用',
          content: '请使用手动记录入口，跳转失败不会改变任务状态。',
          confirmText: '去记录',
          showCancel: false,
          success: () => this.openResultForm(task.id)
        })
      })
      return
    }
    wx.showModal({
      title: `使用${tool && tool.name ? tool.name : '手动记录'}`,
      content: tool && tool.fallback && tool.fallback.searchPhrase
        ? `当前入口尚未完成真机核验。你可以搜索“${tool.fallback.searchPhrase}”，完成后回到 Orbit 手动确认结果。`
        : '当前没有可核验的外部入口，请直接填写用户确认的结构化结果。',
      confirmText: '去记录',
      showCancel: true,
      success: result => {
        if (result.confirm) this.openResultForm(task.id)
      }
    })
  },

  toolButtonLabel(tool) {
    if (!tool) return '记录'
    if (tool.verificationStatus !== 'verified') return '手动记录'
    return tool.handoffMode === 'manual_capture' ? '记录' : '打开'
  },

  confirmResult(event) {
    this.openResultForm(event.currentTarget.dataset.id)
  },

  openResultForm(taskId) {
    const task = this.data.workspace.tasks.find(item => item.id === taskId)
    if (!task) return
    this.setData({
      showResultForm: true,
      resultTaskId: taskId,
      resultFields: getResultFields(task),
      resultDraft: {}
    })
  },

  closeResultForm() {
    this.setData({ showResultForm: false, resultTaskId: '', resultFields: [], resultDraft: {} })
  },

  onResultInput(event) {
    const field = event.currentTarget.dataset.field
    const update = {}
    update[`resultDraft.${field}`] = event.detail.value
    this.setData(update)
  },

  submitResult() {
    const taskId = this.data.resultTaskId
    const draft = this.data.resultDraft
    if (api.MOCK_MODE) {
      addDemoResult(taskId)
      this.closeResultForm()
      this.refresh()
      return
    }
    api.submitTaskResult({
      workspaceId: this.data.workspace.workspaceId,
      taskId,
      result: draft,
      sourceType: 'user_confirmed',
      sourceRef: wx.getStorageSync('pendingToolSession') ? 'mini_program_handoff' : 'manual_result_form',
      idempotencyKey: `result:${this.data.workspace.workspaceId}:${taskId}:${Date.now()}`
    }).then(workspace => {
      saveWorkspace(workspace)
      this.closeResultForm()
      this.applyWorkspace(workspace)
      wx.removeStorageSync('pendingToolSession')
    }).catch(error => wx.showToast({ title: error.message || '结果保存失败', icon: 'none' }))
  },

  showGuidance() {
    const guidance = this.data.workspace.guidance || {}
    const findings = this.data.workspace.derived && this.data.workspace.derived.findings
    const evidence = (this.data.workspace.facts || []).filter(fact => (guidance.evidenceIds || []).includes(fact.id))
    const findingText = findings && findings.length ? `\n\n规则依据：${findings.map(item => item.message).join('；')}` : ''
    const evidenceText = evidence.length ? `\n\n相关事实：${evidence.map(item => item.displayValue || item.label).join('；')}` : ''
    wx.showModal({
      title: guidance.title || '当前建议',
      content: `${guidance.text || '当前没有新的风险。'}${findingText}${evidenceText}`,
      confirmText: '明白了',
      showCancel: false
    })
  },

  shareWorkspace() {
    if (api.MOCK_MODE) {
      wx.showToast({ title: '演示模式请用右上角分享', icon: 'none' })
      return
    }
    api.inviteWorkspace(this.data.workspace.workspaceId)
      .then(result => {
        if (result && result.sharePath) {
          this.setData({ shareInvitePath: result.sharePath })
        }
        wx.showToast({ title: '请点右上角分享给协作者', icon: 'none' })
      })
      .catch(error => wx.showToast({ title: error.message || '暂时无法生成邀请', icon: 'none' }))
  },

  resetDemo() {
    wx.showModal({
      title: '重置演示数据',
      content: '会恢复到异地过年模板的初始状态。',
      confirmText: '重置',
      success: result => {
        if (!result.confirm) return
        const plan = createPlan('春节我和家人分散在不同城市，想一起回老家过年。请帮我安排交通、住宿、年货和家庭分工，预算6000元。', 'new_year_reunion')
        resetWorkspace(plan)
        this.refresh()
        wx.showToast({ title: '已重置', icon: 'success' })
      }
    })
  }
})
