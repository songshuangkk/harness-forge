import type { Metadata } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Harness Forge — AI Agent Project Configurator',
  description: 'Visual project configuration tool for Claude Code and Codex',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${figtree.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
