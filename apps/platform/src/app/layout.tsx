import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Portico Platform',
  description: 'AI SaaS Workflow Builder',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
