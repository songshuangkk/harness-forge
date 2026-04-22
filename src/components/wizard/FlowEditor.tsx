'use client';

import { useState, useCallback } from 'react';
import { useProjectConfig } from '@/store/useProjectConfig';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  SprintStage,
  StageName,
  RoleName,
  ThinkConfig,
  PlanConfig,
  BuildConfig,
  ReviewConfig,
  TestConfig,
  ShipConfig,
  ReflectConfig,
  Language,
} from '@/types';

// ---------------------------------------------------------------------------
// Stage colour system
// ---------------------------------------------------------------------------

interface StageColor {
  bg: string;
  accent: string;
  accentBg: string;
  text: string;
  textMuted: string;
}

const STAGE_COLORS: Record<StageName, StageColor> = {
  think:   { bg: 'oklch(0.945 0.018 250)', accent: 'oklch(0.48 0.10 250)', accentBg: 'oklch(0.92 0.04 250)', text: 'oklch(0.28 0.04 250)', textMuted: 'oklch(0.52 0.03 250)' },
  plan:    { bg: 'oklch(0.945 0.028 80)',  accent: 'oklch(0.50 0.11 80)',  accentBg: 'oklch(0.92 0.05 80)',  text: 'oklch(0.30 0.05 80)',  textMuted: 'oklch(0.50 0.04 80)' },
  build:   { bg: 'oklch(0.945 0.025 160)', accent: 'oklch(0.48 0.10 160)', accentBg: 'oklch(0.92 0.045 160)', text: 'oklch(0.25 0.05 160)', textMuted: 'oklch(0.48 0.03 160)' },
  review:  { bg: 'oklch(0.945 0.022 310)', accent: 'oklch(0.48 0.09 310)', accentBg: 'oklch(0.92 0.04 310)', text: 'oklch(0.30 0.04 310)', textMuted: 'oklch(0.50 0.03 310)' },
  test:    { bg: 'oklch(0.945 0.020 200)', accent: 'oklch(0.48 0.09 200)', accentBg: 'oklch(0.92 0.04 200)', text: 'oklch(0.25 0.04 200)', textMuted: 'oklch(0.48 0.03 200)' },
  ship:    { bg: 'oklch(0.945 0.035 50)',  accent: 'oklch(0.52 0.13 50)',  accentBg: 'oklch(0.92 0.06 50)',  text: 'oklch(0.30 0.06 50)',  textMuted: 'oklch(0.52 0.04 50)' },
  reflect: { bg: 'oklch(0.945 0.022 15)',  accent: 'oklch(0.50 0.10 15)',  accentBg: 'oklch(0.92 0.04 15)',  text: 'oklch(0.30 0.05 15)',  textMuted: 'oklch(0.50 0.03 15)' },
};

const STAGE_META: Record<StageName, { label: string; abbr: string; icon: string; description: string }> = {
  think:   { label: 'Think',   abbr: 'TH', icon: '◆', description: 'Problem redefinition via forcing questions' },
  plan:    { label: 'Plan',    abbr: 'PL', icon: '◎', description: 'Multi-role architecture review' },
  build:   { label: 'Build',   abbr: 'BD', icon: '▲', description: 'Implementation with strategy' },
  review:  { label: 'Review',  abbr: 'RV', icon: '◇', description: 'Multi-dimensional quality audit' },
  test:    { label: 'Test',    abbr: 'TS', icon: '○', description: 'Evidence-based verification' },
  ship:    { label: 'Ship',    abbr: 'SH', icon: '▶', description: 'Release pipeline' },
  reflect: { label: 'Reflect', abbr: 'RF', icon: '✦', description: 'Retrospective with learning' },
};

interface StageExamples {
  gateHint: string;
  gateExamples: string[];
  outputHint: string;
  outputExamples: string[];
}

const STAGE_EXAMPLES: Record<StageName, StageExamples> = {
  think:   { gateHint: 'Must be resolved before planning begins', gateExamples: ['Problem statement defined', 'Success metrics agreed', 'Stakeholders aligned'], outputHint: 'Design doc → feeds into Plan', outputExamples: ['design document', 'problem analysis', 'feasibility report'] },
  plan:    { gateHint: 'Must be approved before building starts', gateExamples: ['Architecture reviewed', 'Tasks estimated', 'Dependencies mapped'], outputHint: 'Implementation plan', outputExamples: ['structured plan with file paths', 'architecture diagram', 'sprint backlog'] },
  build:   { gateHint: 'Code quality checks before review', gateExamples: ['All tests pass', 'No lint errors', 'TDD cycle complete'], outputHint: 'What the agent produces', outputExamples: ['source code + tests', 'component library', 'API endpoints'] },
  review:  { gateHint: 'Quality bar before testing', gateExamples: ['No critical issues', 'Spec compliance verified', 'Security reviewed'], outputHint: 'Review output', outputExamples: ['review report with ratings', 'auto-fix commits', 'improvement suggestions'] },
  test:    { gateHint: 'Evidence of correctness', gateExamples: ['Coverage target met', 'All edge cases covered', 'No flaky tests'], outputHint: 'Test artifacts', outputExamples: ['test results JSON', 'coverage report', 'regression suite'] },
  ship:    { gateHint: 'Release readiness', gateExamples: ['Version bumped', 'Changelog updated', 'CI pipeline green'], outputHint: 'Release artifacts', outputExamples: ['release notes', 'deployment manifest', 'PR'] },
  reflect: { gateHint: 'Lessons captured', gateExamples: ['Retrospective notes written', 'Action items assigned', 'Learnings persisted'], outputHint: 'Retrospective output', outputExamples: ['lessons learned', 'process improvements', 'velocity report'] },
};

const ALL_ROLES: { id: RoleName; label: string }[] = [
  { id: 'ceo', label: 'CEO' },
  { id: 'designer', label: 'Designer' },
  { id: 'eng-manager', label: 'Eng Mgr' },
  { id: 'qa', label: 'QA' },
  { id: 'security', label: 'Security' },
  { id: 'release', label: 'Release' },
  { id: 'doc-engineer', label: 'Docs' },
];

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

function SectionLabel({ title, hint, color }: { title: string; hint?: string; color: StageColor }) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <span className="text-xs font-semibold" style={{ color: color.text }}>{title}</span>
      {hint && <span className="text-[10px]" style={{ color: color.textMuted }}>{hint}</span>}
    </div>
  );
}

function ToggleChips({ options, labels, selected, onToggle, color }: {
  options: string[];
  labels?: Record<string, string>;
  selected: string[];
  onToggle: (value: string) => void;
  color: StageColor;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const isActive = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className="rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200"
            style={{
              backgroundColor: isActive ? color.accentBg : 'oklch(0.975 0.003 75)',
              color: isActive ? color.accent : color.textMuted,
            }}
          >
            {labels?.[opt] ?? opt}
          </button>
        );
      })}
    </div>
  );
}

function TagChips({ items, onRemove, color }: { items: string[]; onRemove: (i: number) => void; color: StageColor }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs" style={{ backgroundColor: color.accentBg, color: color.textMuted }}>
          {item}
          <button onClick={() => onRemove(i)} className="ml-0.5" style={{ color: color.accent }}>×</button>
        </span>
      ))}
    </div>
  );
}

function ExampleChips({ examples, onClick, isUsed, color }: {
  examples: string[];
  onClick: (v: string) => void;
  isUsed: (v: string) => boolean;
  color: StageColor;
}) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      <span className="text-[10px] py-0.5" style={{ color: color.textMuted }}>e.g.</span>
      {examples.map((ex) => {
        const used = isUsed(ex);
        return (
          <button key={ex} onClick={() => !used && onClick(ex)} disabled={used}
            className="rounded px-1.5 py-0.5 text-[10px] transition-all duration-200 disabled:opacity-40"
            style={{ backgroundColor: used ? 'oklch(0.96 0.003 75)' : 'oklch(0.975 0.002 75)', color: color.textMuted, textDecoration: used ? 'line-through' : 'none' }}
          >
            {ex}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage-specific config sections — three-framework fusion
// ---------------------------------------------------------------------------

const THINK_DIMENSIONS = [
  { id: 'problem-framing', label: 'Problem Framing' },
  { id: 'success-metrics', label: 'Success Metrics' },
  { id: 'constraints', label: 'Constraints' },
  { id: 'alternatives', label: 'Alternatives' },
  { id: 'scope', label: 'Scope' },
  { id: 'risks', label: 'Risks' },
];

function ThinkConfigSection({ config, onChange, color }: { config: ThinkConfig; onChange: (p: Partial<ThinkConfig>) => void; color: StageColor }) {
  return (
    <div className="space-y-3">
      <SectionLabel title="Interrogation Dimensions" hint="Which aspects to probe (GStack /office-hours)" color={color} />
      <ToggleChips
        options={THINK_DIMENSIONS.map((d) => d.id)}
        labels={Object.fromEntries(THINK_DIMENSIONS.map((d) => [d.id, d.label]))}
        selected={config.dimensions}
        onToggle={(v) => {
          const next = config.dimensions.includes(v) ? config.dimensions.filter((d) => d !== v) : [...config.dimensions, v];
          onChange({ dimensions: next });
        }}
        color={color}
      />
      <SectionLabel title="Analysis Depth" hint="How deep the agent should probe" color={color} />
      <Select value={config.depth} onValueChange={(v) => onChange({ depth: v as ThinkConfig['depth'] })}>
        <SelectTrigger className="h-7 max-w-xs text-xs" style={{ backgroundColor: 'oklch(0.975 0.003 75)' }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="quick">Quick Assessment</SelectItem>
          <SelectItem value="deep">Deep Analysis</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

const PLAN_REVIEW_TYPES = [
  { id: 'ceo-review', label: 'CEO Review' },
  { id: 'eng-review', label: 'Eng Review' },
  { id: 'design-review', label: 'Design Review' },
  { id: 'dx-review', label: 'DX Review' },
];

function PlanConfigSection({ config, onChange, color }: { config: PlanConfig; onChange: (p: Partial<PlanConfig>) => void; color: StageColor }) {
  return (
    <div className="space-y-3">
      <SectionLabel title="Review Pipeline" hint="Which reviews to run before building (GStack /autoplan)" color={color} />
      <ToggleChips
        options={PLAN_REVIEW_TYPES.map((r) => r.id)}
        labels={Object.fromEntries(PLAN_REVIEW_TYPES.map((r) => [r.id, r.label]))}
        selected={config.reviewTypes}
        onToggle={(v) => {
          const next = config.reviewTypes.includes(v) ? config.reviewTypes.filter((r) => r !== v) : [...config.reviewTypes, v];
          onChange({ reviewTypes: next });
        }}
        color={color}
      />
      <SectionLabel title="Task Structure" hint="How detailed the plan must be (Superpowers methodology)" color={color} />
      <Select value={config.taskStructure} onValueChange={(v) => onChange({ taskStructure: v as PlanConfig['taskStructure'] })}>
        <SelectTrigger className="h-7 max-w-xs text-xs" style={{ backgroundColor: 'oklch(0.975 0.003 75)' }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="simple">Simple Task List</SelectItem>
          <SelectItem value="structured">Structured — file paths + verification steps per task</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function BuildConfigSection({ config, onChange, color }: { config: BuildConfig; onChange: (p: Partial<BuildConfig>) => void; color: StageColor }) {
  const [pathInput, setPathInput] = useState('');
  const defaultPaths = '**/src/**, **/test/**, docs/**';

  return (
    <div className="space-y-3">
      <SectionLabel title="Execution Strategy" hint="How the agent executes tasks (Superpowers subagent model)" color={color} />
      <Select value={config.executionStrategy} onValueChange={(v) => onChange({ executionStrategy: v as BuildConfig['executionStrategy'] })}>
        <SelectTrigger className="h-7 max-w-xs text-xs" style={{ backgroundColor: 'oklch(0.975 0.003 75)' }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="single-agent">Single Agent</SelectItem>
          <SelectItem value="subagent-parallel">Subagent Parallel</SelectItem>
        </SelectContent>
      </Select>
      <SectionLabel title="TDD Mode" hint="RED-GREEN-REFACTOR enforcement (Superpowers)" color={color} />
      <Select value={config.tddMode} onValueChange={(v) => onChange({ tddMode: v as BuildConfig['tddMode'] })}>
        <SelectTrigger className="h-7 max-w-xs text-xs" style={{ backgroundColor: 'oklch(0.975 0.003 75)' }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="enforced">Enforced — RED-GREEN-REFACTOR mandatory</SelectItem>
          <SelectItem value="optional">Optional — write code first if preferred</SelectItem>
        </SelectContent>
      </Select>
      <SectionLabel title="Write Paths" hint="Glob patterns for allowed write targets (default: use defaults below)" color={color} />
      {config.writePaths && config.writePaths.length > 0 && (
        <TagChips items={config.writePaths} onRemove={(i) => onChange({ writePaths: config.writePaths!.filter((_, idx) => idx !== i) })} color={color} />
      )}
      <div className="flex items-center gap-1.5">
        <Input placeholder={defaultPaths} value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pathInput.trim()) {
              e.preventDefault();
              const current = config.writePaths ?? [];
              if (!current.includes(pathInput.trim())) onChange({ writePaths: [...current, pathInput.trim()] });
              setPathInput('');
            }
          }}
          className="h-7 flex-1 max-w-xs text-xs font-mono" style={{ backgroundColor: 'oklch(0.975 0.003 75)' }} />
        <button onClick={() => {
          if (pathInput.trim()) {
            const current = config.writePaths ?? [];
            if (!current.includes(pathInput.trim())) onChange({ writePaths: [...current, pathInput.trim()] });
            setPathInput('');
          }
        }} className="flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium disabled:opacity-30"
          disabled={!pathInput.trim()} style={{ backgroundColor: color.accentBg, color: color.accent }}>+ Add</button>
        {config.writePaths && config.writePaths.length > 0 && (
          <button onClick={() => onChange({ writePaths: undefined })}
            className="rounded px-2 py-1 text-[10px] font-medium whitespace-nowrap"
            style={{ color: color.textMuted }}>Reset</button>
        )}
      </div>
    </div>
  );
}

const REVIEW_DIMENSIONS = [
  { id: 'spec-compliance', label: 'Spec Compliance' },
  { id: 'code-quality', label: 'Code Quality' },
  { id: 'security', label: 'Security' },
  { id: 'performance', label: 'Performance' },
];

function ReviewConfigSection({ config, onChange, color }: { config: ReviewConfig; onChange: (p: Partial<ReviewConfig>) => void; color: StageColor }) {
  return (
    <div className="space-y-3">
      <SectionLabel title="Review Dimensions" hint="What to check (GStack /review + Superpowers two-stage)" color={color} />
      <ToggleChips
        options={REVIEW_DIMENSIONS.map((d) => d.id)}
        labels={Object.fromEntries(REVIEW_DIMENSIONS.map((d) => [d.id, d.label]))}
        selected={config.reviewDimensions}
        onToggle={(v) => {
          const next = config.reviewDimensions.includes(v) ? config.reviewDimensions.filter((d) => d !== v) : [...config.reviewDimensions, v];
          onChange({ reviewDimensions: next });
        }}
        color={color}
      />
      <SectionLabel title="Auto-Fix Policy" hint="Should the agent fix obvious issues?" color={color} />
      <Select value={config.autoFix} onValueChange={(v) => onChange({ autoFix: v as ReviewConfig['autoFix'] })}>
        <SelectTrigger className="h-7 max-w-xs text-xs" style={{ backgroundColor: 'oklch(0.975 0.003 75)' }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Auto-fix obvious issues</SelectItem>
          <SelectItem value="report-only">Report only — no auto changes</SelectItem>
        </SelectContent>
      </Select>
      <SectionLabel title="Severity Threshold" hint="Minimum severity to report" color={color} />
      <Select value={config.severityThreshold} onValueChange={(v) => onChange({ severityThreshold: (v ?? 'all') as ReviewConfig['severityThreshold'] })}>
        <SelectTrigger className="h-7 max-w-xs text-xs" style={{ backgroundColor: 'oklch(0.975 0.003 75)' }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All issues</SelectItem>
          <SelectItem value="critical-major">Critical + Major</SelectItem>
          <SelectItem value="critical-only">Critical only</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

const TEST_METHODS = ['tdd', 'exploratory', 'regression'];
const TEST_METHOD_LABELS: Record<string, string> = { tdd: 'TDD', exploratory: 'Exploratory', regression: 'Regression' };
const TEST_TYPES = ['unit', 'integration', 'e2e', 'browser', 'performance', 'security'];
const TEST_TYPE_LABELS: Record<string, string> = { unit: 'Unit', integration: 'Integration', e2e: 'E2E', browser: 'Browser', performance: 'Performance', security: 'Security' };

const LANGUAGE_TEST_DEFAULTS: Record<Language, { test: string; coverage: string }> = {
  typescript: { test: 'npm test', coverage: 'npm run coverage' },
  javascript: { test: 'npm test', coverage: 'npm run coverage' },
  python:     { test: 'pytest', coverage: 'pytest --cov --cov-report=term-missing' },
  go:         { test: 'go test ./...', coverage: 'go test -cover ./...' },
  java:       { test: 'mvn test', coverage: 'mvn test jacoco:report' },
  rust:       { test: 'cargo test', coverage: 'cargo tarpaulin' },
  dart:       { test: 'flutter test', coverage: 'flutter test --coverage' },
};

function TestConfigSection({ config, onChange, color }: { config: TestConfig; onChange: (p: Partial<TestConfig>) => void; color: StageColor }) {
  const language = useProjectConfig((s) => s.config.project.techStack.language);
  const defaults = LANGUAGE_TEST_DEFAULTS[language] ?? LANGUAGE_TEST_DEFAULTS.typescript;
  const [testPathInput, setTestPathInput] = useState('');
  const testDefaultPaths = '**/test/**, docs/**';

  return (
    <div className="space-y-3">
      <SectionLabel title="Test Methods" hint="Methodology (Superpowers evidence over claims)" color={color} />
      <ToggleChips options={TEST_METHODS} labels={TEST_METHOD_LABELS} selected={config.testMethods}
        onToggle={(v) => { const next = config.testMethods.includes(v) ? config.testMethods.filter((m) => m !== v) : [...config.testMethods, v]; onChange({ testMethods: next }); }}
        color={color}
      />
      <SectionLabel title={`Coverage Target: ${config.coverageTarget}%`} hint="Minimum code coverage" color={color} />
      <div className="max-w-xs">
        <Slider value={[config.coverageTarget]} onValueChange={(v) => onChange({ coverageTarget: Array.isArray(v) ? v[0] : v })} min={0} max={100} step={5} />
      </div>
      <SectionLabel title="Test Types" hint="What to test (GStack /qa real browser)" color={color} />
      <ToggleChips options={TEST_TYPES} labels={TEST_TYPE_LABELS} selected={config.testTypes}
        onToggle={(v) => { const next = config.testTypes.includes(v) ? config.testTypes.filter((t) => t !== v) : [...config.testTypes, v]; onChange({ testTypes: next }); }}
        color={color}
      />
      <SectionLabel title="Environment" hint="Where tests run (Sandbox isolation)" color={color} />
      <Select value={config.environment} onValueChange={(v) => onChange({ environment: v ?? '' })}>
        <SelectTrigger className="h-7 max-w-xs text-xs" style={{ backgroundColor: 'oklch(0.975 0.003 75)' }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="local">Local</SelectItem>
          <SelectItem value="staging">Staging</SelectItem>
          <SelectItem value="production">Production</SelectItem>
        </SelectContent>
      </Select>
      <SectionLabel title="Test Command" hint="Command to run tests (used in tdd.json and gate scripts)" color={color} />
      <div className="flex items-center gap-2 max-w-md">
        <Input
          placeholder={defaults.test}
          value={config.testCommand}
          onChange={(e) => onChange({ testCommand: e.target.value })}
          className="h-7 flex-1 text-xs font-mono"
          style={{ backgroundColor: 'oklch(0.975 0.003 75)' }}
        />
        {!config.testCommand && (
          <button onClick={() => onChange({ testCommand: defaults.test })}
            className="rounded px-2 py-1 text-[10px] font-medium whitespace-nowrap"
            style={{ backgroundColor: color.accentBg, color: color.accent }}>
            Use {defaults.test}
          </button>
        )}
      </div>
      <SectionLabel title="Coverage Command" hint="Command to measure coverage" color={color} />
      <div className="flex items-center gap-2 max-w-md">
        <Input
          placeholder={defaults.coverage}
          value={config.coverageCommand}
          onChange={(e) => onChange({ coverageCommand: e.target.value })}
          className="h-7 flex-1 text-xs font-mono"
          style={{ backgroundColor: 'oklch(0.975 0.003 75)' }}
        />
        {!config.coverageCommand && (
          <button onClick={() => onChange({ coverageCommand: defaults.coverage })}
            className="rounded px-2 py-1 text-[10px] font-medium whitespace-nowrap"
            style={{ backgroundColor: color.accentBg, color: color.accent }}>
            Use {defaults.coverage}
          </button>
        )}
      </div>
      <SectionLabel title="Write Paths" hint="Glob patterns for allowed write targets (default: use defaults below)" color={color} />
      {config.writePaths && config.writePaths.length > 0 && (
        <TagChips items={config.writePaths} onRemove={(i) => onChange({ writePaths: config.writePaths!.filter((_, idx) => idx !== i) })} color={color} />
      )}
      <div className="flex items-center gap-1.5">
        <Input placeholder={testDefaultPaths} value={testPathInput}
          onChange={(e) => setTestPathInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && testPathInput.trim()) {
              e.preventDefault();
              const current = config.writePaths ?? [];
              if (!current.includes(testPathInput.trim())) onChange({ writePaths: [...current, testPathInput.trim()] });
              setTestPathInput('');
            }
          }}
          className="h-7 flex-1 max-w-xs text-xs font-mono" style={{ backgroundColor: 'oklch(0.975 0.003 75)' }} />
        <button onClick={() => {
          if (testPathInput.trim()) {
            const current = config.writePaths ?? [];
            if (!current.includes(testPathInput.trim())) onChange({ writePaths: [...current, testPathInput.trim()] });
            setTestPathInput('');
          }
        }} className="flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium disabled:opacity-30"
          disabled={!testPathInput.trim()} style={{ backgroundColor: color.accentBg, color: color.accent }}>+ Add</button>
        {config.writePaths && config.writePaths.length > 0 && (
          <button onClick={() => onChange({ writePaths: undefined })}
            className="rounded px-2 py-1 text-[10px] font-medium whitespace-nowrap"
            style={{ color: color.textMuted }}>Reset</button>
        )}
      </div>
    </div>
  );
}

const SHIP_PIPELINE = ['run-tests', 'create-pr', 'merge', 'deploy'];
const SHIP_PIPELINE_LABELS: Record<string, string> = { 'run-tests': 'Run Tests', 'create-pr': 'Create PR', 'merge': 'Merge', 'deploy': 'Deploy' };
const DEPLOY_TARGETS = ['staging', 'production', 'canary'];
const DEPLOY_LABELS: Record<string, string> = { staging: 'Staging', production: 'Production', canary: 'Canary' };

function ShipConfigSection({ config, onChange, color }: { config: ShipConfig; onChange: (p: Partial<ShipConfig>) => void; color: StageColor }) {
  return (
    <div className="space-y-3">
      <SectionLabel title="Release Pipeline" hint="Steps to include (GStack /ship + /land-and-deploy)" color={color} />
      <ToggleChips options={SHIP_PIPELINE} labels={SHIP_PIPELINE_LABELS} selected={config.pipeline}
        onToggle={(v) => { const next = config.pipeline.includes(v) ? config.pipeline.filter((p) => p !== v) : [...config.pipeline, v]; onChange({ pipeline: next }); }}
        color={color}
      />
      <SectionLabel title="Version Strategy" hint="How version numbers are bumped" color={color} />
      <Select value={config.versionStrategy} onValueChange={(v) => onChange({ versionStrategy: v ?? '' })}>
        <SelectTrigger className="h-7 max-w-xs text-xs" style={{ backgroundColor: 'oklch(0.975 0.003 75)' }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="semver-patch">Patch (0.0.x) — bug fixes</SelectItem>
          <SelectItem value="semver-minor">Minor (0.x.0) — new features</SelectItem>
          <SelectItem value="semver-major">Major (x.0.0) — breaking changes</SelectItem>
          <SelectItem value="custom">Custom — manual versioning</SelectItem>
        </SelectContent>
      </Select>
      <SectionLabel title="Deployment Targets" hint="Where to deploy (Session replay as audit trail)" color={color} />
      <ToggleChips options={DEPLOY_TARGETS} labels={DEPLOY_LABELS} selected={config.deploymentTargets}
        onToggle={(v) => { const next = config.deploymentTargets.includes(v) ? config.deploymentTargets.filter((t) => t !== v) : [...config.deploymentTargets, v]; onChange({ deploymentTargets: next }); }}
        color={color}
      />
    </div>
  );
}

const REFLECT_DIMS = ['velocity', 'quality', 'test-health', 'growth'];
const REFLECT_LABELS: Record<string, string> = { velocity: 'Velocity', quality: 'Quality', 'test-health': 'Test Health', growth: 'Growth' };

function ReflectConfigSection({ config, onChange, color }: { config: ReflectConfig; onChange: (p: Partial<ReflectConfig>) => void; color: StageColor }) {
  return (
    <div className="space-y-3">
      <SectionLabel title="Retrospective Dimensions" hint="Areas to evaluate (GStack /retro)" color={color} />
      <ToggleChips options={REFLECT_DIMS} labels={REFLECT_LABELS} selected={config.dimensions}
        onToggle={(v) => { const next = config.dimensions.includes(v) ? config.dimensions.filter((d) => d !== v) : [...config.dimensions, v]; onChange({ dimensions: next }); }}
        color={color}
      />
      <SectionLabel title="Learning Persistence" hint="Save learnings for future sessions (Superpowers cross-session)" color={color} />
      <Select value={config.persistLearning} onValueChange={(v) => onChange({ persistLearning: v as ReflectConfig['persistLearning'] })}>
        <SelectTrigger className="h-7 max-w-xs text-xs" style={{ backgroundColor: 'oklch(0.975 0.003 75)' }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="project-memory">Save to project memory</SelectItem>
          <SelectItem value="session-only">This session only</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage config dispatcher
// ---------------------------------------------------------------------------

function StageConfigSection({ stage, onUpdateConfig, color }: {
  stage: SprintStage;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  color: StageColor;
}) {
  const config = stage.stageConfig;
  if (!config) return null;
  switch (stage.name) {
    case 'think':   return <ThinkConfigSection config={config as ThinkConfig} onChange={(p) => onUpdateConfig(p)} color={color} />;
    case 'plan':    return <PlanConfigSection config={config as PlanConfig} onChange={(p) => onUpdateConfig(p)} color={color} />;
    case 'build':   return <BuildConfigSection config={config as BuildConfig} onChange={(p) => onUpdateConfig(p)} color={color} />;
    case 'review':  return <ReviewConfigSection config={config as ReviewConfig} onChange={(p) => onUpdateConfig(p)} color={color} />;
    case 'test':    return <TestConfigSection config={config as TestConfig} onChange={(p) => onUpdateConfig(p)} color={color} />;
    case 'ship':    return <ShipConfigSection config={config as ShipConfig} onChange={(p) => onUpdateConfig(p)} color={color} />;
    case 'reflect': return <ReflectConfigSection config={config as ReflectConfig} onChange={(p) => onUpdateConfig(p)} color={color} />;
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// FlowEditor — main component
// ---------------------------------------------------------------------------

interface FlowEditorProps {
  sprint: SprintStage[];
  onChange: (sprint: SprintStage[]) => void;
}

export function FlowEditor({ sprint, onChange }: FlowEditorProps) {
  const updateStage = useCallback(
    (stageId: string, patch: Partial<SprintStage>) => {
      onChange(sprint.map((s) => s.id === stageId ? { ...s, ...patch } : s));
    },
    [sprint, onChange]
  );

  const toggleRole = useCallback(
    (stageId: string, role: RoleName) => {
      const stage = sprint.find((s) => s.id === stageId);
      if (!stage) return;
      updateStage(stageId, { roles: stage.roles.includes(role) ? stage.roles.filter((r) => r !== role) : [...stage.roles, role] });
    },
    [sprint, updateStage]
  );

  const toggleNegotiationRole = useCallback(
    (stageId: string, role: RoleName) => {
      const stage = sprint.find((s) => s.id === stageId);
      if (!stage) return;
      const current = stage.negotiationRoles ?? [];
      const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
      updateStage(stageId, { negotiationRoles: next });
    },
    [sprint, updateStage]
  );

  const addGate = useCallback(
    (stageId: string, value: string) => {
      const stage = sprint.find((s) => s.id === stageId);
      if (!stage || !value.trim() || stage.gates.includes(value.trim())) return;
      updateStage(stageId, { gates: [...stage.gates, value.trim()] });
    },
    [sprint, updateStage]
  );

  const removeGate = useCallback(
    (stageId: string, index: number) => {
      const stage = sprint.find((s) => s.id === stageId);
      if (!stage) return;
      updateStage(stageId, { gates: stage.gates.filter((_, i) => i !== index) });
    },
    [sprint, updateStage]
  );

  const updateStageConfig = useCallback(
    (stageId: string, patch: Record<string, unknown>) => {
      const stage = sprint.find((s) => s.id === stageId);
      if (!stage?.stageConfig) return;
      updateStage(stageId, { stageConfig: { ...stage.stageConfig, ...patch } });
    },
    [sprint, updateStage]
  );

  const enabledStages = sprint.filter((s) => s.enabled);
  const disabledStages = sprint.filter((s) => !s.enabled);

  return (
    <div className="space-y-8">
      {/* Active Pipeline Strip */}
      <div className="surface-recessed rounded-xl px-6 py-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-muted">Active Pipeline</p>
        {enabledStages.length === 0 ? (
          <p className="text-sm text-ink-muted italic">No stages enabled — toggle stages on below to build your pipeline.</p>
        ) : (
          <div className="flex items-center gap-0 overflow-x-auto">
            {enabledStages.map((stage, i) => {
              const meta = STAGE_META[stage.name];
              const color = STAGE_COLORS[stage.name];
              return (
                <div key={stage.id} className="flex items-center">
                  <button
                    onClick={() => document.getElementById(`stage-${stage.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                    className="group flex items-center gap-2.5 rounded-lg px-3.5 py-2 transition-all duration-300"
                    style={{ backgroundColor: color.accentBg }}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold transition-transform duration-200 group-hover:scale-110"
                      style={{ backgroundColor: color.accent, color: 'oklch(0.99 0.002 75)' }}>
                      {meta.abbr}
                    </span>
                    <span className="text-sm font-semibold whitespace-nowrap" style={{ color: color.text }}>{meta.label}</span>
                  </button>
                  {i < enabledStages.length - 1 && (
                    <svg width="20" height="12" className="shrink-0 mx-0.5" viewBox="0 0 20 12" aria-hidden>
                      <path d="M2 6 L14 6" stroke={color.accent} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" opacity="0.5" />
                      <path d="M13 3 L17 6 L13 9" fill="none" stroke={color.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {disabledStages.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-ink-muted">Skipped:</span>
            {disabledStages.map((stage) => (
              <span key={stage.id} className="rounded px-2 py-0.5 text-xs text-ink-muted line-through" style={{ backgroundColor: 'oklch(0.955 0.004 75)' }}>
                {STAGE_META[stage.name].label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stage Detail Cards */}
      <div className="space-y-3">
        {sprint.map((stage) => (
          <StageRow key={stage.id} stage={stage} color={STAGE_COLORS[stage.name]} meta={STAGE_META[stage.name]} examples={STAGE_EXAMPLES[stage.name]}
            onToggleEnabled={(enabled) => updateStage(stage.id, { enabled })}
            onToggleRole={(role) => toggleRole(stage.id, role)}
            onToggleNegotiationRole={(role) => toggleNegotiationRole(stage.id, role)}
            onAddGate={(value) => addGate(stage.id, value)}
            onRemoveGate={(index) => removeGate(stage.id, index)}
            onOutputFormatChange={(fmt) => updateStage(stage.id, { outputFormat: fmt })}
            onUpdateConfig={(patch) => updateStageConfig(stage.id, patch)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage Row
// ---------------------------------------------------------------------------

interface StageRowProps {
  stage: SprintStage;
  color: StageColor;
  meta: { label: string; abbr: string; icon: string; description: string };
  examples: StageExamples;
  onToggleEnabled: (enabled: boolean) => void;
  onToggleRole: (role: RoleName) => void;
  onToggleNegotiationRole: (role: RoleName) => void;
  onAddGate: (value: string) => void;
  onRemoveGate: (index: number) => void;
  onOutputFormatChange: (value: string) => void;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}

function StageRow({ stage, color, meta, examples, onToggleEnabled, onToggleRole, onToggleNegotiationRole, onAddGate, onRemoveGate, onOutputFormatChange, onUpdateConfig }: StageRowProps) {
  const [gateInput, setGateInput] = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleAddGate = () => { if (gateInput.trim()) { onAddGate(gateInput); setGateInput(''); } };
  const handleGateKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGate(); } };

  return (
    <div id={`stage-${stage.id}`} className="rounded-xl overflow-hidden transition-all duration-300"
      style={{ backgroundColor: stage.enabled ? color.bg : 'oklch(0.965 0.003 75)', opacity: stage.enabled ? 1 : 0.45 }}>
      <div className="px-5 py-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
                style={{ backgroundColor: stage.enabled ? color.accent : 'oklch(0.88 0.005 75)', color: stage.enabled ? 'oklch(0.99 0.002 75)' : 'oklch(0.55 0.01 75)' }}>
                {meta.abbr}
              </span>
              <div>
                <span className="text-sm font-semibold block leading-tight" style={{ color: stage.enabled ? color.text : 'oklch(0.50 0.01 75)' }}>{meta.label}</span>
                <span className="text-[10px]" style={{ color: stage.enabled ? color.textMuted : 'oklch(0.60 0.005 75)' }}>{meta.description}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {ALL_ROLES.map((role) => {
                const selected = stage.roles.includes(role.id);
                return (
                  <button key={role.id} onClick={() => onToggleRole(role.id)}
                    className="rounded-md px-2 py-0.5 text-xs font-medium transition-all duration-200"
                    style={{ backgroundColor: selected ? color.accentBg : 'oklch(0.955 0.004 75)', color: selected ? color.accent : 'oklch(0.55 0.008 75)' }}>
                    {role.label}
                  </button>
                );
              })}
            </div>
          </div>
          <Switch size="sm" checked={stage.enabled} onCheckedChange={onToggleEnabled} />
        </div>

        {/* Expandable detail */}
        {stage.enabled && (
          <div className="mt-4">
            <button onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-xs font-medium transition-colors w-full" style={{ color: color.accent }}>
              <svg width="12" height="12" viewBox="0 0 12 12" className="transition-transform duration-200"
                style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                <path d="M4 2 L8 6 L4 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {expanded ? 'Hide configuration' : 'Configure stage'}
            </button>
            <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}>
              <div className="overflow-hidden">
                <div className="pt-3 space-y-5">
                  {/* Stage-specific config */}
                  <div className="rounded-lg p-4" style={{ backgroundColor: 'oklch(0.975 0.002 75)' }}>
                    <StageConfigSection stage={stage} onUpdateConfig={onUpdateConfig} color={color} />
                  </div>

                  {/* Negotiation Roles */}
                  <div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-xs font-semibold" style={{ color: color.text }}>Negotiation Roles</span>
                      <span className="text-[10px]" style={{ color: color.textMuted }}>Select roles for multi-role discussion before stage output</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ALL_ROLES.map((role) => {
                        const selected = stage.negotiationRoles?.includes(role.id) ?? false;
                        return (
                          <button key={role.id} onClick={() => onToggleNegotiationRole(role.id)}
                            className="rounded-md px-2 py-0.5 text-xs font-medium transition-all duration-200 border"
                            style={{
                              backgroundColor: selected ? color.accentBg : 'oklch(0.975 0.002 75)',
                              borderColor: selected ? color.accent : 'oklch(0.88 0.005 75)',
                              color: selected ? color.accent : 'oklch(0.55 0.008 75)',
                            }}>
                            {role.label}
                          </button>
                        );
                      })}
                    </div>
                    {(stage.negotiationRoles?.length ?? 0) > 0 && (
                      <p className="mt-1.5 text-[10px]" style={{ color: color.textMuted }}>
                        {stage.negotiationRoles!.length} role{stage.negotiationRoles!.length > 1 ? 's' : ''} will negotiate via 2-round sub-agent discussion
                      </p>
                    )}
                  </div>

                  {/* Quality Gates */}
                  <div>
                    <SectionLabel title="Quality Gates" hint={examples.gateHint} color={color} />
                    <TagChips items={stage.gates} onRemove={onRemoveGate} color={color} />
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Input placeholder="Type a gate condition..." value={gateInput}
                        onChange={(e) => setGateInput(e.target.value)} onKeyDown={handleGateKeyDown}
                        className="h-7 flex-1 max-w-xs text-xs" style={{ backgroundColor: 'oklch(0.975 0.003 75)' }} />
                      <button onClick={handleAddGate} disabled={!gateInput.trim()}
                        className="flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors disabled:opacity-30"
                        style={{ backgroundColor: color.accentBg, color: color.accent }}>+ Add</button>
                    </div>
                    <ExampleChips examples={examples.gateExamples} onClick={onAddGate} isUsed={(v) => stage.gates.includes(v)} color={color} />
                  </div>

                  {/* Output Format */}
                  <div>
                    <SectionLabel title="Output Format" hint={examples.outputHint} color={color} />
                    <Input placeholder="e.g. design doc, test results JSON, PR..." value={stage.outputFormat ?? ''}
                      onChange={(e) => onOutputFormatChange(e.target.value)}
                      className="h-7 max-w-xs text-xs" style={{ backgroundColor: 'oklch(0.975 0.003 75)' }} />
                    <ExampleChips examples={examples.outputExamples}
                      onClick={(v) => onOutputFormatChange(stage.outputFormat === v ? '' : v)}
                      isUsed={(v) => stage.outputFormat === v} color={color} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
