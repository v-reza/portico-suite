> **UPDATE 2026-09-10 (v2): DESIGN SYSTEM PINDAH KE LIGHT.** Ketiga file token
> (`A-platform-DESIGN.md` → Platform-Light, `B-helpdesk-DESIGN.md` → Helpdesk-Light,
> `C-code-review-DESIGN.md` → CodeReview-Light) dan `DESIGN-GUIDE.md` ditulis ulang
> dari dark (`#08090a` / Linear dark) ke light (page `#f7f7f8`, panel `#ffffff`,
> aksen violet `#6e5ae6`). Semua catatan di bawah yang menyebut token dark
> (`#5e6ad2`, `#08090a`, `#0f1011`, `badge-success` teks `#06281a`, `button-primary`
> `#545ec4`) **sudah tidak berlaku** — lihat status v2 di akhir dokumen.
>
> **STATUS: SEMUA TEMUAN SUDAH DIPERBAIKI (2026-09-10).**
> Hasil verifikasi akhir: `designmd lint` A/B/C = *0 error* (sisa warning: false-positive
> kontras di atas layer transparan + `orphaned-tokens` yang memang dipakai lewat ref
> `{colors.x}` di tabel prosa, bukan di `components:`), `verify_prd.py` = exit 0
> (95 story / 484 AC). Dokumen di bawah ini disimpan sebagai catatan temuan awal.
>
> Ringkasan perbaikan: (1) YAML `C-codereview-DESIGN.md` di-expand → parse OK;
> (2) C dapat tabel `users` + `repo_members` + 4 endpoint `/api/auth/*` lokal +
> model severity 4 tingkat terdokumentasi; (3) ref menggantung `surface-cavans`→`surface-canvas`,
> `{elevation.*}` kini terdefinisi & terpakai; (4) DESIGN-GUIDE dapat section "Hub — Halaman
> Masuk Terpadu" (login Hub, tombol "Masuk lewat Hub", badge breach SLA, health/status,
> ambang severity 4 tingkat), kontradiksi emoji & font-weight 750 dibuang;
> (5) hitungan tabel/endpoint di README & PRD disinkronkan (A 12 tabel/54 endpoint,
> B 15/36, C 8/18); (6) kontras: `button-primary` pakai `#545ec4`/teks putih (5.23:1),
> `badge-success` teks `#06281a` (6.24:1), token baru `danger-solid #b91c1c` untuk
> tombol/badge danger (putih 6.47:1) — semuanya lolos WCAG AA.

---

# REVIEW — Dokumen Non-PRD (DESIGN + Spec Arsitektur)

Tanggal: 2026-09-10 · Reviewer: Hermes · Status: **ditutup — semua temuan sudah dikerjakan** (lihat status di atas)

Scope: `A/B/C-*.md` (spec arsitektur/project) + 4 file DESIGN
(`A-platform-DESIGN.md`, `B-helpdesk-DESIGN.md`, `C-code-review-DESIGN.md`,
`DESIGN-GUIDE.md`). PRD sudah lewat review terpisah — tidak diulang di sini.

Cara verifikasi: `npx -y -p @google/design.md designmd lint <file>` untuk 3 file
token; penghitungan endpoint/tabel lewat script; grep lintas file untuk cek
konsistensi. Semua angka di bawah hasil eksekusi, bukan perkiraan.

---

## Ringkasan

- **3 error** di file token (2 file): `{colors.surface-canvas}` dan
  `{elevation.*}` tidak pernah ada sebagai token → generate stitch bisa jatuh ke
  nilai default.
- **1 file token tidak bisa di-parse sama sekali**: `C-code-review-DESIGN.md` —
  seluruh YAML-nya diam-diam tidak terbaca.
- **±39 warning** sub-token tak dikenal (`border`, `boxShadow`, `stroke`, dll) —
  wajar untuk spec DESIGN.md, tapi berarti nilai visual itu **tidak ikut ter-export**.
- **12 kegagalan WCAG AA**, termasuk `button-primary` di A & B (4.42:1) — cuma
  kurang 0.08 dari ambang.
- **DESIGN-GUIDE belum punya halaman Hub/SSO** padahal itu Must story di ketiga PRD.
- **README angka karangan**: endpoints A/B meleset jauh, tabel C meleset satu.
- **C belum punya satu endpoint `/api/auth/*` maupun tabel `users`**, padahal
  PRD-nya mewajibkan login lokal tetap jalan saat Hub mati (AC6 US-C15, AC5 US-C16).

---

## A. File DESIGN token (3 file)

### A1. [ERROR · semua file] Reference menggantung

| File | Temuan |
|---|---|
| A | `{colors.surface-canvas}` tidak ada — token-nya ditulis `surface-cavans` (typo *cavans*) |
| A | `{elevation.surface}` tidak pernah didefinisikan (elevation ditulis sebagai blok terpisah, bukan prefix token) |
| A | `{elevation.dialog}` sama, tidak ada |
| B | `{elevation.dialog}` tidak ada |

Efek: `canvas`, `workflow-node`, dan `modal` kehilangan warna/shadow saat export.

### A2. [ERROR · C] YAML tidak valid — file tidak kebaca

`C-code-review-DESIGN.md` baris 32–56 memakai beberapa pasangan key dalam satu
baris (`fontSize: 2rem; fontWeight: 510; ...`). YAML menolak nested mapping di
compact mapping; linter berhenti dan **tidak ada satu token pun yang terbaca**.

Perbaikan: pecah tiap properti ke baris sendiri (seperti A & B), lalu lint ulang.

### A3. [WARNING · A 24, B 15] Sub-token tak dikenal

`border`, `borderColor`, `borderRight`, `borderLeft`, `borderBottom`, `boxShadow`,
`stroke`, `strokeWidth`, `marginBottom`, `extends` — semuanya di luar whitelist
spec (`backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`,
`height`, `width`). Nilai-nilai ini **tidak ikut ter-export**.

Dua pilihan sadar: (a) biarkan sebagai dokumentasi manusia, tapi pindahkan ke
tabel markdown biar tidak menyamar sebagai token mesin; atau (b) pindahkan
rendering-nya ke prose body DESIGN.md.

### A4. [WARNING · 12 pelanggaran WCAG AA]

- A (5): `button-primary` 4.42:1, `button-ghost` 1.46:1, `button-icon` 1.46:1,
  `input` 1.06:1, `sidebar-item-active` 1.06:1
- B (7): semua di atas + `button-danger` 3.76:1, `badge-success` 2.38:1,
  `badge-danger` 3.76:1

Catatan: sebagian temuan 1.06:1 adalah artefak transparansi (`rgba(255,255,255,0.05)`
diukur lawan background alphanya sendiri) — memang begitu linter membandingkan.
Yang **nyata dan gampang dibetulin**: `button-primary` 4.42:1 (kurang 0.08) dan
`badge-success` 2.38:1 (teks `#f7f8f8` di hijau `#10b981` — seharusnya teks gelap).

### A5. [INFO] Token orphan

success/warning/danger didefinisikan tapi tidak dirujuk component di A;
neutral/warning/text-quaternary di B. Bukan bug, tapi menandakan palet belum
dipakai penuh — padahal B baru saja menambah fitur badge breach SLA.

---

## B. DESIGN-GUIDE.md

### B1. [TINGGI] Tidak ada halaman Hub / Login terpadu

16 halaman terdaftar saat review ini ditulis (B×6, A×5, C×5). Tidak ada satupun untuk:
- halaman masuk terpadu / Hub (US-M09, US-M10 — Must)
- layar login yang menampilkan tombol "Masuk lewat Hub"
- badge notifikasi breach SLA di navbar B (US-B30)
- halaman health/status publik (US-M08)

DESIGN-GUIDE ini yang dipakai sebagai prompt ke stitch, jadi halaman yang tidak
terdaftar **tidak akan pernah di-generate**.

### B2. [SEDANG] Kontradiksi dengan aturan sendiri

Anti-slop #3: "NO emoji in UI". Tapi Surface Rules di baris yang sama mendikte
severity group pakai 🔴🟡🟢⚪. Segmen itu ikut ter-paste ke stitch.

### B3. [SEDANG] Aturan badge bentrok antar-file

Aturan #12: "Badges menggunakan **750** font weight". Tapi A/B/C semua menulis
`fontWeight: 510` untuk badge. Stitch dapat dua instruksi berbeda.

### B4. [SEDANG] "Satu accent" vs kenyataan token

Aturan #10: "SATU accent indigo (#5e6ad2) + 1 success green". Tapi C mendefinisikan
`critical #ff4d4f` di atas `danger #ef4444` — dua merah nyaris identik dipakai
untuk severity critical vs high. Ambang severity ini **tidak ada di C PRD/design
guide**, jadi perlu diputuskan: 3 level atau 4 level?

### B5. [RINGAN] Aturan diperintahkan tapi token tidak ada di A & C

#14 "Tables: header #0f1011, row transparent, border …" — token table hanya
didefinisikan di B (A & C tidak punya `table-header` / `table-row`).

### B6. [INFO] Penamaan file tidak konsisten

`C-code-review-DESIGN.md` vs `C-code-review-PRD.md` / `C-code-review.md`. Nama
mengandung tanda hubung, jadi skill `design-md` (dan pola auto-load apa pun)
tidak menemukannya untuk project C.

---

## C. Spec arsitektur (A/B/C-*.md)

### C1. [TINGGI · C] Tidak ada jalur login lokal yang dijanjikan PRD

PRD C mewajibkan:
- AC6 US-C15: "login email+password lokal tetap bisa dipakai" saat Hub down
- AC5 US-C16: "dashboard C masih bisa dimasuki lewat login email+password lokal"

Kenyataan di `C-code-review.md`:
- tabel `users` **tidak ada** di §DB Schema (6 tabel: repos, prs,
  review_results, review_runs, fix_suggestions, webhook_logs)
- **nol endpoint `/api/auth/*`** — satu-satunya auth adalah
  `GET /api/auth/hub/start` dan `/callback`
- `ALTER TABLE users` muncul di blok Hub, menambah kolom ke tabel yang tidak
  pernah dideklarasikan

Jadi C punya kontrak SSO lengkap tapi tidak punya tempat untuk menaruhnya, dan
fitur Must-nya tidak bisa diuji. Bandingkan A & B yang punya `register`/`login`/
`logout` + tabel `users` lengkap.

### C2. [TINGGI · C] Angka yang diklaim di 00-MASTER-PRD.md tidak akurat

| Item | PRD | Spec | Status |
|---|---|---|---|
| DB tables C | 7 | 6 | ⚠️ kurang 1 (lihat C1 — kemungkinan `users` yang hilang) |
| API endpoints A | ~40 | 54 baris | ⚠️ understated |
| API endpoints B | ~50 | 36 baris | ⚠️ overstated |
| API endpoints C | ~12 | 14 baris | ⚠️ sedikit understated |

### C3. [RINGAN] `DELETE /api/repos/:id` ada tapi tidak dibahas

Tidak ada penjelasan efek samping (apakah `prs`/`review_results` ikut terhapus,
atau repo cuma di-set `active=false`).

---

## D. README.md

- D1. Tabel perbandingan memakai angka yang salah (lihat C2).
- D2. Kolom C di tabel klaim "7" tabel DB; spec punya 6. Setelah C1 dibereskan,
  angka mana pun yang dipakai harus disamakan — sebaiknya jangan taruh angka di
  README, cukup arahkan ke spec.

---

## E. Catatan lintas dokumen

- E1. DESIGN-GUIDE merujuk "Next.js 15" sementara README menyebut stack yang sama —
  konsisten, tidak ada temuan.
- E2. `DESIGN-GUIDE.md` adalah satu-satunya file DESIGN dengan isi prosa;
  tiga lainnya murni front-matter YAML. Kalau stitch dijanjikan "paste isi file
  DESIGN.md", file A/B/C tidak punya prose (Overview/Do's & Don'ts) yang diharapkan
  spec DESIGN.md.

---

## Usulan urutan perbaikan (kalau mau dieksekusi)

### ✅ STATUS v2 (2026-09-10) — eksekusi light-mode

Semua di atas sudah dieksekusi, lalu **dilampaui** oleh migrasi light. Status per file:

- `A-platform-DESIGN.md` — Platform-Light, 24 warna / 26 komponen. `designmd lint`: **0 error**.
- `B-helpdesk-DESIGN.md` — Helpdesk-Light, 25 warna / 36 komponen. `designmd lint`: **0 error**.
- `C-code-review-DESIGN.md` — CodeReview-Light, 32 warna / 35 komponen. `designmd lint`: **0 error**.
- `DESIGN-GUIDE.md` — ditulis ulang: Surface Rules light, Anti-Slop 18 aturan,
  Density & State Matrix, spec 16 halaman app + 5 halaman Hub (saat review ditulis).
- `README.md` — tabel file diperbarui (kini memasukkan 3 file token) + catatan migrasi.

Perbaikan kontras v2 (semua terverifikasi lewat perhitungan rasio, semua >= 4.5:1):
Ditemukan & diperbaiki saat migrasi — `text-tertiary` `#7b818c` → `#62676f` (3.66 → 5.32:1),
badge teks-on-tint (efek `#xxxxxx1a` yang dibaca tool sebagai layer hitam) diganti warna
tint eksplisit: `badge-success` `#15803d` di `#e8f6ee` (4.5:1), `badge-danger` `#b91c1c`
di `#fdecec` (5.66:1), `badge-warning` `#b45309` di `#fdf1e3` (4.51:1), `badge-accent`
`#5b46d6` di `#f2f0fe` (5.67:1), `rail-item-active`/`rail-count`/`table-header` dibereskan.

Sisa warning = `orphaned-tokens` saja (token yang hanya dipakai lewat tabel sub-token
prosa, di luar skema `components:`) — bukan kesalahan.

### Urutan (historis, sudah selesai)

1. **C1** — deklarasikan tabel `users` + endpoint auth lokal di C (blocking: fitur Must tidak teruji).
2. **A2** — benerin YAML C-code-review-DESIGN.md (file sekarang efektif mati).
3. **A1** — betulin `surface-canvas` & definisikan `elevation.*` (atau ganti jadi nilai literal).
4. **B1** — tambah halaman Hub/login terpadu + badge breach SLA ke DESIGN-GUIDE.
5. **C2/D1** — sinkronkan angka tabel/endpoint antara PRD, spec, dan README.
6. **A4** — perbaiki 2 kontras yang benar-benar gagal (`button-primary`, `badge-success`).
7. **B2/B3/B4** — resolve kontradiksi aturan (emoji, 750 vs 510, jumlah level severity).
8. B5/B6/C3/D2/A3/A5/E2 — pembersihan ringan.
