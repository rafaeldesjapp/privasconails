import type {Metadata} from 'next';
import './globals.css'; // Global styles
import AppLayout from '@/components/AppLayout';
import { Dancing_Script, Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  variable: '--font-dancing',
});

export const metadata: Metadata = {
  title: 'Executive CRM - Nexus Corporate Edition',
  description: 'A high-end CRM for executive account management.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${dancingScript.variable}`}>
      <body suppressHydrationWarning>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
