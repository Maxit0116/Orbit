const templates = {
  new_year_reunion: {
    title: '异地过年 · 家庭团聚',
    goal: '让分散在不同城市的家人顺利回老家过年',
    budgetLimit: 6000,
    peopleLabel: '爸妈、我和兄弟姐妹',
    locationsLabel: '多个出发城市 → 老家',
    tasks: [
      { title: '确认城市、日期与成员', type: 'decision_task', owner: '我', description: '统一每个人的出发城市、到达时间和返程偏好。', requiredInputs: ['participants', 'origins', 'date'], expectedOutputs: ['confirmedIntent'] },
      { title: '跨城交通', type: 'service_task', owner: '我', description: '为每位成员确定回家的交通方案。', requiredInputs: ['date', 'participants', 'origins', 'destination'], expectedOutputs: ['serviceName', 'startsAt', 'endsAt', 'price', 'location'], resultSchema: { kind: 'transport' } },
      { title: '住宿', type: 'service_task', owner: '妈妈', description: '确认回家前后的住宿安排和入住时间。', requiredInputs: ['date', 'destination', 'participants'], expectedOutputs: ['serviceName', 'checkInAt', 'price', 'location'], resultSchema: { kind: 'lodging' } },
      { title: '年货采购', type: 'service_task', owner: '我', description: '统一采购年货，并确认配送时间。', requiredInputs: ['destination', 'date'], expectedOutputs: ['serviceName', 'deliveryAt', 'price', 'location'], resultSchema: { kind: 'shopping' } },
      { title: '家庭聚餐', type: 'service_task', owner: '未分配', description: '确认聚餐时间、地点和当天需要采购的食材。', requiredInputs: ['date', 'destination', 'participants'], expectedOutputs: ['serviceName', 'startsAt', 'price', 'location'], resultSchema: { kind: 'meal' } },
      { title: '预算', type: 'tracking_task', owner: '我', description: '统一记录交通、住宿、年货和聚餐支出。', requiredInputs: [], expectedOutputs: ['budgetUsed'], resultSchema: { kind: 'budget' } },
      { title: '家庭分工', type: 'coordination_task', owner: '未分配', description: '让每个人认领一项任务，减少重复确认。', requiredInputs: ['participants'], expectedOutputs: ['ownerId'], resultSchema: { kind: 'assignment' } }
    ]
  },
  moving_home: {
    title: '搬家计划',
    goal: '把搬家前后的服务和待办安排在一个空间里',
    budgetLimit: 8000,
    peopleLabel: '我和家人',
    locationsLabel: '旧住址 → 新住址',
    tasks: [
      { title: '确认搬家日期', type: 'decision_task', owner: '我', description: '确定交房、搬运和入住的时间窗口。', requiredInputs: ['date'], expectedOutputs: ['confirmedDate'] },
      { title: '搬家公司', type: 'service_task', owner: '我', description: '比较搬运时间、车型和报价。', requiredInputs: ['date', 'origins', 'destination'], expectedOutputs: ['serviceName', 'startsAt', 'price'], resultSchema: { kind: 'moving' } },
      { title: '家具与家电', type: 'service_task', owner: '家人', description: '记录购买、配送和安装时间。', requiredInputs: ['destination', 'date'], expectedOutputs: ['serviceName', 'deliveryAt', 'price'], resultSchema: { kind: 'shopping' } },
      { title: '地址与水电', type: 'coordination_task', owner: '未分配', description: '处理地址变更、水电和网络开通。', requiredInputs: ['destination'], expectedOutputs: ['checklist'] },
      { title: '搬家预算', type: 'tracking_task', owner: '我', description: '统一记录搬运、家具和服务支出。', requiredInputs: [], expectedOutputs: ['budgetUsed'], resultSchema: { kind: 'budget' } }
    ]
  },
  friend_gathering: {
    title: '朋友聚会',
    goal: '把聚会预约、活动、交通和 AA 费用组织起来',
    budgetLimit: 2000,
    peopleLabel: '朋友 6 人',
    locationsLabel: '各自出发 → 聚会地点',
    tasks: [
      { title: '确认时间与人数', type: 'decision_task', owner: '我', description: '收集大家的空闲时间和偏好。', requiredInputs: ['date', 'participants'], expectedOutputs: ['confirmedIntent'] },
      { title: '餐厅预约', type: 'service_task', owner: '我', description: '确认座位、套餐和取消规则。', requiredInputs: ['date', 'destination', 'participants'], expectedOutputs: ['serviceName', 'startsAt', 'price'], resultSchema: { kind: 'meal' } },
      { title: '活动安排', type: 'service_task', owner: '朋友 A', description: '确认活动内容和时长。', requiredInputs: ['date', 'destination'], expectedOutputs: ['serviceName', 'startsAt', 'price'], resultSchema: { kind: 'activity' } },
      { title: 'AA记账', type: 'tracking_task', owner: '未分配', description: '记录共同支出并生成分摊结果。', requiredInputs: ['participants'], expectedOutputs: ['budgetUsed'], resultSchema: { kind: 'budget' } }
    ]
  },
  generic_task: {
    title: '新的任务空间',
    goal: '把一个复杂目标拆成可以逐步完成的任务',
    budgetLimit: null,
    peopleLabel: '参与者待确认',
    locationsLabel: '地点待确认',
    tasks: [
      { title: '确认目标与约束', type: 'decision_task', owner: '我', description: '明确完成标准、时间范围、参与者和不可妥协的条件。', requiredInputs: ['goal'], expectedOutputs: ['confirmedIntent'] },
      { title: '需要的服务', type: 'service_task', owner: '待分配', description: '识别需要哪些能力来完成目标。', requiredInputs: [], expectedOutputs: ['serviceName'], resultSchema: { kind: 'service' } },
      { title: '时间安排', type: 'coordination_task', owner: '待分配', description: '安排任务顺序、时间窗口和彼此依赖。', requiredInputs: ['date'], expectedOutputs: ['schedule'] },
      { title: '预算', type: 'tracking_task', owner: '我', description: '集中记录预算和已确认支出。', requiredInputs: [], expectedOutputs: ['budgetUsed'], resultSchema: { kind: 'budget' } },
      { title: '成员分工', type: 'coordination_task', owner: '未分配', description: '让参与者认领下一步，避免任务停留在想法阶段。', requiredInputs: ['participants'], expectedOutputs: ['ownerId'], resultSchema: { kind: 'assignment' } }
    ]
  }
}

function inferScenario(rawInput) {
  if (/春节|过年|年货|回老家|团聚/.test(rawInput)) return 'new_year_reunion'
  if (/搬家|租房|家具|水电/.test(rawInput)) return 'moving_home'
  if (/聚会|朋友|餐厅|AA/.test(rawInput)) return 'friend_gathering'
  return 'generic_task'
}

function parseBudget(rawInput) {
  const matched = String(rawInput).match(/预算\s*(?:上限)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:元|块)?/i)
  return matched ? Number(matched[1]) : null
}

function buildPlan(rawInput, scenarioId) {
  const scenario = templates[scenarioId] ? scenarioId : inferScenario(rawInput)
  const template = templates[scenario]
  const budgetLimit = parseBudget(rawInput)
  const missingFields = []
  if (!/\d{1,2}月\d{1,2}(?:日|号)?/.test(rawInput)) missingFields.push('date')
  if (!/我和|我们|家人|朋友|父母|成员|两个人|多人|\d+\s*人/.test(rawInput)) missingFields.push('participants')
  if (!/城市|地点|老家|住址|杭州|北京|上海|广州/.test(rawInput)) missingFields.push('destination')
  if (scenario === 'new_year_reunion' && !/北京|上海|广州|深圳|杭州|成都|重庆/.test(rawInput)) missingFields.push('origins')
  if (budgetLimit === null || budgetLimit === undefined) missingFields.push('budgetLimit')
  return {
    schemaVersion: 'intent.v1',
    planSchemaVersion: 'plan.v1',
    version: 1,
    rawInput: String(rawInput).slice(0, 240),
    scenario,
    title: template.title,
    goal: template.goal,
    participants: [],
    origins: [],
    destination: null,
    date: null,
    dateRange: null,
    budgetLimit,
    serviceNeeds: template.tasks.filter(task => task.type === 'service_task').map(task => task.title),
    preferences: [],
    peopleLabel: template.peopleLabel,
    locationsLabel: template.locationsLabel,
    assumptions: [
      '具体日期、参与者和地点仍需由你确认',
      '外部服务的价格和库存不会被 Orbit 自动读取',
      '任务完成需要用户主动确认结果'
    ],
    missingFields,
    tasks: template.tasks.map((task, index) => ({
      ...task,
      id: `draft_task_${index + 1}`,
      enabled: true,
      source: 'template',
      dependsOn: []
    })),
    needsConfirmation: true
  }
}

module.exports = { templates, inferScenario, buildPlan }
