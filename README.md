# Orbit · AI Task Workspace

Orbit 是一个以现实任务为中心的微信小程序 Workspace 原型。它不从“小程序列表”开始，而是从用户想完成的事情开始：

```text
Intent -> Task Tree -> Mini Program Capability -> Workspace Context
```

当前实现范围：Phase 0–5 单人核心闭环（外部 LLM Adapter、计划修订、Workspace 列表、演示工具跳转、动态结果表单与时间线）已实现；真机 iOS/Android 与第二设备协作仍待后续 Phase。

- 微信原生小程序页面；
- 本地 Mock 数据模式，无需 AppID 或 CloudBase 也能运行；
- CloudBase PostgreSQL 迁移、RLS 和统一 `{ requestId, code, data, message }` 云函数响应；
- 外部 LLM Intent Adapter（OpenAI 兼容 API）+ 模板 fallback；
- `revisePlan`、`listWorkspaces` 与 `plan.revised` 计划修订流；
- 白名单工具匹配、内部演示 verified 跳转、手动结果 fallback；
- Workspace 快照、Fact/Event、按任务类型的结果确认表单；
- 首页「我的 Workspace」列表；
- 时间线、预算、依赖/时间冲突派生状态；
- 11 个核心云函数。

## 在微信开发者工具中运行

1. 打开微信开发者工具。
2. 导入项目根目录：`/Users/terran/Projects/Orbit`。
3. 使用 `project.config.json` 中已配置的真实 AppID，或替换为你自己的 AppID。
4. 直接编译 `miniprogram/`。
5. 首页点击“创建一个任务空间”，选择“异地过年”进入演示。
6. 在 Workspace 中提交至少两类服务结果，观察预算、时间线与冲突提示。

## Mock 与 CloudBase

CloudBase 环境 ID 配置在 `miniprogram/utils/config.js`：

```js
const MOCK_MODE = false
```

### 云函数环境变量

在 CloudBase 控制台为 `createPlan`、`revisePlan` 等函数配置（详见 [env-vars.md](docs/env-vars.md)）：

- `LLM_API_BASE`、`LLM_API_KEY`、`LLM_MODEL`：外部 LLM（未配置时自动使用模板 fallback）
- `DEMO_MP_APPID`、`DEMO_MP_PATH_*`：内部演示小程序跳转目标

### 部署

```bash
node scripts/prepare-functions.js
node scripts/run-intent-regression.js
```

然后通过微信开发者工具或 `wechatide cloud_fn_deploy` 部署 `cloudfunctions/` 下全部函数。新增函数：`revisePlan`、`listWorkspaces`。

### 当前云端状态

- 环境：`orbit-cloudbase-d7fieg8385dce685`
- PostgreSQL：`pgdb-b0pp5mb7`，含 `mini_programs` seed 与 3 条内部演示工具
- 已更新函数：createPlan、authBootstrap、createWorkspace、matchTools、updateTask、updateWorkspace、rebuildDerivedState（其余需在开发者工具确认部署）

跨小程序结果不会被自动读取；用户确认后才写入 Fact/Event。

Phase 0 证据见 [verification-log.md](docs/verification-log.md)；Intent 回归集见 [intent-test-cases.json](data/intent-test-cases.json)。

## 文档

- [产品 PRD](docs/PRD.md)
- [Development Plan](docs/DEVELOPMENT_PLAN.md)
- [环境变量](docs/env-vars.md)
