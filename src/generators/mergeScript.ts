import type { ProjectConfig, OutputFile } from '@/types';

/**
 * Generate a merge script for importing harness into an existing project.
 *
 * The script:
 * 1. Copies `.harness/` (safe — no conflicts)
 * 2. Copies `.claude/hooks/` and `.claude/scripts/` (safe — new files)
 * 3. Copies `.claude/commands/` (safe — new files)
 * 4. Merges hooks/permissions/MCP into existing `.claude/settings.json`
 * 5. Prints instructions for CLAUDE.md integration
 */
export function generateMergeScript(config: ProjectConfig): OutputFile {
  void config;

  const script = `#!/usr/bin/env bash
# harness-import.sh — Merge harness infrastructure into an existing project
# Usage: cd your-project && bash harness-import.sh
set -euo pipefail

SRC_DIR="\$(cd "\$(dirname "\$0")" && pwd)"
DRY_RUN=false

if [ "\${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
  echo "=== DRY RUN — no files will be modified ==="
  echo ""
fi

run() {
  if [ "\$DRY_RUN" = true ]; then
    echo "  [DRY] \$*"
  else
    "\$@"
  fi
}

echo "Harness Forge — Import into existing project"
echo "=============================================="
echo ""

# ── 1. Copy .harness/ (no conflicts — always safe) ──
echo "[1/5] Installing .harness/ infrastructure..."
if [ -d "\$SRC_DIR/.harness" ]; then
  run mkdir -p .harness
  run cp -r "\$SRC_DIR/.harness/"* .harness/
  echo "  ✓ .harness/ copied"
else
  echo "  ⚠ No .harness/ directory found in ZIP"
fi
echo ""

# ── 2. Copy hook and session scripts ──
echo "[2/5] Installing .claude/hooks/ and .claude/scripts/..."
run mkdir -p .claude/hooks .claude/scripts

if [ -d "\$SRC_DIR/.claude/hooks" ]; then
  for f in "\$SRC_DIR/.claude/hooks/"*; do
    [ -f "\$f" ] || continue
    fname=\$(basename "\$f")
    if [ -f ".claude/hooks/\$fname" ]; then
      echo "  ⚠ .claude/hooks/\$fname already exists — skipping (review manually)"
    else
      run cp "\$f" ".claude/hooks/\$fname"
      run chmod +x ".claude/hooks/\$fname"
      echo "  ✓ .claude/hooks/\$fname"
    fi
  done
fi

if [ -d "\$SRC_DIR/.claude/scripts" ]; then
  for f in "\$SRC_DIR/.claude/scripts/"*; do
    [ -f "\$f" ] || continue
    fname=\$(basename "\$f")
    if [ -f ".claude/scripts/\$fname" ]; then
      echo "  ⚠ .claude/scripts/\$fname already exists — skipping (review manually)"
    else
      run cp "\$f" ".claude/scripts/\$fname"
      run chmod +x ".claude/scripts/\$fname"
      echo "  ✓ .claude/scripts/\$fname"
    fi
  done
fi
echo ""

# ── 3. Copy slash commands ──
echo "[3/5] Installing .claude/commands/..."
run mkdir -p .claude/commands

if [ -d "\$SRC_DIR/.claude/commands" ]; then
  for f in "\$SRC_DIR/.claude/commands/"*; do
    [ -f "\$f" ] || continue
    fname=\$(basename "\$f")
    if [ -f ".claude/commands/\$fname" ]; then
      echo "  ⚠ .claude/commands/\$fname already exists — skipping"
    else
      run cp "\$f" ".claude/commands/\$fname"
      echo "  ✓ .claude/commands/\$fname"
    fi
  done
fi
echo ""

# ── 4. Merge settings.json ──
echo "[4/5] Merging .claude/settings.json..."
SETTINGS_SRC="\$SRC_DIR/.claude/settings.json"
SETTINGS_DST=".claude/settings.json"

if [ ! -f "\$SETTINGS_SRC" ]; then
  echo "  ⚠ No settings.json in ZIP — skipping"
elif [ ! -f "\$SETTINGS_DST" ]; then
  # No existing settings — just copy
  run mkdir -p .claude
  run cp "\$SETTINGS_SRC" "\$SETTINGS_DST"
  echo "  ✓ .claude/settings.json created (no existing file)"
else
  # Merge into existing settings.json using jq
  if ! command -v jq &>/dev/null; then
    echo "  ⚠ jq not found — cannot auto-merge settings.json"
    echo "    Manually copy hooks, permissions, and mcpServers from:"
    echo "    \$SETTINGS_SRC"
  else
    # Extract new hooks, permissions, and mcpServers from generated settings
    NEW_HOOKS=\$(jq '.hooks // {}' "\$SETTINGS_SRC")
    NEW_PERMS=\$(jq '.permissions // {}' "\$SETTINGS_SRC")
    NEW_MCP=\$(jq '.mcpServers // {}' "\$SETTINGS_SRC")

    if [ "\$DRY_RUN" = true ]; then
      echo "  [DRY] Would merge into \$SETTINGS_DST:"
      echo "    - Hooks: \$(echo "\$NEW_HOOKS" | jq 'keys')"
      echo "    - Permissions: \$(echo "\$NEW_PERMS" | jq '.allow | length') allow rules"
      echo "    - MCP servers: \$(echo "\$NEW_MCP" | jq 'keys')"
    else
      # Deep-merge: new values take precedence for hook keys
      EXISTING=\$(cat "\$SETTINGS_DST")
      MERGED=\$(echo "\$EXISTING" | jq --argjson hooks "\$NEW_HOOKS" \\
        --argjson perms "\$NEW_PERMS" \\
        --argjson mcp "\$NEW_MCP" '
        .hooks = (.hooks // {} | . + \$hooks) |
        .permissions = (.permissions // {} |
          .allow = ((.allow // []) + (\$perms.allow // []) | unique) |
          .deny = ((.deny // []) + (\$perms.deny // []) | unique)
        ) |
        .mcpServers = (.mcpServers // {} | . * \$mcp)
      ')
      echo "\$MERGED" > "\$SETTINGS_DST"
      echo "  ✓ .claude/settings.json merged (hooks + permissions + MCP)"
    fi
  fi
fi
echo ""

# ── 5. CLAUDE.md instructions ──
echo "[5/5] CLAUDE.md integration"
echo "─────────────────────────────────"
CLAUDE_SRC="\$SRC_DIR/CLAUDE.md"

if [ -f "CLAUDE.md" ]; then
  echo "  You already have a CLAUDE.md. Choose one:"
  echo ""
  echo "  Option A — Replace (overwrite):"
  echo "    cp \$CLAUDE_SRC CLAUDE.md"
  echo ""
  echo "  Option B — Append protocol section:"
  echo "    echo '' >> CLAUDE.md"
  echo "    echo '## Harness Protocol (imported)' >> CLAUDE.md"
  echo "    tail -n +3 \$CLAUDE_SRC >> CLAUDE.md"
  echo ""
  echo "  Option C — Keep separate (reference in your CLAUDE.md):"
  echo "    cp \$CLAUDE_SRC .harness/CLAUDE-protocol.md"
  echo "    # Then add to your CLAUDE.md:"
  echo "    # Read .harness/CLAUDE-protocol.md for harness workflow instructions"
else
  echo "  No existing CLAUDE.md — installing generated version:"
  if [ "\$DRY_RUN" = true ]; then
    echo "  [DRY] cp \$CLAUDE_SRC CLAUDE.md"
  else
    run cp "\$CLAUDE_SRC" "CLAUDE.md"
    echo "  ✓ CLAUDE.md installed"
  fi
fi
echo ""

# ── Done ──
echo "=============================================="
echo "Import complete!"
echo ""
echo "Next steps:"
echo "  1. bash .claude/scripts/session-init.sh"
echo "  2. Start your sprint: /think"
echo "  3. Check status: bash .harness/scripts/check.sh"
echo ""

# Cleanup: remove self if not dry run
if [ "\$DRY_RUN" = false ]; then
  rm -f "\$0" 2>/dev/null || true
fi
`;

  return {
    path: 'harness-import.sh',
    content: script,
  };
}
