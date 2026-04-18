# Dual-Mode Hooks Design

## Problem

Hooks (guard.sh, advance.sh, transition.sh, emit-event.sh) assume they always run inside a sprint flow. When called by non-sprint skills or external agents, `state.json` doesn't exist or lacks `sprint.current`, causing the entire hook chain to break.

## Solution

Add mode detection at each hook's entry point. Two modes:

- **Sprint mode**: existing behavior unchanged — gate enforcement, stage progression, document chaining + archival
- **Standalone mode**: hooks become lightweight gate executors — no state machine, no document operations, no stage progression

## Mode Detection

```bash
detect_mode() {
  if [ -f "$HARNESS/state.json" ]; then
    CURRENT=$(jq -r '.sprint.current // empty' "$HARNESS/state.json")
    if [ -n "$CURRENT" ]; then
      echo "sprint"
      return
    fi
  fi
  echo "standalone"
}
```

`state.json` exists + `sprint.current` non-empty → sprint. Otherwise → standalone.

## Hook Behavior by Mode

| Hook | Sprint | Standalone |
|------|--------|------------|
| guard.sh | Enforce tool/permission rules per stage | Security boundary only (protected dirs + dangerous commands), no stage rules |
| advance.sh | Check file gates for current stage | Skip, no file gates to check |
| transition.sh | Validate command gates + advance stage | Execute gate only, return exit code, no state mutation |
| emit-event.sh | Log stage/role events | Optional: log standalone call |

## Standalone transition.sh

Core gate executor. Two invocation patterns:

```bash
# Resolve command from constraints.json by gate name
transition.sh --gate build-lint

# Execute arbitrary command directly
transition.sh --command "cargo clippy"
```

Returns exit code only (0 = pass, non-zero = fail). Does not touch `state.json`, does not advance stage.

## Language Agnostic

Gate commands are resolved from `constraints.json` via `LANGUAGE_ACTION_DEFAULTS` + placeholder resolution. No hardcoded language-specific commands. Standalone mode uses the same resolution mechanism.

## Document Handling

- **Sprint**: document chaining between stages + archival on new sprint (existing behavior)
- **Standalone**: no document generation, validation, or archival. No filesystem side effects beyond gate execution output.

## Scope of Changes

- `src/generators/engines/claude/hooks.ts`: add mode detection + standalone branches to transition.sh, guard.sh, advance.sh templates
- `stageArtifacts.ts`, `constraints.ts`: no changes to core logic
- New: `--gate` and `--command` parameter parsing in transition.sh standalone path
