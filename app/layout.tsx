import { Dancing_Script, Inter, M_PLUS_Rounded_1c } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const dancingScript = Dancing_Script({ subsets: ['latin'], variable: '--font-dancing' });
const mPlusRounded = M_PLUS_Rounded_1c({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-mplus',
});

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
    <html lang="pt-BR" className={`${inter.variable} ${dancingScript.variable} ${mPlusRounded.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
