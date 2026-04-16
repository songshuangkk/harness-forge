# Hook State Machine Design

**Date**: 2026-04-11
**Status**: Approved
**Approach**: C — Declarative constraints + thin shell hooks

## Problem

Harness Forge 当前产物是静态配置文件，存在三个根本性限制：

1. **阶段推进靠 AI 自觉** — 没有强制 gate，AI 可以跳过阶段
2. **角色权限只是提示词** — 没有工具级拦截，AI 可以无视角色边界
3. **跨引擎不一致** — 只有 Claude Code 能跑完整流程

## Solution: 文件状态机 + Hook 强制约束

不引入 server，不增加使用门槛。把现有 shell hook 升级为有限状态机：

- 声明式约束文件（`constraints.yaml`）定义所有规则
- Shell hook 薄壳读取约束 → 判断 → 执行
- 文件系统（`.harness/`）作为状态存储
- AI 无法篡改状态（guard.sh 拦截对 `.harness/` 的写入）

## Architecture

```
.harness/
  constraints.yaml       ← 唯一约束来源（由 Harness Forge 生成）
  state.json             ← 运行时状态（当前阶段、角色、gate 状态）
  scripts/
    check.sh             ← 手动状态查看
    session-init.sh      ← 首次初始化

.claude/hooks/
  guard.sh               ← PreToolUse：工具/路径拦截
  advance.sh             ← PostToolUse：gate 检查 + 状态更新
  transition.sh          ← Slash command 调用：阶段切换
```

## File Specs

### `.harness/state.json`

```json
{
  "version": 1,
  "project": "my-project",
  "sprint": {
    "current": "think",
    "history": [],
    "started_at": "2026-04-11T00:00:00Z"
  },
  "role": {
    "current": "ceo",
    "allowed_tools": ["Read", "Grep", "Glob"],
    "allowed_paths": ["docs/**"]
  },
  "gates": {
    "think": { "passed": false, "artifacts": [] },
    "plan": { "passed": false, "artifacts": [] },
    "build": { "passed": false, "artifacts": [] },
    "review": { "passed": false, "artifacts": [] },
    "test": { "passed": false, "artifacts": [] },
    "ship": { "passed": false, "artifacts": [] },
    "reflect": { "passed": false, "artifacts": [] }
  }
}
```

### `.harness/constraints.yaml`

```yaml
project: my-project

stages:
  - name: think
    roles: [ceo]
    tools:
      allow: [Read, Grep, Glob, Agent]
      deny: [Write, Edit, Bash]
    paths:
      write: [docs/**]
    gates:
      - id: think-output
        type: file_exists
        pattern: "docs/think-*.md"
        description: "分析文档已生成"
    next: plan

  - name: plan
    roles: [ceo, designer, eng-manager]
    tools:
      allow: [Read, Grep, Glob, Write, Edit, Agent]
      deny: [Bash]
    paths:
      write: [docs/**]
    gates:
      - id: plan-output
        type: file_exists
        pattern: "docs/plans/*.md"
        description: "计划文档已生成"
      - id: plan-review
        type: command
        check: "test -f docs/plans/review-checklist.md"
        description: "Review checklist 已生成"
    next: build

  - name: build
    roles: [eng-manager]
    tools:
      allow: [Read, Grep, Glob, Write, Edit, Bash, Agent]
      deny: []
    paths:
      write: [src/**, test/**, docs/**]
    gates:
      - id: build-complete
        type: command
        check: "npm run build 2>/dev/null"
        description: "构建通过"
    next: review

  - name: review
    roles: [qa, security]
    tools:
      allow: [Read, Grep, Glob, Write, Edit]
      deny: [Bash]
    paths:
      write: [docs/**]
    gates:
      - id: review-report
        type: file_exists
        pattern: "docs/reviews/*.md"
        description: "Review 报告已生成"
    next: test

  - name: test
    roles: [qa]
    tools:
      allow: [Read, Grep, Glob, Write, Edit, Bash]
      deny: []
    paths:
      write: [test/**, docs/**]
    gates:
      - id: tests-pass
        type: command
        check: "npm test 2>/dev/null"
        description: "测试通过"
    next: ship

  - name: ship
    roles: [release]
    tools:
      allow: [Read, Grep, Glob, Write, Edit, Bash]
      deny: []
    paths:
      write: ["**"]
    gates:
      - id: version-bumped
        type: command
        check: "git diff --cached --quiet"
        description: "Changes committed"
    next: reflect

  - name: reflect
    roles: [doc-engineer]
    tools:
      allow: [Read, Grep, Glob, Write, Edit]
      deny: [Bash]
    paths:
      write: [docs/**]
    gates: []
    next: null

roles:
  ceo:
    description: "方向决策和需求澄清"
    focus: [requirement clarity, scope control]
  designer:
    description: "架构和交互设计"
    focus: [system design, API contract]
  eng-manager:
    description: "工程实现"
    focus: [code quality, implementation]
  qa:
    description: "质量保障"
    focus: [testing, coverage, edge cases]
  security:
    description: "安全审查"
    focus: [vulnerabilities, compliance]
  release:
    description: "发布管理"
    focus: [versioning, deployment, changelog]
  doc-engineer:
    description: "文档和回顾"
    focus: [documentation, retrospective]

transitions:
  - from: think
    to: plan
    requires: [think-output]
  - from: plan
    to: build
    requires: [plan-output, plan-review]
  - from: build
    to: review
    requires: [build-complete]
  - from: review
    to: test
    requires: [review-report]
  - from: test
    to: ship
    requires: [tests-pass]
  - from: ship
    to: reflect
    requires: [version-bumped]
```

## Hook Scripts

### guard.sh — PreToolUse

读 `state.json`（当前阶段）+ `constraints.yaml`（该阶段工具/路径规则）→ allow/deny。

```
输入: Claude Code JSON (tool_name, tool_input)
逻辑:
  1. 取当前阶段 from state.json
  2. 从 constraints.yaml 取该阶段 tools.allow / tools.deny
  3. 工具在 deny 列表 → exit 2 (阻止)
  4. 工具是 Write/Edit → 检查 paths.write 匹配
  5. 路径不匹配 → exit 2 (阻止)
  6. 全部通过 → exit 0
安全: .harness/ 不在任何 stage 的 paths.write 中，AI 无法篡改状态
```

### advance.sh — PostToolUse

读 `constraints.yaml`（当前阶段 gates）→ 检查产出物 → 更新 `state.json`。

```
输入: Claude Code JSON (tool_name, tool_input, tool_result)
逻辑:
  1. 取当前阶段 from state.json
  2. 从 constraints.yaml 取该阶段 gates
  3. 逐个检查 gate:
     - file_exists: ls pattern 是否有文件
     - command: eval check 命令是否成功
  4. 所有 gate 通过 → 更新 state.json gates.{stage}.passed = true
```

### transition.sh — Slash Command 触发

检查前置 gate → 更新当前阶段和角色权限缓存。

```
输入: $1 = 目标阶段
逻辑:
  1. 读 transitions 规则，找 from=current to=target
  2. 检查 from 阶段的所有 requires gate 是否 passed
  3. 未通过 → 输出阻止信息，exit 1
  4. 通过 → 更新 state.json:
     - sprint.history += [current]
     - sprint.current = target
     - role.current = 新阶段默认角色
     - role.allowed_tools = 新阶段工具列表
     - role.allowed_paths = 新阶段路径列表
```

### session-init.sh — 首次初始化

```
逻辑:
  1. 检查 jq, yq 是否安装
  2. 如果 state.json 不存在 → 从 constraints.yaml 生成初始状态
  3. 写入 project 名和 started_at 时间戳
  4. 输出 "Start with: /think"
```

### check.sh — 手动状态查看

输出当前阶段、角色、各 gate 状态。

## Cross-Engine Degradation

### Claude Code (Full)

- guard.sh → PreToolUse hook (exit 2 拦截)
- advance.sh → PostToolUse hook (状态更新)
- transition.sh → slash command 内调用
- 强制执行，AI 无法绕过

### Codex (Partial)

- `constraints.yaml` 共享
- `hooks.json` 做有限的事件检查
- 每个 `skills/{stage}.md` 头部嵌入约束提示词
- 提示词级别约束，非硬拦截

### Cursor (Minimal)

- `constraints.yaml` 共享
- `.cursor/rules/{stage}.mdc` 声明阶段约束
- 纯提示词级约束，依赖 AI 遵守

### Shared

所有引擎共享 `.harness/scripts/check.sh`，用户可手动查看状态。

## Generator Changes

### New Files

| Generator | Output |
|-----------|--------|
| `src/generators/core/constraints.ts` | `.harness/constraints.yaml` + `.harness/state.json` + `.harness/scripts/*.sh` |
| `src/generators/engines/claude/hooks.ts` (rewrite) | `.claude/hooks/guard.sh` + `advance.sh` + `transition.sh` |

### Modified Files

| File | Change |
|------|--------|
| `src/generators/core/flows.ts` | 输出改为生成 `constraints.yaml` 而非纯文本描述 |
| `src/generators/engines/claude/commands.ts` | slash command 开头追加 transition.sh 调用 |
| `src/generators/engines/codex/` | skills 里嵌入约束提示词 + hooks.json |
| `src/generators/engines/cursor/` | .mdc rules 声明约束 |
| `src/generators/index.ts` | `generateAll()` 新增 constraints 生成步骤 |

### Generation Order

```
generateAll()
  → core: constraints.ts      // 先生成，其他依赖它
  → core: roles.ts
  → engine: hooks.ts          // 读 constraints 生成 hook 薄壳
  → engine: commands.ts       // slash commands + transition 调用
  → scaffold: scripts/        // session-init.sh 检测 yq/jq
  → ...existing generators
```

## User Flow

```
下载 ZIP → 解压到项目根目录
  → AI 工具打开项目
  → CLAUDE.md 引导 AI 先跑 session-init.sh
  → state.json 初始化，current = think
  → 用户 /think → guard.sh 只允许只读操作
  → AI 产出 docs/think-*.md
  → advance.sh 检测 gate 通过 → state.json 更新
  → 用户 /plan → transition.sh 检查 think gate ✅ → 切换阶段
  → ... 依次推进到 reflect
```

## Dependencies

- `jq` — JSON 读写
- `yq` — YAML 解析 constraints.yaml
- 检测在 session-init.sh 中，缺失时提示安装

## Security

- `state.json` 写入只由 hook 脚本完成
- `guard.sh` 拦截对 `.harness/` 目录的 Write/Edit 操作
- `constraints.yaml` 完全只读，AI 无法修改
- AI 试图直接编辑 state.json → 被 PreToolUse hook 拦截
