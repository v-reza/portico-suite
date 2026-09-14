# PRD — PROJECT A: AI SaaS Platform (Internal-Tool Builder)

| Field | Value |
|---|---|
| **Product** | Platform — bikin internal tool dari prompt, tanpa nulis kode |
| **Version** | 0.1 |
| **Status** | `draft` |
| **Owner** | Reza (solo dev) |
| **Date** | 2026-09-10 |
| **Master PRD** | [00-MASTER-PRD.md](00-MASTER-PRD.md) |
| **Architecture spec** | [A-platform.md](A-platform.md) — schema, endpoint, pipeline AI, runner workflow ada di sana |
| **Design tokens** | [A-platform-DESIGN.md](A-platform-DESIGN.md) |

---

## 1. Problem Statement

Tim kecil (2–15 orang, tanpa developer internal) butuh tool kecil untuk pekerjaannya: form input supplier, pencatatan stok gudang, checklist QC, approval cuti. Kebutuhannya nyata tapi kecil — terlalu kecil untuk menyewa developer, terlalu spesifik untuk dibelikan SaaS yang sudah jadi:

- Alternatif "no-code" yang ada (Airtable, Retool, Notion) mulai dari ~$20–$30/user/bulan dan **datanya keluar dari server mereka** — banyak tim menolak karena data pelanggan/supplier.
- Spreadsheet bertahan sampai jumlah kolom >20 dan orang >5; setelah itu salah entri mulai rutin terjadi.
- Minta tolong developer internal berarti menunggu antrean; minta agensi berarti biaya proyek Rp 15–50 juta untuk tool yang umurnya 6 bulan.
- Otomatisasi ("kalau form ini diisi, kirim email ke gudang") biasanya harus diminta ke orang teknis — padahal ini kebutuhan operasional sehari-hari.

Yang dirugikan: **Adit** (team lead yang stuck dengan spreadsheet), **tim operasional** (salah entri berulang, kerja manual), **pemilik bisnis** (uang keluar untuk tool yang tidak dipakai).

`ASSUMPTION:` Pembanding harga dan klaim privasi data diverifikasi ulang saat dipakai di README, dengan tanggal.

---

## 2. Goals & Non-Goals

### Goals

| ID | Goal |
|---|---|
| G1 | Orang non-teknis bisa menghasilkan aplikasi kerja yang benar-benar berfungsi dari satu deskripsi, dalam <5 menit, tanpa menulis kode. |
| G2 | AI bukan hiasan: kalau AI dimatikan, pembuatan aplikasi dari prompt tidak bisa dilakukan sama sekali (mode manual tetap ada, tapi berbeda tingkat kesulitan). |
| G3 | Output AI **tidak pernah** langsung dipublikasikan — selalu berupa draft yang bisa diperiksa manusia dulu. |
| G4 | Otomatisasi bisa dibuat sendiri oleh non-developer: "kalau X terjadi, lakukan Y." |
| G5 | Data milik pengguna bisa di-host sendiri, dan rahasia (kredensial sumber data) disimpan terenkripsi. |
| G6 | Aplikasi yang sudah dipublikasikan bisa dipakai siapa pun lewat tautan, tanpa akun. |

### Non-Goals

| ID | Bukan goal | Alasan |
|---|---|---|
| NG1 | Editor visual pixel-perfect / styling kustom penuh | Fokus fungsi, bukan desain |
| NG2 | Kode aplikasi hasil generate bisa di-export dan dijalankan mandiri | Ini produk berbeda (codegen), scope jauh lebih besar |
| NG3 | Marketplace template / plugin pihak ketiga | Belum ada pengguna untuk berbagi |
| NG4 | Kolaborasi real-time pada builder (multi-kursor) | Konflik edit menambah kompleksitas besar |
| NG5 | Mobile app untuk mengedit builder | Builder butuh layar lebar |
| NG6 | Billing langganan berbayar | Kolom `plan` tetap ada, penegakannya tidak |
| NG7 | Dukungan tipe komponen tak terbatas / komponen kustom buatan pengguna | Whitelist tipe komponen justru yang menjaga AI tetap terkendali |
| NG8 | SSO / SAML / LDAP / OIDC pihak ketiga | tetap Non-Goal (selaras project B) |
| NG9 | Versi aplikasi bisa di-rollback ke versi sebelumnya (history penuh) | Undo/redo sesi sudah cukup untuk MVP |

> **Klarifikasi NG8:** enterprise SSO (SAML/LDAP/OIDC provider) **tetap Non-Goal**; yang sekarang masuk scope adalah **SSO internal lewat Hub portofolio** sebagai jalur login *tambahan* — lihat US-A31. Angka/nilai kontraknya tidak diulang di sini; acuannya bagian "Identitas bersama (Hub)" di 00-MASTER-PRD.md (satu angka hidup di satu tempat).

---

## 3. Personas

### P1 — Adit, "Team Lead Operasional" (builder)
- **Konteks:** mengelola tim 8 orang, punya masalah nyata: pencatatan data pakai Google Sheets yang mulai kacau.
- **Job to be done:** membuat satu tool kecil yang benar (input valid, ada otomatisasi) tanpa melewati developer.
- **Workaround sekarang:** spreadsheet bersama, grup WhatsApp untuk konfirmasi, dan aturan tak tertulis.
- **Sukses:** dalam hitungan menit, ada tautan yang bisa dibagikan ke timnya, dan dia tidak perlu mengingat aturan lagi karena sistem yang mengingatkan.
- **Tingkat teknis:** bisa pakai Excel rumus, pernah lihat API, tidak menulis kode.

### P2 — Rina, "Admin Workspace" (admin)
- **Konteks:** orang yang bertanggung jawab atas akun dan data, sering jadi yang dimintai tolong kalau ada yang salah.
- **Job to be done:** tahu siapa yang boleh apa, dan bisa mencabut akses tanpa drama.
- **Sukses:** bisa mengatur peran dan mengundang anggota tanpa menanyakan siapa pun.

### P3 — Maya, "Technical Recruiter" (reviewer)
- **Konteks:** sudah melihat puluhan "AI builder". Yang dia cari adalah bukti bahwa AI-nya menangani kenyataan: hasil model yang cacat, validasi, dan perilaku saat gagal.
- **Job to be done:** dalam 2 menit memastikan ini bukan demo palsu.
- **Sukses:** dia bisa mengetik prompt sendiri dan melihat aplikasi yang terbentuk — dan melihat apa yang terjadi ketika dia mengetik prompt yang buruk.

---

## 4. Core User Journeys

**J1 — Adit bikin tool dari prompt (jalur utama):**
1. Adit buka Platform, login, menekan "New app".
2. Dia mengetik: "Form input data supplier: nama, telepon, alamat, kategori (elektronik, tekstil, makanan), tanggal kontrak".
3. AI mengembalikan draft aplikasi: satu halaman, lima komponen, nama aplikasi yang wajar.
4. Adit melihat pratinjau, memperbaiki label satu field di panel properti.
5. Dia menambahkan otomatisasi: "kalau form dikirim, kirim email ke gudang@perusahaan.com".
6. Dia publish → dapat tautan publik → dibagikan ke timnya.
7. Tim mengisi form lewat tautan; datanya masuk ke tab Data.

**J2 — Prompt buruk ditangani dengan benar (kualitas yang diuji reviewer):**
1. Maya mengetik prompt kosong atau hanya "asdf".
2. Sistem menolak dengan penjelasan, bukan menghasilkan aplikasi kosong.
3. Maya mengetik prompt yang meminta 3 jenis komponen yang tidak ada.
4. AI diberi tahu kesalahannya, mencoba sekali lagi, dan kalau tetap gagal, Maya melihat daftar kesalahan yang spesifik — bukan error 500.

**J3 — Adit mengotomatiskan proses:**
1. Adit membuat workflow dengan pemicu "ketika form dikirim".
2. Dia menambahkan langkah: kirim email → kondisi (kalau kategori = tekstil) → tulis baris ke tabel lain.
3. Dia menjalankan uji coba (dry-run) dengan data contoh.
4. Hasil uji ditampilkan per langkah: langkah mana sukses, mana gagal, dan kenapa.
5. Dia mengaktifkan workflow dan melihat riwayat setiap kali berjalan.

**J4 — Rina mengatur anggota:**
1. Rina membuka Settings → Users.
2. Dia mengundang anggota sebagai `builder`, satu lagi sebagai `viewer`.
3. `viewer` mencoba mengedit aplikasi → ditolak dengan penjelasan, bukan error misterius.
4. Rina mencabut akses seorang anggota → dia langsung tidak bisa membuka aplikasi lagi.

**J5 — Adit menangani AI yang lambat (ketahanan):**
1. AI butuh waktu lebih dari biasanya (>60 detik).
2. Antarmuka tidak menggantung: muncul status, tombol batalkan, dan batas waktu.
3. Kalau dibatalkan atau habis waktu, tidak ada setengah aplikasi tersimpan di database, dan Adit bisa coba lagi tanpa membersihkan apa pun.

---

## 5. Scope & Prioritas

| Area | Fitur | Prioritas |
|---|---|---|
| Auth | Register workspace + admin pertama | Must |
| Auth | Login/logout sesi | Must |
| Auth | Peran admin / builder / viewer, ditegakkan di server | Must |
| Auth | Undang anggota via email | Must |
| App | Buat/lihat/ubah/arsip aplikasi | Must |
| App | Slug unik per workspace, dipakai untuk URL publik | Must |
| App | Publikasi (draft vs published) — tidak pernah otomatis | Must |
| Builder | Palet komponen (14 tipe) + drag & drop ke kanvas | Must |
| Builder | Panel properti dinamis sesuai tipe komponen | Must |
| Builder | Pindahkan urutan komponen + hapus | Must |
| Builder | Halaman: tambah, ganti nama, urutkan | Must |
| Builder | Undo/redo sesi edit | Must |
| Builder | Pratinjau sebelum publish | Must |
| Builder | Kolom / komponen bersarang | Should |
| Builder | Duplikat komponen | Should |
| AI | Generate aplikasi utuh dari prompt → draft | Must |
| AI | Generate satu form tambahan di halaman yang ada | Must |
| AI | Validasi keluaran + perbaikan sekali + pelaporan kesalahan spesifik | Must |
| AI | Batas jumlah komponen + pengurangan biaya token | Must |
| AI | Progres bertahap saat generate + tombol batalkan | Should |
| AI | Usulan langkah workflow dari prompt | Could |
| Data | Penyimpanan baris dinamis per aplikasi | Must |
| Data | Tabel data: lihat, cari, paginasi | Must |
| Data | Ekspor CSV | Could |
| Form publik | Render aplikasi yang dipublikasikan tanpa login | Must |
| Form publik | Kirim data tanpa akun | Must |
| Form publik | Validasi wajib-isi + pesan per field | Must |
| Workflow | 4 tipe pemicu (form submit, cron, webhook masuk, tombol) | Must |
| Workflow | Aksi: kirim email, panggil API, buat/ubah/hapus baris, notifikasi Slack, kondisi | Must |
| Workflow | Editor langkah visual | Must |
| Workflow | Riwayat setiap eksekusi + error per langkah | Must |
| Workflow | Perilaku saat gagal: lanjut / berhenti / coba ulang | Must |
| Workflow | Uji coba (dry-run) dengan data contoh | Must |
| Sumber data | Sumber API + penyimpanan terenkripsi + tombol uji koneksi | Should |
| Keamanan | Rahasia dienkripsi, token publik form terpisah dari akun | Must |
| Audit | Log aktivitas (siapa melakukan apa kapan) | Must |
| i18n | Lapisan terjemahan (EN/ID) + pemilih bahasa di semua layar, termasuk form publik | Must |
| Builder | Duplikat halaman beserta seluruh komponennya (deep copy) | Should |
| Keamanan | Rate limiting per-IP + per-token di endpoint kirim form publik & API (429 + Retry-After, store bersama antarinstande) | Must |
| Auth | Login lewat Hub (SSO internal) sebagai jalur tambahan, selaras bagian "Identitas bersama (Hub)" di 00-MASTER-PRD.md | Must |
| Ops | Health/readiness endpoint `/health` + `/ready` (per-komponen + latency, non-200 kalau wajib down) | Must |
| Ops | Metrik observabilitas (latency request + biaya token AI + hasil run workflow), tanpa PII di label | Should |

---

## 6. User Stories & Acceptance Criteria

### Autentikasi & Workspace

---

**US-A01** — Sebagai **Rina**, gw mau membuat workspace untuk tim gw, supaya data dan aplikasi terpisah dari tim lain.
Priority: Must · Est: M

- [ ] AC1: Kalau email belum terdaftar, saat Rina mengisi nama workspace, email, password, workspace dibuat dan Rina menjadi `admin` di dalamnya.
- [ ] AC2: Kalau email sudah dipakai, maka pendaftaran ditolak dengan pesan yang jelas dan tidak ada workspace kedua.
- [ ] AC3: Kalau nama workspace berisi spasi/huruf besar, maka slug dibuat otomatis dan tetap unik lintas workspace.
- [ ] AC4: Kalau pendaftaran gagal di tengah, maka tidak ada workspace setengah jadi yang tertinggal.

---

**US-A02** — Sebagai **Adit**, gw mau masuk dan keluar dengan aman, supaya aplikasi tim gw tidak bisa dibuka orang luar.
Priority: Must · Est: S

- [ ] AC1: Kalau kredensial benar, saat login, sesi dibuat dan Adit diarahkan ke daftar aplikasi.
- [ ] AC2: Kalau password salah, maka pesan generik (tidak mengungkap mana yang salah).
- [ ] AC3: Kalau 5 kegagalan dalam 10 menit untuk satu email, maka login diblokir 15 menit untuk email itu.
- [ ] AC4: Kalau sesi kedaluwarsa, saat Adit membuka halaman, dia diarahkan login dan kembali ke halaman tujuan setelah masuk.
- [ ] AC5: Kalau logout, maka tombol back browser tidak menampilkan data aplikasi lagi.

---

**US-A03** — Sebagai **Rina**, gw mau mengundang anggota dengan peran tertentu, supaya akses orang sesuai tanggung jawabnya.
Priority: Must · Est: M

- [ ] AC1: Kalau Rina mengundang email sebagai `builder`, maka email undangan terkirim dan tercatat sebagai undangan tertunda.
- [ ] AC2: Kalau undangan dibuka dalam 24 jam, saat penerima mengisi nama + password, akunnya aktif dengan peran yang benar.
- [ ] AC3: Kalau undangan lewat 24 jam, saat dibuka, muncul halaman kedaluwarsa dan Rina bisa kirim ulang.
- [ ] AC4: Kalau email sudah jadi anggota workspace ini, maka undangan duplikat ditolak dengan peringatan.
- [ ] AC5: Kalau tautan undangan sudah dipakai sekali, saat dipakai lagi, ditolak.

---

**US-A04** — Sebagai **Rina**, gw mau peran yang ditegakkan, supaya anggota tidak bisa melakukan hal di luar haknya.
Priority: Must · Est: M

- [ ] AC1: Kalau anggota berperan `viewer`, saat dia mencoba menyimpan perubahan pada aplikasi, permintaan ditolak di server (bukan hanya tombol yang dinonaktifkan).
- [ ] AC2: Kalau `builder`, saat dia mencoba membuka pengaturan anggota atau pencabutan akses, ditolak.
- [ ] AC3: Kalau `admin`, saat dia mengubah peran anggota, perubahan berlaku dan tercatat di log aktivitas.
- [ ] AC4: Kalau Rina mencoba menurunkan perannya sendiri, maka ditolak dengan pesan bahwa admin terakhir tidak bisa diubah.
- [ ] AC5: Kalau permintaan tanpa sesi ke endpoint data apa pun, maka 401.
- [ ] AC6: Kalau aplikasi milik workspace X, saat akun `admin` workspace Y menyentuhnya dengan menebak URL, 403 dan tidak ada data yang terungkap.

---

### Aplikasi

---

**US-A05** — Sebagai **Adit**, gw mau membuat aplikasi baru, supaya ada wadah untuk tool yang mau gw bangun.
Priority: Must · Est: S

- [ ] AC1: Kalau Adit mengisi nama aplikasi, saat disimpan, aplikasi dibuat dalam keadaan draft (belum dipublikasikan) dan dia masuk ke editor.
- [ ] AC2: Kalau nama kosong, maka ditolak dengan pesan di field itu.
- [ ] AC3: Kalau sudah ada aplikasi bernama sama di workspace itu, maka slug-nya dibuat unik otomatis (bukan error).
- [ ] AC4: Kalau aplikasi dibuat, maka tercatat di log aktivitas dengan pelaku dan waktunya.

---

**US-A06** — Sebagai **Adit**, gw mau melihat semua aplikasi gw, supaya gw bisa mengelola banyak tool sekaligus.
Priority: Must · Est: S

- [ ] AC1: Kalau ada 4 aplikasi, maka tampil sebagai kartu berisi nama, slug, deskripsi singkat, status, dan waktu terakhir diubah.
- [ ] AC2: Kalau belum ada aplikasi, maka tampil empty state dengan dua aksi: "buat dari prompt" dan "buat kosong".
- [ ] AC3: Kalau data sedang dimuat, maka tampil skeleton, bukan layar kosong.
- [ ] AC4: Kalau gagal memuat daftar, maka muncul pesan error + tombol coba lagi, dan kartu aplikasi tidak ditampilkan setengah jadi.
- [ ] AC5: Kalau ada 100 aplikasi, maka daftar tetap membuka <1 detik (p95).

---

**US-A07** — Sebagai **Adit**, gw mau mengubah dan mengarsipkan aplikasi, supaya dia tidak menumpuk kalau sudah tidak dipakai.
Priority: Must · Est: S

- [ ] AC1: Kalau Adit mengubah nama/deskripsi, maka perubahan tersimpan dan waktu diubah terbarui.
- [ ] AC2: Kalau Adit mengarsipkan aplikasi, maka aplikasi hilang dari daftar utama, tautan publiknya berhenti bekerja, dan datanya tidak terhapus.
- [ ] AC3: Kalau aplikasi diarsipkan, saat Adit memulihkannya, tautan publiknya bekerja lagi (dengan slug yang sama).
- [ ] AC4: Kalau `viewer` mencoba mengarsipkan, maka ditolak.
- [ ] AC5: Kalau penghapusan permanen dilakukan (admin), maka halaman, komponen, workflow, dan baris datanya ikut terhapus, dan aksi ini tercatat di log.

---

**US-A08** — Sebagai **Adit**, gw mau mengendalikan kapan aplikasi bisa dipakai orang lain, supaya tidak ada yang terpublikasi tanpa gw sadari.
Priority: Must · Est: M

- [ ] AC1: Kalau aplikasi berstatus draft, saat Adit membuka tautan publiknya, muncul halaman "belum dipublikasikan" (bukan kebetulan bisa dipakai).
- [ ] AC2: Kalau Adit menekan publish, maka status berubah dan tautan publik langsung bisa dipakai.
- [ ] AC3: Kalau aplikasi dibatalkan publikasinya, maka tautan publik kembali menampilkan halaman "belum dipublikasikan" tanpa menghapus data yang sudah masuk.
- [ ] AC4: Kalau aplikasi dibuat oleh AI, maka statusnya tetap draft sampai manusia mempublikasikannya (AI tidak boleh mempublikasikan sendiri).
- [ ] AC5: Kalau orang luar mengirim data ke form publik, maka dia tidak bisa membuka data yang sudah masuk sebelumnya (hanya bisa mengirim).

---

### Builder

---

**US-A09** — Sebagai **Adit**, gw mau menambahkan komponen dengan drag & drop, supaya gw bisa menyusun tool tanpa kode.
Priority: Must · Est: L

- [ ] AC1: Kalau Adit menyeret komponen "text" dari palet ke kanvas, saat dilepas, komponen muncul di urutan tempat dijatuhkan dan langsung muncul di panel properti.
- [ ] AC2: Kalau kanvas kosong, maka tampil area dengan petunjuk "geser komponen ke sini", bukan kanvas hitam kosong tanpa keterangan.
- [ ] AC3: Kalau Adit menyeret komponen ke area di luar kanvas, saat dilepas, tidak ada perubahan yang terjadi (tidak ada komponen "nyasar").
- [ ] AC4: Kalau komponen baru ditambahkan, maka pengaturannya bisa diubah (label, placeholder, wajib-isi) dan perubahan terlihat langsung di kanvas.
- [ ] AC5: Kalau 15 komponen di satu halaman dan Adit menambah lagi, maka dibatasi dengan pesan jelas (batas per halaman).
- [ ] AC6: Kalau penambahan komponen, maka aksi itu bisa di-undo.

---

**US-A10** — Sebagai **Adit**, gw mau mengurutkan ulang dan menghapus komponen, supaya susunan form bisa gw perbaiki.
Priority: Must · Est: M

- [ ] AC1: Kalau Adit memindahkan komponen dari posisi 3 ke posisi 1, saat dijatuhkan, urutannya berubah seketika dan tetap tersimpan setelah halaman dimuat ulang.
- [ ] AC2: Kalau Adit menghapus komponen, maka komponen hilang dari kanvas dan dari penyimpanan setelah perubahan disimpan.
- [ ] AC3: Kalau penghapusan tidak disengaja, saat Adit menekan undo, komponen kembali pada posisi dan pengaturannya semula.
- [ ] AC4: Kalau Adit memilih sebuah komponen, maka tampil penanda visual bahwa komponen itu yang sedang dipilih (bukan menebak dari panel properti).

---

**US-A11** — Sebagai **Adit**, gw mau memiliki beberapa halaman dalam satu aplikasi, supaya tool gw bisa dipakai bertahap.
Priority: Must · Est: M

- [ ] AC1: Kalau Adit menambahkan halaman, maka tab halaman baru muncul dan bisa diberi nama serta rute.
- [ ] AC2: Kalau Adit mengubah urutan halaman, maka urutannya tersimpan dan konsisten setelah dimuat ulang.
- [ ] AC3: Kalau Adit menghapus halaman berisi komponen, maka ada konfirmasi yang menyebutkan jumlah komponen yang akan ikut terhapus.
- [ ] AC4: Kalau aplikasi dipublikasikan dengan dua halaman, saat pengunjung membuka rute masing-masing, komponen halaman yang sesuai yang tampil.
- [ ] AC5: Kalau rute duplikat dalam satu aplikasi, maka ditolak dengan pesan yang menyebut rute yang bentrok.

---

**US-A12** — Sebagai **Adit**, gw mau membatalkan kesalahan edit yang baru gw lakukan, supaya gw berani bereksperimen.
Priority: Must · Est: M

- [ ] AC1: Kalau Adit menambahkan, menghapus, memindahkan, atau mengubah komponen, saat menekan undo, keadaan kembali ke sebelum perubahan terakhir.
- [ ] AC2: Kalau Adit sudah menekan undo, saat menekan redo, perubahan yang dibatalkan diterapkan kembali.
- [ ] AC3: Kalau riwayat sudah mencapai batas (50 langkah), maka langkah paling lama dibuang dan tidak ada error.
- [ ] AC4: Kalau Adit mempublikasikan atau menghapus halaman, maka riwayat redo dikosongkan (aksi besar tidak bisa dibatalkan sebagian).
- [ ] AC5: Kalau Adit meninggalkan halaman dengan perubahan belum tersimpan, maka dia diberi peringatan sebelum keluar.

---

**US-A13** — Sebagai **Maya**, gw mau melihat pratinjau sebelum publish, supaya gw yakin form-nya benar sebelum dipakai orang.
Priority: Must · Est: S

- [ ] AC1: Kalau Adit menekan "pratinjau", maka tampil aplikasi seperti yang akan dilihat pengunjung, tanpa memerlukan publikasi.
- [ ] AC2: Kalau pratinjau dibuka, maka tidak ada data sungguhan yang tersimpan saat form dicoba di pratinjau (mode uji tidak mencemari data).
- [ ] AC3: Kalau pratinjau gagal dimuat, maka muncul pesan error yang jelas, bukan layar putih.
- [ ] AC4: Kalau ada perubahan setelah pratinjau dibuka, maka pratinjau menyegarkan dirinya atau menunjukkan bahwa datanya sudah basi.

---

### AI Generator

---

**US-A14** — Sebagai **Adit**, gw mau menulis satu deskripsi dan mendapat aplikasi, supaya gw tidak perlu menyusun komponen satu per satu.
Priority: Must · Est: L

- [ ] AC1: Kalau Adit mengetik prompt yang wajar (mis. "form input supplier: nama, telepon, alamat, kategori"), saat dikirim, dalam ≤60 detik dia menerima draft aplikasi berisi nama, minimal satu halaman, dan komponen yang relevan dengan prompt.
- [ ] AC2: Kalau draft dihasilkan, maka status aplikasi masih draft, dan Adit diminta memeriksa sebelum publikasi.
- [ ] AC3: Kalau hasil generate tidak valid, maka tidak ada aplikasi setengah jadi yang tersimpan (transaksi tidak separuh jalan).
- [ ] AC4: Kalau generate berhasil, maka Adit bisa langsung mengedit hasilnya seperti aplikasi biasa (hasil bukan sesuatu yang terkunci).
- [ ] AC5: Kalau prompt berbahasa Indonesia, maka hasilnya tetap benar (nama aplikasi dan label sesuai bahasa prompt).
- [ ] AC6: Kalau 10 prompt uji berisi deskripsi wajar, maka ≥8 menghasilkan aplikasi yang bisa dipakai tanpa perbaikan struktur (kriteria rilis M2 di master PRD).

---

**US-A15** — Sebagai **Maya**, gw mau hasil AI yang cacat ditangani dengan benar, supaya gw tahu ini bukan demo palsu.
Priority: Must · Est: M

- [ ] AC1: Kalau prompt kosong atau hanya spasi, saat dikirim, ditolak dengan pesan yang menjelaskan bahwa deskripsi diperlukan, dan tidak ada permintaan AI yang dikirim.
- [ ] AC2: Kalau model mengembalikan JSON yang tidak bisa diparse, maka sistem mencoba sekali lagi dengan menyertakan pesan kesalahannya, dan pengguna diberi tahu bahwa sedang mencoba ulang.
- [ ] AC3: Kalau percobaan kedua juga gagal, maka pengguna menerima daftar kesalahan yang spesifik (mis. "tipe komponen `slider` tidak dikenal di halaman 1") — bukan error 500 atau pesan umum.
- [ ] AC4: Kalau model mengembalikan lebih dari 15 komponen dalam satu halaman, maka hasil dipotong ke 15 dan ada catatan bahwa pemotongan dilakukan.
- [ ] AC5: Kalau model mengembalikan tipe komponen yang tidak dikenal, maka tipe itu tidak pernah disimpan (ditolak atau digantikan `text`) dan ada catatan.
- [ ] AC6: Kalau prompt melebihi **500 karakter**, maka input menolak dengan pesan batas panjang (menyelaraskan dengan guard prompt-injection di spec; mencegah pembengkakan biaya).
- [ ] AC7: Kalau permintaan AI lebih dari 60 detik, maka proses dibatalkan dengan pesan yang menjelaskan, dan tidak ada data yang tersisa di database.

---

**US-A16** — Sebagai **Adit**, gw mau menambah satu form baru ke halaman yang sudah ada, supaya gw tidak harus regenerate semuanya.
Priority: Must · Est: M

- [ ] AC1: Kalau ada halaman dengan 4 komponen, saat Adit meminta tambahan ("tambahkan field tanggal lahir dan nomor KTP"), komponen baru ditambahkan **di akhir** halaman itu tanpa mengubah komponen lamanya.
- [ ] AC2: Kalau permintaan tambahan meminta field yang sudah ada di halaman itu, maka sistem menandai kemungkinan duplikat (bukan langsung membuat label kembar).
- [ ] AC3: Kalau penambahan gagal, maka halaman tetap dalam keadaan seperti sebelum permintaan (tidak setengah berubah).
- [ ] AC4: Kalau penambahan berhasil, maka aksi itu bisa di-undo.

---

**US-A17** — Sebagai **Reza**, gw mau biaya AI terkendali, supaya demo tidak mati karena tagihan.
Priority: Must · Est: M

- [ ] AC1: Kalau prompt yang sama persis dikirim dua kali dalam 5 menit, maka permintaan kedua memakai hasil yang tersimpan (tidak memanggil AI lagi) dan ini terlihat dari waktu respons yang jauh lebih cepat.
- [ ] AC2: Kalau permintaan generate aplikasi utuh, maka model yang dipakai untuk membuat form tambahan adalah model yang lebih murah (dicatat di konfigurasi, bukan di dalam kode).
- [ ] AC3: Kalau setiap pemanggilan AI, maka jumlah token masuk/keluar tercatat per permintaan supaya biaya bisa dihitung.
- [ ] AC4: Kalau biaya harian melewati batas yang dikonfigurasi, maka permintaan AI baru ditolak dengan pesan yang jelas (bukan diam-diam habis).

---

### Penyimpanan & Data

---

**US-A18** — Sebagai **Adit**, gw mau data yang diisi tim gw tersimpan dan bisa dilihat, supaya tool-nya berguna.
Priority: Must · Est: M

- [ ] AC1: Kalau pengunjung mengisi form publik dan menekan kirim, maka baris data tersimpan, dan Adit melihatnya di tab Data.
- [ ] AC2: Kalau field wajib-isi dibiarkan kosong, maka pengiriman ditolak dan muncul pesan per field yang bermasalah; tidak ada baris tersimpan.
- [ ] AC3: Kalau nilai yang dikirim tidak sesuai tipe (mis. email berisi "abc"), maka ditolak dengan pesan di field email itu.
- [ ] AC4: Kalau pengunjung mengirim dua kali karena tidak sengaja menekan dua kali, maka hanya satu baris yang tersimpan (pencegahan dobel-kirim).
- [ ] AC5: Kalau baris tersimpan, maka waktu dibuat dan sumber pengirim tercatat.

---

**US-A19** — Sebagai **Adit**, gw mau mencari dan menelusuri data yang masuk, supaya gw bisa menemukan satu baris di antara ribuan.
Priority: Must · Est: M

- [ ] AC1: Kalau ada 5.000 baris, saat Adit membuka tab Data, tampil 25 baris pertama dengan total dan nomor halaman.
- [ ] AC2: Kalau Adit mengetik kata kunci, maka pencarian mencakup isi nilai baris, dan hasilnya <500ms (p95).
- [ ] AC3: Kalau pencarian tidak menemukan apa pun, maka tampil empty state yang menyebut kata kunci yang dicari, bukan tabel kosong.
- [ ] AC4: Kalau belum ada data, maka tampil empty state berisi cara membagikan tautan form untuk mulai mengumpulkan data.

---

### Workflow

---

**US-A20** — Sebagai **Adit**, gw mau membuat otomatisasi dari satu pemicu, supaya proses berjalan tanpa diingat orang.
Priority: Must · Est: L

- [ ] AC1: Kalau Adit membuat workflow dengan pemicu "ketika form dikirim" pada halaman tertentu, saat form itu dikirim, satu catatan eksekusi baru muncul di riwayat.
- [ ] AC2: Kalau workflow dibuat, maka keadaannya tidak aktif secara default sampai Adit mengaktifkannya.
- [ ] AC3: Kalau workflow dengan pemicu cron berjadwal setiap Senin 09:00, maka eksekusi terjadi pada jadwal itu (minimal terbukti lewat uji jadwal pendek seperti tiap menit).
- [ ] AC4: Kalau workflow dengan pemicu webhook masuk, saat permintaan datang dengan tanda tangan yang salah, ditolak (401) dan tidak ada eksekusi.
- [ ] AC5: Kalau workflow dinonaktifkan, saat pemicunya terjadi, tidak ada eksekusi yang dibuat.
- [ ] AC6: Kalau Adit menambah pemicu cron dengan jadwal yang tidak valid, maka ditolak dengan pesan format jadwal.

---

**US-A21** — Sebagai **Adit**, gw mau menambah beberapa langkah ke workflow, supaya otomatisasinya berguna.
Priority: Must · Est: L

- [ ] AC1: Kalau Adit menambahkan langkah "kirim email" dengan penerima dan isi, saat workflow berjalan, langkah itu dijalankan dan hasilnya tercatat.
- [ ] AC2: Kalau langkah "panggil API" dikonfigurasi dengan URL dan metode, saat berjalan, permintaan dikirim dan kode responsnya tercatat pada langkah itu.
- [ ] AC3: Kalau langkah gagal, maka pesan kesalahan yang jelas tercatat pada langkah tersebut (termasuk langkah ke-berapa, aksi apa).
- [ ] AC4: Kalau Adit memindahkan urutan langkah, maka urutan baru tersimpan dan dijalankan sesuai urutan itu.
- [ ] AC5: Kalau langkah dihapus, maka eksekusi berikutnya tidak lagi menjalankannya dan riwayat lama tetap utuh.

---

**US-A22** — Sebagai **Adit**, gw mau satu langkah kondisi, supaya otomatisasinya tidak selalu berjalan sama.
Priority: Must · Est: M

- [ ] AC1: Kalau langkah kondisi dengan ekspresi yang mengacu pada data masukan, saat kondisinya benar, eksekusi lanjut ke langkah berikutnya.
- [ ] AC2: Kalau kondisinya salah, maka eksekusi berhenti pada titik itu dan riwayat mencatat mengapa berhenti.
- [ ] AC3: Kalau ekspresi kondisi tidak valid, saat workflow disimpan, ditolak dengan pesan bahwa ekspresinya salah (bukan gagal saat berjalan).
- [ ] AC4: Kalau ekspresi berisi upaya menjalankan kode berbahaya (mis. akses berkas/fungsi sistem), maka ditolak — ekspresi hanya boleh mengakses data masukan.

---

**US-A23** — Sebagai **Adit**, gw mau mengatur apa yang terjadi kalau satu langkah gagal, supaya otomatisasi tidak berhenti diam-diam.
Priority: Must · Est: M

- [ ] AC1: Kalau langkah diatur "lanjut jika gagal", saat langkah itu gagal, kesalahan dicatat pada langkah itu dan langkah berikutnya tetap dijalankan.
- [ ] AC2: Kalau langkah diatur "berhenti jika gagal", maka eksekusi berhenti dan seluruh eksekusi ditandai gagal dengan penyebabnya.
- [ ] AC3: Kalau langkah diatur "coba ulang jika gagal", maka langkah itu dicoba ulang maksimal 3 kali dengan jeda membesar sebelum dianggap gagal.
- [ ] AC4: Kalau eksekusi berakhir (sukses/gagal), maka status akhirnya terlihat di riwayat dan bisa dibuka detailnya.

---

**US-A24** — Sebagai **Adit**, gw mau menguji workflow sebelum mengaktifkannya, supaya gw tidak menyalakan sesuatu yang salah.
Priority: Must · Est: M

- [ ] AC1: Kalau Adit menekan "uji coba" dengan data contoh yang dia isi, maka langkah-langkah dijalankan dalam mode uji dan hasilnya ditampilkan per langkah.
- [ ] AC2: Kalau mode uji, maka tidak ada efek nyata yang mengubah data produksi (mis. baris tidak benar-benar dibuat, email tidak benar-benar terkirim) dan hal ini dinyatakan jelas di layar.
- [ ] AC3: Kalau satu langkah gagal dalam uji, maka langkah itu ditandai gagal beserta alasannya, dan langkah berikutnya tetap diperlihatkan hasilnya sesuai aturan "saat gagal".
- [ ] AC4: Kalau uji coba dengan data contoh kosong, maka ditolak dengan pesan bahwa data contoh diperlukan.

---

**US-A25** — Sebagai **Adit**, gw mau melihat riwayat setiap kali workflow berjalan, supaya gw bisa tahu kenapa ada yang tidak jalan.
Priority: Must · Est: M

- [ ] AC1: Kalau workflow sudah berjalan 20 kali, maka riwayat menampilkan 20 catatan dengan waktu, status, dan pemicunya.
- [ ] AC2: Kalau Adit membuka satu catatan, maka dia melihat data masukan, data keluaran, dan kesalahan bila ada, per langkah.
- [ ] AC3: Kalau riwayat difilter status `gagal`, maka hanya yang gagal yang muncul.
- [ ] AC4: Kalau ada kesalahan, maka isinya bisa dibaca manusia (bukan dump objek mentah yang tak terbaca).
- [ ] AC5: Kalau 100 eksekusi dalam sehari, maka tab riwayat tetap membuka <1 detik (p95).

---

**US-A26** — Sebagai **Rina**, gw mau kredensial sumber data disimpan dengan aman, supaya gw tidak khawatir tentang kebocoran.
Priority: Should · Est: M

- [ ] AC1: Kalau Rina menambahkan sumber data API dengan kunci rahasia, maka kunci itu tidak pernah muncul kembali dalam bentuk aslinya di antarmuka setelah disimpan (ditampilkan bertopeng).
- [ ] AC2: Kalau kunci itu tersimpan di database, saat dibaca langsung dari database, isinya terenkripsi (bukan teks biasa).
- [ ] AC3: Kalau Rina menekan "uji koneksi", maka hasilnya dilaporkan (berhasil / pesan kesalahan yang bisa dipahami), bukan gagal senyap.
- [ ] AC4: Kalau `viewer` mencoba membuka halaman sumber data, maka ditolak.
- [ ] AC5: Kalau sumber data dihapus, maka kredensialnya ikut hilang dan tidak tersisa di mana pun.

---

**US-A27** — Sebagai **Adit**, gw mau memakai Platform dalam bahasa Indonesia atau Inggris, supaya tim gw tidak dipaksa bahasa asing.
Priority: Must · Est: M

- [ ] AC1: Kalau browser berbahasa Inggris dan pengguna belum pernah memilih bahasa, maka seluruh label UI tampil Inggris (deteksi `Accept-Language`).
- [ ] AC2: Kalau ada pemilih bahasa (di menu akun), saat Adit memilih Indonesia, seluruh label UI berubah dan pilihannya bertahan setelah reload dan setelah login.
- [ ] AC3: Kalau **aplikasi yang dibuat pengguna** punya label sendiri (nama field, teks tombol), maka label itu **tidak** ikut diterjemahkan otomatis — teks yang ditulis Adit tampil apa adanya di kedua bahasa.
- [ ] AC4: Kalau string terjemahan belum ada untuk sebuah kunci, maka yang tampil adalah bahasa Inggris (fallback), bukan layar kosong atau kunci mentah tanpa penanganan.
- [ ] AC5: Kalau halaman form publik dibuka pengunjung, maka bahasanya mengikuti bahasa pengunjung, bukan bahasa pemilik aplikasi.
- [ ] AC6: Kalau pesan kesalahan validasi form, maka pesannya ikut bahasa yang aktif (bukan pesan server berbahasa Inggris yang bocor ke UI Indonesia).
- [ ] AC7: Kalau reviewer menjalankan uji, maka tidak ada string UI yang di-hardcode di komponen (dipastikan lewat uji atau pemeriksaan daftar).

---

### Duplikat Halaman

**US-A28** — Sebagai **Adit**, gw mau menduplikat halaman beserta semua komponennya, supaya gw tidak membangun ulang form yang mirip.
Priority: Should · Est: M

- [ ] AC1: Kalau halaman "Form Pendaftaran" punya 12 komponen, saat Adit menekan "Duplikat halaman", dibuat halaman baru dengan nama default "Form Pendaftaran (copy)" berisi 12 komponen dengan urutan dan konfigurasi identik.
- [ ] AC2: Kalau halaman asal punya komponen tata letak (container) berisi komponen di dalamnya, saat diduplikat, seluruh isi bersarang ikut tersalin (deep copy); mengubah properti komponen di salinan tidak mengubah komponen di halaman asal dan sebaliknya.
- [ ] AC3: Kalau halaman asal punya route `daftar`, saat diduplikat, salinan dapat route unik `daftar-copy`; kalau `daftar-copy` sudah dipakai, dipakai `daftar-copy-2`, lalu `-3`, dst.
- [ ] AC4: Kalau penyimpanan salinan gagal di tengah transaksi (mis. komponen ke-7 dari 12 gagal disimpan), saat proses dibatalkan, tidak ada halaman salinan setengah jadi yang tersisa (rollback penuh), daftar halaman sama seperti sebelum aksi, dan pesan kesalahan tampil di layar.
- [ ] AC5: Kalau pengguna berperan `viewer` yang bukan anggota workspace, saat dia mengirim permintaan duplikat langsung ke API (bukan lewat tombol), server membalas 403 dan tidak ada baris halaman atau komponen baru.
- [ ] AC6: Kalau Adit menekan tombol "Duplikat" dua kali dalam waktu <1 detik (dobel kirim), maka hanya satu halaman salinan yang terbentuk.

---

### Health & Readiness

**US-A29** — Sebagai **Reza**, gw mau app A punya endpoint kesehatan dan kesiapan, supaya monitor/hosting bisa tahu komponen mana yang mati tanpa gw cek satu-satu.
Priority: Must · Est: S

- [ ] AC1: Kalau app berjalan, saat `GET /health` dipanggil tanpa login, dibalas 200 dengan body `{ "status": "ok" }` dalam <200 ms (p95).
- [ ] AC2: Kalau semua komponen wajib sehat, saat `GET /ready` dipanggil tanpa login, dibalas 200 dengan status per komponen minimal `db`, `queue` (worker), dan `storage` (object storage), masing-masing menyertakan status dan latency dalam milidetik.
- [ ] AC3: Kalau komponen database mati, saat `GET /ready` dipanggil, dibalas 503 dan komponen yang gagal disebut namanya (`db` ditandai down), sementara komponen lain tetap dilaporkan statusnya (bukan gagal total tanpa informasi).
- [ ] AC4: Kalau `GET /health` dan `GET /ready` dipanggil, maka isi respons hanya nama komponen + status + latency, dan tidak memuat rahasia apa pun (tidak ada connection string, token, atau kredensial yang terbaca).
- [ ] AC5: Kalau respons diambil lewat proxy/CDN, saat `GET /ready` dipanggil dua kali berurutan, header `Cache-Control: no-store` ada sehingga hasilnya tidak di-cache.
- [ ] AC6: Kalau worker antrean mati tapi database hidup, maka `GET /ready` membalas 503 dengan komponen `queue` ditandai down (komponen wajib yang tidak siap membuat keseluruhan tidak siap).

---

### Metrik & Observabilitas

**US-A30** — Sebagai **Reza**, gw mau ada metrik latency, biaya token AI, dan hasil run workflow, supaya performa dan biaya bisa dilihat tanpa membaca log satu-satu.
Priority: Should · Est: M

- [ ] AC1: Kalau sistem sudah melayani trafik, saat metrik dibaca dari endpoint yang tersedia, tersedia minimal: latency request (p50 dan p95 per rute), total biaya token AI per hari (USD), dan jumlah run workflow per hasil (`sukses`/`gagal`).
- [ ] AC2: Kalau label pada metrik, maka tidak ada label yang memuat email, nama user, atau isi kiriman form; label yang dipakai hanya rute, kode status, dan id workflow.
- [ ] AC3: Kalau satu run workflow selesai, saat counter hasil dibaca ≤10 detik setelahnya, counter `sukses` atau `gagal` bertambah tepat 1 (tidak dobel, tidak hilang).
- [ ] AC4: Kalau endpoint metrik terbuka di URL publik, maka akses dibatasi (token bearer lewat env atau hanya jaringan internal), bukan bisa dibaca siapa saja.
- [ ] AC5: Kalau nilai metrik ditampilkan, maka formatnya bisa dibaca mesin (Prometheus text atau JSON) dengan satuan eksplisit (ms untuk latency, USD untuk biaya), bukan hanya tabel HTML.

---

### Login lewat Hub (SSO)

**US-A31** — Sebagai **Maya**, gw mau bisa login ke Platform pakai akun Hub yang sama dengan app lain, supaya gw tidak bikin akun baru tiap produk.
Priority: Must · Est: L

- [ ] AC1: Kalau Hub aktif, saat Maya memilih "Login lewat Hub", dia masuk lewat Authorization Code flow dari Hub dan otentikasinya selaras bagian "Identitas bersama (Hub)" di 00-MASTER-PRD.md (angka/nilai kontrak tidak diulang di sini).
- [ ] AC2: Kalau user Hub belum pernah login ke Platform, saat login pertama berhasil, akun lokal dibuat/ditautkan secara just-in-time dengan pemetaan klaim `sub` Hub → user lokal; kalau email Hub cocok dengan user lokal yang sudah ada, akun itu **ditautkan**, bukan dibuatkan akun kedua.
- [ ] AC3: Kalau Hub sedang mati, saat Maya membuka halaman login, login email + password lokal tetap berhasil dan muncul notifikasi non-blocking bahwa login Hub tidak tersedia (bukan halaman error, bukan alur buntu).
- [ ] AC4: Kalau token Hub tidak valid, kadaluarsa, atau ditandatangani kunci asing, saat callback login diproses, server membalas 401 dan tidak ada sesi setengah jadi (tidak ada cookie sesi yang di-set, tidak ada user lokal baru yang dibuat).
- [ ] AC5: Kalau Hub merotasi kunci penandatangan, saat Maya login setelah rotasi, verifikasi tetap berhasil tanpa perlu restart app (app mengambil ulang kunci dari endpoint JWKS Hub dan menyimpannya di cache).
- [ ] AC6: Kalau dua login pertama dari user Hub yang sama datang hampir bersamaan, saat keduanya diproses, tepat satu user lokal yang terbentuk (dijamin constraint unik pada pemetaan `sub`/email), login kedua ditautkan ke user yang sama — bukan dua baris user.
- [ ] AC7: Kalau user Hub yang belum dikenal berhasil login, saat dia mengakses sumber daya milik sebuah workspace, server membalas 403 (bukan sekadar tombol yang disembunyikan) karena peran **tidak** diambil dari token; dia masuk dalam keadaan tanpa keanggotaan workspace dan tetap harus diundang atau membuat workspace sendiri.

---

### Rate Limiting

**US-A32** — Sebagai **Reza**, gw mau endpoint kirim form publik dan API dibatasi lajunya, supaya form publik tidak bisa dipakai spam dan jatah AI tidak dihabiskan satu akun.
Priority: Must · Est: M

- [ ] AC1: Kalau batas laju aktif per-IP dan per-token, saat permintaan kirim form publik atau API datang di dalam batas, permintaan diproses normal (tidak ada penolakan palsu pada trafik wajar).
- [ ] AC2: Kalau batas 10 kirim per menit per IP, saat permintaan ke-11 datang dalam jendela yang sama, server membalas 429 dengan header `Retry-After` berisi detik sisa, dan **tidak ada baris** yang ditulis untuk permintaan yang ditolak itu.
- [ ] AC3: Kalau permintaan ke-11 ditolak 429, saat jumlah baris di tabel data app dicek, jumlahnya tetap 10 — tidak ada baris setengah tertulis atau baris tersisa dari permintaan yang ditolak.
- [ ] AC4: Kalau app berjalan di 2 instance, saat 10 kiriman dikirim bergantian ke kedua instance dalam satu jendela waktu, permintaan ke-11 tetap ditolak 429 (penghitung disimpan di store bersama antarinstande, bukan di memori per-proses).
- [ ] AC5: Kalau admin mengubah batas dari 10 menjadi 50 lewat konfigurasi, saat konfigurasi disimpan, batas baru berlaku tanpa deploy ulang (batas dibaca dari konfigurasi, bukan konstanta di kode).
- [ ] AC6: Kalau jendela waktu sudah lewat, saat permintaan berikutnya datang, permintaan diterima normal lagi (blokir bersifat sementara, bukan permanen).

---

## 7. Functional Requirements (perilaku saja)

| ID | Requirement |
|---|---|
| FR-A01 | Semua respons API memakai bentuk konsisten `{ data, error }`. |
| FR-A02 | Semua endpoint data butuh sesi; tanpa sesi → 401. Batas: pengiriman data ke form publik adalah satu-satunya jalur tanpa sesi, dan hanya boleh "menulis", tidak bisa "membaca". |
| FR-A03 | Isolasi antartim ditegakkan di server pada setiap baca/tulis. |
| FR-A04 | Keluaran AI selalu diterima sebagai **usulan**, bukan perintah. Setiap keluaran divalidasi terhadap daftar tipe komponen yang sah sebelum disimpan. |
| FR-A05 | Aplikasi hasil AI tidak pernah otomatis dipublikasikan. |
| FR-A06 | Semua aksi builder (tambah/ubah/hapus/pindah) tercatat di riwayat undo dalam sesi. |
| FR-A07 | Ekspresi kondisi tidak boleh menjalankan kode arbitrer; hanya boleh membaca data masukan. |
| FR-A08 | Setiap eksekusi workflow menghasilkan catatan riwayat, termasuk yang gagal. |
| FR-A09 | Rahasia (kunci API sumber data) disimpan terenkripsi dan tidak dikembalikan ke klien. |
| FR-A10 | Token untuk pengiriman form publik berbeda dari kredensial akun dan hanya memberi hak "kirim". |
| FR-A11 | Setiap pemanggilan AI mencatat jumlah token untuk perhitungan biaya. |
| FR-A12 | Semua aksi destruktif (hapus aplikasi/halaman/komponen, cabut akses) tercatat dengan pelaku dan waktu. |
| FR-A13 | Validasi wajib-isi dan tipe data ditegakkan di server, tidak hanya di antarmuka. |
| FR-A14 | Semua teks UI berasal dari berkas terjemahan (kunci), tidak pernah ditulis langsung di komponen. Bahasa wajib: Inggris + Indonesia. |
| FR-A15 | Bahasa aktif ditentukan oleh: pilihan pengguna (tersimpan di profil/sesi) → `Accept-Language` → Inggris. Tidak pernah error karena bahasa tak dikenal. |
| FR-A16 | Label yang ditulis pengguna di dalam aplikasinya sendiri tidak pernah diterjemahkan otomatis; hanya teks milik Platform yang diterjemahkan. |

---

## 8. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-A01 | Editor builder terasa langsung: menambah/memindah komponen memberi umpan balik visual <100ms. |
| NFR-A02 | Generate aplikasi dari prompt selesai <60 detik (p95) untuk prompt panjang sedang; >60 detik dibatalkan. |
| NFR-A03 | Daftar data 5.000 baris: hasil pencarian <500ms (p95). |
| NFR-A04 | Eksekusi workflow dicatat dalam ≤5 detik setelah pemicunya terpicu (untuk pemicu form). |
| NFR-A05 | `docker compose up` dari mesin bersih → aplikasi jalan, bisa login, bisa membuat app dalam ≤10 menit. |
| NFR-A06 | HTTPS wajib di lingkungan live. |
| NFR-A07 | Password disimpan sebagai hash adaptif. |
| NFR-A08 | Setiap halaman builder memakai 4 keadaaan: loading (skeleton), kosong (petunjuk + aksi), error (pesan + coba lagi), terisi. |
| NFR-A09 | Aplikasi yang dipublikasikan tetap bisa dibuka pada perangkat mobile (form tetap enak dipakai). |
| NFR-A10 | Batas operasional yang menjaga biaya: maksimal 15 komponen/halaman, maksimal 5 halaman/aplikasi, panjang prompt maksimal, kuota AI harian. |
| NFR-A11 | Aksesibilitas dasar: kontrol builder bisa dijangkau keyboard, fokus terlihat, komponen bisa dipindah tanpa hanya mengandalkan tetikus (satu alternatif minimal). |
| NFR-A12 | Batas global pada kekuatan AI: tidak ada data pengguna yang dikirim ke penyedia model di luar teks prompt yang ditulis pengguna sendiri. |
| NFR-A13 | Cakupan terjemahan: 100% teks UI staf dan halaman form publik memakai kunci terjemahan; kedua bahasa lengkap sebelum rilis (diperiksa otomatis dengan membandingkan berkas terjemahan). |
| NFR-A14 | Angka dan tanggal mengikuti locale bahasa aktif (pemisah ribuan, format tanggal), bukan format kaku. |
| NFR-A15 | Menambah bahasa ketiga hanya berarti menambah berkas terjemahan + mendaftarkan locale; tidak ada perubahan kode komponen. |

---

## 9. Success Metrics

| # | Metric | Baseline | Target | Cara ukur |
|---|---|---|---|---|
| A-M1 | Prompt wajar (10 uji) menghasilkan aplikasi yang bisa dipakai tanpa perbaikan struktur | 0 | ≥8/10 | Uji manual terjadwal, hasil dicatat per prompt |
| A-M2 | Prompt cacat ditangani tanpa error 500 | 0 | 100% memberi pesan spesifik | Uji 10 prompt cacat (kosong, tipe tak dikenal, terlalu panjang, berisi perintah menyimpang) |
| A-M3 | Waktu dari buka editor sampai draft aplikasi muncul | tidak ada | ≤60 detik | Ukur 10 kali, ambil p95 |
| A-M4 | Biaya AI per generate aplikasi | tidak ada | <$0.05 | Jumlah token tercatat × harga model |
| A-M5 | Aksi builder berturutan (tambah 10 komponen + undo 10 kali) | tidak ada | 0 kesalahan keadaan, hasil kembali seperti semula | Test otomatis + uji manual |
| A-M6 | Eksekusi workflow pemicu form tercatat | tidak ada | 100% (tidak ada kehilangan) | Kirim 20 form uji, hitung riwayat |
| A-M7 | Test suite hijau | 0 | 100% di CI | Tab Actions |

---

## 10. Risks & Mitigations

| # | Risk | Mitigasi |
|---|---|---|
| R-A1 | AI menghasilkan kelinci di topi yang kelihatan "pintar" di 1 prompt tapi rapuh di 9 lainnya | Ukur A-M1 dengan 10 prompt tetap yang disimpan di repo sebagai himpunan uji; jangan menilai dari satu demo |
| R-A2 | Pengguna menaruh data pribadi ke form tanpa sadar | Dokumen kecil di halaman publish soal data; mode demo diberi data palsu |
| R-A3 | Builder drag & drop adalah bagian UI paling mudah menjadi rapuh (urutan, undo, penyimpanan) | Satu sumber kebenaran untuk urutan komponen + test undo/redo eksplisit |
| R-A4 | Biaya AI membengkak saat demo ramai | Cache 5 menit, batas komponen, model murah untuk form tambahan, kuota harian, log token |
| R-A5 | Ekspresi kondisi jadi celah keamanan | Bukan mesin evaluasi kode; hanya pembaca data masukan dengan daftar pembanding terbatas |
| R-A6 | Workflow berjalan dua kali untuk pemicu yang sama (dobel kirim karena percobaan ulang pemicu) | Idempotensi pada pemicu (simpan id kejadian) + uji dengan pengiriman pemicu ganda |
| R-A7 | Halaman publik dipakai untuk spam | Batas laju kirim per alamat IP + validasi wajib, dan tombol publikasi aplikasi bisa dimatikan dengan cepat |
| R-A8 | Lingkup melebar ke "codegen" atau "template marketplace" | Non-Goal NG1/NG2/NG3; catat sebagai `OPEN:` kalau muncul keinginan |
| R-A9 | Rate limit & SSO menyentuh jalur lintas-app: store penghitung bersama bisa bocor/terlalu ketat, dan dokumen SSO bisa basi kalau Hub berubah sementara app A sudah mengimplementasi | Batas laju dibaca dari konfigurasi + satu sumber angka (store bersama, bukan konstanta per-instance) dan diuji lintas 2 instance; kontrak SSO **hanya** di bagian "Identitas bersama (Hub)" di 00-MASTER-PRD.md (app A mengacu, tidak menyalin) sehingga perubahan Hub cukup diubah di satu tempat — diuji dengan skenario rotasi kunci JWKS |

---

## 11. Assumptions & Open Questions

```
ASSUMPTION: Klaim perbandingan harga/privasi di §1 diverifikasi ulang saat dipakai di README (dengan tanggal).
ASSUMPTION: Satu workspace per akun di MVP (multi-workspace tidak dibutuhkan).
ASSUMPTION: Data aplikasi disimpan sebagai baris JSON; tidak ada skema tabel khusus per aplikasi.
ASSUMPTION: AI yang dipakai bisa diganti (adapter), sehingga biaya/model bisa ditukar tanpa mengubah domain logic.
ASSUMPTION: Mode demo publik memakai kuota AI terbatas dan itu diterima sebagai kompromi demo.
```

```
OPEN: Apakah perlu kemampuan ekspor data ke CSV di MVP?
      → Rekomendasi: tidak (Could). Nilai cerita produk rendah, kerja tambahan nyata.
OPEN: Apakah aplikasi yang diarsipkan boleh dipulihkan tanpa batas waktu?
      → Rekomendasi: ya untuk MVP; penjadwalan pembersihan permanen ditunda.
OPEN: Berapa kuota AI harian untuk akun demo publik?
      → Rekomendasi: mulai kecil (mis. 20 generate/hari) dan dinaikkan hanya kalau perlu; dicatat sebagai angka konfigurasi.
OPEN: Perlukah "progres bertahap" (streaming) di MVP atau setelahnya?
      → Rekomendasi: setelah (Should). Manfaat besar untuk persepsi kecepatan, tapi menambah jalur kesalahan (batal, sambungan putus).
OPEN: Apakah kolom/komponen bersarang masuk MVP?
      → Rekomendasi: tunda ke v1. Struktur bersarang membuat undo, validasi, dan render jauh lebih rumit.
```

> **Diputuskan (2026-09-10): Bahasa UI = bilingual EN/ID.** Satu app dengan lapisan terjemahan (kunci i18n), bukan dua build terpisah. Default Inggris, pemilih bahasa tersimpan, deteksi `Accept-Language`, fallback ke Inggris. **Penting:** label yang ditulis pengguna di dalam aplikasinya sendiri tidak diterjemahkan otomatis. Lihat US-A27, FR-A14..A16, NFR-A13..A15.

---

## 12. Release Plan & Exit Criteria

| Milestone | Isi | Exit criteria |
|---|---|---|
| **A0** | Fondasi: skema, auth, peran, layout aplikasi, Docker Compose | Register + login + isolasi antartim terverifikasi (uji lintas tim ditolak); skeleton test hijau di CI |
| **A1** | Aplikasi + builder: US-A05..A13 | Semua AC Must terverifikasi; undo/redo lolos uji; **deploy publik pertama** |
| **A2** | AI generator: US-A14..A17 | ≥8/10 prompt uji lolos (A-M1); 100% prompt cacat memberi pesan spesifik (A-M2); token tercatat |
| **A3** | Data + form publik: US-A18..A19 | Kirim 20 data uji → semua tersimpan; validasi server terverifikasi; isolasi baca tetap terjaga |
| **A4** | Workflow: US-A20..A25 + sumber data A26 | Eksekusi pemicu form 100% tercatat; perilaku "saat gagal" terverifikasi ketiganya; uji coba tidak mengubah data nyata |
| **A5** | Etalase | Semua AC Must terverifikasi; test hijau; README + akun demo + himpunan prompt uji terdokumentasi |
| **A6** | Ops, hardening & SSO: US-A28 (duplikat halaman, Should), **US-A29 (health/ready)**, US-A30 (metrik, Should), **US-A31 (login Hub)**, **US-A32 (rate limiting)** | **US-A29** terverifikasi: DB/queue/storage mati → `/ready` balas 503 dengan komponen gagal disebut, respons tanpa rahasia dan tanpa cache · **US-A32** terverifikasi: kiriman ke-11 dalam jendela ditolak 429 dengan `Retry-After` dan **tidak ada baris** tertulis, limit tetap berlaku lintas 2 instance (store bersama) · **US-A31** terverifikasi: jalur Hub jalan selaras bagian "Identitas bersama (Hub)" di 00-MASTER-PRD.md, Hub mati → login lokal tetap jalan + notifikasi non-blocking, token invalid → 401 tanpa sesi setengah jadi, rotasi kunci JWKS tanpa restart, JIT provisioning idempoten (2 login bersamaan → 1 user lokal) · US-A28 duplikat kedalaman penuh + rollback saat gagal di tengah transaksi · US-A30 metrik tanpa PII di label |

**Definition of Done project A:**
1. Semua baris `Must` di §5 terimplementasi.
2. Semua AC `Must` di §6 terverifikasi dengan bukti (test otomatis atau langkah manual tercatat).
3. Himpunan uji 10 prompt wajar + 10 prompt cacat tersimpan di repo dan hasilnya terdokumentasi.
4. Test suite hijau di CI, badge di README.
5. Deploy publik + akun demo berfungsi, dengan kuota AI demo aktif.
6. Tidak ada jalur yang membuat aplikasi terpublikasi tanpa tindakan manusia.
7. README memuat: masalah, GIF demo (termasuk satu demo prompt cacat ditangani), cara pakai demo, bagian "bagian tersulit".
8. Setiap keputusan tunda tercatat sebagai `OPEN:` di §11.

---

## 13. Traceability ke Spec Arsitektur

| Story | Bagian spec |
|---|---|
| US-A01..A04 (auth, peran, undangan) | `organizations`, `users`, endpoint `/api/auth/*`, `/api/users/*`, middleware |
| US-A05..A08 (aplikasi) | `apps`, endpoint `/api/apps/*`, publikasi |
| US-A09..A13 (builder, halaman, undo/redo) | `pages`, `components`, `/api/pages/*`, `/api/components/*`, sistem undo/redo |
| US-A14..A17 (AI) | `/api/ai/*`, Pipeline AI Generator, manajemen biaya token |
| US-A18 (simpan data) | `app_data_rows`, `POST /api/apps/:id/data` |
| US-A19 (tabel data) | `GET /api/apps/:id/data`, tampilan Data |
| US-A20..A25 (workflow) | `workflows`, `workflow_steps`, `workflow_runs`, `cron_jobs`, Runner Engine, `/api/workflows/*` |
| US-A26 (sumber data) | `data_sources`, enkripsi AES-256-GCM, `/api/data-sources/*` |
| US-A28 (duplikat halaman, deep copy) | `pages`, `components`, `/api/pages/*` — deep copy komponen bersarang & route unik belum dibahas di spec |
| US-A29 (health/ready) | `A-platform.md` → "Ops, Hardening & SSO Hub" § Health & Readiness |
| US-A30 (metrik & observabilitas) | `A-platform.md` → "Ops, Hardening & SSO Hub" § Metrik Observabilitas |
| US-A31 (login lewat Hub / SSO) | `A-platform.md` → "Ops, Hardening & SSO Hub" § Login lewat Hub; tabel `hub_login_states`, kolom `users.hub_sub` |
| US-A32 (rate limiting) | `A-platform.md` → "Ops, Hardening & SSO Hub" § Rate Limiting |
| Keamanan & audit | RBAC + `activity_logs` |

---

*Kembali ke [00-MASTER-PRD.md](00-MASTER-PRD.md) · Lanjut ke [C-code-review-PRD.md](C-code-review-PRD.md)*
