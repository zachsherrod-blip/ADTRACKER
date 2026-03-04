import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AdTracker — Meta Ad Library',
  description: 'Track Meta Ad Library data across brands',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav
          style={{
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
          }}
          className="px-6 py-3 flex items-center gap-4"
        >
          <a href="/" className="flex items-center gap-2 font-bold text-white text-base">
            <span
              style={{ background: 'var(--accent)' }}
              className="w-6 h-6 rounded-md flex items-center justify-center text-xs"
            >
              AD
            </span>
            AdTracker
          </a>
          <div className="flex-1" />
          <a href="/" className="btn-ghost text-sm">
            Dashboard
          </a>
          <a href="/api/export/latest.csv" className="btn-primary text-sm">
            ↓ Export CSV
          </a>
        </nav>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
