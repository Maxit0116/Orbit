const scenarioConfigs = {
  generic_task: {
    title: '新的任务空间',
    goal: '把一个复杂目标拆成可以逐步完成的任务',
    scenario: 'generic_task',
    budgetLimit: 0,
    peopleLabel: '参与者待确认',
    locationsLabel: '地点待确认',
    tasks: [
      {
        title: '确认目标与约束',
        type: 'decision_task',
        tag: '先确认',
        owner: '我',
        description: '明确完成标准、时间范围、参与者和不可妥协的条件。',
        tools: [{ name: '目标清单', category: '规划', reason: '先把复杂目标变成可确认的约束。' }]
      },
      {
        title: '需要的服务',
        type: 'service_task',
        tag: '服务',
        owner: '待分配',
        description: '识别需要哪些微信小程序能力来完成目标。',
        tools: [{ name: '能力工具', category: '能力', reason: '从任务需求匹配已核验的小程序工具。' }]
      },
      {
        title: '时间安排',
        type: 'coordination_task',
        tag: '协作',
        owner: '待分配',
        description: '安排任务的顺序、时间窗口和彼此依赖。',
        tools: [{ name: '时间清单', category: '计划', reason: '把不同服务结果放在同一条时间线上。' }]
      },
      {
        title: '预算',
        type: 'tracking_task',
        tag: '追踪',
        owner: '我',
        description: '如果任务涉及费用，集中记录预算和已确认支出。',
        tools: [{ name: 'Orbit 预算板', category: '追踪', reason: '自动汇总已确认的任务结果。' }],
        result: { label: '当前支出', value: '¥0' }
      },
      {
        title: '成员分工',
        type: 'coordination_task',
        tag: '协作',
        owner: '未分配',
        description: '让参与者认领下一步，避免任务停留在想法阶段。',
        tools: [{ name: 'Orbit 协作清单', category: '协作', reason: '围绕共同目标分配和追踪任务。' }]
      }
    ]
  },
  new_year_reunion: {
    title: '异地过年 · 家庭团聚',
    goal: '让分散在不同城市的家人顺利回老家过年',
    scenario: 'new_year_reunion',
    budgetLimit: 6000,
    peopleLabel: '爸妈、我和兄弟姐妹',
    locationsLabel: '多个出发城市 → 老家',
    tasks: [
      {
        title: '确认城市、日期与成员',
        type: 'decision_task',
        tag: '先确认',
        owner: '我',
        description: '把每个人的出发城市、到达时间和返程偏好统一起来。',
        tools: [{ name: '家庭信息清单', category: '协作', reason: '把成员和约束集中在一个清单里。' }]
      },
      {
        title: '跨城交通',
        type: 'service_task',
        tag: '服务',
        owner: '我',
        description: '为每位成员确定回家的交通方案。',
        tools: [{ name: '铁路出行服务', category: '出行', reason: '支持按出发城市和日期查询交通方案。' }],
        result: { label: '交通方案', value: '待确认' }
      },
      {
        title: '住宿',
        type: 'service_task',
        tag: '服务',
        owner: '妈妈',
        description: '确认回家前后的住宿安排和入住时间。',
        tools: [{ name: '住宿预订服务', category: '住宿', reason: '根据日期、人数和目的地匹配住宿。' }],
        result: { label: '住宿安排', value: '待确认' }
      },
      {
        title: '年货采购',
        type: 'service_task',
        tag: '服务',
        owner: '我',
        description: '统一采购年货，并确认配送时间。',
        tools: [{ name: '商超采购服务', category: '购物', reason: '支持年货清单、配送时间和预算记录。' }],
        result: { label: '配送时间', value: '待确认' }
      },
      {
        title: '家庭聚餐',
        type: 'service_task',
        tag: '待分配',
        owner: '未分配',
        description: '确认聚餐时间、地点和当天需要采购的食材。',
        tools: [{ name: '本地生活服务', category: '本地生活', reason: '支持餐厅预约或本地采购。' }],
        result: { label: '聚餐安排', value: '待确认' }
      },
      {
        title: '预算',
        type: 'tracking_task',
        tag: '追踪',
        owner: '我',
        description: '统一记录交通、住宿、年货和聚餐支出。',
        tools: [{ name: 'Orbit 预算板', category: '追踪', reason: '自动汇总已确认的任务结果。' }],
        result: { label: '当前支出', value: '¥0' }
      },
      {
        title: '家庭分工',
        type: 'coordination_task',
        tag: '协作',
        owner: '未分配',
        description: '让每个人认领一项任务，减少群聊里的重复确认。',
        tools: [{ name: 'Orbit 协作清单', category: '协作', reason: '围绕共同目标分配和追踪任务。' }]
      }
    ]
  },
  moving_home: {
    title: '搬家计划',
    goal: '把搬家前后的服务和待办安排在一个空间里',
    scenario: 'moving_home',
    budgetLimit: 8000,
    peopleLabel: '我和家人',
    locationsLabel: '旧住址 → 新住址',
    tasks: [
      { title: '确认搬家日期', type: 'decision_task', tag: '先确认', owner: '我', description: '确定交房、搬运和入住的时间窗口。', tools: [{ name: '日历服务', category: '计划', reason: '先锁定多个服务的共同时间窗口。' }] },
      { title: '搬家公司', type: 'service_task', tag: '服务', owner: '我', description: '比较搬运时间、车型和报价。', tools: [{ name: '搬家服务', category: '搬运', reason: '按地点、楼层和物品量匹配服务。' }], result: { label: '搬运报价', value: '待确认' } },
      { title: '家具与家电', type: 'service_task', tag: '服务', owner: '家人', description: '记录购买、配送和安装时间。', tools: [{ name: '家居服务', category: '购物', reason: '把购买和配送结果带回搬家时间线。' }], result: { label: '配送时间', value: '待确认' } },
      { title: '地址与水电', type: 'coordination_task', tag: '协作', owner: '未分配', description: '处理地址变更、水电和网络开通。', tools: [{ name: '生活缴费服务', category: '生活', reason: '集中处理搬家后的基础服务。' }] },
      { title: '搬家预算', type: 'tracking_task', tag: '追踪', owner: '我', description: '统一记录搬运、家具和服务支出。', tools: [{ name: 'Orbit 预算板', category: '追踪', reason: '自动汇总已确认金额。' }], result: { label: '当前支出', value: '¥0' } }
    ]
  },
  friend_gathering: {
    title: '朋友聚会',
    goal: '把聚会预约、活动、交通和 AA 费用组织起来',
    scenario: 'friend_gathering',
    budgetLimit: 2000,
    peopleLabel: '朋友 6 人',
    locationsLabel: '各自出发 → 聚会地点',
    tasks: [
      { title: '确认时间与人数', type: 'decision_task', tag: '先确认', owner: '我', description: '收集大家的空闲时间和偏好。', tools: [{ name: '投票清单', category: '协作', reason: '快速收集多人选择。' }] },
      { title: '餐厅预约', type: 'service_task', tag: '服务', owner: '我', description: '确认座位、套餐和取消规则。', tools: [{ name: '本地生活服务', category: '餐饮', reason: '按人数、时间和位置匹配餐厅。' }], result: { label: '预约安排', value: '待确认' } },
      { title: '活动安排', type: 'service_task', tag: '服务', owner: '朋友 A', description: '确认活动内容和时长。', tools: [{ name: '活动预约服务', category: '活动', reason: '把活动时间加入共同时间线。' }], result: { label: '活动时间', value: '待确认' } },
      { title: 'AA 记账', type: 'tracking_task', tag: '追踪', owner: '未分配', description: '记录共同支出并生成分摊结果。', tools: [{ name: 'AA 记账服务', category: '记账', reason: '支持多人共同记录和分摊。' }], result: { label: '当前支出', value: '¥0' } }
    ]
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function getScenarioConfigs() {
  return clone(scenarioConfigs)
}

function inferScenario(rawInput) {
  const input = rawInput || ''
  if (/搬家|租房|家具|水电/.test(input)) return 'moving_home'
  if (/聚会|朋友|餐厅|AA/.test(input)) return 'friend_gathering'
  if (/春节|过年|年货|回老家|团聚/.test(input)) return 'new_year_reunion'
  return 'generic_task'
}

function createPlan(rawInput, scenarioId) {
  const selectedScenario = scenarioId || inferScenario(rawInput)
  const config = scenarioConfigs[selectedScenario] || scenarioConfigs.generic_task
  return {
    rawInput,
    scenario: config.scenario,
    title: config.title,
    goal: config.goal,
    budgetLimit: config.budgetLimit,
    peopleLabel: config.peopleLabel,
    locationsLabel: config.locationsLabel,
    assumptions: [
      '具体日期和参与者仍需由你确认',
      '外部服务的价格和库存不会被 Orbit 自动读取',
      '任务完成需要用户主动确认结果'
    ],
    tasks: clone(config.tasks)
  }
}

function createWorkspaceFromPlan(plan) {
  const now = new Date().toISOString()
  return {
    id: `ws_${Date.now()}`,
    title: plan.title,
    goal: plan.goal,
    scenario: plan.scenario,
    budgetLimit: plan.budgetLimit,
    peopleLabel: plan.peopleLabel,
    locationsLabel: plan.locationsLabel,
    status: 'in_progress',
    createdAt: now,
    updatedAt: now,
    tasks: plan.tasks.map((task, index) => ({
      ...task,
      id: `task_${index + 1}`,
      status: index === 0 ? 'done' : 'todo',
      completedAt: index === 0 ? now : null
    })),
    facts: indexFacts(plan.scenario, now),
    events: [
      { id: `event_${Date.now()}`, type: 'workspace.created', text: '创建了一个新的任务空间', at: '刚刚' }
    ],
    guidance: {
      title: '先确认关键约束',
      text: '先补充日期、参与者和各自所在城市，Orbit 才能判断哪些任务可以并行完成。'
    }
  }
}

function indexFacts(scenario, now) {
  if (scenario === 'new_year_reunion') {
    return [
      { key: 'budget.used', label: '已确认支出', value: '¥0', source: 'Workspace 初始化', at: now },
      { key: 'participants', label: '参与者', value: '爸妈、我和兄弟姐妹', source: '用户输入', at: now }
    ]
  }
  return [{ key: 'budget.used', label: '已确认支出', value: '¥0', source: 'Workspace 初始化', at: now }]
}

module.exports = {
  createPlan,
  createWorkspaceFromPlan,
  getScenarioConfigs
}
