#!/usr/bin/env node

function resolveFactKey(task) {
  if (/聚餐|餐厅|meal/i.test(task.title)) return 'family.meal'
  if (/年货|采购|shopping/i.test(task.title)) return 'family.shopping'
  if (/交通|出行|transport/i.test(task.title)) return 'family.transport'
  if (/住宿|酒店|lodging/i.test(task.title)) return 'family.lodging'
  return `task.${task.id}`
}

function detectDeliveryAfterMeal(facts) {
  const timeFacts = facts.map(fact => ({ fact, value: fact.value_json || {} }))
  const delivery = timeFacts.find(item => item.value.deliveryAt)
  const meal = timeFacts.find(item => item.value.startsAt && /meal|聚餐|family\.meal/i.test(item.fact.key))
  if (!delivery || !meal) return false
  return new Date(delivery.value.deliveryAt) > new Date(meal.value.startsAt)
}

function detectBudgetOverLimit(workspace, facts) {
  const budgetUsed = facts.reduce((sum, fact) => {
    const value = fact.value_json || {}
    const amount = Number(value.price ?? value.amount ?? value.cost)
    return Number.isFinite(amount) && amount >= 0 ? sum + amount : sum
  }, 0)
  return workspace.budget_limit !== null && budgetUsed > Number(workspace.budget_limit)
}

let passed = 0
let failed = 0

function assert(name, condition, detail) {
  if (condition) {
    passed += 1
    console.log(`PASS ${name}`)
    return
  }
  failed += 1
  console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`)
}

assert('factKey maps 年货采购 to family.shopping', resolveFactKey({ id: 't1', title: '采购年货' }) === 'family.shopping')
assert('factKey maps 家庭聚餐 to family.meal', resolveFactKey({ id: 't2', title: '家庭聚餐' }) === 'family.meal')

const conflictFacts = [
  { key: 'family.meal', value_json: { startsAt: '2026-12-28T18:00:00.000Z' } },
  { key: 'family.shopping', value_json: { deliveryAt: '2026-12-28T20:00:00.000Z' } }
]
assert('delivery_after_meal fires when delivery is after meal', detectDeliveryAfterMeal(conflictFacts))

const okFacts = [
  { key: 'family.meal', value_json: { startsAt: '2026-12-28T18:00:00.000Z' } },
  { key: 'family.shopping', value_json: { deliveryAt: '2026-12-28T16:00:00.000Z' } }
]
assert('no delivery_after_meal when delivery is before meal', !detectDeliveryAfterMeal(okFacts))

assert(
  'budget_over_limit when confirmed spend exceeds cap',
  detectBudgetOverLimit({ budget_limit: 1000 }, [{ key: 'family.transport', value_json: { price: 1200 } }])
)

console.log(`\nPhase 5 smoke: ${passed}/${passed + failed} passed`)
process.exit(failed ? 1 : 0)
