# Sistem Pendeteksi Berita Hoaks

Aplikasi web berbasis Next.js untuk menganalisis kredibilitas berita dari URL artikel maupun unggahan gambar tangkapan layar. Sistem mengekstrak konten artikel atau teks pada gambar, mengidentifikasi klaim utama menggunakan model bahasa Groq, memverifikasi klaim melalui Google Fact Check Tools API serta pencarian berita terkait (Google Custom Search API dengan fallback scraping Yahoo Search), lalu menyusun laporan investigasi beserta skor kredibilitas.

## Tech Stack

- **Framework**: Next.js 16.2.10 (App Router)
- **UI Library**: React 19.2.4
- **Bahasa**: TypeScript 5
- **Styling**: CSS Modules dan CSS global
- **AI / LLM**: `groq-sdk` (`llama-3.3-70b-versatile` dengan fallback `llama-3.1-8b-instant` untuk analisis teks; `meta-llama/llama-4-scout-17b-16e-instruct` dengan fallback `qwen/qwen3.6-27b` untuk analisis gambar)
- **HTTP Client & HTML Parser**: Axios dan Cheerio
- **Linter**: ESLint 9 (`eslint-config-next`)

## Prasyarat

- Node.js versi 20 atau lebih baru
- npm
- `GROQ_API_KEY` (wajib) dari [Groq Console](https://console.groq.com)
- Kredensial opsional untuk fitur tambahan:
  - `GOOGLE_FACT_CHECK_API_KEY` (Google Fact Check Tools API)
  - `GOOGLE_CUSTOM_SEARCH_API_KEY` dan `GOOGLE_SEARCH_ENGINE_ID` (Google Custom Search API)

## Cara Setup Lokal

1. Instal dependensi proyek:

   ```bash
   npm install
   ```

2. Salin templat variabel lingkungan dan isi nilai API key yang dibutuhkan:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` dan masukkan minimal `GROQ_API_KEY`. Variabel Google bersifat opsional; apabila tidak diisi, pencarian berita terkait akan menggunakan fallback Yahoo Search dan lookup Google Fact Check akan dilewati.

3. Jalankan server pengembangan:

   ```bash
   npm run dev
   ```

   Aplikasi dapat diakses melalui `http://localhost:3000`.

4. Perintah pemeriksaan dan build produksi:

   ```bash
   npm run lint
   npm run build
   npm run start
   ```

## Struktur Folder

```text
.
├── .env.example              # Templat variabel lingkungan
├── .gitignore                # Aturan pengabaian file Git
├── eslint.config.mjs         # Konfigurasi ESLint
├── next.config.ts            # Konfigurasi Next.js
├── package.json              # Dependensi dan skrip npm
├── tsconfig.json             # Konfigurasi TypeScript dan path alias (@/*)
├── public/                   # Aset statis publik
└── src/
    ├── app/
    │   ├── api/
    │   │   └── analyze/
    │   │       ├── image/route.ts  # Endpoint POST analisis gambar/OCR
    │   │       └── url/route.ts    # Endpoint POST analisis URL artikel
    │   ├── globals.css       # Styling global
    │   ├── layout.tsx        # Root layout dan metadata
    │   └── page.tsx          # Halaman utama antarmuka pengguna
    ├── components/           # Komponen UI dan CSS Modules
    │   ├── AnalysisTimeline.*
    │   ├── EvidenceList.*
    │   ├── HeroSection.*
    │   ├── InputPanel.*
    │   ├── LanguageSelector.*
    │   └── ResultCard.*
    └── lib/
        ├── services/         # Integrasi layanan eksternal & scraping
        │   ├── factcheck.ts  # Google Fact Check Tools API
        │   ├── groq.ts       # Klien Groq AI (teks & vision)
        │   ├── scraper.ts    # Ekstraksi konten artikel web
        │   └── search.ts     # Pencarian berita terkait (Google/Yahoo)
        ├── utils/            # Utilitas prompt, sanitasi, dan terjemahan
        │   ├── prompts.ts
        │   ├── sanitize.ts
        │   └── translations.ts
        └── types.ts          # Definisi tipe TypeScript
```
