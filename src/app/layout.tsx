import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Hoax Detector — Sistem Pendeteksi Berita Hoaks',
  description:
    'Deteksi berita hoaks secara otomatis menggunakan AI. Masukkan URL atau upload gambar berita untuk mendapatkan investigasi mendalam tentang keaslian berita.',
  keywords: [
    'hoax detector',
    'fake news',
    'berita hoaks',
    'fact checker',
    'pendeteksi hoaks',
    'verifikasi berita',
  ],
  openGraph: {
    title: 'Hoax Detector — Sistem Pendeteksi Berita Hoaks',
    description:
      'Deteksi berita hoaks secara otomatis menggunakan AI. Investigasi mendalam tentang keaslian berita.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
