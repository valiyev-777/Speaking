import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'IELTS Speaking Partner | O\'zbekiston',
  description: 'IELTS Speaking mashq qiling - ovozli suhbat va chat orqali haqiqiy odamlar bilan',
  keywords: ['IELTS', 'Speaking', 'Uzbekistan', 'O\'zbekiston', 'English', 'Practice'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          {children}
        </div>
      </body>
    </html>
  );
}
