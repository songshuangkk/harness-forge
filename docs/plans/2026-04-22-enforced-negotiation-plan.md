# Enforced Multi-Role Negotiation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce multi-role negotiation consensus as a blocking gate in Think and Plan stages, so agents cannot skip the two-round review process.

**Architecture:** Two-layer enforcement — (1) consensus gate becomes `blockOnFail: true` in Think/Plan so `transition.sh` blocks advancement, (2) CLAUDE.md and stage commands explicitly frame negotiation as MANDATORY with numbered steps.

**Tech Stack:** TypeScript, no test framework — verify via `npm run build`.

---

### Task 1: Make consensus gate blocking for Think/Plan

**Files:**
- Modify: `src/generators/core/stageArtifacts.ts:190-201`

**Step 1: Edit `getStageArtifacts` — change `blockOnFail` to be stage-aware**

In `src/generators/core/stageArtifacts.ts`, replace the consensus artifact push block (lines 190-201):

```ts
  // Multi-role stages: add consensus artifact — blocking for Think/Plan
  if (stage.roles.length >= 2) {
    const hasConsensus = artifacts.some((a) => a.path === 'docs/negotiation/consensus.md');
    if (!hasConsensus) {
      artifacts.push({
        path: 'docs/negotiation/consensus.md',
        description: 'Multi-role negotiation consensus',
        verification: 'contains-section',
        sectionMarker: '## Consensus',
        blockOnFail: stage.name === 'think' || stage.name === 'plan',
      });
    }
  }
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add src/generators/core/stageArtifacts.ts
git commit -m "feat(gates): block Think/Plan transitions on missing consensus"
```

---

### Task 2: Rewrite CLAUDE.md Role Negotiation section

**Files:**
- Modify: `src/generators/engines/claude/claudeMd.ts:102-106`

**Step 1: Replace the "Role Negotiation" section in `generateClaudeMd`**

In `src/generators/engines/claude/claudeMd.ts`, replace lines 102-106:

Old:
```ts
    '### Role Negotiation',
    '',
    'Stages with 2+ assigned roles run a multi-round negotiation before executing.',
    'Each role spawns as a sub-agent, writes independent perspectives, cross-reads, then synthesizes consensus.',
    'Workspace: `docs/negotiation/` — check status with `bash .claude/scripts/negotiate.sh status`.',
```

New:
```ts
    '### Role Negotiation (Think + Plan — MANDATORY when multi-role)',
    '',
    'Think and Plan stages with 2+ assigned roles MUST complete negotiation before advancing:',
    '',
    '1. **Init**: `bash .claude/scripts/negotiate.sh init <stage> <role1,role2,...>`',
    '2. **Round 1**: Spawn sub-agents in parallel — each role independently reviews stage docs, writes to `docs/negotiation/round-1/<role>.md`',
    '3. **Verify Round 1**: `bash .claude/scripts/negotiate.sh check-round 1`',
    '4. **Round 2**: Spawn sub-agents — each role reads ALL Round 1 perspectives, writes revised assessment to `docs/negotiation/round-2/<role>.md`',
    '5. **Verify Round 2**: `bash .claude/scripts/negotiate.sh check-round 2`',
    '6. **Synthesize**: Read all Round 2 files, write `docs/negotiation/consensus.md` with agreed points, trade-offs, and resolution',
    '7. **Gate check**: `transition.sh` will block advancement if consensus.md is missing `## Consensus` section',
    '',
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/generators/engines/claude/claudeMd.ts
git commit -m "feat(claude-md): rewrite negotiation section as mandatory flow"
```

---

### Task 3: Add negotiation step to Think stage process

**Files:**
- Modify: `src/generators/engines/claude/commands.ts:136-154`

**Step 1: Append negotiation prompt to Think process**

In `src/generators/engines/claude/commands.ts`, modify the `think` entry in `STATIC_COMMANDS` (lines 136-154).

Change the last line of the process from:
```
7. Output the design document to feed into the Plan stage.`,
```

To:
```
7. Output the design document to feed into the Plan stage.

**Negotiation (MANDATORY — if 2+ roles assigned)**: Before finalizing output, run the full Negotiation Protocol below. The consensus gate will block advancement to Plan if `docs/negotiation/consensus.md` is missing. Do NOT skip this.`,
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/generators/engines/claude/commands.ts
git commit -m "feat(commands): add mandatory negotiation prompt to Think process"
```

---

### Task 4: Strengthen Plan stage negotiation wording

**Files:**
- Modify: `src/generators/engines/claude/commands.ts:39` (structured variant)
- Modify: `src/generators/engines/claude/commands.ts:53` (simple variant)

**Step 1: Update Plan process step 3 — structured variant**

In `src/generators/engines/claude/commands.ts`, in `generatePlanProcess` function, for the `structured` branch, change line 39:

Old:
```ts
3. **Run multi-role review** (see Role Perspectives below for each role's focus).
```

New:
```ts
3. **Run multi-role negotiation** (MANDATORY — see Negotiation Protocol section below for sub-agent prompts). The consensus gate will block advancement if `docs/negotiation/consensus.md` is missing.
```

**Step 2: Update Plan process step 3 — simple variant**

For the `simple` branch (around line 53), change:

Old:
```ts
3. **Run multi-role review** (see Role Perspectives below for each role's focus).
```

New:
```ts
3. **Run multi-role negotiation** (MANDATORY — see Negotiation Protocol section below for sub-agent prompts). The consensus gate will block advancement if `docs/negotiation/consensus.md` is missing.
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/generators/engines/claude/commands.ts
git commit -m "feat(commands): strengthen Plan negotiation wording to MANDATORY"
```

---

### Task 5: Final build + lint verification

**Step 1: Run full build**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 2: Run lint**

Run: `npm run lint`
Expected: No new warnings.

**Step 3: Verify generated output (manual spot-check)**

Run `npm run dev`, navigate to Generate page, generate a config with multi-role Think/Plan stages, and verify:
- Downloaded ZIP contains CLAUDE.md with the new "MANDATORY" negotiation section
- `constraints.json` shows `blockOnFail: true` for Think/Plan consensus gates
- Stage command `.claude/commands/think.md` includes negotiation prompt
- Stage command `.claude/commands/plan.md` has strengthened step 3

**Step 4: Commit all remaining changes if any**

```bash
git add -A
git commit -m "chore: final cleanup for enforced negotiation feature"
```
