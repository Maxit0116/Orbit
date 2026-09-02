const api = require('../../utils/api')
const { saveWorkspace } = require('../../utils/store')
const { getScenarioConfigs } = require('../../utils/mock-data')
const { validateIntentDraft } = require('../../utils/schema')

Page({
  data: {
    rawInput: '',
    scenarioId: '',
    autoFocus: true,
    plan: null,
    loading: false,
    revising: false,
    examples: [
      { id: 'new_year_reunion', label: '异地过年', text: '春节我和家人分散在不同城市，想一起回老家过年。请帮我安排交通、住宿、年货和家庭分工，预算6000元。' },
      { id: 'moving_home', label: '搬家', text: '我要在月底搬家，请帮我安排搬家公司、家具配送、水电和预算。' },
      { id: 'friend_gathering', label: '朋友聚会', text: '周末组织6个朋友聚会，帮我安排餐厅、活动、交通和AA记账。' }
    ]
  },

  onLoad(options) {
    const scenarioId = options.scenario || ''
    const configs = getScenarioConfigs()
    const defaultText = this.data.examples.find(item => item.id === scenarioId)
    this.setData({
      scenarioId,
      autoFocus: !options.scenario,
      rawInput: defaultText ? defaultText.text : '',
      scenarioTitle: configs[scenarioId] ? configs[scenarioId].title : ''
    })
  },

  goBack() {
    wx.navigateBack()
  },

  onInput(event) {
    this.setData({ rawInput: event.detail.value })
  },

  noop() {},

  onPlanFieldInput(event) {
    const field = event.currentTarget.dataset.field
    const value = event.detail.value
    const nextValue = field === 'budgetLimit' ? (value === '' ? null : Number(value)) : value
    const update = {}
    update[`plan.${field}`] = nextValue
    this.setData(update)
  },

  useExample(event) {
    this.setData({
      rawInput: event.currentTarget.dataset.example,
      scenarioId: event.currentTarget.dataset.scenario
    })
  },

  generatePlan() {
    const rawInput = this.data.rawInput.trim()
    if (!rawInput) {
      wx.showToast({ title: '先写下你要完成的事', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    api.createPlan(rawInput, this.data.scenarioId || undefined)
      .then(plan => {
        plan.tasks = plan.tasks.map(task => ({ ...task, enabled: true }))
        this.setData({ plan })
      })
      .catch(error => {
        wx.showToast({ title: error.message || '理解失败，请稍后重试', icon: 'none' })
      })
      .finally(() => this.setData({ loading: false }))
  },

  revisePlan() {
    const rawInput = this.data.rawInput.trim()
    if (!this.data.plan) {
      return this.generatePlan()
    }
    this.setData({ revising: true })
    api.revisePlan(rawInput, this.data.plan, this.data.scenarioId || undefined)
      .then(plan => {
        plan.tasks = plan.tasks.map(task => ({ ...task, enabled: task.enabled !== false }))
        this.setData({ plan })
        wx.showToast({ title: '已根据最新输入更新理解', icon: 'none' })
      })
      .catch(error => wx.showToast({ title: error.message || '重新理解失败', icon: 'none' }))
      .finally(() => this.setData({ revising: false }))
  },

  togglePlanTask(event) {
    const index = Number(event.currentTarget.dataset.index)
    const tasks = this.data.plan.tasks.map((task, taskIndex) => taskIndex === index
      ? { ...task, enabled: !task.enabled }
      : task)
    this.setData({ 'plan.tasks': tasks })
  },

  onPlanTaskTitleInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const tasks = this.data.plan.tasks.map((task, taskIndex) => taskIndex === index
      ? { ...task, title: event.detail.value, source: 'user_added' }
      : task)
    this.setData({ 'plan.tasks': tasks })
  },

  addPlanTask() {
    const tasks = this.data.plan.tasks.concat([{
      id: `draft_user_${Date.now()}`,
      title: '新任务',
      type: 'service_task',
      tag: '用户新增',
      owner: '待分配',
      description: '这是由你新增的任务，可以继续编辑。',
      requiredInputs: [],
      expectedOutputs: [],
      resultSchema: { kind: 'service' },
      source: 'user_added',
      enabled: true
    }])
    this.setData({ 'plan.tasks': tasks })
  },

  confirmPlan() {
    const plan = this.data.plan
    if (!plan) return
    const enabledTasks = plan.tasks.filter(task => task.enabled !== false)
    if (!enabledTasks.length) {
      wx.showToast({ title: '至少保留一个任务', icon: 'none' })
      return
    }
    const nextPlan = { ...plan, tasks: enabledTasks }
    const validation = validateIntentDraft(nextPlan)
    if (!validation.valid) {
      wx.showToast({ title: validation.errors[0], icon: 'none' })
      return
    }
    api.createWorkspace(nextPlan)
      .then(workspace => this.finishWorkspace(workspace))
      .catch(() => wx.showToast({ title: '创建失败，请稍后重试', icon: 'none' }))
  },

  createManualWorkspace() {
    const configs = getScenarioConfigs()
    const generic = configs.generic_task
    api.createWorkspace({
      rawInput: this.data.rawInput || '手动创建任务空间',
      scenario: generic.scenario,
      title: generic.title,
      goal: generic.goal,
      budgetLimit: null,
      peopleLabel: generic.peopleLabel,
      locationsLabel: generic.locationsLabel,
      tasks: generic.tasks.map(task => ({ ...task, enabled: true }))
    }).then(workspace => this.finishWorkspace(workspace))
      .catch(() => wx.showToast({ title: '创建失败，请稍后重试', icon: 'none' }))
  },

  finishWorkspace(workspace) {
    const taskIds = (workspace.tasks || []).map(task => task.id)
    if (api.MOCK_MODE || !workspace.workspaceId || !taskIds.length) {
      saveWorkspace(workspace)
      wx.redirectTo({ url: `/pages/workspace/workspace?workspaceId=${workspace.workspaceId || workspace.id || ''}` })
      return Promise.resolve(workspace)
    }
    return Promise.all(taskIds.map(taskId => api.matchTools({
      workspaceId: workspace.workspaceId,
      taskId,
      knownInputs: []
    }))).then(() => api.getWorkspaceSnapshot(workspace.workspaceId))
      .catch(() => workspace)
      .then(nextWorkspace => {
        saveWorkspace(nextWorkspace)
        wx.redirectTo({ url: `/pages/workspace/workspace?workspaceId=${nextWorkspace.workspaceId}` })
        return nextWorkspace
      })
  }
})
