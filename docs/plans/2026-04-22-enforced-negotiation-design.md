# Enforced Multi-Role Negotiation for Think + Plan Stages

Date: 2026-04-22

## Problem

The negotiation protocol (`negotiation.ts`) is well-designed with two rounds (independent review → cross-reading → consensus), but in practice users skip it entirely. Three root causes:

1. **Advisory gate** — `stageArtifacts.ts` sets `blockOnFail: false` for consensus artifact, never blocks transitions
2. **Buried in docs** — CLAUDE.md "Role Negotiation" section is 3 lines of prose, easy to ignore
3. **Detached from process** — Think/Plan stage commands append negotiation after the main process; agents complete the steps and skip the appendix

## Solution: Two-Layer Enforcement (Approach A)

### Layer 1: Gate Hard Block (`stageArtifacts.ts`)

Change consensus gate to `blockOnFail: true` for Think and Plan stages when `stage.roles.length >= 2`. Other stages remain advisory (`false`).

```ts
// In getStageArtifacts()
blockOnFail: stage.name === 'think' || stage.name === 'plan',
```

This makes `transition.sh` check `docs/negotiation/consensus.md` contains `## Consensus` before allowing Think→Plan or Plan→Build transitions.

### Layer 2: CLAUDE.md Flow Guidance (`claudeMd.ts`)

Rewrite "Role Negotiation" section from 3-line description to explicit MANDATORY protocol with numbered steps and gate block consequence.

Key changes:
- Label as "MANDATORY when multi-role"
- List 7 numbered steps: init → round 1 → verify → round 2 → verify → synthesize → gate check
- Explicitly state transition.sh will block if consensus.md is missing

### Layer 3: Process Integration (`commands.ts`)

- **Think**: Insert negotiation prompt at end of process (before output step), referencing the Negotiation Protocol section
- **Plan**: Strengthen step 3 wording from "Run multi-role review" to explicit reference to mandatory negotiation protocol

## Files Changed

| File | Change |
|------|--------|
| `src/generators/core/stageArtifacts.ts` | Think/Plan consensus gate `blockOnFail: true` |
| `src/generators/engines/claude/claudeMd.ts` | Role Negotiation section rewritten as MANDATORY flow |
| `src/generators/engines/claude/commands.ts` | Think process adds negotiation step; Plan step 3 strengthened |
| `src/generators/core/negotiation.ts` | No changes — protocol design is complete |

## Out of Scope

- Other stages (Review, Reflect) keep advisory consensus checks
- No changes to `negotiateScript.ts` — workspace management works correctly
- No new scripts or files — existing gate infrastructure handles everything
