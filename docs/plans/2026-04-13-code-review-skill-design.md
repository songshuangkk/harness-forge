# Code Review Skill Design

## Goal

Replace `superpowers:requesting-code-review` with a Harness Forge-native code-review command, dynamically generated per project config.

## Approach: Dynamic Command Generator (Plan B)

New generator `src/generators/engines/claude/codeReview.ts` that produces `.claude/commands/code-review.md` tailored to the project's roles, dimensions, and severity threshold.

## Trigger

- **Not a hook.** `transition.sh` outputs a hint line when entering review stage: `Run /code-review for deep code quality audit.`
- User executes `/code-review` manually.

## Execution Model: Main Agent + On-Demand Sub-Agents

1. Main agent runs two-phase scan:
   - **Phase 1 — Spec Compliance**: read plan, check acceptance criteria, file paths, verification steps
   - **Phase 2 — Code Quality**: architecture, code quality, security, test coverage, performance
2. When Critical/Major findings >= `severityThreshold` (default 3), spawn sub-agents for deep-dive:
   - Security → OWASP Top 10 audit
   - Architecture → coupling, dependency analysis
   - Test coverage → gap analysis, edge case suggestions
3. Sub-agents use `subagent_type: "general-purpose"`, no superpowers dependency
4. Results aggregated back to main agent, written to `docs/reviews/review-report.md`

## File Structure

```
src/generators/engines/claude/codeReview.ts    ← new generator
src/generators/index.ts                         ← add one line
src/generators/engines/claude/hooks.ts          ← add hint in transition.sh
```

## Dynamic Config Mapping

| Config field | Usage |
|---|---|
| `ReviewConfig.reviewDimensions` | Scan checklist items |
| `ReviewConfig.severityThreshold` | Sub-agent spawn trigger (default 3) |
| `ReviewConfig.autoFix` | Whether to auto-fix obvious issues |
| `stage.roles` | Role focus areas → scan dimensions |
| `stage.gates` | Gates checklist appended to command |
| `flow.constraints` | Stage constraints |
| `project.techStack` | Language-specific lint/test command hints |

## Output Format (appended to `docs/reviews/review-report.md`)

```markdown
## Code Review — {timestamp}
### Spec Compliance
- ✅ / ❌ per acceptance criterion
### Quality Findings
| # | Severity | Area | Description | File:Line |
### Deep-Dive Reports
(sub-agent summaries)
### Sign-off
- [ ] Review passed — no Critical/Major issues remaining
```

## Relationship with Existing `/review`

- `/review` stays as the general multi-role entry point
- `/code-review` is the focused deep-dive complement
- Sprint flow hint: run `/review` first, then `/code-review`

## Implementation Changes

1. **New file**: `src/generators/engines/claude/codeReview.ts`
   - `renderScanChecklist(roles, dimensions)` → main agent scan items
   - `renderSpawnProtocol(threshold)` → sub-agent spawn rules
   - `renderOutputTemplate()` → output format template
   - `generateCodeReviewCommand(config)` → assembles OutputFile

2. **Edit**: `src/generators/index.ts` — add `generateCodeReviewCommand` import and call

3. **Edit**: `src/generators/engines/claude/hooks.ts` — `renderTransitionScript()` adds hint when target is review
