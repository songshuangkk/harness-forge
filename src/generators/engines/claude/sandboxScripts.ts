import type { ProjectConfig, OutputFile } from '@/types';

// ── Docker sandbox config ──

const DOCKER_COMPOSE = `# docker-compose.sandbox.yml — Isolated execution environment
# Usage: docker compose -f docker-compose.sandbox.yml run sandbox <command>

services:
  sandbox:
    build:
      context: .
      dockerfile: Dockerfile.sandbox
    volumes:
      - .:/workspace
    working_dir: /workspace
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2'
    # Network isolation
    network_mode: none
`;

const DOCKERFILE = `# Dockerfile.sandbox — Minimal sandbox for agent execution
FROM node:20-slim

# Install common tools
RUN apt-get update && apt-get install -y --no-install-recommends \\
    git \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
`;

// ── Secret detection hook (for vault credential policy) ──

const SECRET_CHECK_SCRIPT = `#!/usr/bin/env bash
# secret-check.sh — Detect hardcoded secrets in file content
# Reads stdin JSON, checks for common secret patterns.
# Exit 0 = clean, exit 2 = blocked.

set -euo pipefail

INPUT=$(cat)

# Extract file content from Write/Edit tool input
CONTENT=$(echo "$INPUT" | grep -o '"content":"[^"]*"' | head -1 | sed 's/"content":"//;s/"$//')

if [ -z "$CONTENT" ]; then
  exit 0
fi

# Secret patterns to detect
PATTERNS=(
  "sk-[a-zA-Z0-9]{20,}"
  "ghp_[a-zA-Z0-9]{36}"
  "gho_[a-zA-Z0-9]{36}"
  "xox[baprs]-[a-zA-Z0-9-]+"
  "AKIA[0-9A-Z]{16}"
  "AIza[a-zA-Z0-9_-]{35}"
  "-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----"
  "password\\s*[:=]\\s*['\\""][^'\\""]+['\\""]"
  "api[_-]?key\\s*[:=]\\s*['\\""][^'\\""]+['\\""]"
  "secret\\s*[:=]\\s*['\\""][^'\\""]{8,}['\\""]"
)

BLOCKED=0

for PATTERN in "\${PATTERNS[@]}"; do
  if echo "$CONTENT" | grep -qE "$PATTERN"; then
    echo "BLOCKED: Hardcoded secret detected (pattern: $PATTERN)" >&2
    BLOCKED=1
  fi
done

if [ "$BLOCKED" -eq 1 ]; then
  echo "Use vault or environment variables instead of hardcoded secrets." >&2
  exit 2
fi

exit 0
`;

// ── Main generator ──

export function generateSandboxScripts(config: ProjectConfig): OutputFile[] {
  const { sandbox } = config.architecture;
  const files: OutputFile[] = [];

  // Docker sandbox
  if (sandbox.type === 'docker') {
    files.push({
      path: 'docker-compose.sandbox.yml',
      content: DOCKER_COMPOSE,
    });
    files.push({
      path: 'Dockerfile.sandbox',
      content: DOCKERFILE,
    });
  }

  // Vault credential policy → secret detection hook
  if (sandbox.credentialPolicy === 'vault') {
    files.push({
      path: '.claude/hooks/secret-check.sh',
      content: SECRET_CHECK_SCRIPT,
    });
  }

  // Local sandbox → no extra files needed

  return files;
}

/**
 * Returns whether secret detection hook should be registered.
 */
export function hasSecretCheck(config: ProjectConfig): boolean {
  return config.architecture.sandbox.credentialPolicy === 'vault';
}
