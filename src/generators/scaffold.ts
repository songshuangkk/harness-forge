import type { OutputFile, ProjectConfig } from '@/types';

/**
 * Generates basic project scaffold files based on the tech stack
 * defined in the given ProjectConfig.
 */
export function generateScaffold(config: ProjectConfig): OutputFile[] {
  const files: OutputFile[] = [];
  const { framework } = config.project.techStack;
  const pm = config.project.techStack.packageManager;

  // 1. Package manifest
  if (framework === 'flutter') {
    files.push(generatePubspec(config));
  } else {
    files.push(generatePackageJson(config));
  }

  // 2. README
  files.push(generateReadme(config));

  // 3. Architecture doc
  files.push(generateArchitectureDoc(config));

  // 4. Framework boilerplate
  const boilerplate = generateBoilerplate(config);
  files.push(...boilerplate);

  return files;
}

// ---------------------------------------------------------------------------
// Package manifest
// ---------------------------------------------------------------------------

function generatePackageJson(config: ProjectConfig): OutputFile {
  const { framework, packageManager: pm } = config.project.techStack;
  const name = config.project.name;

  const pkg: Record<string, unknown> = {
    name,
    version: '0.1.0',
    private: true,
  };

  if (framework === 'next') {
    pkg.scripts = {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      lint: 'next lint',
    };
    pkg.dependencies = {
      next: 'latest',
      react: 'latest',
      'react-dom': 'latest',
    };
    pkg.devDependencies = {
      typescript: 'latest',
      '@types/node': 'latest',
      '@types/react': 'latest',
    };
  } else if (framework === 'react') {
    pkg.scripts = {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    };
    pkg.dependencies = {
      react: 'latest',
      'react-dom': 'latest',
    };
    pkg.devDependencies = {
      typescript: 'latest',
      vite: 'latest',
      '@vitejs/plugin-react': 'latest',
      '@types/react': 'latest',
      '@types/react-dom': 'latest',
    };
  } else if (framework === 'vue') {
    pkg.scripts = {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    };
    pkg.dependencies = {
      vue: 'latest',
    };
    pkg.devDependencies = {
      typescript: 'latest',
      vite: 'latest',
      '@vitejs/plugin-vue': 'latest',
      'vue-tsc': 'latest',
    };
  } else {
    // custom – minimal
    pkg.scripts = {
      dev: 'echo "No dev script configured"',
      build: 'echo "No build script configured"',
    };
  }

  return {
    path: 'package.json',
    content: JSON.stringify(pkg, null, 2) + '\n',
  };
}

function generatePubspec(config: ProjectConfig): OutputFile {
  const name = config.project.name.replace(/[^a-z0-9_]/g, '_');
  const content = `name: ${name}
description: ${config.project.description}
version: 0.1.0

environment:
  sdk: ">=3.0.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
`;
  return { path: 'pubspec.yaml', content };
}

// ---------------------------------------------------------------------------
// README
// ---------------------------------------------------------------------------

function generateReadme(config: ProjectConfig): OutputFile {
  const { framework, packageManager: pm } = config.project.techStack;
  const installCmd = getInstallCommand(pm);
  const devCmd = getDevCommand(framework);

  const content = `# ${config.project.name}

${config.project.description}

## Getting Started

\`\`\`bash
${installCmd}
${devCmd}
\`\`\`

## Architecture

This project uses an AI-assisted development workflow powered by ${config.architecture.harness.engine}.
See CLAUDE.md for full configuration.
`;
  return { path: 'README.md', content };
}

// ---------------------------------------------------------------------------
// Architecture doc
// ---------------------------------------------------------------------------

function generateArchitectureDoc(config: ProjectConfig): OutputFile {
  const { architecture, flow } = config;

  const enabledStages = flow.sprint
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)
    .map((s) => `- **${s.name}** (order ${s.order}): roles ${s.roles.join(', ')}`)
    .join('\n');

  const content = `# Architecture

## Agent Architecture

The project follows a three-layer agent architecture:

| Layer     | Storage / Type            | Details                                      |
|-----------|---------------------------|----------------------------------------------|
| Session   | ${architecture.session.storage.padEnd(24)} | Retention: ${architecture.session.eventRetention} events, recovery: ${architecture.session.recoveryStrategy} |
| Harness   | ${architecture.harness.engine.padEnd(24)} | Context strategy: ${architecture.harness.contextStrategy}, max retries: ${architecture.harness.maxRetries} |
| Sandbox   | ${architecture.sandbox.type.padEnd(24)} | Credential policy: ${architecture.sandbox.credentialPolicy}, MCP servers: ${architecture.sandbox.mcpServers.length} |

## Sprint Flow

Enabled stages:

${enabledStages}

## Key Design Decisions

- **AI Engine**: ${architecture.harness.engine}
- **Context Strategy**: ${architecture.harness.contextStrategy}
- **Sandbox Type**: ${architecture.sandbox.type}
- **Session Recovery**: ${architecture.session.recoveryStrategy}
- **Credential Policy**: ${architecture.sandbox.credentialPolicy}
- **Constraint Rules**: ${flow.constraints.length} configured
`;

  return { path: 'docs/plans/ARCHITECTURE.md', content };
}

// ---------------------------------------------------------------------------
// Framework boilerplate
// ---------------------------------------------------------------------------

function generateBoilerplate(config: ProjectConfig): OutputFile[] {
  const { framework } = config.project.techStack;
  const files: OutputFile[] = [];

  if (framework === 'next') {
    files.push({
      path: 'src/app/layout.tsx',
      content: `import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '${config.project.name}',
  description: '${config.project.description}',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
    });
    files.push({
      path: 'src/app/page.tsx',
      content: `export default function Home() {
  return (
    <main>
      <h1>${config.project.name}</h1>
      <p>${config.project.description}</p>
    </main>
  );
}
`,
    });
  } else if (framework === 'react') {
    files.push({
      path: 'src/main.tsx',
      content: `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
    });
    files.push({
      path: 'src/App.tsx',
      content: `export default function App() {
  return (
    <div>
      <h1>${config.project.name}</h1>
      <p>${config.project.description}</p>
    </div>
  );
}
`,
    });
  } else if (framework === 'vue') {
    files.push({
      path: 'src/main.ts',
      content: `import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#root');
`,
    });
    files.push({
      path: 'src/App.vue',
      content: `<template>
  <div>
    <h1>${config.project.name}</h1>
    <p>${config.project.description}</p>
  </div>
</template>
`,
    });
  } else if (framework === 'flutter') {
    files.push({
      path: 'lib/main.dart',
      content: `import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${config.project.name}',
      home: const HomePage(),
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('${config.project.name}'),
      ),
      body: const Center(
        child: Text('${config.project.description}'),
      ),
    );
  }
}
`,
    });
  }

  // custom – skip boilerplate

  return files;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInstallCommand(pm: string): string {
  switch (pm) {
    case 'npm':
      return 'npm install';
    case 'yarn':
      return 'yarn install';
    case 'pnpm':
      return 'pnpm install';
    case 'bun':
      return 'bun install';
    default:
      return 'npm install';
  }
}

function getDevCommand(framework: string): string {
  switch (framework) {
    case 'next':
    case 'react':
    case 'vue':
      return 'npm run dev';
    case 'flutter':
      return 'flutter run';
    case 'custom':
      return 'npm run dev';
    default:
      return 'npm run dev';
  }
}
