import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Harness Forge</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Visual project configurator for AI coding agents
        </p>
        <Link
          href="/wizard"
          className="mt-8 inline-flex items-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
