import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const inter = localFont({
  src: './fonts/Inter-latin.woff2',
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Portico Platform',
  description: 'AI SaaS Workflow Builder',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}