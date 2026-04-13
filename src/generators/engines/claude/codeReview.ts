import type { ProjectConfig, OutputFile, RoleName, RoleConfig, ReviewConfig } from '@/types'
import { getRolePrompt } from '@/generators/core/rolePrompts'

// ── Scan Checklist ──

function renderScanChecklist(
  roles: RoleName[],
  configuredRoles: RoleConfig[],
  dimensions: string[]
): string {
  const lines: string[] = ['## Scan Checklist', '']

  if (dimensions.length > 0) {
    for (const dim of dimensions) {
      lines.push(`- [ ] ${dim}`)
    }
    lines.push('')
  }

  lines.push('### Role Focus Areas')
  lines.push('')

  for (const roleId of roles) {
    const prompt = getRolePrompt(roleId, configuredRoles)
    if (prompt.reviewFocus.length > 0) {
      for (const focus of prompt.reviewFocus) {
        lines.push(`- [ ] ${focus}`)
      }
    }
  }
  lines.push('')

  lines.push('### Standard Checks')
  lines.push('')
  lines.push('- [ ] File paths implemented')
  lines.push('- [ ] No secrets or credentials in code')
  lines.push('- [ ] Error handling present for all critical paths')
  lines.push('- [ ] No unused imports')
  lines.push('- [ ] Naming conventions consistent')
  lines.push('')

  return lines.join('\n')
}

// ── Deep-Dive Protocol ──

function renderSpawnProtocol(severityThreshold: string): string {
  const triggerMap: Record<string, string> = {
    'critical-only': '1+ Critical findings',
    'critical-major': '3+ Critical or Major findings',
    'all': '5+ findings of any severity',
  }
  const trigger = triggerMap[severityThreshold] ?? triggerMap['critical-major']

  const lines: string[] = [
    '## Deep-Dive Protocol',
    '',
    `Spawn condition: **${trigger}**`,
    '',
    'When the threshold is met, spawn sub-agents to investigate specific domains:',
    '',
    '### Spawn Rules',
    '',
    '- Only spawn for domains with Major/Critical issues',
    '- Use a single message with multiple Agent tool calls for parallel spawn',
    '- Sub-agents use `subagent_type: "general-purpose"` (NOT superpowers)',
    '- Do NOT use `isolation: "worktree"`',
    '- Collect all results before composing the final report',
    '',
    '### Domain Table',
    '',
    '| Domain | Focus |',
    '|--------|-------|',
    '| Security | OWASP vulnerability scan |',
    '| Architecture | Coupling and dependency analysis |',
    '| Test coverage | Gap analysis against acceptance criteria |',
    '',
  ]

  return lines.join('\n')
}

// ── Output Template ──

function renderOutputTemplate(autoFix: string): string {
  const lines: string[] = ['## Output Format', '']

  if (autoFix === 'auto') {
    lines.push('> **Auto-fix enabled**: Fix issues as you find them during the scan. Document each fix in the report.')
    lines.push('')
  } else if (autoFix === 'report-only') {
    lines.push('> **Report-only mode**: Document all findings without modifying any files.')
    lines.push('')
  }

  lines.push('```markdown')
  lines.push('# Code Review Report')
  lines.push('')
  lines.push('## Spec Compliance')
  lines.push('')
  lines.push('| Criterion | Status | Notes |')
  lines.push('|-----------|--------|-------|')
  lines.push('| ... | Pass / Fail / Partial | ... |')
  lines.push('')
  lines.push('## Quality Findings')
  lines.push('')
  lines.push('| Severity | Area | Description | File:Line |')
  lines.push('|----------|------|-------------|-----------|')
  lines.push('| Critical/Major/Minor | ... | ... | ... |')
  lines.push('')
  lines.push('## Deep-Dive Reports')
  lines.push('')
  lines.push('_(Populated by sub-agents when spawn threshold is met)_')
  lines.push('')
  lines.push('## Sign-off')
  lines.push('')
  lines.push('- [ ] All Critical issues resolved or documented')
  lines.push('- [ ] All Major issues resolved or have remediation plan')
  lines.push('- [ ] Spec compliance verified')
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}

// ── Main generator ──

export function generateCodeReviewCommand(config: ProjectConfig): OutputFile | null {
  const reviewStage = config.flow.sprint.find(
    (s) => s.name === 'review' && s.enabled
  )

  if (!reviewStage) return null

  const reviewConfig = (reviewStage.stageConfig as ReviewConfig) ?? {
    reviewDimensions: [],
    autoFix: 'report-only',
    severityThreshold: 'critical-major',
  }

  const configuredRoles = config.flow.roles

  // Stage entry protocol
  const stageEntryProtocol = [
    '## Stage Entry (MANDATORY)',
    '',
    'Before doing anything else:',
    '',
    '1. Run: `bash .claude/hooks/transition.sh review`',
    '   - If it fails, DO NOT proceed. Tell the user which gates are blocking.',
    '2. Confirm you are now in the **Review** stage.',
    '',
  ].join('\n')

  // Two-phase process
  const process = [
    '## Process',
    '',
    '### Phase 1: Spec Compliance',
    '',
    '1. Read the implementation plan from `docs/plans/implementation-plan.md`.',
    '2. Compare each task against its acceptance criteria.',
    '3. Verify all file paths from the plan were addressed.',
    '4. List any missing or incomplete items.',
    '',
    '### Phase 2: Code Quality Scan',
    '',
    '1. Scan all changed files for quality issues (see Scan Checklist below).',
    '2. Classify each finding by severity: Critical, Major, Minor.',
    '3. If spawn threshold is met, launch deep-dive sub-agents (see Deep-Dive Protocol).',
    '4. Create or **update** the review report at `docs/reviews/review-report.md`. If the file already exists, **append** new findings — do not overwrite previous sections.',
    '',
  ].join('\n')

  // Scan checklist
  const scanChecklist = renderScanChecklist(
    reviewStage.roles,
    configuredRoles,
    reviewConfig.reviewDimensions
  )

  // Spawn protocol
  const spawnProtocol = renderSpawnProtocol(reviewConfig.severityThreshold)

  // Output template
  const outputTemplate = renderOutputTemplate(reviewConfig.autoFix)

  // Constraints
  const stageConstraints = config.flow.constraints.filter(
    (c) => c.stageId === reviewStage.id || c.stageId === '*'
  )
  const constraintsSection = ['## Constraints', '']
  if (stageConstraints.length > 0) {
    for (const c of stageConstraints) {
      const marker = c.enforced ? '[ENFORCED]' : '[advisory]'
      constraintsSection.push(`- ${marker} ${c.description}`)
    }
  } else {
    constraintsSection.push('None.')
  }
  constraintsSection.push('')

  const assembled = [
    '---',
    'description: "Code review — spec compliance + quality audit with on-demand deep-dive agents"',
    '---',
    '',
    '# Code Review — Deep Quality Audit',
    '',
    stageEntryProtocol,
    process,
    '',
    scanChecklist,
    spawnProtocol,
    outputTemplate,
    constraintsSection.join('\n'),
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')

  return {
    path: '.claude/commands/code-review.md',
    content: assembled,
  }
}
