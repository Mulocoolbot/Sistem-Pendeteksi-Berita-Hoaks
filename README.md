# Sistem Pendeteksi Berita Hoaks

Aplikasi web berbasis Next.js (App Router) dengan TypeScript untuk menganalisis kredibilitas berita dari URL artikel maupun unggahan gambar tangkapan layar tanpa ketergantungan Google Cloud Billing. Sistem mengekstrak konten artikel (fast-path Cheerio dengan fallback otomatis ke Jina Reader API) atau teks pada gambar, mengidentifikasi klaim atomik beserta sinyal jurnalistik menggunakan Groq API, memverifikasi klaim secara paralel ke domain pemeriksa fakta terverifikasi serta pencarian berita terkait melalui Tavily Search API (dengan fallback otomatis ke Jina Search API), lalu menyusun laporan investigasi lengkap beserta skor kredibilitas dan metadata `providerStatus`.

## Tech Stack

- **Framework**: Next.js `16.2.10` (App Router)
- **UI Library**: React `19.2.4` dan React DOM `19.2.4`
- **Bahasa**: TypeScript (`^5`)
- **Styling**: CSS Modules dan CSS global
- **AI / LLM**: `groq-sdk` (`^1.3.0`)
  - Analisis teks (`textModel` / `fallbackTextModel` di `src/lib/config.ts`): `openai/gpt-oss-120b` dengan fallback `openai/gpt-oss-20b`
  - Analisis gambar (`visionModel` di `src/lib/config.ts`): `qwen/qwen3.8-27b`
- **HTTP Client & HTML Parser**: `axios` (`^1.18.1`) dan `cheerio` (`^1.2.0`)
- **Ekstraksi & Pencarian Eksternal**: Tavily Search API (`https://api.tavily.com/search`), Jina Reader API (`https://r.jina.ai/`), dan Jina Search API (`https://s.jina.ai/`)
- **Linter**: ESLint (`^9`) dengan `eslint-config-next` (`16.2.10`)

## Prasyarat

- Node.js versi 20 atau lebih baru
- npm
- `GROQ_API_KEY` (wajib) dari Groq Console (`https://console.groq.com`)
- `TAVILY_API_KEY` (opsional, disarankan) untuk pencarian berita utama dan verifikasi domain fact-checker melalui Tavily Search API
- `JINA_API_KEY` (opsional) untuk meningkatkan rate limit Jina Reader (`r.jina.ai`) dan Jina Search (`s.jina.ai`) saat fallback

## Langkah Instalasi Lokal

1. Instal dependensi proyek:

   ```bash
   npm install
   ```

2. Salin templat variabel lingkungan ke `.env.local` dan lengkapi nilainya:

   ```bash
   cp .env.example .env.local
   ```

   Minimal isi `GROQ_API_KEY` pada `.env.local`. Tambahkan `TAVILY_API_KEY` dan `JINA_API_KEY` untuk mengaktifkan pencarian utama dan meningkatkan batas rate fallback Jina AI.

3. Jalankan server pengembangan:

   ```bash
   npm run dev
   ```

   Aplikasi berjalan di `http://localhost:3000`.

4. Perintah pemeriksaan tipe, lint, build produksi, dan menjalankan hasil build:

   ```bash
   npx tsc --noEmit
   npm run lint
   npm run build
   npm run start
   ```

## Daftar Variabel `.env.example`

Seluruh variabel lingkungan berikut dibaca oleh `getEnvConfig()` di `src/lib/config.ts`:

| Variabel | Status | Digunakan Oleh | Keterangan |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | Wajib | `src/lib/services/groq.ts` | API key Groq untuk ekstraksi klaim, penyusunan query pencarian, sintesis verifikasi, dan ekstraksi teks dari gambar. |
| `TAVILY_API_KEY` | Opsional (Primary Search & Fact-Check) | `src/lib/services/search.ts`, `src/lib/services/factcheck.ts` | API key Tavily Search (`POST https://api.tavily.com/search`) untuk pencarian berita utama serta pencarian klaim ke domain pemeriksa fakta terverifikasi (`turnbackhoax.id`, `cekfakta.com`, `cekfakta.tempo.co`, `snopes.com`, `politifact.com`, `factcheck.org`, `fullfact.org`). Jika kosong atau gagal (HTTP 4xx/5xx/timeout), sistem otomatis fallback ke Jina Search (`https://s.jina.ai/`). |
| `JINA_API_KEY` | Opsional (Reader & Search Fallback) | `src/lib/services/scraper.ts`, `src/lib/services/search.ts`, `src/lib/services/factcheck.ts` | API key Jina AI untuk meningkatkan rate limit Jina Reader (`https://r.jina.ai/`) ketika Cheerio mendapat HTTP 403/429/5xx, timeout, atau konten < 200 karakter, serta fallback Jina Search (`https://s.jina.ai/`). |

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
        ├── config.ts                       # Konfigurasi env, model AI, endpoint, timeout, dan limit
        ├── types.ts                        # Definisi tipe TypeScript & metadata providerStatus
        ├── schemas/
        │   └── analysis.ts                 # Skema validasi Zod untuk input/output analisis & provider
        ├── services/
        │   ├── analyzer.ts                 # Orkestrasi pipeline investigasi & graceful degradation
        │   ├── factcheck.ts                # Klien paralel verifikasi domain fact-checker (Tavily -> Jina Search)
        │   ├── groq.ts                     # Klien Groq API (teks dan vision)
        │   ├── scraper.ts                  # Ekstraksi artikel (Cheerio fast-path -> Jina Reader fallback)
        │   └── search.ts                   # Pencarian berita (Tavily primary -> Jina Search fallback)
        └── utils/
            ├── cache.ts                    # Cache LRU + TTL in-memory untuk laporan investigasi
            ├── credibility.ts              # Klasifikasi kredibilitas domain TIER_1/TIER_2/TIER_3
            ├── errors.ts                   # Utilitas AppError dan respons JSON API
            ├── prompts.ts                  # Generator prompt untuk model AI
            ├── sanitize.ts                 # Validasi URL, parsing JSON aman, dan konversi base64
            └── translations.ts             # Kamus terjemahan antarmuka multibahasa
```
