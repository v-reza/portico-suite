# 00 — MASTER PRD: Portfolio Project Suite

| Field | Value |
|---|---|
| **Product** | 3-project portfolio suite (A: Platform, B: Helpdesk, C: AI Code Review) |
| **Version** | 0.1 |
| **Status** | `draft` — butuh review sebelum di-freeze |
| **Owner** | Reza (solo dev) |
| **Date** | 2026-09-10 |
| **Architecture specs** | [A-platform.md](A-platform.md) · [B-helpdesk.md](B-helpdesk.md) · [C-code-review.md](C-code-review.md) |
| **Design system** | [DESIGN-GUIDE.md](DESIGN-GUIDE.md) · [A-platform-DESIGN.md](A-platform-DESIGN.md) · [B-helpdesk-DESIGN.md](B-helpdesk-DESIGN.md) · [C-code-review-DESIGN.md](C-code-review-DESIGN.md) |
| **Project PRDs** | [A-platform-PRD.md](A-platform-PRD.md) · [B-helpdesk-PRD.md](B-helpdesk-PRD.md) · [C-code-review-PRD.md](C-code-review-PRD.md) |

> **Cara pakai dokumen ini:** PRD ini mendefinisikan *kenapa* dan *sukses-nya diukur apa*. Detail teknis (schema, endpoint, folder tree) sengaja **tidak** diulang di sini — link ke spec. PRD per-project berisi user stories + acceptance criteria lengkap.

---

## 1. Problem Statement

Seorang developer solo butuh portfolio kerja yang membuktikan kemampuan **engineering**, bukan kemampuan menulis to-do app ke-400. Masalahnya:

- Portfolio umum (clone Netflix, weather app, CRUD blog) **tidak membedakan** pelamar satu dengan yang lain. Reviewer teknis menghabiskan <60 detik per portfolio sebelum memutuskan lanjut atau tidak.
- Klaim "berpengalaman dengan AI" tidak punya bukti kalau hasilnya cuma wrapper LLM 20 baris yang bisa dipaste siapa saja.
- Skill multi-step (auth + RBAC + queue + webhook + observability) tidak bisa dibuktikan dengan satu project kecil — butuh **beberapa produk yang saling nyambung** dan konsisten dikerjakan.
- Owner belum punya artefak yang mendemonstrasikan cara berpikir produk: kenapa fitur ini, kenapa bukan fitur itu, suksesnya diukur gimana.

Yang dirugikan: **Reza** (kehilangan peluang interview), **recruiter** (tidak bisa menilai kandidat dari portfolio yang generik).

**Cost hari ini:** setiap lamaran dikirim tanpa artefak yang bisa membedakan. Waktu belajar dihabiskan untuk project yang tidak menghasilkan sinyal.

`ASSUMPTION:` Owner sedang menyiapkan portfolio untuk melamar posisi full-stack / AI engineer. Kalau tujuannya beda (freelance, jualan produk), §4 dan §8 harus direvisi.

---

## 2. Goals & Non-Goals

### Goals

| ID | Goal | Kenapa penting |
|---|---|---|
| G1 | 3 produk berdiri sendiri, masing-masing deployable & bisa dipakai tanpa project lain | Menunjukkan konsistensi, bukan one-hit |
| G2 | Tiap project memakai AI secara **esensial** (kalau AI dimatikan, produk kehilangan fungsi inti) | Membedakan dari project "AI-powered" stiker |
| G3 | Target multi-step nyata: auth, RBAC, background job, webhook, audit log | Bukti kemampuan sistem, bukan tutorial |
| G4 | Dogfooding: project C mereview PR repo A & B | Narasi portfolio yang tidak bisa ditiru cepat |
| G5 | Ketiga produk live di URL publik dengan data demo yang bisa dicoba reviewer <2 menit | Reviewer tidak akan setup lokal |
| G6 | Setiap project punya test suite yang jalan di CI | Sinyal kualitas yang mudah diverifikasi |
| G7 | Ketiga app bisa dipakai dalam **bahasa Inggris dan Indonesia** (pemilih bahasa, bukan dua build) | Reviewer bisa non-Indonesia; pemilik produk lokal tetap nyaman |

### Non-Goals

| ID | Bukan goal | Alasan |
|---|---|---|
| NG1 | Multitenancy skala SaaS, billing berbayar, SOC2, SLA kontraktual | Biaya waktu > sinyal yang didapat |
| NG2 | Aplikasi mobile native | Tidak menambah sinyal unik di sini |
| NG3 | 3D / Three.js di dalam app A, B, atau C | 3D hanya untuk *web profile* terpisah; app harus fokus fungsi |
| NG4 | Microservices, Kubernetes, service mesh | Kompleksitas tanpa manfaat di skala 1 orang |
| NG5 | Fitur kolaborasi real-time / CRDT / video call | Satu-dua area berbeda, jangan semua sekaligus |
| NG6 | Dukungan browser lama / mobile app-grade polish | Fokus desktop web dulu |
| NG7 | Auto-fix PR otomatis (project C) | Risiko menulis commit ke repo orang; tetap v2 |
| NG8 | Membangun produk yang benar-benar dijual | Beda PRD kalau nanti jadi arahnya |
| NG9 | Enterprise SSO (SAML / LDAP / OIDC pihak ketiga) | SSO internal lewat Hub (§5.1) sudah cukup untuk narasi; integrasi IdP asing menambah kompleksitas tanpa sinyal baru |
| NG10 | Kuota/billing penegakan per-plan (penagihan berbayar, kuota per-plan) | Tidak menambah sinyal; fokus pada fungsi produk. **Dicabut sebagian (2026-09-12):** konsol admin lintas-app (users/roles/app-settings di Hub) KELUAR dari non-goal dan menjadi US-M11 — lihat §5.1 |
| NG11 | Manajemen permission granular (role → CRUD per-resource, editor permission matrix) | RBAC berbasis peran sudah cukup untuk narasi; permission engine dinamis menambah kompleksitas backend tanpa sinyal baru |

---

## 3. Personas

### P1 — Reza, "The Builder" (owner)
- **Peran:** solo developer, sekaligus the one who builds and demos.
- **Konteks:** kerja sendiri, waktu terbatas, satu laptop.
- **Job to be done:** menghasilkan artefak yang membuat orang mau menginterview dia.
- **Workaround sekarang:** dokumentasi di kepala, spec tercecer.
- **Sukses bagi dia:** 3 app live + 1 repo publik yang rapi + bisa jelasin keputusan produk dengan yakin.

### P2 — Maya, "Technical Recruiter / Hiring Manager"
- **Peran:** orang yang men-scan portfolio, biasanya 30-90 detik pertama.
- **Konteks:** buka 20 portfolio per hari, sudah kebal dengan "AI-powered platform".
- **Job to be done:** memutuskan "layak dipanggil atau tidak" tanpa setup lokal.
- **Workaround sekarang:** skip portfolio tanpa demo publik; skip kalau README tidak jelas fungsinya ngapain.
- **Sukses bagi dia:** dalam 2 menit dia paham produk ini ngapain, dan ada 1 detail teknis yang tidak bisa dikarang pengikut tutorial (contoh: bot-nya beneran ngekomentar di PR).

### P3 — Adit, "The Overloaded Team Lead" (jangkar persona end-user, dipakai di project A)
- **Peran:** user nyata yang jadi pembenaran fitur produk.
- **Konteks:** tim kecil, banyak proses manual berulang, tidak punya budget tools enterprise.
- **Job to be done:** mengubah proses manual berulang jadi form + otomasi, tanpa nulis kode (project A).
- **Workaround sekarang:** spreadsheet + WhatsApp + inget-inget sendiri.
- **Sukses bagi dia:** proses yang dulu 30 menit hilang jadi 2 menit.

Persona end-user tiap produk ada di PRD masing-masing (B punya Sari/Rio/Dita, C punya Dimas). P3 di sini hanya jangkar untuk project A, bukan pengganti.

---

## 4. Kenapa tiga ini, dan kenapa urutan ini

| Project | Membuktikan | Kenapa dipilih |
|---|---|---|
| **B — Helpdesk** | CRUD sistem kompleks, RBAC, SLA engine, inbound email, webhook outbound | Domain paling jelas dipahami reviewer; "pengganti Zendesk" langsung ngerti tanpa dijelaskan. Fondasi kualitas test. |
| **A — Platform** | Builder UI (drag-drop), AI structured output + validation, workflow runner, enkripsi rahasia | Membedakan dari CRUD biasa; AI-nya esensial (generate app dari prompt). |
| **C — Code Review** | Multi-agent pipeline, GitHub App auth, async queue, dedup/ranking, cost tracking | Paling tinggi sinyal AI-nya, dan menciptakan narasi dogfooding yang tidak dimiliki portfolio lain. |

**Urutan build: B → A → C.** Alasan: B paling jelas scope-nya jadi pemanasan sekaligus menetapkan konvensi (test, error format, state handling). A memakai konvensi itu. C dibangun terakhir karena C *butuh* A dan B sebagai objek review — kalau C dibangun duluan, tidak ada yang direview, dan narasi dogfooding-nya kosong.

---

## 5. Hubungan antar project (bukan arsitektur, hanya peran)

```
B (Helpdesk) ─┐
              ├──> C (AI Code Review) ──> bot ngekomentar di PR repo A & B
A (Platform) ─┘

Web Profile (3D diorama, terpisah) ──> pintu masuk yang mengarahkan ke 3 produk di atas
```

- A dan B **tidak boleh saling bergantung** (kode, DB, deploy harus terpisah).
- C boleh bergantung pada A & B hanya sebagai *target review*, bukan sebagai runtime dependency.
- Web profile bukan bagian dari suite ini; dia hanya etalase.

### 5.1 Identitas bersama (Hub) — SSO internal

Keputusan: **SSO internal lewat Hub**, bukan SAML/OIDC pihak ketiga (itu tetap Non-Goal, lihat NG9).

Hub (web profile + portal portofolio) jadi **identity provider** untuk ketiga app. Semua angka dan detail
kontrak di bawah ini **hanya ditulis di sini**; PRD per-project mengacu ke §5.1 di dokumen ini dan tidak boleh
mengulang nilainya.

**Kontrak:**

| Aspek | Aturan |
|---|---|
| Login default tiap app | **email + password lokal, tetap wajib jalan** — SSO adalah jalur *tambahan*, bukan pengganti |
| Aturan kemandirian | Hub mati **tidak boleh** membuat app A, B, atau C tidak bisa dipakai/di-deploy sendiri (selaras §5 butir 1) |
| Protokol | Authorization Code flow dari Hub ke app |
| Token | JWT ter-sign **RS256**; app memverifikasi pakai **endpoint JWKS publik Hub** |
| Rotasi kunci | App cache kunci JWKS dan tetap verifikasi setelah kunci Hub dirotasi, **tanpa restart** |
| Provisioning | Just-in-time: login Hub pertama membuat/menautkan akun lokal, map klaim `sub` → user lokal |
| Email sudah ada | Email cocok dengan user lokal yang sudah ada → **ditautkan**, bukan dibuatkan akun kedua |
| Peran/akses | **Diatur di Hub, ditegakkan di app.** Hub jadi *control plane*: menyimpan definisi peran per-app + penugasannya. App menyimpan salinan lokal dan menegakkan sendiri, sehingga Hub mati tidak menghentikan penegakan (lihat Aturan kemandirian) |
| Batas control plane | Hub **hanya** mengatur **akses app** (boleh masuk app ini atau tidak) + **peran app-level** di A dan B. Hub **tidak** mengatur izin di dalam app: akses repo C tetap milik C (`US-C17`), dan keanggotaan workspace/organisasi tetap milik app masing-masing |
| Vocabulary peran | **Tidak diseragamkan.** Tiap app punya set sendiri — A `admin/builder/viewer`, B `admin/agent/customer`, C akses repo per-repo. Hub menyimpan ketiganya dan tidak memaksa satu skema universal |
| Akses app | Hub menyimpan daftar app yang boleh dimasuki tiap user. User tanpa akses ke sebuah app: kartunya di halaman Pilih App tampil **disabled + alasan**, dan redirect-nya ditolak **di server** (bukan cuma tombol yang dimatikan) |
| Halaman kelola Hub | Hub punya halaman **Users** dan **Roles** — lihat `DESIGN-GUIDE.md` § Hub |
| User Hub tak dikenal | Masuk app dalam keadaan **tanpa keanggotaan** — harus diundang (atau bikin workspace/organisasi sendiri di A/B). Di Hub, app yang belum dia punya aksesnya tampil disabled |
| Bot C | Bot tetap autentikasi lewat **GitHub App installation**, bukan SSO. SSO hanya untuk login dashboard |

Coverage per app: A → `US-A31`, B → `US-B34`, C → `US-C17`. Implementasi juga dipakai halaman masuk etalase (M4).

`OPEN: Setelah Hub dipakai bersama 3 app, apakah Hub juga jadi satu-satunya tempat ganti password/email akun?`
`     → Rekomendasi: di MVP tidak; password lokal tetap bisa diubah dari masing-masing app supaya tidak ada single point of failure.`

---

Detail arsitektur: lihat spec per project. PRD ini tidak menyalin schema.

---

## 6. Scope & Prioritas (portofolio-level)

| Area | Isi | Prioritas |
|---|---|---|
| Project B | Helpdesk MVP sesuai [B-helpdesk-PRD.md](B-helpdesk-PRD.md) | **Must** |
| Project A | Platform MVP sesuai [A-platform-PRD.md](A-platform-PRD.md) | **Must** |
| Project C | AI Code Review MVP sesuai [C-code-review-PRD.md](C-code-review-PRD.md) | **Must** |
| C terpasang di A & B | GitHub App aktif, ada bukti komentar nyata di PR | **Must** — ini inti narasinya |
| Deploy publik 3 app + demo seed data | Satu URL per produk | **Must** |
| README portfolio + halaman demo 2 menit | Panduan reviewer | **Must** |
| Web profile 3D | Etalase | **Should** |
| UI bilingual (EN/ID) di ketiga app + pemilih bahasa | Keterjangkauan reviewer | **Must** — lihat US-M07 |
| Health/readiness endpoint di ketiga app | Sinyal operasional yang bisa dicek reviewer | **Must** — lihat US-M08 |
| Rate limiting di endpoint publik A & B + login | Production readiness | **Must** — lihat US-A32 / US-B33 |
| Identitas bersama (Hub / SSO internal) | Satu login untuk 3 app | **Must** — lihat §5.1 |
| Halaman masuk terpadu (Hub) yang mengarahkan ke 3 app | Jembatan web profile → produk | **Must** — lihat US-M09 |
| Auto-fix PR (C v2), Slack notify, allowlist | Fitur lanjutan | **Could** |
| Bahasa ketiga, **tema gelap**, mobile-perfect | Polish | **Won't (sekarang)** — catatan: tema **terang** justru sistem yang dipakai sekarang (light-first, lihat design system), jadi yang ditunda adalah varian **gelap** |

---

## 7. Portfolio-level User Stories

Ini story tentang *portofolio*-nya, bukan fitur produk. Fitur produk ada di PRD masing-masing.

---

**US-M01** — Sebagai **Reza**, gw mau tiap produk bisa dibuka lewat URL publik tanpa install apa pun, supaya recruiter bisa mencoba sendiri.
Priority: Must · Est: M

- [ ] AC1: Kalau 3 produk sudah deploy, saat Maya buka URL produk mana pun, halaman pertama yang muncul bisa diakses tanpa login dalam <5 detik (koneksi normal).
- [ ] AC2: Kalau Maya tidak punya akun, saat dia butuh melihat fitur inti, tersedia tombol/kredensial **demo account** yang tertulis jelas di halaman login.
- [ ] AC3: Kalau demo account dipakai, saat Maya mengubah data, perubahannya **tidak merusak** tampilan default user lain (data demo bisa di-reset, atau dipisah per sesi).
- [ ] AC4: Kalau produk sedang down, saat Maya buka URL, muncul halaman error yang jelas (bukan stack trace mentah).

---

**US-M02** — Sebagai **Reza**, gw mau ada data demo yang sudah terisi, supaya reviewer tidak melihat dashboard kosong.
Priority: Must · Est: S

- [ ] AC1: Kalau database baru di-seed, saat reviewer login, project B punya ≥20 tiket dengan status berbeda-beda, ≥3 KB article, dan ≥1 SLA policy aktif.
- [ ] AC2: Kalau database baru di-seed, saat reviewer login project A, ada ≥2 app contoh yang sudah punya halaman, komponen, dan ≥1 workflow.
- [ ] AC3: Kalau database baru di-seed, saat reviewer buka project C, ada ≥3 PR dengan hasil review (termasuk minimal 1 PR dengan temuan critical, dan 1 PR bersih tanpa temuan).
- [ ] AC4: Kalau seed dijalankan dua kali, maka tidak ada data duplikat (idempotent).

---

**US-M03** — Sebagai **Reza**, gw mau bot C beneran ngekomentar di PR repo A dan B, supaya klaim dogfooding bisa diverifikasi.
Priority: Must · Est: M

- [ ] AC1: Kalau GitHub App C terpasang di repo A, saat gw buka PR berisi bug yang disengaja, dalam <2 menit muncul komentar bot di PR itu.
- [ ] AC2: Kalau komentar sudah muncul, saat reviewer klik link di README portfolio, dia sampai ke PR asli di GitHub (bukan screenshot).
- [ ] AC3: Kalau PR dibuat di repo A dan repo B, maka keduanya tercatat di dashboard C sebagai repo terpisah dengan riwayat review masing-masing.
- [ ] AC4: Kalau PR hanya mengubah file `.md`, maka bot **tidak** berkomentar (menghindari noise yang terlihat tidak profesional).

---

**US-M04** — Sebagai **Maya**, gw mau paham satu produk dalam 2 menit, supaya gw bisa memutuskan lanjut atau tidak dengan cepat.
Priority: Must · Est: S

- [ ] AC1: Kalau Maya buka README portfolio, saat dia baca 30 detik pertama, dia dapat: satu kalimat masalah yang dipecahkan, satu screenshot/GIF, dan satu link demo.
- [ ] AC2: Kalau dia buka repo produk, saat dia scroll README, ada bagian "Kenapa ini ada" dan "Bagian tersulit secara teknis" — bukan hanya daftar fitur.
- [ ] AC3: Kalau dia tidak mau baca, saat dia lihat judul commit 20 terakhir, terlihat pola kerja nyata (bukan satu commit "initial commit" raksasa).
- [ ] AC4: Kalau dia ragu apakah app-nya jalan, saat dia jalankan perintah di README (opsional, satu perintah), stack-nya jalan lokal ≤10 menit.

---

**US-M05** — Sebagai **Reza**, gw mau tiap project punya test yang jalan di CI, supaya kualitasnya bisa diverifikasi orang lain tanpa percaya kata gw.
Priority: Should · Est: M

- [ ] AC1: Kalau push ke branch mana pun, saat CI jalan, test suite dieksekusi otomatis dan statusnya terlihat di repo.
- [ ] AC2: Kalau ada test yang gagal, maka build ditandai gagal (tidak bisa hijau walau test merah).
- [ ] AC3: Kalau README menampilkan badge CI, saat diklik, menuju run CI asli.
- [ ] AC4: Kalau test suite dijalankan lokal dengan `npm test`, maka hasilnya sama dengan di CI (tidak ada test yang hanya jalan di CI).

---

**US-M06** — Sebagai **Reza**, gw mau bisa menjelaskan setiap keputusan scope dengan alasan, supaya saat wawancara gw tidak kelihatan menebak.
Priority: Should · Est: S

- [ ] AC1: Kalau ada pertanyaan "kenapa tidak pakai X", saat gw jawab, jawabannya bisa dirujuk ke bagian Non-Goals di PRD ini atau PRD project.
- [ ] AC2: Kalau ada fitur yang sengaja ditunda, maka tercatat di §11 PRD project sebagai `OPEN:` atau di tabel prioritas `Could/Won't` dengan alasannya.
- [ ] AC3: Kalau ada keputusan arsitektur besar (contoh: Postgres JSONB untuk data dinamis di A), maka ada catatan singkat alasan + alternatif yang ditolak.

---

**US-M07** — Sebagai **Maya**, gw mau memakai app dalam bahasa Inggris, sementara pengguna lokal bisa pakai Indonesia, supaya tidak ada yang dipaksa bahasa asing.
Priority: Must · Est: M

- [ ] AC1: Kalau Maya membuka app dan browser-nya berbahasa Inggris, maka UI tampil dalam bahasa Inggris tanpa dia mengubah pengaturan apa pun (deteksi dari header `Accept-Language`).
- [ ] AC2: Kalau ada pemilih bahasa di UI, saat Maya memilih Indonesia, seluruh label berubah dan pilihannya tersimpan (bertahan setelah reload dan setelah login).
- [ ] AC3: Kalau satu halaman punya teks UI dan (di project C) teks keluaran AI, maka **keduanya boleh berbeda bahasa** — bahasa UI dashboard dan bahasa keluaran AI adalah dua pengaturan terpisah (lihat US-C14). Yang dilarang adalah campuran **di dalam satu keluaran** (mis. satu komentar PR separuh Inggris separuh Indonesia).
- [ ] AC4: Kalau sebuah string belum diterjemahkan, maka yang tampil adalah kunci terjemahannya (mis. `ticket.empty_state`) atau bahasa Inggris — **bukan** layar kosong, dan kekurangan itu tercatat supaya bisa dibetulkan.
- [ ] AC5: Kalau ada bahasa yang belum didukung diminta lewat URL, maka sistem jatuh ke Inggris, bukan error.
- [ ] AC6: Kalau teks dinamis berisi angka dan tanggal, maka formatnya ikut locale (1.234 vs 1,234) — bukan angka mentah.
- [ ] AC7: Kalau tester menjalankan pemeriksaan, maka tidak ada string UI yang di-hardcode di komponen (dipastikan lewat uji otomatis atau pemeriksaan daftar).

---

**US-M08** — Sebagai **Maya**, gw mau bisa ngecek sendiri semua komponen hidup atau nggak, supaya gw bisa percaya demo-nya bukan cuma halaman depan yang bagus.
Priority: Must · Est: S

- [ ] AC1: Kalau ketiga app sudah deploy, saat gw buka `<url>/health` di app mana pun, respons 200 berisi status hidup proses itu, tanpa perlu login.
- [ ] AC2: Kalau gw buka `<url>/ready` di app mana pun, maka responsnya memuat status **per komponen** (database, worker/queue, dan komponen khusus app: storage di A, poller email di B) dengan latensi masing-masing dalam milidetik.
- [ ] AC3: Kalau satu komponen wajib mati (contoh: database dimatikan), saat gw buka `/ready`, status HTTP-nya **bukan** 200 dan komponen yang gagal disebut namanya (bukan sekadar "error").
- [ ] AC4: Kalau `/health` dan `/ready` diakses siapa pun, maka **tidak ada** rahasia yang bocor — tidak ada string koneksi, nama host internal, versi paket, variabel lingkungan, atau isi stack trace di respons.
- [ ] AC5: Kalau gw buka `/ready` dua kali berturut-turut, maka tidak ada data lama yang tersaji (respons tidak di-cache); header no-store ada.
- [ ] AC6: Kalau komponen sudah normal lagi, saat gw buka `/ready`, status kembali 200 tanpa restart app.

---

**US-M09** — Sebagai **Maya**, gw mau satu halaman masuk yang jelas dan mengarahkan gw ke tiga produk, supaya gw tidak bingung harus mulai dari mana.
Priority: Must · Est: S

- [ ] AC1: Kalau gw buka halaman masuk portfolio, saat halaman dimuat, dalam satu layar ada: nama tiap produk, satu kalimat masalah yang dipecahkan, tombol demo, dan tombol akun demo.
- [ ] AC2: Kalau gw belum login, saat gw klik salah satu produk, gw diarahkan ke produk itu dan tetap bisa masuk lewat tombol **akun demo** tanpa registrasi.
- [ ] AC3: Kalau halaman masuk punya pemilih bahasa, saat browser gw berbahasa Inggris, halaman tampil Inggris tanpa gw mengubah apa pun (selaras US-M07).
- [ ] AC4: Kalau salah satu produk sedang tidak bisa diakses, saat gw buka halaman masuk, produk itu ditandai jelas "sedang tidak tersedia" dan **tidak** membuat seluruh halaman gagal dimuat (halaman tetap 200).
- [ ] AC5: Kalau gw klik tombol demo produk yang sedang mati, maka gw dapat halaman pesan yang jelas, bukan halaman putih atau stack trace.

---

**US-M10** — Sebagai **Maya**, gw mau satu akun tetap berlaku di tiga app, supaya gw tidak perlu bikin akun tiga kali buat nyoba portofolionya.
Priority: Must · Est: M

- [ ] AC1: Kalau gw masuk lewat Hub (§5.1) dan belum punya akun di app mana pun, saat gw buka app A, akun lokal gw dibuat otomatis dan perannya **tidak** diambil dari token — kalau belum diundang, gw masuk tanpa keanggotaan dan diarahkan ke jalur undangan/bikin workspace.
- [ ] AC2: Kalau email Hub-ku sudah terdaftar di app B, saat gw login Hub sekali, email itu **ditautkan** ke user lokal yang sudah ada dan tidak ada akun kedua (tidak ada data terbelah).
- [ ] AC3: Kalau Hub sedang mati, saat gw login pakai email+password lokal di app A, B, atau C, gw tetap bisa masuk dan semua fitur app itu jalan seperti biasa (bukti kemandirian tiap app).
- [ ] AC4: Kalau gw login Hub dari halaman masuk, saat gw kembali lagi setelah sesi kedaluwarsa, gw diminta login ulang dan perpindahan app tidak menyisakan sesi setengah jadi.
- [ ] AC5: Kalau bagian tukar-kode (`token exchange`) gagal atau gw batalkan di tengah jalan, maka tidak ada akun lokal yang dibuat dan tidak ada baris setengah jadi di database (provisioning hanya jalan setelah token terverifikasi).
- [ ] AC6: Kalau gw hanya penonton (bukan pemilik repo), saat gw buka dashboard C lewat Hub, akses repo-nya tetap ditentukan oleh keanggotaan lokal app C, bukan oleh token.
- [ ] AC7: Kalau kunci penandatangan Hub dirotasi, saat gw masuk lagi, verifikasi token di app tetap jalan tanpa perlu restart app.

---

**US-M11** — Sebagai **Reza**, gw mau mengatur akses app dan peran tiap user dari satu tempat di Hub, supaya gw tidak perlu login ke tiga app satu-satu cuma buat ngatur siapa boleh apa.
Priority: Must · Est: M

- [ ] AC1: Kalau gw buka halaman Users di Hub, saat daftar dimuat, tiap baris menampilkan akses user ke ketiga app sebagai badge terpisah, dan badge app yang tidak dia punya aksesnya tampil abu — bukan disembunyikan.
- [ ] AC2: Kalau gw cabut akses user ke sebuah app, saat dia membuka halaman Pilih App di Hub, kartu app itu tampil **disabled** dengan alasan yang terbaca, dan percobaan redirect langsung ke URL authorize app itu ditolak **di server** dengan 403 — bukan cuma tombol yang dimatikan.
- [ ] AC3: Kalau gw ubah peran user di Hub, saat dia memakai app itu, perubahan berlaku tanpa dia perlu login ulang, dan perubahan itu tercatat di log aktivitas Hub (siapa mengubah apa, kapan).
- [ ] AC4: Kalau gw buka halaman Roles di Hub, saat dimuat, peran dikelompokkan per app dengan vocabulary masing-masing (Platform: admin/builder/viewer · Helpdesk: admin/agent/customer · Code Review: akses per repo), **tanpa** dipaksa jadi satu skema seragam.
- [ ] AC5: Kalau gw melihat matriks permission sebuah peran, saat gw klik sel mana pun, tidak ada yang berubah — matriks itu baca-saja dan ada caption yang menyatakannya (selaras NG11).
- [ ] AC6: Kalau Hub sedang mati, saat gw memakai app A, B, atau C, penegakan peran di app itu tetap jalan pakai salinan lokal — tidak ada app yang jadi tidak bisa dipakai (selaras §5.1 Aturan kemandirian).
- [ ] AC7: Kalau gw mencoba menurunkan peran admin terakhir di sebuah app, saat gw simpan, perubahan ditolak dengan pesan yang jelas — baik dari Hub maupun dari halaman Settings app itu.

---

## 8. Success Metrics (portofolio-level)

| # | Metric | Baseline | Target | Cara ukur |
|---|---|---|---|---|
| M1 | Produk live dengan URL publik | 0 | 3 | Cek manual: 3 URL merespons 200 |
| M2 | Waktu reviewer dari buka URL ke "paham produknya ngapain" | tidak terukur | ≤2 menit | Test ke 2 orang, catat waktu & pertanyaan mereka |
| M3 | Temuan bot C yang **valid** (bukan false positive) di PR uji | 0 | ≥70% dari temuan adalah isu nyata | Siapkan 10 PR uji berisi bug yang disengaja, hitung presisi |
| M4 | Cakupan fitur MVP M1 per project (tabel scope PRD project) | 0% | 100% baris Must | Checklist manual sebelum tandai rilis |
| M5 | Test suite hijau di CI | 0 | 100% run hijau | Tab Actions di GitHub |
| M6 | Waktu bot C dari PR dibuka sampai komentar muncul (PR normal) | tidak ada | <2 menit p95 | Log timestamp `webhook_logs` vs waktu komentar |
| M7 | Biaya LLM per review PR (project C) | tidak ada | <$0.05 | `review_runs.llm_cost_cents` dirata-rata |
| M8 | Login Hub yang berhasil mengarahkan ke app (SSO internal, US-M10) | tidak ada | 100% login berhasil mendarat di app tujuan tanpa akun ganda | Uji manual: 3 akun (ada di Hub saja / ada di app saja / ada di keduanya), cek jumlah baris `users` |

Catatan: M6 & M7 bukan "metric bisnis" — ini **criterion yang bisa diverifikasi** oleh reviewer, yang untuk project portfolio justru lebih kuat daripada angka palsu soal revenue.

---

## 9. Constraints

| Tipe | Batasan |
|---|---|
| Tim | 1 orang. Tidak ada code review manusia, jadi test + type safety menggantikan peran itu. |
| Waktu | Total 5–8 minggu untuk 3 project + deploy. Setiap project >3 minggu berarti scope harus dipotong. |
| Biaya | Harus jalan dengan free tier / biaya minimal. LLM API = biaya utama project C → wajib ada pencatatan biaya per run. |
| Infra | Deploy harus muat di 1 VPS kecil atau free tier (Docker Compose). Tidak boleh butuh layanan berbayar untuk demo. |
| Konsistensi | Ketiga project pakai design system yang sama (lihat DESIGN-GUIDE.md). |
| Foto-reviewer | Semua fitur inti harus bisa dicoba tanpa setup lokal dan tanpa CLI. |

---

## 10. Risks & Mitigations

| # | Risk | Dampak | Mitigasi |
|---|---|---|---|
| R1 | **Scope creep**: tiap project punya tabel fitur `Could` yang menggoda untuk dikerjakan | Project tidak pernah selesai | Gate: hanya baris `Must` yang dikerjakan sampai ketiganya live. `Could` masuk backlog, bukan sprint. |
| R2 | Project C jadi tidak meyakinkan karena presisi deteksi rendah | Narasi dogfooding jadi bumerang (bot-nya salah terus) | Wajib regex-layer + LLM verification sebelum posting; ukur presisi di PR uji (M3) sebelum dipasang ke repo publik |
| R3 | Bot C memposting noise berlebihan (false positive) di repo sendiri | Terlihat tidak profesional | Skip trivial PR, cap temuan, threshold severity minimum, dan tombol dismiss per temuan |
| R4 | Biaya LLM membengkak tanpa terasa | Demo tiba-tiba berhenti | Cap temuan, model lebih murah untuk agent style & judge, pencatatan biaya per run, budget harian |
| R5 | 3 project tapi ketiganya dangkal | Sinyal "bisa banyak hal tapi tidak dalam" | Urutan build tegas + gate per milestone: satu project tidak dimulai sebelum yang sebelumnya live |
| R6 | Deploy dicicil di akhir, ternyata butuh perubahan besar | Deadline meleset | Docker Compose dari hari pertama + deploy pertama di akhir minggu pertama tiap project (bukan di akhir semua) |
| R7 | Tidak ada yang membuka portfolionya | Semua kerja tidak berdampak | Halaman demo 2 menit + satu PR publik yang menunjukkan bot bekerja; sebar lewat 1 kanal yang relevan |
| R8 | Mengerjakan versi "bagus" duluan (design polish) sebelum fungsinya ada | Waktu habis di UI | Aturan: fitur harus jalan dulu (test hijau), polish setelah milestone rilis |

---

## 11. Assumptions & Open Questions

```
ASSUMPTION: Tujuan utama adalah sinyal untuk lamaran kerja / recruiter teknis.
ASSUMPTION: Reviewer akan mencoba demo tanpa setup lokal; README + demo account lebih penting dari dokumentasi instalasi panjang.
ASSUMPTION: Budget LLM ditanggung sendiri dan harus kecil (<$20/bulan saat demo aktif).
ASSUMPTION: Satu laptop untuk development; host deploy terpisah (VPS/free tier).
```

```
OPEN: Web profile 3D masuk timeline 5–8 minggu ini atau setelah 3 app live?
      → Rekomendasi: setelah. Efek portfolio-nya kecil dibanding 3 app.
OPEN: Apakah repo A & B dibuat publik sejak awal?
      → Rekomendasi: ya, publik. Bot C butuh repo publik supaya komentarnya bisa diverifikasi tanpa login.
OPEN: Apakah perlu custom domain atau cukup subdomain platform host?
      → Rekomendasi: subdomain dulu; domain menyusul setelah 3 app live.
```

> **Diputuskan (2026-09-10): Bilingual EN/ID.** Setiap app punya pemilih bahasa + deteksi `Accept-Language`; default Inggris. Bukan dua build terpisah, tapi satu app dengan lapisan terjemahan. Implementasi: US-M07 + FR/NFR per project. Bahasa ketiga masuk Non-Goals/`Won't` sampai 3 app live.

> **Diputuskan (2026-09-10): Hub langsung redirect, tanpa layar persetujuan per-app.** Hub hanya menerbitkan kode otorisasi untuk app yang redirect-URI-nya ada di allowlist terdaftar; app tak terdaftar ditolak sebelum kode dibuat. Tanpa consent screen tidak ada langkah yang bisa dibatalkan user, jadi satu-satunya kondisi setengah jadi adalah kegagalan tukar-kode (dijaga AC5 US-M10). Layar persetujuan masuk `Won't` sampai 3 app live. Lihat §5.1, US-M10.

> **Diputuskan (2026-09-10): SSO internal lewat Hub (identity provider portofolio).** Bukan SAML/LDAP/OIDC pihak ketiga — itu tetap Non-Goal (NG9). Satu akun Hub untuk ketiga app; **login email+password lokal tetap wajib jalan** dan Hub mati tidak boleh melumpuhkan app mana pun. Kontrak lengkap (protokol, algoritma token, JWKS, rotasi kunci, JIT provisioning, aturan peran) hanya ada di **§5.1** dan tidak diulang di PRD per-project. Implementasi: US-M10, US-A31, US-B34, US-C15–C17.

```
OPEN: Kalau Hub jadi satu-satunya tempat ganti password, app A/B/C kehilangan jalur pemulihan saat Hub mati?
      → Rekomendasi: tidak; ganti password tetap bisa dari masing-masing app (lihat §5.1).
OPEN:  Kuota token AI per workspace di A: hard cap atau soft warning?
      → Rekomendasi: soft warning dulu (exceed = tetap jalan + notifikasi), hard cap masuk v1.
```

---

## 12. Release Plan & Exit Criteria

| Milestone | Isi | Exit criteria (harus BENAR untuk lanjut) |
|---|---|---|
| **M0 — Fondasi** | Konvensi: format error response, aturan 4-state UI (loading/empty/error/populated), struktur test, Docker Compose | 1 project skeleton bisa `docker compose up` + test kosong hijau di CI |
| **M1 — B live** | Helpdesk MVP (`Must` di B-PRD) | Semua AC ber-priority Must di B-PRD terverifikasi · B punya URL publik + demo data · test hijau · **UI bilingual EN/ID lengkap (US-B29)** |
| **M2 — A live** | Platform MVP (`Must` di A-PRD) | Semua AC Must di A-PRD terverifikasi · URL publik · test hijau · AI generator berhasil ≥8 dari 10 prompt uji · **UI bilingual EN/ID lengkap (US-A27)** |
| **M3 — C live** | Code Review MVP (`Must` di C-PRD) + terpasang di repo A & B | Komentar bot nyata muncul di ≥2 PR publik · presisi temuan ≥70% di PR uji (M3 metric) · biaya/review <$0.05 · **templat komentar dua bahasa (US-C14)** |
| **M4 — Etalase** | README portfolio, halaman demo 2 menit, GIF/screenshot, badge CI, halaman masuk terpadu | US-M04 AC terpenuhi · diuji ke ≥2 orang dan keduanya paham produk <2 menit · **halaman masuk (US-M09) + SSO Hub (US-M10) jalan, dan login lokal tetap jalan saat Hub dimatikan** |
| **M5 — Terpisah** | Web profile 3D | Bisa dilewati tanpa memengaruhi M1–M4 |

---

## 13. Traceability

| Project | PRD | Story ID range | Spec arsitektur |
|---|---|---|---|
| A — Platform | [A-platform-PRD.md](A-platform-PRD.md) | `US-A01` … `US-A32` | [A-platform.md](A-platform.md) |
| B — Helpdesk | [B-helpdesk-PRD.md](B-helpdesk-PRD.md) | `US-B01` … `US-B35` | [B-helpdesk.md](B-helpdesk.md) |
| C — Code Review | [C-code-review-PRD.md](C-code-review-PRD.md) | `US-C01` … `US-C17` | [C-code-review.md](C-code-review.md) |
| Portofolio | dokumen ini | `US-M01` … `US-M11` | — |

**Total: 95 story** (A 32 + B 35 + C 17 + M 11). Acceptance criteria: **484**
(A 163 + B 183 + C 83 + M 55).

**Aturan ID:** story ID tidak pernah dinomori ulang setelah review. Story yang dibuang ditandai `(dropped)`, tidak dihapus barisnya, supaya tiket turunan tidak bergeser.

---

*Berikutnya: [A-platform-PRD.md](A-platform-PRD.md) → [B-helpdesk-PRD.md](B-helpdesk-PRD.md) → [C-code-review-PRD.md](C-code-review-PRD.md)*
