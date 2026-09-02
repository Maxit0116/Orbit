const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const source = path.join(root, 'cloudfunctions', '_shared')
const targets = ['createPlan', 'revisePlan', 'createWorkspace', 'authBootstrap', 'getWorkspaceSnapshot', 'submitTaskResult', 'matchTools', 'updateTask', 'rebuildDerivedState', 'updateWorkspace', 'listWorkspaces', 'inviteWorkspace', 'joinWorkspace', 'runGuidance', 'respondGuidance']

function copyDirectory(from, to) {
  fs.mkdirSync(to, { recursive: true })
  fs.readdirSync(from, { withFileTypes: true }).forEach(entry => {
    const sourcePath = path.join(from, entry.name)
    const targetPath = path.join(to, entry.name)
    if (entry.isDirectory()) copyDirectory(sourcePath, targetPath)
    else fs.copyFileSync(sourcePath, targetPath)
  })
}

targets.forEach(name => copyDirectory(source, path.join(root, 'cloudfunctions', name, '_shared')))
console.log(`Prepared shared runtime for ${targets.length} functions`)
