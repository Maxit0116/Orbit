#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { buildPlan } = require('../cloudfunctions/_shared/templates')

const casesPath = path.join(__dirname, '..', 'data', 'intent-test-cases.json')
const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'))

let passed = 0
let failed = 0

cases.forEach(testCase => {
  const plan = buildPlan(testCase.input, testCase.scenario)
  const errors = []
  if (testCase.mustKeepMissing) {
    testCase.mustKeepMissing.forEach(field => {
      if (!plan.missingFields.includes(field)) errors.push(`missing field ${field} should remain missing`)
    })
  }
  if (testCase.mustIncludeTasks) {
    testCase.mustIncludeTasks.forEach(title => {
      if (!plan.tasks.some(task => task.title.includes(title))) errors.push(`task ${title} missing`)
    })
  }
  if (testCase.mustNotHaveDate && plan.date) errors.push('date should be null')
  if (testCase.mustHaveBudget === false && plan.budgetLimit !== null) errors.push('budget should be null')
  if (errors.length) {
    failed += 1
    console.error(`FAIL ${testCase.id}:`, errors.join('; '))
  } else {
    passed += 1
    console.log(`PASS ${testCase.id}`)
  }
})

console.log(`\nIntent regression: ${passed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
