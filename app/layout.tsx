import { Dancing_Script, Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const dancingScript = Dancing_Script({ subsets: ['latin'], variable: '--font-dancing' });

export const metadata = {
  title: 'Priscila Vasconcelos - Nail Designer',
  description: 'Sistema de agendamento e gestão para Nail Designers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${dancingScript.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
