# Sistem Pendeteksi Berita Hoaks

Aplikasi web berbasis Next.js (App Router) dengan TypeScript untuk menganalisis kredibilitas berita dari URL artikel maupun unggahan gambar tangkapan layar. Sistem mengekstrak konten artikel atau teks pada gambar, mengidentifikasi klaim utama menggunakan model bahasa melalui Groq API, memverifikasi klaim melalui Google Fact Check Tools API serta pencarian berita terkait (Google Custom Search API dengan fallback ke Yahoo Search), lalu menyusun laporan investigasi lengkap beserta skor kredibilitas.

## Tech Stack

- **Framework**: Next.js `16.2.10` (App Router)
- **UI Library**: React `19.2.4` dan React DOM `19.2.4`
- **Bahasa**: TypeScript (`^5`)
- **Styling**: CSS Modules dan CSS global
- **AI / LLM**: `groq-sdk` (`^1.3.0`)
  - Analisis teks (`textModel` / `fallbackTextModel` di `src/lib/config.ts`): `openai/gpt-oss-120b` dengan fallback `openai/gpt-oss-20b`
  - Analisis gambar (`visionModel` di `src/lib/config.ts`): `qwen/qwen3.8-27b`
- **HTTP Client & HTML Parser**: `axios` (`^1.18.1`) dan `cheerio` (`^1.2.0`)
- **Linter**: ESLint (`^9`) dengan `eslint-config-next` (`16.2.10`)

## Prasyarat

- Node.js versi 20 atau lebih baru
- npm
- `GROQ_API_KEY` (wajib) dari Groq Console (`https://console.groq.com`)
- Kredensial Google API (opsional):
  - `GOOGLE_FACT_CHECK_API_KEY` untuk lookup pada Google Fact Check Tools API
  - `GOOGLE_CUSTOM_SEARCH_API_KEY` dan `GOOGLE_SEARCH_ENGINE_ID` untuk pencarian berita terkait melalui Google Custom Search API

## Langkah Instalasi Lokal

1. Instal dependensi proyek:

   ```bash
   npm install
   ```

2. Salin templat variabel lingkungan ke `.env.local` dan lengkapi nilainya:

   ```bash
   cp .env.example .env.local
   ```

   Minimal isi `GROQ_API_KEY` pada `.env.local`. Variabel Google bersifat opsional.

3. Jalankan server pengembangan:

   ```bash
   npm run dev
   ```

   Aplikasi berjalan di `http://localhost:3000`.

4. Perintah pemeriksaan lint, build produksi, dan menjalankan hasil build:

   ```bash
   npm run lint
   npm run build
   npm run start
   ```

## Daftar Variabel `.env.example`

Seluruh variabel lingkungan berikut dibaca oleh `getEnvConfig()` di `src/lib/config.ts`:

| Variabel | Status | Digunakan Oleh | Keterangan |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | Wajib | `src/lib/services/groq.ts` | API key Groq untuk ekstraksi klaim, penyusunan query pencarian, investigasi kredibilitas, dan ekstraksi teks dari gambar. |
| `GOOGLE_FACT_CHECK_API_KEY` | Opsional | `src/lib/services/factcheck.ts` | API key Google Fact Check Tools. Jika kosong, pencarian ke Google Fact Check dilewati. |
| `GOOGLE_CUSTOM_SEARCH_API_KEY` | Opsional | `src/lib/services/search.ts` | API key Google Custom Search. Jika kosong bersama `GOOGLE_SEARCH_ENGINE_ID`, pencarian berita terkait beralih ke scraping Yahoo Search. |
| `GOOGLE_SEARCH_ENGINE_ID` | Opsional | `src/lib/services/search.ts` | Search Engine ID (CX) untuk Google Custom Search API. |

## Struktur Folder

```text
.
├── .env.example                            # Templat variabel lingkungan
├── .gitignore                              # Aturan pengabaian file Git
├── eslint.config.mjs                       # Konfigurasi ESLint
├── next.config.ts                          # Konfigurasi Next.js
├── package.json                            # Manifest dependensi dan skrip npm
├── package-lock.json                       # Lockfile npm
├── tsconfig.json                           # Konfigurasi TypeScript dan alias @/*
├── public/                                 # Direktori aset statis publik
└── src/
    ├── app/
    │   ├── api/
    │   │   └── analyze/
    │   │       ├── image/route.ts          # Endpoint POST analisis gambar/OCR
    │   │       └── url/route.ts            # Endpoint POST analisis URL artikel
    │   ├── favicon.ico                     # Ikon aplikasi
    │   ├── globals.css                     # Styling global dan design tokens
    │   ├── layout.tsx                      # Root layout dan metadata aplikasi
    │   └── page.tsx                        # Halaman utama antarmuka pengguna
    ├── components/                         # Komponen UI dan CSS Modules
    │   ├── AnalysisTimeline.module.css
    │   ├── AnalysisTimeline.tsx
    │   ├── EvidenceList.module.css
    │   ├── EvidenceList.tsx
    │   ├── HeroSection.module.css
    │   ├── HeroSection.tsx
    │   ├── InputPanel.module.css
    │   ├── InputPanel.tsx
    │   ├── LanguageSelector.module.css
    │   ├── LanguageSelector.tsx
    │   ├── ResultCard.module.css
    │   └── ResultCard.tsx
    ├── hooks/
    │   └── useAnalysis.ts                  # Hook state manajemen proses analisis
    └── lib/
        ├── config.ts                       # Konfigurasi env, model AI, endpoint, dan limit
        ├── types.ts                        # Definisi tipe TypeScript
        ├── services/
        │   ├── analyzer.ts                 # Orkestrasi pipeline investigasi
        │   ├── factcheck.ts                # Klien Google Fact Check Tools API
        │   ├── groq.ts                     # Klien Groq API (teks dan vision)
        │   ├── scraper.ts                  # Ekstraksi konten HTML artikel
        │   └── search.ts                   # Pencarian berita terkait (Google/Yahoo)
        └── utils/
            ├── errors.ts                   # Utilitas AppError dan respons JSON API
            ├── prompts.ts                  # Generator prompt untuk model AI
            ├── sanitize.ts                 # Validasi URL, parsing JSON aman, dan konversi base64
            └── translations.ts             # Kamus terjemahan antarmuka multibahasa
```
