const RESULT_FIELDS = {
  transport: [
    { field: 'serviceName', label: '交通方式', placeholder: '例如：高铁 G1234' },
    { field: 'startsAt', label: '出发时间', placeholder: '2026-12-28 09:00' },
    { field: 'endsAt', label: '到达时间', placeholder: '2026-12-28 13:00' },
    { field: 'location', label: '路线', placeholder: '出发城市 → 老家' },
    { field: 'price', label: '金额', placeholder: '520', type: 'digit' }
  ],
  lodging: [
    { field: 'serviceName', label: '住宿名称', placeholder: '例如：老家酒店' },
    { field: 'checkInAt', label: '入住时间', placeholder: '2026-12-28 14:00' },
    { field: 'location', label: '地点', placeholder: '老家城区' },
    { field: 'price', label: '金额', placeholder: '680', type: 'digit' }
  ],
  shopping: [
    { field: 'serviceName', label: '采购内容', placeholder: '例如：年货礼盒' },
    { field: 'deliveryAt', label: '送达时间', placeholder: '2026-12-29 18:00' },
    { field: 'location', label: '收货地点', placeholder: '老家地址' },
    { field: 'price', label: '金额', placeholder: '900', type: 'digit' }
  ],
  meal: [
    { field: 'serviceName', label: '餐厅/聚餐', placeholder: '例如：家庭聚餐' },
    { field: 'startsAt', label: '聚餐时间', placeholder: '2026-12-28 18:00' },
    { field: 'location', label: '地点', placeholder: '老家城区' },
    { field: 'price', label: '金额', placeholder: '520', type: 'digit' }
  ],
  service: [
    { field: 'serviceName', label: '服务名称', placeholder: '例如：服务方案' },
    { field: 'location', label: '地点', placeholder: '可选' },
    { field: 'startsAt', label: '开始时间', placeholder: '可选' },
    { field: 'price', label: '金额', placeholder: '可选', type: 'digit' }
  ]
}

function getResultFields(task) {
  const kind = task && task.resultSchema && task.resultSchema.kind
  return RESULT_FIELDS[kind] || RESULT_FIELDS.service
}

function buildScheduleItems(facts) {
  const items = []
  ;(facts || []).forEach(fact => {
    const value = fact.value || {}
    if (value.startsAt) items.push({ label: fact.label || '开始', time: value.startsAt, source: fact.source })
    if (value.deliveryAt) items.push({ label: '送达', time: value.deliveryAt, source: fact.source })
    if (value.checkInAt) items.push({ label: '入住', time: value.checkInAt, source: fact.source })
  })
  return items.sort((left, right) => String(left.time).localeCompare(String(right.time)))
}

module.exports = {
  getResultFields,
  buildScheduleItems
}
