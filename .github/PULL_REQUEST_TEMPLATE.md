## Ringkasan Perubahan

<!-- Jelaskan secara singkat perubahan yang dibuat, konteks sprint, atau issue terkait. -->

- **Konteks / Sprint**: 
- **Perubahan Utama**: 

## Jenis Perubahan

- [ ] `feat` — Penambahan fitur baru
- [ ] `fix` — Perbaikan bug
- [ ] `refactor` — Perubahan struktur kode tanpa mengubah perilaku eksternal
- [ ] `ci` / `chore` — Perubahan konfigurasi CI/CD, governance, atau tooling
- [ ] `docs` — Pembaruan dokumentasi
- [ ] `perf` / `style` — Optimasi performa atau penyesuaian tampilan UI

## Verifikasi Kualitas Lokal

- [ ] `npm run lint` lulus tanpa error
- [ ] `npx tsc --noEmit` lulus tanpa error
- [ ] `npm run build` berhasil membangun bundle produksi

## Laporan Blackbox Testing (`BB-X.Y`)

| ID Uji | Skenario / Fitur | Input | Ekspektasi Output | Hasil Aktual | Status |
| --- | --- | --- | --- | --- | --- |
| `BB-1.1` | Akses halaman utama (`GET /`) | Buka `/` pada browser atau `curl` | HTTP `200`, UI utama tampil normal tanpa error | | [ ] Pass / [ ] Fail |
| `BB-1.2` | Validasi payload kosong (`POST /api/analyze/url`) | Body `{}` dengan header `Content-Type: application/json` | HTTP `400` dengan pesan error validasi terstruktur | | [ ] Pass / [ ] Fail |
| `BB-2.1` | Analisis URL / gambar berita valid (`BB-X.Y`) | Artikel berita atau tangkapan layar uji | Laporan investigasi lengkap dengan skor & `providerStatus` | | [ ] Pass / [ ] Fail |

### Checklist Blackbox Testing

- [ ] `BB-X.1` — Seluruh skenario jalur normal (*happy path*) untuk perubahan ini telah diuji dan sesuai ekspektasi.
- [ ] `BB-X.2` — Kasus batas (*edge case*) dan input tidak valid ditangani dengan pesan error yang jelas tanpa crash.
- [ ] `BB-X.3` — Tampilan antarmuka (loading, error, dan hasil) tetap konsisten tanpa regresi visual.
- [ ] `BB-X.4` — Status check CI **`Quality & Blackbox Smoke Test`** lulus setelah push terakhir.
