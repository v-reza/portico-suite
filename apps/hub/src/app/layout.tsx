import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Portico — Identity Hub',
  description: 'Control plane untuk platform, helpdesk, dan code review.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
