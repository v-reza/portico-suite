# PRD — PROJECT B: Self-Hosted Helpdesk

| Field | Value |
|---|---|
| **Product** | Helpdesk — self-hosted ticketing |
| **Version** | 0.1 |
| **Status** | `draft` |
| **Owner** | Reza (solo dev) |
| **Date** | 2026-09-10 |
| **Master PRD** | [00-MASTER-PRD.md](00-MASTER-PRD.md) |
| **Architecture spec** | [B-helpdesk.md](B-helpdesk.md) — schema, endpoint, worker ada di sana |
| **Design tokens** | [B-helpdesk-DESIGN.md](B-helpdesk-DESIGN.md) |

---

## 1. Problem Statement

Tim support kecil (2–15 orang) di startup dan agensi Indonesia memakai Excel, WhatsApp grup, dan email pribadi untuk melacak keluhan pelanggan. Akibatnya:

- Tiket hilang di antara chat: tidak ada satu tempat yang tahu "siapa sedang mengerjakan apa".
- Tidak ada tenggat yang ditegakkan. Pelanggan menunggu berhari-hari tanpa ada yang sadar.
- Tidak ada riwayat. Kalau orangnya resign, pengetahuannya ikut hilang.
- Alternatif berbayar (Zendesk, Freshdesk) mulai dari ~$55/agent/bulan (~Rp 850rb) — untuk tim 5 orang itu ~Rp 4,2 juta/bulan, tidak masuk budget untuk tim yang belum punya fungsi support formal.

Yang dirugikan: **tim support** (kerja tanpa sistem, sering disalahkan), **pelanggan** (tidak tahu status keluhannya), **manajer** (tidak punya data untuk keputusan).

`ASSUMPTION:` Pembanding harga diambil dari tier publik Zendesk/Freshdesk. Kalau nanti dipakai untuk klaim di README, angkanya diverifikasi ulang saat itu dan dicantumkan tanggalnya.

---

## 2. Goals & Non-Goals

### Goals

| ID | Goal |
|---|---|
| G1 | Satu tempat yang menjadi kebenaran tunggal untuk semua keluhan pelanggan: masuk dari web atau email, punya status yang jelas. |
| G2 | Tenggat (SLA) ditegakkan otomatis — sistem yang mengingatkan, bukan manusia. |
| G3 | Bisa diinstal sendiri dengan Docker Compose, satu perintah, tanpa layanan berbayar. |
| G4 | Pemisahan peran yang benar: agen tidak bisa melihat data admin, pelanggan tidak bisa melihat tiket pelanggan lain. |
| G5 | Riwayat lengkap: setiap perubahan status dan setiap balasan tercatat dan bisa diaudit. |

### Non-Goals

| ID | Bukan goal | Alasan |
|---|---|---|
| NG1 | Aplikasi mobile native | Web responsif cukup |
| NG2 | Integrasi WhatsApp di MVP (kolom `source` tetap ada) | Membutuhkan API bisnis pihak ketiga + biaya; tunda ke v1 |
| NG3 | Live chat real-time / widget embed | Domain produk berbeda, scope jauh lebih besar |
| NG4 | Billing langganan, batas jumlah agen per plan | Skema `plan` tetap ada, penegakannya tidak |
| NG5 | Marketplace plugin / API publik terdokumentasi penuh | Webhook outbound sudah jadi jalur integrasi |
| NG6 | AI di dalam produk ini | Ini produk operasional; AI-nya ada di project A dan C |
| NG7 | SSO / SAML / LDAP | Login email-password cukup untuk demo; **enterprise** SSO (SAML/LDAP/IdP pihak ketiga) tetap Non-Goal. Catatan: **SSO internal lewat Hub portofolio sekarang masuk scope** sebagai jalur login tambahan (lihat US-B34, kontrak di bagian "Identitas bersama (Hub)" di 00-MASTER-PRD.md) — beda dari enterprise SSO yang ditunda |
| NG8 | Sinkronisasi dua arah dengan Zendesk/Jira | Yang dikejar adalah pengganti, bukan jembatan |

---

## 3. Personas

### P1 — Sari, "Support Lead" (admin)
- **Konteks:** 5 tahun jadi support, sekarang mengatur tim 4 agen. Yang paling stres kalau ada pelanggan komplain karena lewat tenggat.
- **Job to be done:** memastikan tidak ada tiket yang jatuh ke celah, dan tahu beban kerja tiap agen.
- **Workaround sekarang:** spreadsheet "tiket.xlsx" yang diperbarui manual seminggu sekali, plus grup WhatsApp.
- **Sukses:** dia bisa lihat dalam satu layar: berapa tiket terbuka, mana yang hampir lewat SLA, siapa yang overloaded.

### P2 — Rio, "Support Agent" (agent)
- **Konteks:** jawab 30–50 keluhan/hari, sering harus tanya balik ke tim teknis.
- **Job to be done:** mengerjakan tiket cepat tanpa kehilangan konteks, dan berhenti menjawab hal yang sama berulang.
- **Workaround sekarang:** menyalin jawaban dari chat lama; tanya orang di sebelah.
- **Sukses:** dia punya catatan internal di dalam tiket (tidak perlu tanya ulang), dan ada template/artikel KB untuk dijawab sendiri.

### P3 — Dita, "Pelanggan" (requester)
- **Konteks:** pakai produk klien, ketemu masalah, hanya ingin tahu statusnya tanpa harus menelepon.
- **Job to be done:** melaporkan masalah sekali dan tahu bahwa laporannya diurus.
- **Workaround sekarang:** kirim WhatsApp ke sales, yang sering lupa meneruskan.
- **Sukses:** dia dapat nomor tiket, bisa buka link status tanpa membuat akun, dan lihat kalau sudah resolved.

---

## 4. Core User Journeys

**J1 — Dita melapor lewat email (happy path):**
1. Dita kirim email ke `support@klien.com`.
2. Sistem mengenali mailbox itu milik organisasi X, membuat user atas namanya, dan membuat tiket baru.
3. Dita menerima balasan berisi nomor tiket.
4. Rio melihat tiket di daftar, mengambil alih, dan membalas.
5. Balasan Rio terkirim ke email Dita (dan muncul di tiket).
6. Rio menandai resolved → Dita dapat email survei CSAT → dia beri 5 bintang.

**J2 — Sari mengatur tenggat:**
1. Sari buka Settings → SLA.
2. Dia bikin policy: prioritas urgent → respons pertama 15 menit, resolusi 4 jam.
3. Tiket urgent baru dibuat jam 09:00.
4. Jam 09:16 belum ada balasan → sistem menandai breach, mengirim notifikasi ke role admin, dan menulis catatan internal di tiket.
5. Sari melihatnya di dashboard, menugaskan ke Rio.

**J3 — Rio menutup tiket berulang:**
1. Tiket baru: "cara reset password".
2. Rio sudah pernah menjawab ini → dia buka KB, ambil artikel yang ada, kirim sebagai balasan.
3. Rio ubah status jadi `pending` karena menunggu konfirmasi pelanggan.
4. Pelanggan balas "sudah bisa, terima kasih" → tiket otomatis jadi `open` (karena ada balasan pelanggan), lalu Rio resolve.

**J4 — Integrasi sistem luar:**
1. Sari mendaftarkan webhook ke `https://crm-klien.com/hooks/helpdesk` untuk event `ticket.created` dan `ticket.resolved`.
2. Semua tiket baru dan tiket selesai otomatis terkirim ke CRM.
3. Kalau endpoint CRM down, sistem mencoba ulang 3x dengan jeda membesar, lalu menandai gagal di log webhook.

---

## 5. Scope & Prioritas

| Area | Fitur | Prioritas |
|---|---|---|
| Auth | Register organisasi + akun admin pertama | Must |
| Auth | Login / logout sesi | Must |
| Auth | Undang agen via email (magic link, 24 jam) | Must |
| Auth | Peran admin / agent / customer dengan penegakan di server | Must |
| Tiket | Buat, lihat, ubah, arsipkan (soft delete) | Must |
| Tiket | Daftar + filter (status, prioritas, assignee, tag, grup) + pencarian + paginasi | Must |
| Tiket | Mesin status: new → open → pending → resolved → closed (+ reopen) | Must |
| Tiket | Penugasan ke agen dan ke grup | Must |
| Tiket | Tag | Must |
| Tiket | Komentar publik (terlihat pelanggan) | Must |
| Tiket | Catatan internal (tidak terlihat pelanggan) | Must |
| Tiket | Lampiran pada komentar | Must |
| Tiket | Aksi massal (ubah status / assign banyak tiket sekaligus) | Should |
| Tiket | Body komentar markdown | Must |
| SLA | Policy per prioritas (respons pertama + resolusi + eskalasi) | Must |
| SLA | Deteksi pelanggaran otomatis + catatan internal | Must |
| SLA | Eskalasi ke role yang dikonfigurasi | Should |
| Email | Inbound email → tiket baru atau komentar | Must |
| Email | Balasan keluar ke pelanggan | Should |
| Webhook | 5 event outbound + tanda tangan HMAC | Must |
| Webhook | Retry dengan backoff, log hasil | Must |
| CSAT | Survei 1–5 bintang setelah resolved, satu kali per tiket | Must |
| KB | Kategori + artikel markdown | Must |
| KB | Publikasi vs draft (visibilitas berdasarkan peran) | Must |
| KB | Pencarian artikel | Should |
| Portal | Halaman tiket publik berbasis token (tanpa akun) | Must |
| Ops | Dashboard statistik (volume, waktu respons, CSAT) | Must |
| Ops | Log aktivitas perubahan status & penugasan | Must |
| Ops | Hapus permanen otomatis setelah 30 hari arsip | Could |
| Notif | Notifikasi dalam aplikasi (bell) | Could |
| Notif | Badge/lonceng breach SLA di navbar + dismiss per-pengguna (persist) | Must |
| Notif | Balasan via WhatsApp | Won't (sekarang) |
| Ops | Endpoint `/health` + `/ready` (liveness & readiness per komponen) | Must |
| Ops | Rate limiting: login, submit portal publik, REST API (per IP + per user/token) | Must |
| Email | Penanganan email masuk gagal: retry + antrean + retry dari UI admin + alert operator | Must |
| Auth | Login lewat Hub (SSO internal, Authorization Code + JWKS) — lokal tetap default | Must |
| i18n | UI staf + portal pelanggan + email keluar + CSAT masing-masing ikut bahasa pembacanya | Must |

---

## 6. User Stories & Acceptance Criteria

### Autentikasi & Organisasi

---

**US-B01** — Sebagai **Sari**, gw mau mendaftarkan organisasi gw beserta akun admin, supaya tim gw punya ruang kerja sendiri.
Priority: Must · Est: M

- [ ] AC1: Kalau email belum terdaftar, saat Sari mengirim nama organisasi, email, dan password, organisasi dibuat, Sari menjadi `admin`, dan dia langsung masuk tanpa perlu login ulang.
- [ ] AC2: Kalau email sudah terdaftar, saat dia mencoba mendaftar lagi, muncul error "email sudah terdaftar" dan tidak ada organisasi kedua yang dibuat.
- [ ] AC3: Kalau password kurang dari 8 karakter, saat form dikirim, pendaftaran ditolak dengan pesan spesifik per field.
- [ ] AC4: Kalau nama organisasi mengandung huruf besar/spasi, maka slug dibuat otomatis (huruf kecil, tanda hubung) dan tetap unik di antara organisasi lain.
- [ ] AC5: Kalau pendaftaran gagal di tengah transaksi, maka tidak ada organisasi setengah jadi yang tertinggal di database.

---

**US-B02** — Sebagai **Rio**, gw mau login dan logout dengan aman, supaya data klien tidak bisa diakses orang lain.
Priority: Must · Est: S

- [ ] AC1: Kalau kredensial benar, saat Rio login, sesi dibuat dan dia diarahkan ke daftar tiket.
- [ ] AC2: Kalau password salah, saat dia login, muncul pesan generik "email atau password salah" (tidak membocorkan mana yang salah).
- [ ] AC3: Kalau 5 percobaan gagal dalam 10 menit untuk satu email, maka login dibatasi 15 menit untuk email itu.
- [ ] AC4: Kalau Rio logout, saat dia tekan tombol back di browser, halaman terproteksi tidak menampilkan data lagi (sesi sudah mati).
- [ ] AC5: Kalau sesi sudah kedaluwarsa, saat Rio membuka halaman, dia diarahkan ke login, dan setelah masuk kembali dia balik ke halaman yang tadi dituju.

---

**US-B03** — Sebagai **Sari**, gw mau mengundang agen lewat email, supaya tidak perlu membuat akun untuk orang lain secara manual.
Priority: Must · Est: M

- [ ] AC1: Kalau Sari mengundang `rio@perusahaan.com` sebagai agent, maka email berisi tautan undangan terkirim dan tercatat sebagai undangan tertunda.
- [ ] AC2: Kalau tautan undangan dibuka dalam 24 jam, saat Rio mengisi nama dan password, akunnya aktif dan dia bisa login.
- [ ] AC3: Kalau tautan undangan sudah lewat 24 jam, saat dibuka, muncul halaman "undangan kedaluwarsa" dan Sari bisa mengirim ulang.
- [ ] AC4: Kalau email yang diundang sudah anggota organisasi itu, saat Sari mengundang lagi, muncul peringatan dan tidak ada undangan duplikat.
- [ ] AC5: Kalau tautan undangan sudah dipakai sekali, saat dipakai lagi, ditolak.

---

**US-B04** — Sebagai **Sari**, gw mau peran yang tegas, supaya tidak ada agen yang tanpa sengaja menghapus data atau membaca tiket yang bukan miliknya.
Priority: Must · Est: M

- [ ] AC1: Kalau Rio berperan `agent`, saat dia mencoba membuka halaman admin (users, SLA, webhooks), dia ditolak (redirect + pesan), bukan hanya tombol yang disembunyikan.
- [ ] AC2: Kalau Dita berperan `customer`, saat dia membuka daftar tiket, dia hanya melihat tiket di mana dia adalah requester-nya.
- [ ] AC3: Kalau Dita membuka URL tiket orang lain secara manual, maka dia mendapat 403, bukan halaman kosong atau data tiket itu.
- [ ] AC4: Kalau permintaan API tanpa sesi, saat menyentuh endpoint data apa pun, respons 401 (bukan data kosong).
- [ ] AC5: Kalau Sari mencoba menurunkan perannya sendiri dari admin, maka ditolak dengan pesan "tidak bisa mengubah peran sendiri", dan kalau itu admin terakhir, ditolak tegas.

---

### Tiket

---

**US-B05** — Sebagai **Dita**, gw mau membuat tiket dengan cepat, supaya masalah gw tercatat dan bisa dilacak.
Priority: Must · Est: S

- [ ] AC1: Kalau Dita mengisi subjek dan deskripsi, saat dia kirim, tiket dibuat berstatus `new`, requester = Dita, sumber = `web`, dan dia menerima nomor tiket.
- [ ] AC2: Kalau subjek kosong atau hanya spasi, saat dikirim, ditolak dengan pesan validasi di fieldnya.
- [ ] AC3: Kalau Rio (agent) membuat tiket atas nama pelanggan, maka dia bisa menentukan requester, dan tiket tetap tercatat sebagai dibuat oleh agent itu.
- [ ] AC4: Kalau tiket berhasil dibuat, maka ada entri di log status dan event `ticket.created` terkirim ke webhook yang berlangganan.
- [ ] AC5: Kalau jaringan putus saat submit, maka form menampilkan error dan data yang diisi tidak hilang dari layar.

---

**US-B06** — Sebagai **Maya (reviewer)**, gw mau demo tiket terlihat realistis, supaya gw bisa menilai tanpa harus mengisi data dulu.
Priority: Should · Est: S

- [ ] AC1: Kalau seed demo dijalankan, maka ada ≥20 tiket dengan status bervariasi (minimal satu di setiap status) dan prioritas bervariasi.
- [ ] AC2: Kalau seed demo sudah pernah jalan, saat dijalankan lagi, jumlah tiket tidak bertambah (idempotent).
- [ ] AC3: Kalau seed, maka ada ≥2 tiket yang melewati SLA (sudah breach) supaya tampilan peringatan bisa dilihat.
- [ ] AC4: Kalau reviewer login dengan akun demo, maka dia tidak bisa merusak data demo orang lain (akun demo terpisah atau data bisa direset).

---

**US-B07** — Sebagai **Sari**, gw mau melihat semua tiket dengan filter dan pencarian, supaya gw tahu kondisi tim dalam satu layar.
Priority: Must · Est: M

- [ ] AC1: Kalau ada 120 tiket, saat Sari membuka daftar, tampil 25 tiket pertama dengan total, halaman, dan pengingat jumlah halaman.
- [ ] AC2: Kalau Sari memilih status `open` dan prioritas `high`, saat filter diterapkan, hanya tiket yang cocok yang muncul, dan filter aktif terlihat sebagai chip yang bisa dihapus satu per satu.
- [ ] AC3: Kalau Sari mengetik 3 huruf pada pencarian, saat hasil muncul, pencarian mencakup subjek dan isi deskripsi, dan waktunya <400ms untuk 10.000 tiket (p95).
- [ ] AC4: Kalau hasil filter kosong, maka tampil empty state berisi chip filter aktif dan aksi "hapus filter" — bukan tabel kosong tanpa penjelasan.
- [ ] AC5: Kalau Sari mengurutkan berdasar kolom (dibuat/prioritas/SLA), saat dia klik header, urutan berubah dan tetap konsisten setelah pindah halaman.
- [ ] AC6: Kalau Sari membuka URL dengan filter di query string, maka filter itu langsung diterapkan (bisa dibagikan ke orang lain).

---

**US-B08** — Sebagai **Rio**, gw mau membuka detail tiket dan melihat seluruh konteksnya, supaya gw tidak perlu tanya ulang.
Priority: Must · Est: M

- [ ] AC1: Kalau Rio membuka tiket, maka dia melihat: subjek, nomor, status, prioritas, requester, assignee, tag, tenggat SLA, dan seluruh percakapan berurutan.
- [ ] AC2: Kalau tiket tidak ada, saat URL dibuka, muncul halaman 404 yang jelas (bukan layar putih).
- [ ] AC3: Kalau ada >50 komentar, maka 50 terbaru ditampilkan lebih dulu, dengan opsi memuat yang lebih lama.
- [ ] AC4: Kalau Rio tidak punya akses ke tiket itu (bukan agen org tersebut, bukan requester), maka 403.
- [ ] AC5: Kalau data sedang dimuat, maka tampil skeleton (bukan halaman kosong yang terlihat seperti error).

---

**US-B09** — Sebagai **Sari**, gw mau menugaskan tiket ke agen atau grup, supaya jelas siapa yang bertanggung jawab.
Priority: Must · Est: S

- [ ] AC1: Kalau Sari memilih Rio dari daftar assignee, saat disimpan, tiket menampilkan Rio sebagai assignee dan tercatat di log aktivitas (dari siapa, ke siapa, kapan).
- [ ] AC2: Kalau tiket belum punya assignee, saat ada agen pertama membalas, penugasan otomatis ke agen itu (kalau perilaku ini diaktifkan di pengaturan).
- [ ] AC3: Kalau Sari mencoba menugaskan ke orang di luar organisasinya, saat dikirim, ditolak.
- [ ] AC4: Kalau penugasan diubah, maka event `ticket.assigned` terkirim ke webhook pelanggan.

---

**US-B10** — Sebagai **Rio**, gw mau menandai tiket dengan tag, supaya tiket serupa bisa dikelompokkan.
Priority: Should · Est: S

- [ ] AC1: Kalau Rio mengetik tag baru pada tiket, saat disimpan, tag muncul sebagai chip pada tiket dan bisa dipakai sebagai filter.
- [ ] AC2: Kalau tag yang sama diketik dengan huruf besar/kecil berbeda, maka dianggap tag yang sama (tidak duplikat).
- [ ] AC3: Kalau Rio menghapus tag, maka tag hilang dari tiket dan tidak lagi muncul di filter sebagai tag tiket itu.
- [ ] AC4: Kalau Rio mengetik lebih dari 10 tag dalam satu tiket, maka dibatasi dengan pesan jelas.

---

**US-B11** — Sebagai **Sari**, gw mau alur status yang konsisten, supaya tidak ada tiket yang "nyangkut" tanpa arti.
Priority: Must · Est: M

- [ ] AC1: Kalau tiket berstatus `new`, saat Rio (agent) membalas, status berubah otomatis ke `open`.
- [ ] AC2: Kalau tiket berstatus `open`, saat Rio mengubahnya ke `pending`, tiket ditandai sedang menunggu pelanggan, dan pengingat SLA resolusi dijeda selama itu.
- [ ] AC3: Kalau tiket berstatus `pending`, saat pelanggan membalas, status kembali ke `open` dan pengingat SLA lanjut.
- [ ] AC4: Kalau Rio menandai `resolved`, maka waktu resolusi dicatat dan survei CSAT dijadwalkan sekali untuk tiket itu.
- [ ] AC5: Kalau tiket sudah `resolved` 7 hari dan tidak ada balasan, maka otomatis jadi `closed`.
- [ ] AC6: Kalau pelanggan membalas tiket yang `resolved` atau `closed`, maka tiket dibuka kembali (`open`) dan penghitung SLA di-reset.
- [ ] AC7: Kalau perpindahan status yang tidak diizinkan oleh alur (misalnya `closed` langsung ke `pending`), maka ditolak dengan pesan yang menjelaskan transisi yang sah.

---

**US-B12** — Sebagai **Dita**, gw mau membalas tiket dan melihat balasan agen, supaya komunikasi terjadi di satu tempat.
Priority: Must · Est: S

- [ ] AC1: Kalau Dita menulis balasan, saat dikirim, balasan muncul di urutan percakapan dengan nama dan waktu relatif ("2 jam lalu").
- [ ] AC2: Kalau balasan berisi markdown (list, bold, link), maka dirender rapi dan tidak bisa menyisipkan skrip (HTML mentah ditampilkan sebagai teks).
- [ ] AC3: Kalau Dita mengirim balasan ke tiket `new` atau `resolved`, maka status tiket ikut berubah sesuai alur (US-B11).
- [ ] AC4: Kalau balasan sedang dikirim, maka tampil langsung secara optimistis dengan penanda "mengirim", dan jadi normal setelah server mengonfirmasi. Kalau gagal, ada tombol coba lagi tanpa kehilangan teks.

---

**US-B13** — Sebagai **Rio**, gw mau menulis catatan internal, supaya tim bisa berkoordinasi tanpa dilihat pelanggan.
Priority: Must · Est: S

- [ ] AC1: Kalau Rio menyalakan tombol "catatan internal" saat membalas, saat dikirim, komentar ditandai internal dan **tidak** dikirim ke pelanggan lewat email, dan tidak muncul di portal publik.
- [ ] AC2: Kalau catatan internal ada di tiket, saat Dita membuka portal publiknya, catatan itu tidak terlihat sama sekali (bukan hanya disembunyikan dengan CSS).
- [ ] AC3: Kalau komentar internal, maka tampil dengan penanda visual yang jelas di sisi agen (label + pembeda warna), supaya agen tidak salah kirim.

---

**US-B14** — Sebagai **Rio**, gw mau melampirkan file pada komentar, supaya bukti masalah (screenshot, log) bisa ikut serta.
Priority: Must · Est: M

- [ ] AC1: Kalau Rio melampirkan file gambar ≤5MB, saat komentar dikirim, lampiran tampil sebagai thumbnail di komentar dan bisa dibuka.
- [ ] AC2: Kalau file >10MB, saat diunggah, ditolak dengan pesan ukuran maksimum, dan komentar tetap tidak terkirim sebagian.
- [ ] AC3: Kalau file tipe berbahaya/eksekutabel, maka ditolak dengan pesan tipe yang diizinkan.
- [ ] AC4: Kalau unggahan sedang berjalan, maka muncul progres per file, dan tombol kirim tidak aktif sampai selesai.
- [ ] AC5: Kalau pengunggahan gagal di tengah, maka file tidak setengah tersimpan dan komentar tidak kehilangan isinya.

---

**US-B15** — Sebagai **Sari**, gw mau melakukan aksi pada banyak tiket sekaligus, supaya kerja repetitif berkurang.
Priority: Should · Est: M

- [ ] AC1: Kalau belum ada tiket yang dipilih, maka bilah aksi massal tersembunyi atau dalam keadaan tidak aktif.
- [ ] AC2: Kalau Sari memilih 12 tiket, saat dia mengubah statusnya jadi `closed`, semua terubah, dan jumlah yang berubah dilaporkan ("12 tiket diperbarui").
- [ ] AC3: Kalau sebagian tiket di antaranya tidak berhak dia ubah, maka yang berhasil dan yang gagal dilaporkan terpisah (tidak gagal senyap).
- [ ] AC4: Kalau aksi massal berjalan, saat Sari menekan aksi lagi, permintaan kedua tidak terkirim (tombol dinonaktifkan saat proses).

---

**US-B16** — Sebagai **Sari**, gw mau mengarsipkan tiket alih-alih menghapusnya selamanya.
Priority: Must · Est: S

- [ ] AC1: Kalau Sari (admin) menghapus tiket, maka tiket hilang dari daftar normal tetapi masih tersimpan; bisa dilihat dengan filter "terarsip".
- [ ] AC2: Kalau tiket berstatus terarsip, saat muncul di daftar terarsip, ada label "terarsip" dan tanggalnya, dan tombol pulihkan.
- [ ] AC3: Kalau Rio (agent) mencoba menghapus, maka ditolak (hanya admin).
- [ ] AC4: Kalau tiket sudah terarsip 30 hari, maka dihapus permanen oleh proses terjadwal, dan penghapusan permanen itu tercatat di log.

---

### SLA

---

**US-B17** — Sebagai **Sari**, gw mau mengatur tenggat per prioritas, supaya ekspektasi waktu berhenti jadi tebakan.
Priority: Must · Est: M

- [ ] AC1: Kalau Sari membuat policy `urgent` dengan respons pertama 15 menit dan resolusi 4 jam, saat tiket berprioritas urgent dibuat, tenggat tiket dihitung dari policy itu.
- [ ] AC2: Kalau sudah ada policy untuk prioritas `urgent`, saat Sari membuat policy baru untuk prioritas yang sama, ditolak dengan pesan "policy untuk prioritas ini sudah ada".
- [ ] AC3: Kalau policy dinonaktifkan, saat tiket baru berprioritas itu dibuat, tiket tidak punya tenggat aktif, dan tiket lama tidak bisa dijeda oleh policy yang dimatikan.
- [ ] AC4: Kalau jam kantor/waktu kalender belum didukung, maka tenggat dihitung sebagai waktu berjalan (continuous), dan ini dinyatakan terbuka di §9 sebagai keterbatasan.
- [ ] AC5: Kalau tiket belum punya assignee, maka tetap dihitung terhadap SLA respons pertama.

---

**US-B18** — Sebagai **Sari**, gw mau sistem menandai pelanggaran tenggat sendiri, supaya tidak ada yang terlewat.
Priority: Must · Est: M

- [ ] AC1: Kalau policy respons pertama 15 menit dan tiket urgent belum dibalas pada menit ke-16, maka tiket ditandai breach dan ada catatan internal otomatis di tiket tersebut.
- [ ] AC2: Kalau tiket sudah pernah ditandai breach untuk tipe yang sama, saat pemeriksaan berjalan lagi, tidak ada catatan breach duplikat.
- [ ] AC3: Kalau tiket yang sedang `pending` (menunggu pelanggan), maka penghitung resolusi dijeda dan tidak menghasilkan breach palsu.
- [ ] AC4: Kalau 100 tiket melewati tenggat pada waktu bersamaan, maka semua tercatat dalam satu putaran pemeriksaan (≤60 detik) tanpa proses yang saling menimpa.
- [ ] AC5: Kalau pelanggaran terjadi, maka tampil sebagai penanda merah pada daftar tiket dan pada detail tiket (bukan hanya di dashboard statistik).

---

**US-B19** — Sebagai **Sari**, gw mau pelanggaran dieskalasi otomatis, supaya ada orang yang benar-benar bertindak.
Priority: Should · Est: M

- [ ] AC1: Kalau policy mengonfigurasi eskalasi ke role `admin` setelah 60 menit, saat breach tercatat dan lewat durasi itu, event `sla_breached` dikirim ke webhook, dan notifikasi ditujukan ke pengguna berperan admin di organisasi itu.
- [ ] AC2: Kalau tidak ada pengguna berperan `admin` selain pelanggar sendiri, maka eskalasi dicatat gagal di log (tidak gagal senyap) dan tetap ada catatan internal di tiket.
- [ ] AC3: Kalau eskalasi sudah dikirim untuk pelanggaran itu, saat pemeriksaan berikutnya jalan, tidak dikirim ulang.

---

### Email

---

**US-B20** — Sebagai **Dita**, gw mau cukup mengirim email untuk mendapat tiket, supaya tidak perlu belajar sistem baru.
Priority: Must · Est: L

- [ ] AC1: Kalau email masuk ke `support@klien.com` yang terdaftar untuk organisasi X, saat tidak ada nomor tiket di subjek, tiket baru dibuat, pengirim dibuat sebagai pelanggan (tanpa password), dan email mentahnya tersimpan sebagai jejak.
- [ ] AC2: Kalau subjek berisi referensi tiket (contoh `[#TK-123]`), saat email masuk, balasannya ditambahkan sebagai komentar pada tiket itu, bukan tiket baru.
- [ ] AC3: Kalau pengirim dengan alamat itu sudah tercatat sebagai pelanggan, saat dia mengirim email lagi, balasannya masuk ke tiketnya yang sudah ada atau ke tiket baru, tanpa membuat akun duplikat.
- [ ] AC4: Kalau email ditujukan ke mailbox yang tidak dikenali organisasi mana pun, maka sistem merespons 404 dan tidak membuat data apa pun (tidak error ke user).
- [ ] AC5: Kalau lampiran email melebihi 10MB, maka lampiran itu dilewati dengan catatan di log, dan tiket tetap dibuat.
- [ ] AC6: Kalau satu organisasi menerima lebih dari 10 email dalam satu menit, maka kelebihannya masuk antrean (tidak diproses bersamaan) supaya tidak membanjiri sistem.
- [ ] AC7: Kalau email dikirim oleh sistem otomatis (auto-reply, noreply, out-of-office), maka tidak dibuat tiket (mencegah loop).

---

**US-B21** — Sebagai **Dita**, gw mau menerima balasan agen lewat email, supaya saya tidak perlu membuka aplikasi.
Priority: Should · Est: M

- [ ] AC1: Kalau Rio (agent) membalas tiket yang requesternya punya email dan bukan internal, saat balasan terkirim, email keluar ke alamat Dita berisi isi balasan + nomor tiket di subjek.
- [ ] AC2: Kalau komentar itu ditandai internal, maka **tidak ada** email yang dikirim.
- [ ] AC3: Kalau pengiriman email gagal (SMTP menolak), maka komentar tetap tersimpan, kegagalan tercatat, dan agen diberi tahu bahwa email tidak terkirim.

---

### Webhook

---

**US-B22** — Sebagai **Sari**, gw mau mengirim event ke sistem lain, supaya helpdesk tidak jadi pulau.
Priority: Must · Est: M

- [ ] AC1: Kalau Sari mendaftarkan webhook dengan URL dan memilih event `ticket.created`, saat tiket baru dibuat, POST terkirim ke URL itu berisi event, waktu, dan data tiket.
- [ ] AC2: Kalau webhook terkirim, maka ada header berisi tanda tangan HMAC dan penerima bisa memverifikasinya dengan secret yang sama.
- [ ] AC3: Kalau Sari menekan "test" pada webhook, maka payload uji terkirim dan hasilnya (kode respons, sukses/gagal) ditampilkan di layar.
- [ ] AC4: Kalau webhook dinonaktifkan, saat event terjadi, tidak ada permintaan dikirim.
- [ ] AC5: Kalau Sari memilih hanya event `ticket.resolved`, maka event `ticket.created` tidak terkirim ke webhook itu (filter bekerja).

---

**US-B23** — Sebagai **Sari**, gw mau pengiriman yang gagal dicoba ulang dan terlihat, supaya saya tidak kehilangan event diam-diam.
Priority: Must · Est: M

- [ ] AC1: Kalau endpoint tujuan merespons 500, saat webhook dikirim, dicoba ulang 3 kali dengan jeda membesar (1s, 4s, 16s kira-kira).
- [ ] AC2: Kalau sudah 3 kali percobaan gagal, saat percobaan terakhir gagal, status webhook ditandai gagal, tercatat di log dengan kode respons terakhir, dan terlihat di halaman pengaturan.
- [ ] AC3: Kalau endpoint tujuan tidak merespons dalam 10 detik, maka permintaan dihentikan dan dianggap gagal (retry ikut berjalan).
- [ ] AC4: Kalau event berhasil terkirim, maka waktu terakhir terkirim diperbarui dan bisa dilihat di pengaturan.
- [ ] AC5: Kalau secret webhook tidak cocok di sisi penerima, maka penerima menolak (dan ini terdokumentasi sebagai tanggung jawab penerima).

---

### CSAT

---

**US-B24** — Sebagai **Sari**, gw mau mengukur kepuasan pelanggan, supaya kualitas support bisa dilihat angkanya.
Priority: Must · Est: M

- [ ] AC1: Kalau Rio menandai tiket `resolved` dan requester punya email, maka survei dikirim sekali ke email pelanggan berisi tautan dengan token.
- [ ] AC2: Kalau tiket itu sudah pernah mengirim survei, saat statusnya bolak-balik resolved lagi, tidak ada survei kedua yang dikirim.
- [ ] AC3: Kalau pelanggan membuka tautan survei, saat dia memberi skor 1–5 dan komentar, skor tersimpan dan halaman berterima kasih muncul.
- [ ] AC4: Kalau pelanggan mengirim ulang formulir yang sama, maka jawaban pertama tidak tertimpa (atau ditolak dengan pesan bahwa sudah pernah diisi, tergantung keputusan di §9).
- [ ] AC5: Kalau token survei lebih dari 14 hari, saat dibuka, ditolak dengan pesan kedaluwarsa.
- [ ] AC6: Kalau token dibuat untuk tiket X, saat token itu dipakai untuk tiket Y, ditolak (token terikat ke satu tiket).

---

### Basis Pengetahuan

---

**US-B25** — Sebagai **Rio**, gw mau menulis artikel bantuan, supaya pertanyaan yang sama tidak perlu dijawab manual terus.
Priority: Must · Est: M

- [ ] AC1: Kalau Rio membuat kategori lalu artikel di dalamnya, saat disimpan, artikel muncul di bawah kategori itu dengan slug otomatis dari judulnya.
- [ ] AC2: Kalau dua artikel berjudul sama, maka slug keduanya tetap unik (misalnya dengan penomoran), tanpa error.
- [ ] AC3: Kalau Rio mengedit artikel, maka perubahan tersimpan dan waktu "diperbarui" berubah.
- [ ] AC4: Kalau artikel dalam keadaan draft, maka pelanggan tidak bisa membukanya lewat URL langsung (bukan hanya disembunyikan dari daftar).
- [ ] AC5: Kalau artikel dipublikasikan, maka ia muncul di daftar publik dan jumlah baca bertambah saat dibuka.

---

**US-B26** — Sebagai **Rio**, gw mau mencari artikel yang sudah ada, supaya saya bisa pakai ulang jawaban lama.
Priority: Should · Est: S

- [ ] AC1: Kalau ada 50 artikel, saat Rio mengetik kata kunci, hasil mencakup judul dan isi artikel.
- [ ] AC2: Kalau pencarian tidak menemukan apa pun, maka muncul empty state dengan ajakan membuat artikel baru.

---

### Portal Pelanggan

---

**US-B27** — Sebagai **Dita**, gw mau melacak tiket gw tanpa membuat akun, supaya saya tetap tahu perkembangannya.
Priority: Must · Est: M

- [ ] AC1: Kalau Dita menerima tautan dari email, saat dia membukanya tanpa login, dia melihat subjek, status, dan percakapan publik tiket itu saja.
- [ ] AC2: Kalau tautan itu dibuka, maka komentar internal tidak muncul sama sekali.
- [ ] AC3: Kalau tautan milik tiket lain diganti satu karakter, maka akses ditolak (token acak, tidak bisa ditebak).
- [ ] AC4: Kalau tautan tidak valid atau sudah kedaluwarsa, maka muncul halaman yang jelas, bukan halaman kosong.
- [ ] AC5: Kalau koneksi tidak terenkripsi, maka tautan tetap dilindungi token (dan ini jadi alasan HTTPS wajib di daftar kebutuhan non-fungsional).

---

### Operasional & Pelaporan

---

**US-B28** — Sebagai **Sari**, gw mau melihat angka kinerja tim, supaya keputusan penambahan orang punya dasar.
Priority: Must · Est: M

- [ ] AC1: Kalau ada tiket dalam 30 hari terakhir, saat Sari membuka dashboard, dia melihat: total tiket, jumlah per status, jumlah per prioritas, rata-rata waktu respons pertama, rata-rata waktu resolusi, dan rata-rata CSAT.
- [ ] AC2: Kalau belum ada data sama sekali, maka tampil empty state dengan penjelasan (bukan grafik kosong tanpa keterangan).
- [ ] AC3: Kalau periode filter diubah (7/30/90 hari), maka semua angka menyesuaikan periode itu.
- [ ] AC4: Kalau tiket yang masih `pending`, maka tidak dihitung sebagai keterlambatan resolusi.
- [ ] AC5: Kalau angka ditampilkan, maka satuan jelas (jam/hari) dan tidak ada angka "NaN" atau kosong pada kondisi apa pun.

---

**US-B29** — Sebagai **Sari**, gw mau helpdesk dan portal pelanggan bisa dipakai dalam bahasa Inggris dan Indonesia, supaya pelanggan tidak dipaksa bahasa asing.
Priority: Must · Est: M

- [ ] AC1: Kalau browser berbahasa Inggris, maka label UI staf tampil Inggris tanpa diatur dulu (deteksi `Accept-Language`).
- [ ] AC2: Kalau ada pemilih bahasa, saat Sari memilih Indonesia, label UI staf berubah dan pilihannya bertahan setelah reload dan setelah login.
- [ ] AC3: Kalau **portal publik pelanggan** dibuka, maka bahasanya mengikuti bahasa pelanggan yang membuka, bukan bahasa staf yang membuat tiket.
- [ ] AC4: Kalau email keluar (notifikasi tiket) dikirim ke pelanggan, maka isinya memakai bahasa pelanggan, bukan bahasa staf.
- [ ] AC5: Kalau survei CSAT dibuka pelanggan, maka pertanyaan dan pilihan bintangnya berbahasa pelanggan.
- [ ] AC6: Kalau string terjemahan belum tersedia, maka yang tampil adalah bahasa Inggris, bukan layar kosong.
- [ ] AC7: Kalau reviewer menjalankan uji, maka tidak ada string UI yang di-hardcode di komponen.

---

### Notifikasi Breach SLA di UI

---

**US-B30** — Sebagai **Sari**, gw mau sistem memberi tahu gw begitu ada tiket yang melewati tenggat, supaya gw tidak perlu bolak-balik buka file Excel buat nyari yang kelewat.
Priority: Must · Est: M

- [ ] AC1: Kalau ada ≥1 tiket dengan breach aktif yang boleh gw lihat, saat gw buka aplikasi, muncul lencana/lonceng di navbar dengan jumlah breach aktif dan tautan ke daftar tiket terfilter `breach=aktif`.
- [ ] AC2: Kalau Sari menekan "dismiss" pada satu breach, maka notifikasi itu hilang dari lencananya dan tetap hilang setelah reload maupun login ulang; ia baru muncul lagi kalau tiket yang sama breach lagi untuk perubahan status berikutnya.
- [ ] AC3: Kalau Dita berperan `customer`, maka dia tidak pernah menerima notifikasi breach tiket pelanggan lain; percobaan memuat daftar breach via API untuk tiket di luar haknya → 403 (bukan daftar kosong yang menipu).
- [ ] AC4: Kalau 50 tiket breach dalam satu putaran pemeriksaan, saat pemeriksaan jalan 100 putaran lagi tanpa perubahan status, jumlah notifikasi tetap 50 (satu per tiket per perubahan status), bukan menumpuk — dedupe per tiket per state change.
- [ ] AC5: Kalau Sari menekan "dismiss" dua kali cepat (double-click atau dua tab), maka tetap satu baris status dismiss per pengguna per breach, tanpa error dan tanpa baris ganda.
- [ ] AC6: Kalau tidak ada breach aktif, maka lencana tidak tampil sama sekali (bukan menampilkan angka "0").
- [ ] AC7: Kalau Sari buka Pengaturan → Notifikasi, maka dia bisa memilih kanal notifikasi breach (dalam aplikasi / email) dan mode kirim (langsung / digest harian), pilihannya tersimpan per pengguna dan bertahan setelah logout.

---

### Penanganan Email Masuk yang Gagal

---

**US-B31** — Sebagai **Sari**, gw mau email masuk yang gagal tidak hilang diam-diam, supaya gw bisa lihat kenapa dan coba lagi tanpa nanya ke pelanggan "emailnya udah dikirim belum?".
Priority: Must · Est: L

- [ ] AC1: Kalau relay SMTP/IMAP atau parser sedang down, saat ada email masuk, kegagalan tersimpan di antrean/retry dan setiap percobaan tercatat dengan alasan (kode error + pesan) — tidak ada email yang dibuang diam-diam.
- [ ] AC2: Kalau percobaan gagal mencapai 5 kali, maka item muncul di UI admin sebagai "email masuk gagal" dengan tombol "coba lagi", dan operator berperan `admin` menerima alert.
- [ ] AC3: Kalau dua email masuk membawa Message-ID yang sama (duplikat), maka tetap dibuat tepat satu tiket (idempotensi berdasar Message-ID), bukan dua.
- [ ] AC4: Kalau aplikasi/worker down saat email masuk, saat aplikasi hidup lagi, email yang tertahan tetap tertarik dan diproses — tidak hilang.
- [ ] AC5: Kalau satu email rusak (MIME tidak valid), maka hanya email itu yang ditolak; email lain di antrean tetap diproses (satu surat rusak tidak memblokir antrean).
- [ ] AC6: Kalau Rio berperan `agent` (bukan admin), saat dia memanggil `POST /api/email/inbox/:id/retry`, 403 — hanya `admin` organisasi itu yang boleh.
- [ ] AC7: Kalau admin menekan "coba lagi" dua kali cepat, maka hanya satu proses retry berjalan dan tetap satu tiket (tidak dobel).
- [ ] AC8: Kalau kegagalan berhasil terselesaikan, maka item hilang dari daftar gagal dan statusnya tercatat "selesai" di log, tanpa email asli yang dihapus dari penyimpanan jejak.

---

### Endpoint Health & Readiness

---

**US-B32** — Sebagai **Reza (operator)**, gw mau ada endpoint cek kesehatan dan kesiapan, supaya monitoring dan Docker healthcheck tahu komponen mana yang ngadat sebelum user yang ngeluh.
Priority: Must · Est: S

- [ ] AC1: Kalau aplikasi berjalan, saat `GET /health` dipanggil tanpa auth, respons 200 `{ "status": "ok" }` dan tidak ada rahasia, connection string, atau versi library internal yang bocor.
- [ ] AC2: Kalau semua komponen wajib sehat, saat `GET /ready` dipanggil, 200 berisi status per komponen (DB, queue/worker, mail poller) lengkap dengan latensi ms masing-masing.
- [ ] AC3: Kalau DB tidak bisa dihubungi, saat `GET /ready`, respons non-200 (503) yang menyebut komponen gagal `db` beserta alasan singkatnya.
- [ ] AC4: Kalau yang mati cuma mail poller (DB sehat), maka `/ready` 503 hanya menyebut `mail_poller` sementara komponen lain tetap dilaporkan sehat, dan `/health` tetap 200 (liveness ≠ readiness).
- [ ] AC5: Kalau `/health` dan `/ready`, maka respons tidak di-cache (`Cache-Control: no-store`) dan tidak butuh kredensial apa pun.
- [ ] AC6: Kalau probe dijalankan berulang dalam 1 menit, maka waktu respons `/health` <50ms (p95) dan `/ready` <2s saat semua sehat.

---

### Rate Limiting

---

**US-B33** — Sebagai **Sari**, gw mau ada batas laju permintaan, supaya login dan portal publik nggak bisa dibanjiri brute-force atau spam submit dari satu sumber.
Priority: Must · Est: M

- [ ] AC1: Kalau limit aktif (login: per IP + per email; submit portal publik dan REST API: per IP + per pengguna/token), saat limit terlampaui, respons 429 + header `Retry-After` (detik) dan badan pesan yang bisa dibaca manusia.
- [ ] AC2: Kalau dua instance aplikasi berjalan, saat permintaan disebar ke keduanya dari kunci yang sama, limit tetap ditegakkan bersama (pakai store bersama seperti Redis, bukan memori proses) — total lolos tidak melebihi batas.
- [ ] AC3: Kalau permintaan melewati limit, maka tidak ada satu pun baris/data yang tertulis di DB untuk permintaan yang ditolak itu.
- [ ] AC4: Kalau satu email sudah kena lockout 15 menit (US-B02), maka percobaan yang masih tertahan lockout tidak dihitung ulang oleh limiter rate (tidak double-penalty) dan pesannya tetap "email atau password salah"; penghitung limiter mereset setelah jendelanya lewat.
- [ ] AC5: Kalau limit dikonfigurasi lewat env/pengaturan, maka mengubah nilainya berlaku tanpa ubah kode (dan tanpa restart, kecuali restart minimal yang sengaja didokumentasikan).
- [ ] AC6: Kalau satu IP kena 429 berkali-kali, maka kejadiannya tercatat di log dengan IP + endpoint, tanpa pernah menulis password atau token ke log.
- [ ] AC7: Kalau 100 permintaan bersamaan pada detik yang sama dari satu kunci dengan limit 10/menit, maka tepat ≤10 yang lolos dan sisanya 429 (tidak ada kebocoran karena balapan).

---

### Login lewat Hub (SSO Internal)

---

**US-B34** — Sebagai **Sari**, gw mau login pakai akun Hub portofolio, supaya gw nggak perlu ngelola password terpisah buat helpdesk — tapi login email/password lokal harus tetap jalan kalau Hub lagi mati.
Priority: Must · Est: L

- [ ] AC1: Kalau Sari memilih "Login lewat Hub", saat dia menyelesaikan Authorization Code flow, dia masuk ke organisasinya dan akun lokalnya tertaut, dengan token diverifikasi lewat JWKS Hub dan klaim `sub` dipetakan ke user lokal — selaras bagian "Identitas bersama (Hub)" di 00-MASTER-PRD.md.
- [ ] AC2: Kalau Hub tidak bisa dihubungi, saat Sari buka halaman login, login email/password lokal tetap 100% berfungsi dan tombol SSO menampilkan notice "tidak tersedia" yang tidak memblokir — selaras bagian "Identitas bersama (Hub)" di 00-MASTER-PRD.md.
- [ ] AC3: Kalau token SSO kedaluwarsa atau tanda tangannya tidak valid, maka respons 401 dan tidak ada sesi setengah jadi (tidak ada sesi lokal yang terbentuk dari token yang gagal verifikasi).
- [ ] AC4: Kalau kunci JWKS Hub dirotasi, saat verifikasi token berikutnya jalan, verifikasi tetap sukses tanpa restart aplikasi (cache kunci di-refresh sendiri).
- [ ] AC5: Kalau user Hub belum pernah masuk dan dia login pertama kali dari dua tab sekaligus, maka JIT provisioning tetap menghasilkan tepat satu user lokal yang tertaut (idempoten, tidak duplikat).
- [ ] AC6: Kalau email Hub sama dengan email user lokal yang sudah ada, saat dia login lewat Hub pertama kali, akun lama itu yang ditautkan — bukan dibuat akun kedua dengan email sama.
- [ ] AC7: Kalau user Hub belum punya keanggotaan organisasi mana pun, saat dia login, dia masuk dalam keadaan tanpa organisasi (tidak otomatis jadi `admin`); dia baru punya akses setelah diundang.
- [ ] AC8: Kalau token SSO valid tapi user itu bukan anggota organisasi X, saat dia minta tiket organisasi X lewat API, 403 — keanggotaan ditegakkan server-side, bukan diambil dari klaim token.
- [ ] AC9: Kalau login SSO berhasil, maka log aktivitas mencatat metode login (`hub-sso`) + waktu, tanpa menyimpan tokennya.
- [ ] AC10: Kalau Reza mengubah peran Sari dari `agent` jadi `admin` di Hub, maka perubahan itu tersinkron ke salinan lokal B dan berlaku paling lama 60 detik kemudian **tanpa Sari perlu login ulang** — tapi penegakannya tetap dilakukan B dari salinan lokalnya, bukan dibaca dari token (selaras §5.1 "diatur di Hub, ditegakkan di app").

---

**US-B35** — Sebagai **Rio**, gw mau agen AI menyiapkan draf balasan dari tiket + artikel KB yang relevan, supaya gw berhenti menjawab hal yang sama dari nol dan bisa langsung mengedit alih-alih menulis.
Priority: Must · Est: L

- [ ] AC1: Kalau Rio menekan "Draf dengan AI" di composer, saat draf selesai, draf muncul **di dalam kotak composer** sebagai teks yang bisa diedit — bukan modal terpisah, bukan panel yang menutupi thread, dan **tidak** terkirim otomatis.
- [ ] AC2: Kalau draf dibuat, saat sumbernya ditampilkan, setiap klaim menyebut artikel KB yang jadi rujukannya (judul + tautan); kalau tidak ada artikel relevan, draf dibiarkan kosong dan UI bilang "tidak ada artikel KB yang cocok" alih-alih mengarang jawaban.
- [ ] AC3: Kalau isi tiket mengandung instruksi yang mencoba membelokkan agen (mis. "abaikan aturan sebelumnya"), maka draf tidak menuruti instruksi itu dan menandai tiket sebagai perlu perhatian manusia — percobaan itu tercatat di log, bukan gagal senyap.
- [ ] AC4: Kalau draf dibuat, maka **tidak ada** catatan internal atau data organisasi lain yang ikut masuk ke konteks model, dan isi draf tidak pernah dikirim ke pelanggan tanpa Rio menekan kirim.
- [ ] AC5: Kalau penyedia AI sedang mati atau kuotanya habis, saat Rio menekan "Draf dengan AI", composer tetap berfungsi normal dan UI menampilkan error inline yang bisa dicoba ulang — tulis balasan manual tidak pernah terhalang (selaras G1, app tetap mandiri).
- [ ] AC6: Kalau draf dibuat, maka pemakaian token dan biayanya tercatat per tiket dan per organisasi, dan bisa dibaca lewat endpoint metrik.
- [ ] AC7: Kalau organisasi mematikan fitur ini di Settings, saat Rio membuka tiket, tombol "Draf dengan AI" tidak tampil dan tidak ada panggilan model yang terjadi — pematian ditegakkan **di server**, bukan cuma menyembunyikan tombol.

---

## 7. Functional Requirements (perilaku saja)

| ID | Requirement |
|---|---|
| FR-B01 | Setiap respons API memakai bentuk konsisten: `{ data, error }` — tidak ada format campuran antar endpoint. |
| FR-B02 | Semua endpoint data memerlukan sesi; tanpa sesi → 401. |
| FR-B03 | Isolasi organisasi ditegakkan di server untuk setiap pembacaan dan penulisan; tidak pernah hanya di UI. |
| FR-B04 | Perubahan status tiket selalu menulis entri log (status asal, tujuan, pelaku, waktu, alasan opsional). |
| FR-B05 | Komentar internal tidak pernah masuk ke email keluar, portal publik, atau ekspor apa pun. |
| FR-B06 | Nomor tiket unik per organisasi dan tidak pernah didaur ulang setelah tiket dihapus. |
| FR-B07 | Penghapusan tiket bersifat arsip dulu (30 hari) sebelum permanen; penghapusan permanen tercatat. |
| FR-B08 | Semua event webhook menyertakan tanda tangan HMAC atas isi permintaan. |
| FR-B09 | Token (undangan, CSAT, portal) ditandatangani, punya masa berlaku, dan tidak bisa dipakai lintas tiket/organisasi. |
| FR-B10 | Perubahan jam tenggat SLA dijeda ketika tiket `pending`, dan lanjut saat `open`. |
| FR-B11 | Unggahan lampiran divalidasi ukuran dan tipe sebelum disimpan. |
| FR-B12 | Email otomatis (auto-reply/noreply) tidak menghasilkan tiket. |
| FR-B13 | Semua aksi destruktif (hapus, ubah peran) dicatat dengan pelaku dan waktu. |

---

## 8. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-B01 | Daftar tiket 10.000 baris: hasil pertama <400ms (p95) dengan filter standar. |
| NFR-B02 | Detail tiket (termasuk 50 komentar) tampil <600ms (p95). |
| NFR-B03 | Pemeriksaan SLA untuk seluruh tiket aktif selesai dalam ≤60 detik per putaran. |
| NFR-B04 | Pengiriman webhook tidak memblokir respons HTTP ke pengguna (dilakukan asinkron). |
| NFR-B05 | "Docker compose up" di mesin bersih → aplikasi berjalan dan bisa login dalam ≤10 menit, tanpa langkah manual selain mengisi `.env`. |
| NFR-B06 | Semua transportasi memakai HTTPS di lingkungan live. |
| NFR-B07 | Password disimpan sebagai hash adaptif (bcrypt/argon2), tidak pernah sebagai teks. |
| NFR-B08 | Staf maupun pelanggan bisa memakai UI dalam bahasa pilihannya (Inggris + Indonesia); tidak ada orang yang dipaksa bahasa asing. Lihat US-B29. |
| NFR-B09 | Semua halaman punya state loading (skeleton), empty (penjelasan + aksi), dan error (pesan + tombol coba lagi). |
| NFR-B10 | Data demo tidak boleh membuat biaya operasional berjalan sendiri (tidak ada cron berbayar, tidak ada email keluar otomatis di mode demo). |
| NFR-B11 | Paket dependensi utama minimal: tidak ada layanan berbayar wajib untuk demo. |
| NFR-B12 | Aksesibilitas dasar: semua kontrol bisa dijangkau keyboard, fokus terlihat. |
| NFR-B13 | Cakupan terjemahan: 100% teks UI staf, portal pelanggan, email keluar, dan survei CSAT memakai kunci terjemahan; kedua bahasa lengkap sebelum rilis (diperiksa otomatis dengan membandingkan berkas terjemahan). |
| NFR-B14 | Angka dan tanggal mengikuti locale bahasa aktif, termasuk format tanggal pada tenggat SLA. |
| NFR-B15 | Menambah bahasa ketiga hanya berarti menambah berkas terjemahan + mendaftarkan locale; tidak ada perubahan kode komponen. |

---

## 9. Success Metrics

| # | Metric | Baseline | Target | Cara ukur |
|---|---|---|---|---|
| B-M1 | Tiket yang bisa dibuat lewat email tanpa intervensi manusia | tidak ada | 100% email valid → tiket | Kirim 10 email uji ke mailbox demo, hitung yang jadi tiket |
| B-M2 | Pelanggaran SLA terdeteksi tepat waktu | tidak ada | 0 terlewat, ≤1 menit keterlambatan deteksi | Buat tiket dengan tenggat 2 menit, cek waktu catatan breach |
| B-M3 | Webhook terkirim tanpa kehilangan event saat endpoint down | tidak ada | 100% terkirim setelah 3 percobaan, atau tercatat gagal | Simulasi endpoint down 2 kali, lalu nyala; cek log |
| B-M4 | Isolasi data antar peran | tidak ada | 0 kebocoran lintas peran / lintas organisasi | Uji penetrasi ringan: 8 skenario akses tidak sah |
| B-M5 | Waktu setup lokal | tidak ada | ≤10 menit | Stopwatch di mesin bersih |
| B-M6 | Test suite hijau | 0 | 100% di CI | Tab Actions |

---

## 10. Risks & Mitigations

| # | Risk | Mitigasi |
|---|---|---|
| R-B1 | Inbound email adalah bagian paling rapuh (format, loop auto-reply, spam) | Uji dengan 10 variasi email nyata (dengan lampiran, tanda tangan, mail-forward) sebelum dianggap selesai; tolak email otomatis |
| R-B2 | Status tiket bisa jadi tidak konsisten kalau transisi dipaksakan lewat API langsung | Semua perpindahan status lewat satu fungsi domain yang memeriksa transisi sah; tidak ada update status langsung di controller |
| R-B3 | SLA worker dan pengguna mengubah tiket bersamaan → penghitung kacau | Perhitungan tenggat berbasis waktu dibuat, bukan penghitung yang dikurangi; status `pending` disimpan sebagai field, bukan dihitung di memori |
| R-B4 | Retry webhook bisa menghantam endpoint penerima berkali-kali | Backoff + batas 3 percobaan + tombol matikan per webhook |
| R-B5 | Lampiran menumpuk di disk | Batas ukuran + tipe; penghapusan lampiran ikut siklus hapus tiket |
| R-B6 | Lingkup melebar ke AI/WhatsApp/live chat | Non-Goal NG2/NG3; tunda ke v1 dengan catatan |
| R-B7 | Login lewat Hub bisa mengunci orang di luar kalau verifikasi token/JWKS salah atau Hub mati | Lokal selalu jadi jalur default (diuji dengan Hub dimatikan); cache JWKS + refresh otomatis tanpa restart; verifikasi token pakai library standar, bukan kode sendiri; keanggotaan tetap app-local jadi token rusak tidak bisa menaikkan hak |

---

## 11. Assumptions & Open Questions

```
ASSUMPTION: Pembanding harga Zendesk/Freshdesk di §1 akan diverifikasi ulang saat dipakai di README, dan tanggalnya dicantumkan.
ASSUMPTION: Tidak ada kebutuhan jam kerja / hari libur di perhitungan SLA untuk MVP.
ASSUMPTION: Attachments disimpan di disk lokal host, bukan object storage berbayar.
ASSUMPTION: Satu organisasi per akun. Multi-org (satu user beberapa organisasi) tidak dibutuhkan MVP.
```

```
OPEN: Pengiriman email balasan ke pelanggan (US-B21) pakai layanan apa kalau harus gratis?
      → Rekomendasi: SMTP dari penyedia gratis untuk demo + adapter agar bisa diganti tanpa mengubah domain logic.
OPEN: Apakah CSV ekspor tiket perlu di MVP?
      → Rekomendasi: tidak. Bukan bagian dari cerita produk; tunda.
OPEN: Kalau surat CSAT diisi ulang oleh pelanggan, timpa jawaban lama atau tolak?
      → Rekomendasi: tolak dengan pesan jelas, simpan jawaban pertama. Alasan: menjaga kejujuran metrik.
OPEN: Berapa lama tiket `resolved` bertahan sebelum `closed`?
      → Rekomendasi: 7 hari, bisa dikonfigurasi per organisasi di v1.
```

> **Diputuskan (2026-09-10): Bahasa UI = bilingual EN/ID.** Berlaku untuk UI staf **dan** portal pelanggan **dan** email keluar **dan** survei CSAT — bahasa mengikuti pembacanya masing-masing, bukan satu pengaturan untuk semua. Lihat US-B29, NFR-B08, NFR-B13..B15.

---

## 12. Release Plan & Exit Criteria

| Milestone | Isi | Exit criteria |
|---|---|---|
| **B0** | Fondasi: skema DB, auth, layout aplikasi, konvensi format respons, Docker Compose | Register + login jalan; `docker compose up` terverifikasi; skeleton test hijau di CI |
| **B1** | Inti tiket: US-B01..B16 (auth, CRUD, filter, komentar, internal, lampiran, status, arsip) | Semua AC Must B01–B16 terverifikasi; data demo ter-seed; **deploy publik pertama** |
| **B2** | SLA + email: US-B17..B21 | Tiket uji melewati tenggat → breach tercatat otomatis; email uji → tiket jadi |
| **B3** | Integrasi + kepuasan: US-B22..B24 | Webhook uji terkirim dengan tanda tangan valid; CSAT masuk dan terhitung di statistik |
| **B4** | Pengetahuan + portal + laporan: US-B25..B28 | Semua AC Must terverifikasi; 8 skenario akses tidak sah ditolak; test hijau; README + akun demo siap |
| **B5** | Operasional & ketahanan: US-B30..B34 (notifikasi breach di UI, penanganan email masuk gagal, `/health` + `/ready`, rate limiting, login lewat Hub/SSO internal) | Semua AC Must US-B30..B34 terverifikasi; badge breach + dismiss bertahan setelah reload; email gagal masuk daftar admin dengan retry; `/ready` 503 saat DB mati; 429 + `Retry-After` diuji lintas 2 instance; login Hub sukses, dan lokal tetap jalan saat Hub dimatikan. **Ini yang melengkapi exit criteria M1 di master §12: "semua AC ber-priority Must di B-PRD terverifikasi"** |

**Definition of Done project B:**
1. Semua baris `Must` di §5 terimplementasi.
2. Semua AC `Must` di §6 terverifikasi (dengan bukti: test otomatis atau langkah manual yang dicatat).
3. Test suite hijau di CI, badge terlihat di README.
4. Deploy publik + akun demo berfungsi.
5. Tidak ada kebocoran lintas peran pada 8 skenario uji akses.
6. README memuat: masalah, screenshot, cara coba demo, bagian "bagian tersulit".
7. Setiap keputusan tunda tercatat di §11 sebagai `OPEN:` dengan alasan.

---

## 13. Traceability ke Spec Arsitektur

Cerita di PRD ini dipetakan ke kemampuan teknis di [B-helpdesk.md](B-helpdesk.md):

| Story | Bagian spec |
|---|---|
| US-B01..B04 (auth, peran) | `organizations`/`users`, endpoint `/api/auth/*`, `/api/invite`, middleware |
| US-B05..B16 (tiket) | `tickets`, `ticket_comments`, `ticket_tags`, `ticket_status_log`, endpoint `/api/tickets/*` |
| US-B17..B19 (SLA) | `sla_policies`, `sla_breaches`, SLA engine (worker BullMQ) |
| US-B20..B21 (email) | `inbound_emails`, `/api/email/receive`, alur inbound email |
| US-B22..B23 (webhook) | `webhooks`, pengirim webhook + HMAC + retry |
| US-B24 (CSAT) | `csat_surveys`, alur survei + token |
| US-B25..B26 (KB) | `kb_categories`, `kb_articles`, `/api/kb/*` |
| US-B27 (portal) | portal berbasis token (spec § Key Mechanics) |
| US-B28 (statistik) | `/api/tickets/stats` |
| US-B30 (notif breach di UI) | `B-helpdesk.md` → "Ops, Hardening & SSO Hub" § Notifikasi breach SLA di UI |
| US-B31 (email masuk gagal) | `inbound_emails`, mekanik Inbound Email → Ticket, + `B-helpdesk.md` → "Ops, Hardening & SSO Hub" § Email masuk gagal |
| US-B32 (`/health` + `/ready`) | `B-helpdesk.md` → "Ops, Hardening & SSO Hub" § Health & Readiness |
| US-B33 (rate limiting) | `B-helpdesk.md` → "Ops, Hardening & SSO Hub" § Rate Limiting |
| US-B34 (login Hub/SSO internal) | `B-helpdesk.md` → "Ops, Hardening & SSO Hub" § Login lewat Hub |

---

*Kembali ke [00-MASTER-PRD.md](00-MASTER-PRD.md) · Lanjut ke [A-platform-PRD.md](A-platform-PRD.md)*
