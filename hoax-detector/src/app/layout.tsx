import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hoax Detector — Sistem Pendeteksi Berita Hoaks",
  description:
    "Deteksi berita hoaks secara otomatis menggunakan AI. Masukkan URL atau upload gambar berita untuk mendapatkan investigasi mendalam tentang keaslian berita.",
  keywords: [
    "hoax detector",
    "fake news",
    "berita hoaks",
    "fact checker",
    "pendeteksi hoaks",
    "verifikasi berita",
  ],
  openGraph: {
    title: "Hoax Detector — Sistem Pendeteksi Berita Hoaks",
    description:
      "Deteksi berita hoaks secara otomatis menggunakan AI. Investigasi mendalam tentang keaslian berita.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
