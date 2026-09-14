# PRD — PROJECT C: AI Code Review Agent

| Field | Value |
|---|---|
| **Product** | Review — agen yang meninjau pull request otomatis |
| **Version** | 0.1 |
| **Status** | `draft` |
| **Owner** | Reza (solo dev) |
| **Date** | 2026-09-10 |
| **Master PRD** | [00-MASTER-PRD.md](00-MASTER-PRD.md) |
| **Architecture spec** | [C-code-review.md](C-code-review.md) — pipeline, aturan deteksi, format komentar, integrasi VCS ada di sana |
| **Design tokens** | [C-code-review-DESIGN.md](C-code-review-DESIGN.md) |

---

## 1. Problem Statement

Code review adalah gerbang kualitas yang paling sering jadi hambatan:

- Reviewer manusia kelelahan: pada PR yang ke-10 di hari yang sama, perhatian turun dan hal-hal yang berulang (variabel tidak terpakai, error yang tidak ditangani, kredensial yang ikut ter-commit) tetap lolos karena otak manusia cepat bosan pada pola yang sama.
- Waktu tunggu terasa mahal di tim kecil: satu orang reviewer untuk seluruh repo berarti PR bisa menunggu berjam-jam hanya untuk komentar "tolong tambahkan penanganan error di sini".
- Umpan balik tidak konsisten: hal yang sama ditegur di PR si A tapi dibiarkan di PR si B, tergantung jam dan mood.
- Hal yang paling berbahaya justru yang paling cepat terlewat: kredensial ter-commit, input pengguna yang langsung masuk ke query, ketiadaan batas pada loop yang membaca data eksternal.
- Developer pemula tidak punya tempat belajar yang jujur: dia ingin tahu **kenapa** barisnya salah, bukan hanya "changes requested".

Yang dirugikan: **Dimas** (solo dev yang tidak punya siapa-siapa untuk mereview), **tim kecil** (reviewer jadi bottleneck), **tim keamanan** (temuan berulang setiap sprint), dan **pembelajar** yang tidak mendapat penjelasan.

Catatan: ini juga alat untuk mereview repo A dan B sendiri — kalau agen ini tidak bisa menemukan masalah nyata di kode gw sendiri, berarti tidak berguna.

---

## 2. Goals & Non-Goals

### Goals

| ID | Goal |
|---|---|
| G1 | Setiap PR menerima tinjauan otomatis **tanpa membangunkan siapa pun**: komentar pertama (temuan pemeriksaan ringan) muncul ≤2 menit; tinjauan lengkap dengan ringkasan ≤5 menit. |
| G2 | Setiap temuan punya **lokasi, tingkat bahaya, alasan, dan saran perbaikan** — bukan "ini terlihat salah". |
| G3 | Bug keamanan yang jelas (kredensial ter-commit, kueri yang dirangkai dari string, rahasia yang ikut tercatat) **selalu** terdeteksi, bahkan saat model utama gagal. |
| G4 | Agung tidak boleh membuat komentar palsu: temuan yang tidak bisa dia tunjukkan lokasinya di diff tidak dikirim. |
| G5 | Keputusan akhir tetap milik manusia — tinjauan ini memberi saran, bukan gerbang yang memblokir. |
| G6 | Komentar membentuk pola yang bisa dipelajari pembaca (alasan + cara memperbaiki, dengan nada yang tidak menghakimi). |
| G7 | Biaya per tinjauan PR terkendali karena tidak semua berkas perlu dilihat AI. |

### Non-Goals

| ID | Bukan goal | Alasan |
|---|---|---|
| NG1 | Menggantikan reviewer manusia atau menilai siapa yang boleh merge | Penilaian itu butuh konteks yang tidak dimiliki agen |
| NG2 | Menulis patch dan mendorong commit sendiri | Berbahaya: komentar yang salah bisa berubah menjadi kode yang salah |
| NG3 | Mengeksekusi kode dari PR (menjalankan test/build dari kontribusi luar) | Risiko keamanan langsung (kode dari luar dieksekusi) — ini juga batasan platform, bukan hanya pilihan |
| NG4 | Memblokir merge otomatis (status check wajib) | Akan menghasilkan keluhan kalau ada salah temuan; biarkan manusia memutuskan |
| NG5 | Dukungan semua bahasa pemrograman; MVP fokus JS/TS + Python | Cakupan melebar sebelum mutu dasar terbukti |
| NG6 | Analisis lintas-repo / efek berantai antar berkas | Perlu pemahaman arsitektur yang jauh melebihi satu PR |
| NG7 | Membuat isu sendiri (mis. membuka tiket dari komentar) | Butuh keputusan produk terpisah |
| NG8 | Multi-tenant SaaS dengan billing | Dipakai untuk repo gw sendiri dan demo |
| NG9 | Chatbot tanya-jawab tentang kode | Fitur lain; fokus pada tinjauan PR |

---

## 3. Personas

### P1 — Dimas, "Solo Developer" (pemilik repo)
- **Konteks:** mengerjakan 3 repo sendiri. Tidak ada pasangan untuk membaca kodenya.
- **Job to be done:** tahu hal-hal yang dia lewatkan **sebelum** itu memalukan atau merugikan.
- **Workaround sekarang:** membaca ulang PR-nya sendiri (bias lemah: orang buta terhadap kesalahannya sendiri), atau merge dan berharap.
- **Sukses:** tinjauan muncul di PR sebelum dia merge, dan temuan yang dia setujui bisa dia perbaiki dengan satu kejelasan.

### P2 — Sari, "Tech Lead tim kecil" (pengguna repo tim)
- **Konteks:** reviewer utama untuk repo tim 6 orang. Waktu untuk tinjauan mendalam terbatas pada hal yang tidak berulang.
- **Job to be done:** mendelegasikan temuan dangkal ke mesin supaya energi dia dipakai untuk keputusan desain.
- **Sukses:** dia bisa mengabaikan komentar untuk hal yang tidak penting, dan fokus pada temuan yang menuntut pertimbangan.
- **Catatan penting:** kalau tinjauan berisik (banyak salah temuan), dia akan mengabaikan semuanya — kualitas lebih penting daripada jumlah.

### P3 — Maya, "Technical Recruiter" (reviewer portofolio)
- **Konteks:** sudah melihat agent demo yang cuma bisa "3 komentar generik" atau menghasilkan kewajiban-kewajiban yang tidak terbukti (mis. "variabel ini tidak dipakai" padahal jelas dipakai).
- **Job to be done:** memastikan ini punya gigi: berjalan di PR nyata, punya temuan nyata, punya bukti, dan tahu batasnya.
- **Sukses:** dia bisa membaca beberapa komentar nyata di repo dan melihat yang rapi: bukti lokasi, alasan, saran.

---

## 4. Core User Journeys

**J1 — Dimas membuka PR dan mendapat tinjauan (jalur utama):**
1. Dimas membuat PR di repo A dengan 3 berkas berubah.
2. Webhook sampai ke agen; agen memfilter berkas (berkas lock/vendor/generated dilewati, ukuran diff dibatasi).
3. Untuk setiap berkas yang lolos filter, agen menjalankan pemeriksaan ringan (deteksi pola kredensial, kueri dirangkai dari string, penanganan error kosong, dll).
4. Model AI dipanggil untuk berkas yang butuh penalaran; hasilnya disatukan dengan temuan pemeriksaan ringan, lalu dideduplikasi.
5. Temuan dengan lokasi yang tidak jelas dibuang.
6. Komentar dipasang di baris yang tepat, dengan tingkat bahaya dan saran perbaikan.
7. Ringkasan PR muncul berisi: jumlah temuan per tingkat, berkas mana yang paling perlu dilihat, dan pernyataan batas ("ini saran, bukan gerbang merge").

**J2 — Model AI gagal atau habis kuota (ketahanan):**
1. Panggilan AI gagal (waktu habis, kesalahan penyedia, atau batas biaya).
2. Agen tetap menyelesaikan tinjauan dengan pemeriksaan ringan saja.
3. Ringkasan menyatakan secara eksplisit bahwa analisis mendalam tidak tersedia untuk PR ini, dan menyebutkan alasannya.
4. Komentar keamanan yang jelas tetap muncul.

**J3 — PR berukuran besar (batas & transparansi):**
1. Sebuah PR mengubah 80 berkas.
2. Agen mengambil berkas paling berisiko dulu (berkas berisi kata kunci sensitif, berkas non-test, perubahan di jalur autentikasi), sampai batas jumlah berkas / token.
3. Ringkasan menyatakan berkas mana yang dilewati karena batas dan mengapa.
4. Tidak ada kegagalan senyap: kalau tidak sempat diperiksa, hal itu dinyatakan.

**J4 — Komentar harus terbukti (anti-halusinasi):**
1. Model mengembalikan temuan pada baris 120, padahal diff berkas itu hanya punya 40 baris.
2. Agen membuang temuan tersebut dan mencatatnya (terlihat di log internal), bukan memasang komentar di baris 40 dengan tebakan.

**J5 — Noise dikendalikan (belajar dari umpan balik):**
1. Sari menandai temuan "gaya penulisan" sebagai tidak membantu, berulang.
2. Aturan untuk tingkatan itu diredam (per aturan, bukan per orang) dan hasilnya tercatat.
3. Ringkasan tetap jujur: aturan apa yang aktif dan apa yang diredam.

---

## 5. Scope & Prioritas

| Area | Fitur | Prioritas |
|---|---|---|
| Pemicu | Webhook PR (dibuka/diperbarui) dari platform VCS | Must |
| Pemicu | Idempotensi: PR yang sama tidak dianalisis dua kali untuk revisi yang sama | Must |
| Filter | Lewati berkas lock, vendored, generated, biner, dan diff terlalu besar | Must |
| Filter | Urutkan berkas berdasarkan risiko, ambil sampai batas jatah | Must |
| Deteksi | Pemeriksaan ringan tanpa AI (kredensial ter-commit, kueri dirangkai string, error ditelan, dll) | Must |
| AI | Tinjauan per berkas dengan batas token dan alur JSON yang ketat | Must |
| AI | Penggabungan temuan pemeriksaan ringan + AI, deduplikasi | Must |
| AI | Pemulihan saat model gagal: tetap ada hasil, jujur soal bagian yang tidak dianalisis | Must |
| Komentar | Komentar di baris yang tepat (perubahan pada baris yang dikomentari) | Must |
| Komentar | Tingkat bahaya + alasan + saran perbaikan, dengan nada tidak menghakimi | Must |
| Komentar | Ringkasan PR sebagai satu komentar | Must |
| Komentar | Buang temuan yang lokasinya tidak valid di diff | Must |
| Komentar | Tidak pernah memasang komentar duplikat di PR yang sama | Must |
| Ringkasan | Menyebut berkas mana yang tidak dianalisis + cara menaikkan batas (biaya/waktu) | Should |
| Konfigurasi | Ambang temuan, aturan aktif, kuota biaya, bahasa output | Must |
| Konfigurasi | Daftar lewati/abaikan (path, pola) | Should |
| Konfigurasi | Redam per aturan berdasarkan umpan balik | Should |
| Observabilitas | Log biaya per PR, jumlah temuan per aturan, tingkat buang | Must |
| Observabilitas | Halaman riwayat tinjauan (Repos / PR List / PR Detail / Dashboard) | **Must** (MVP — lihat §12 keputusan 2026-09-12) |
| Dogfooding | Berjalan di repo A dan B dengan hasil nyata | Must |
| Evaluasi | Himpunan uji: diff contoh dengan temuan harapan | Must |
| i18n | UI dashboard EN/ID + templat komentar dua bahasa (pengaturan terpisah) | Must |
| SSO Hub | Login dashboard lewat Hub: Authorization Code + verifikasi JWT RS256 via JWKS publik Hub (cache + rotasi kunci) | Must |
| SSO Hub | Provisioning just-in-time: login Hub pertama membuat/menautkan akun lokal (email cocok → ditautkan, bukan akun kedua) | Must |
| SSO Hub | Akses repo tetap app-local (tidak diambil dari token Hub); bot tetap autentikasi lewat GitHub App, bukan SSO | Must |

---

## 6. User Stories & Acceptance Criteria

### Pemicu & Admissi

---

**US-C01** — Sebagai **Dimas**, gw mau PR gw otomatis ditinjau saat dibuka, supaya gw tidak perlu memanggil apa pun.
Priority: Must · Est: M

- [ ] AC1: Kalau PR baru dibuka pada repo yang terhubung, saat webhook diterima, satu catatan tinjauan dibuat dengan status `berjalan`.
- [ ] AC2: Kalau webhook dengan tanda tangan tidak valid, maka ditolak (401) dan tidak ada tinjauan yang dibuat.
- [ ] AC3: Kalau PR yang sama diperbarui 5 kali dalam 2 menit, maka hanya tinjauan untuk revisi terakhir yang dikerjakan (revisi sebelumnya dibatalkan/ditandai usang).
- [ ] AC4: Kalau PR yang sama diproses dua kali karena percobaan ulang webhook, maka komentar tidak terpasang ganda (idempotensi berdasarkan (repo, PR, revisi, aturan)).
- [ ] AC5: Kalau repo dinonaktifkan, maka webhook-nya ditolak dengan pesan yang jelas dan tidak ada tinjauan baru.

---

**US-C02** — Sebagai **Reza**, gw mau tinjauan hanya menghabiskan biaya pada berkas yang layak, supaya biaya per PR terkendali.
Priority: Must · Est: M

- [ ] AC1: Kalau PR mengubah `package-lock.json`, sebuah berkas minified, dan 3 berkas sumber, maka hanya berkas sumber yang dianalisis AI; berkas sisanya dicatat sebagai dilewati.
- [ ] AC2: Kalau diff satu berkas melebihi batas (mis. 1.200 baris perubahan), maka berkas itu dilewati AI dengan catatan alasan, dan pemeriksaan ringan tetap dijalankan pada berkas itu.
- [ ] AC3: Kalau PR mengubah 80 berkas, maka jumlah berkas yang dianalisis AI ≤ batas jatah, dipilih berdasarkan skor risiko (bukan urutan abjad), dan ringkasan menyebutkan mana yang dilewati.
- [ ] AC4: Kalau semua berkas dilewati, maka ringkasan tetap dibuat dan menyatakan bahwa tidak ada berkas yang layak dianalisis.
- [ ] AC5: Kalau konfigurasi pola lewati diisi `docs/**`, maka berkas di bawah `docs/` tidak pernah dianalisis AI.

---

### Deteksi

---

**US-C03** — Sebagai **Sari**, gw mau masalah keamanan yang jelas selalu terdeteksi, supaya tidak bergantung pada model AI.
Priority: Must · Est: M

- [ ] AC1: Kalau diff berisi kunci API (pola `sk-...`, `AKIA...`, atau string acak panjang bernama `*_KEY`), maka satu temuan tingkat `critical` muncul dengan lokasi baris itu, **tanpa** memanggil AI.
- [ ] AC2: Kalau diff berisi kueri yang dirangkai dari potongan string dengan variabel masukan, maka temuan `critical` muncul untuk pola itu.
- [ ] AC3: Kalau diff berisi blok `catch {}` kosong atau error yang ditelan tanpa catatan, maka muncul temuan berkategori `warning` (kategori, BUKAN tingkat — tingkatnya salah satu dari `critical`/`high`/`medium`/`low`).
- [ ] AC4: Kalau pola rahasia muncul di berkas uji yang jelas (mis. `fixtures/`), maka temuan diberi kategori `info` dengan catatan "data uji, verifikasi" (bukan `critical` palsu).
- [ ] AC5: Kalau pemeriksaan ringan berjalan, maka hasilnya sama saat AI mati (berdiri sendiri).

---

**US-C04** — Sebagai **Dimas**, gw mau AI menangkap hal yang tidak terbaca oleh pola, supaya tinjauannya berguna.
Priority: Must · Est: L

- [ ] AC1: Kalau diff berisi fungsi dengan loop yang membaca data eksternal tanpa batas, maka model mengembalikan temuan berupa JSON dengan `file`, `line`, `severity`, `reason`, `suggestion`.
- [ ] AC2: Kalau model mengembalikan JSON yang tidak bisa diparse, maka agen mencoba sekali lagi dengan pesan kesalahan disertakan; kalau tetap gagal, berkas itu ditandai "tidak dapat dianalisis" dan tinjauan tetap selesai.
- [ ] AC3: Kalau model mengembalikan `severity` di luar daftar yang sah (`critical`/`high`/`medium`/`low`), maka nilai itu dikoersi ke `low` dan ada catatan. (Nilai `info`/`warning` yang dikirim model masuk ke kolom `category`, bukan `severity`.)
- [ ] AC4: Kalau model mengembalikan `suggestion` kosong, maka komentar tetap dipasang tetapi saran diisi dengan kalimat penjelas minimal (tidak ada komentar kosong).
- [ ] AC5: Kalau model mengembalikan lebih dari 25 temuan untuk satu berkas, maka diambil 25 dengan bahaya tertinggi dan catatan pemotongan.
- [ ] AC6: Kalau diff berisi kode Python, maka analisis tetap benar (dukungan JS/TS + Python diverifikasi oleh himpunan uji).

---

**US-C05** — Sebagai **Maya**, gw mau tidak ada komentar palsu, supaya gw bisa mempercayai setiap komentar.
Priority: Must · Est: M

- [ ] AC1: Kalau model menyebut baris 120 sementara diff berkas itu hanya punya 40 baris, maka temuan itu dibuang dan tercatat di log sebagai dibuang (bukan dipasang perkiraan).
- [ ] AC2: Kalau model menyebut berkas yang tidak ada dalam daftar berkas yang dianalisis, maka temuan dibuang.
- [ ] AC3: Kalau temuan menyebut baris yang tidak termasuk baris yang berubah, maka komentar dipasang pada baris perubahan terdekat di berkas itu, atau dibuang kalau tidak ada — dan pilihannya tercatat.
- [ ] AC4: Kalau tingkat buang (temuan dibuang / temuan diusulkan) tercatat per tinjauan, maka nilainya tersedia di log observabilitas.

---

### Komentar & Ringkasan

---

**US-C06** — Sebagai **Dimas**, gw mau komentar menempel di baris yang benar, supaya gw tahu persis bagian mana yang dibicarakan.
Priority: Must · Est: M

- [ ] AC1: Kalau temuan pada baris 42 yang berubah, maka komentar dipasang pada baris 42 pada berkas yang tepat (bukan sebagai komentar umum di PR).
- [ ] AC2: Kalau satu baris punya 3 temuan, maka dipasang sebagai satu komentar berisi 3 poin (bukan 3 komentar terpisah).
- [ ] AC3: Kalau API platform menolak komentar pada baris itu, maka agen memakai fallback komentar berkas dan mencatat bahwa fallback terjadi.
- [ ] AC4: Kalau komentar terpasang, maka komentarnya tidak merusak format diff (tidak menempelkan kutipan berkas mentah ke PR).

---

**US-C07** — Sebagai **Sari**, gw mau setiap komentar menjelaskan alasannya, supaya orang belajar dari tinjauan.
Priority: Must · Est: M

- [ ] AC1: Kalau temuan `critical` soal kredensial, maka komentarnya menyebut: apa masalahnya, mengapa berbahaya, apa yang harus dilakukan.
- [ ] AC2: Kalau temuan apa pun, maka tidak ada kalimat kosong bernada menghakimi ("kode jelek", "kenapa kamu begini"); gunakan kalimat netral dan arahkan ke perbaikan (bisa diverifikasi dengan pemeriksaan kata terlarang).
- [ ] AC3: Kalau temuan sifatnya preferensi/gaya, maka tingkatnya maksimal `low` dan kategorinya `info`, dengan bahasa yang menyatakan sebagai saran ("pertimbangkan").
- [ ] AC4: Kalau temuan ditulis, maka bahasa output mengikuti konfigurasi (default Indonesia) dan konsisten dalam satu PR.

---

**US-C08** — Sebagai **Dimas**, gw mau satu ringkasan di PR, supaya gw tidak perlu membaca 30 komentar untuk tahu situasinya.
Priority: Must · Est: M

- [ ] AC1: Kalau tinjauan selesai dengan 5 temuan, maka ringkasan dipasang berisi: jumlah per tingkat, berkas yang paling perlu diperhatikan, dan pernyataan bahwa ini saran bukan gerbang merge.
- [ ] AC2: Kalau PR dibuat ulang/diperbarui, maka ringkasan lama diperbarui (satu ringkasan aktif per PR, bukan menumpuk).
- [ ] AC3: Kalau tinjauan selesai tanpa temuan, maka ringkasan tetap dipasang dan menyebutkan apa yang sudah diperiksa.
- [ ] AC4: Kalau berkas dilewati atau model gagal, maka ringkasan **wajib** menyebutkannya (tidak boleh terkesan bahwa semuanya sudah diperiksa).

---

### Ketahanan & Batas

---

**US-C09** — Sebagai **Reza**, gw mau agen tetap berguna saat AI gagal, supaya demo tidak mati.
Priority: Must · Est: M

- [ ] AC1: Kalau panggilan AI habis waktu atau gagal, maka tinjauan tetap selesai memakai pemeriksaan ringan dan komentar keamanan tetap muncul.
- [ ] AC2: Kalau kuota biaya per PR habis, maka sisa berkas dilewati dengan catatan di ringkasan.
- [ ] AC3: Kalau penyedia AI mengembalikan galat batas laju, maka agen mencoba ulang dengan jeda membesar (maksimal 3 kali), lalu melewati berkas itu dengan catatan.
- [ ] AC4: Kalau AI mati total, maka tinjauan tetap punya hasil (tidak ada satupun PR yang "gagal total" tanpa keluaran).
- [ ] AC5: Kalau kegagalan terjadi, maka alasan pastinya tercatat di log (bukan "terjadi kesalahan").

---

**US-C10** — Sebagai **Sari**, gw mau biaya per tinjauan tercatat, supaya tidak ada tagihan kejutan.
Priority: Must · Est: S

- [ ] AC1: Kalau satu PR dianalisis, maka jumlah token masuk/keluar dan perkiraan biaya tercatat per berkas dan per PR.
- [ ] AC2: Kalau batas biaya harian terlampaui, maka PR baru hanya mendapat pemeriksaan ringan dan ringkasannya menyatakan batas biaya tercapai.
- [ ] AC3: Kalau laporan biaya dibuka, maka bisa dilihat per repo dan per periode.

---

**US-C11** — Sebagai **Dimas**, gw mau mengatur agen tanpa mengubah kode, supaya bisa menyesuaikan dengan repo gw.
Priority: Must · Est: M

- [ ] AC1: Kalau berkas konfigurasi dengan daftar aturan aktif/nonaktif, saat dibaca, aturan yang dimatikan tidak muncul di komentar.
- [ ] AC2: Kalau ambang temuan diatur (mis. hanya `critical` + `high`), maka temuan berkategori `info` tidak dipasang sebagai komentar.
- [ ] AC3: Kalau temuan `info` tidak dipasang sebagai komentar, maka jumlahnya tetap ada di ringkasan (informasinya tidak hilang).
- [ ] AC4: Kalau konfigurasi tidak valid, maka agen berhenti dengan pesan yang menyebut baris bermasalah (bukan diam-diam memakai default).
- [ ] AC5: Kalau bahasa output diatur, maka semua komentar memakai bahasa itu.

---

### Evaluasi & Dogfooding

---

**US-C12** — Sebagai **Reza**, gw mau bisa mengukur mutu agen, supaya gw tahu perkembangannya bukan perasaan.
Priority: Must · Est: M

- [ ] AC1: Kalau himpunan uji berisi diff contoh dengan daftar temuan harapan, saat evaluasi dijalankan, dilaporkan: temuan yang benar terdeteksi (recall) dan temuan palsu (presisi) per aturan.
- [ ] AC2: Kalau himpunan uji dijalankan pada versi kode saat ini, maka hasil tertulis bisa dibandingkan antar waktu (bukan hanya angka di terminal).
- [ ] AC3: Kalau satu aturan menurun mutunya setelah perubahan, maka penurunan itu terlihat pada laporan evaluasi.
- [ ] AC4: Kalau himpunan uji memuat minimal satu contoh per aturan `Must`, maka tidak ada aturan tanpa uji.

---

**US-C13** — Sebagai **Maya**, gw mau bukti agen bekerja di repo nyata, supaya ini bukan demo mainan.
Priority: Must · Est: M

- [ ] AC1: Kalau agen dijalankan pada PR nyata di repo A atau B, maka komentar nyata terpasang dan bisa dibuka lewat tautan.
- [ ] AC2: Kalau README memuat minimal 3 contoh temuan nyata dari repo A/B (dengan tautan + tingkat + alasan), maka reviewer bisa memverifikasi sendiri.
- [ ] AC3: Kalau agen melewatkan sesuatu yang manusia temukan, maka hal itu tercatat secara jujur di bagian batasan README (bukan disembunyikan).
- [ ] AC4: Kalau agen dimatikan saat PR dibuat, maka PR tetap bisa merge (tidak menjadi gerbang wajib) — dibuktikan dengan status check-nya tidak wajib.

---

**US-C14** — Sebagai **Maya**, gw mau memakai dashboard C dalam bahasa Inggris sementara komentar di PR bisa berbahasa Indonesia, supaya tidak ada yang dipaksa satu bahasa.
Priority: Must · Est: M

- [ ] AC1: Kalau browser berbahasa Inggris, maka seluruh label dashboard tampil Inggris tanpa diatur dulu.
- [ ] AC2: Kalau Maya memilih Indonesia lewat pemilih bahasa di top bar (segmented control ID/EN), maka label dashboard berubah dan pilihannya bertahan — **terpisah** dari bahasa komentar PR.
- [ ] AC3: Kalau konfigurasi bahasa komentar diatur `id`, maka komentar di PR berbahasa Indonesia **meskipun** dashboard berbahasa Inggris — dua pengaturan ini terpisah, bukan satu.
- [ ] AC4: Kalau sebuah aturan punya templat komentar, maka templatnya ada untuk kedua bahasa dan dipilih sesuai konfigurasi; templat yang hilang tercatat (bukan komentar kosong).
- [ ] AC5: Kalau string UI belum diterjemahkan, maka yang tampil adalah bahasa Inggris, bukan layar kosong.
- [ ] AC6: Kalau evaluasi himpunan uji dijalankan, maka presisi dihitung terpisah per bahasa output supaya penurunan mutu di satu bahasa terlihat.

---

### Masuk lewat Hub (SSO)

---

**US-C15** — Sebagai **Dimas**, gw mau masuk dashboard C lewat Hub, supaya gw tidak bikin akun baru tiap pindah produk.
Priority: Must · Est: M

- [ ] AC1: Kalau pengguna belum login dan memilih "Masuk dengan Hub", saat Authorization Code ditukar jadi token, JWT RS256 diverifikasi memakai kunci dari endpoint JWKS publik Hub (selaras bagian "Identitas bersama (Hub)" di 00-MASTER-PRD.md) dan sesi dashboard dibuat.
- [ ] AC2: Kalau JWT dengan tanda tangan tidak valid, maka login ditolak (401), tidak ada sesi dibuat, dan kejadiannya tercatat di log tanpa nilai token.
- [ ] AC3: Kalau JWT yang `exp`-nya sudah lewat, maka login ditolak (401) dengan pesan "sesi Hub kedaluwarsa, masuk lagi" — bukan halaman kosong atau 500.
- [ ] AC4: Kalau klaim `iss` atau `aud` tidak cocok dengan yang diharapkan, maka login ditolak (401) meski tanda tangannya valid (verifikasi bukan cuma tanda tangan).
- [ ] AC5: Kalau Authorization Code yang sama dikirim dua kali (replay), maka percobaan kedua ditolak dan tetap hanya ada satu sesi aktif untuk pengguna itu.
- [ ] AC6: Kalau endpoint JWKS Hub tidak bisa dijangkau (Hub down) atau lambat, maka login Hub gagal dengan pesan jelas dalam ≤5 detik **dan** login email+password lokal tetap bisa dipakai (kemandirian app, bagian "Identitas bersama (Hub)" di 00-MASTER-PRD.md).
- [ ] AC7: Kalau Hub merotasi kunci JWKS, maka app tetap bisa memverifikasi token baru tanpa restart (kunci di-refresh dari cache), dibuktikan dengan satu login berhasil setelah rotasi.

---

**US-C16** — Sebagai **Reza**, gw mau akun C dibuat/ditautkan otomatis saat login Hub, supaya tidak ada akun ganda dan tidak ada data yang salah nyambung.
Priority: Must · Est: M

- [ ] AC1: Kalau login Hub pertama dengan email yang belum ada di C, maka tepat satu akun lokal dibuat dan ditautkan ke klaim `sub`, dan pemetaan `sub` → user lokal tercatat.
- [ ] AC2: Kalau email Hub cocok dengan user lokal yang sudah ada, maka akun itu yang ditautkan (bukan bikin akun kedua), dibuktikan jumlah baris `users` tidak bertambah.
- [ ] AC3: Kalau dua login Hub bersamaan untuk `sub` yang sama (dobel klik/dua tab), maka hanya satu akun lokal terbuat dan keduanya memakai akun yang sama (unique constraint pada `sub`).
- [ ] AC4: Kalau token Hub tidak membawa klaim email, maka provisioning ditolak dengan pesan yang jelas dan tidak ada akun setengah jadi.
- [ ] AC5: Kalau penautan gagal di tengah (mis. galat DB setelah akun dibuat), maka tidak ada user setengah jadi dan tidak ada penautan parsial — semuanya di dalam satu transaksi.
- [ ] AC6: Kalau pengguna Hub yang belum jadi anggota repo mana pun, maka dia masuk dalam keadaan tanpa akses repo; permintaan API repo darinya ditolak **403 di server**, bukan cuma tombol yang disembunyikan.

---

**US-C17** — Sebagai **Reza**, gw mau akses repo tetap milik app C dan bot tetap pakai GitHub App, supaya SSO tidak diam-diam jadi jalur izin.
Priority: Must · Est: S

- [ ] AC1: Kalau token Hub membawa klaim peran/scope apa pun, maka peran dan akses repo tetap diambil dari keanggotaan lokal di C, bukan dari token (selaras bagian "Identitas bersama (Hub)" di 00-MASTER-PRD.md).
- [ ] AC2: Kalau pengguna punya sesi Hub yang valid tapi bukan anggota repo X, saat memanggil endpoint repo X (`GET` maupun `POST`), server menolak **403** dan tidak mengembalikan data repo itu.
- [ ] AC3: Kalau bot C memproses webhook PR, maka bot autentikasi lewat GitHub App installation token, bukan SSO; menghapus/mencabut koneksi SSO Hub tidak menghentikan bot — dibuktikan bot tetap memasang komentar di PR.
- [ ] AC4: Kalau sesi Hub dicabut atau kedaluwarsa saat dashboard sedang terbuka, maka permintaan berikutnya ditolak **401** dan diarahkan ke login, bukan tetap menampilkan data.
- [ ] AC5: Kalau seluruh sistem Hub mati, maka dashboard C masih bisa dimasuki lewat login email+password lokal dan pipeline review tetap berjalan.
- [ ] AC6: Kalau Reza mencabut akses user ke app C dari halaman Users di Hub, saat user itu membuka halaman Pilih App, kartu C tampil disabled dan redirect-nya ditolak **403 di server**; akses repo individual di dalam C tetap ditentukan keanggotaan lokal C, bukan oleh toggle Hub (selaras US-M11 AC2).

---

## 7. Functional Requirements

| ID | Requirement |
|---|---|
| FR-C01 | Tinjauan bersifat idempoten terhadap (repo, PR, revisi): tidak ada komentar ganda untuk masukan yang sama. |
| FR-C02 | Setiap temuan wajib punya: berkas, baris, tingkat, alasan, saran. Kekurangan salah satu → temuan dibuang. |
| FR-C03 | Temuan yang lokasinya tidak ada di diff dibuang, tidak digeser ke baris terdekat tanpa catatan. |
| FR-C04 | Pemeriksaan ringan berjalan tanpa AI dan tetap menghasilkan keluaran. |
| FR-C05 | Kegagalan AI tidak menggagalkan seluruh tinjauan. |
| FR-C06 | Ringkasan wajib jujur soal berkas yang dilewati dan bagian yang tidak dianalisis. |
| FR-C07 | Tanda tangan webhook diverifikasi sebelum pemrosesan apa pun. |
| FR-C08 | Agen tidak pernah mengeksekusi kode dari PR; analisisnya statis/dinamis-atas-diff saja... `ASSUMPTION:` "dinamis" di sini maksudnya membaca diff, bukan menjalankan. |
| FR-C09 | Agen tidak pernah menulis kode atau commit ke repo (hanya komentar). |
| FR-C10 | Rahasia (token VCS, kunci penyedia AI) disimpan terenkripsi dan tidak pernah muncul di komentar atau log. |
| FR-C11 | Setiap aturan punya ID stabil; komentar menyebut ID aturan supaya bisa dirujuk. |
| FR-C12 | Riwayat tinjauan disimpan minimal: repo, PR, revisi, berkas yang dianalisis, temuan, biaya, status. |
| FR-C13 | Batas operasional: jumlah berkas per PR, baris diff per berkas, token per berkas, biaya per PR, temuan per berkas. |
| FR-C14 | Bahasa komentar mengikuti konfigurasi. |
| FR-C15 | Preferensi gaya tidak pernah melebihi tingkat `low` dan kategorinya `info`. |
| FR-C16 | Semua teks UI dashboard berasal dari berkas terjemahan (kunci); bahasa wajib: Inggris + Indonesia. Templat komentar dipilih dari bahasa yang dikonfigurasi, terpisah dari bahasa UI. |
| FR-C17 | Bahasa aktif UI ditentukan oleh: pilihan pengguna → `Accept-Language` → Inggris. Tidak pernah error karena bahasa tak dikenal. |

---

## 8. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-C01 | Komentar pertama (pemeriksaan ringan) muncul ≤2 menit setelah webhook diterima; tinjauan lengkap + ringkasan ≤5 menit, untuk PR berukuran sedang (≤10 berkas relevan). |
| NFR-C02 | Satu PR tidak pernah membuat seluruh agen berhenti: ada batas waktu per berkas dan batas waktu total. |
| NFR-C03 | Biaya AI per PR ≤$0.05 untuk PR berukuran sedang (selaras metrik M7 di master PRD). |
| NFR-C04 | Pemeriksaan ringan selesai <5 detik untuk diff ≤1.000 baris. |
| NFR-C05 | Tingkat buang temuan (dibuang/diusulkan) terpantau; kalau >30% itu tanda keluaran model perlu diperbaiki. |
| NFR-C06 | Rahasia tidak pernah masuk ke log (termasuk log galat). |
| NFR-C07 | `docker compose up` → agen jalan dan bisa dites dengan satu diff contoh dalam ≤10 menit. |
| NFR-C08 | Setiap berkas yang tidak dianalisis memakai AI punya alasan yang bisa dibaca manusia di ringkasan. |
| NFR-C09 | Analisis tidak memerlukan checkout penuh repo; cukup diff + berkas yang berkaitan. |
| NFR-C10 | Cakupan terjemahan: 100% teks UI dashboard memakai kunci terjemahan, dan templat komentar tersedia untuk kedua bahasa; diperiksa otomatis dengan membandingkan berkas terjemahan. |
| NFR-C11 | Angka, biaya, dan durasi mengikuti locale bahasa aktif, bukan format kaku. |
| NFR-C12 | Menambah bahasa ketiga hanya berarti menambah berkas terjemahan + templat komentar; tidak ada perubahan kode pipeline. |

---

## 9. Success Metrics

| # | Metric | Baseline | Target | Cara ukur |
|---|---|---|---|---|
| C-M1 | Recall temuan keamanan (dari himpunan uji) | 0 | 100% aturan `critical` | Evaluasi otomatis vs himpunan uji |
| C-M2 | Presisi (temuan dikonfirmasi berguna / total komentar) pada 3 PR nyata | 0 | ≥70% | Dinilai manual, dicatat; setiap komentar dinilai berguna/tidak |
| C-M3 | Waktu komentar pertama (pemeriksaan ringan) | tidak ada | ≤2 menit (p95) | Waktu webhook → komentar pertama, 10 PR |
| C-M4 | Biaya per PR | tidak ada | ≤$0.05 | Token tercatat × harga |
| C-M5 | Komentar palsu (lokasi tidak valid yang lolos) | tidak ada | 0 | Audit log pembuangan + uji anti-halusinasi |
| C-M6 | Ketahanan: PR yang gagal total saat AI mati | tidak ada | 0 | Matikan AI sengaja, jalankan 5 PR, hitung |
| C-M7 | Dogfooding: temuan nyata di repo A/B dengan tautan | 0 | ≥3 contoh terdokumentasi | Daftar di README |
| C-M8 | Test suite hijau | 0 | 100% | CI |

---

## 10. Risks & Mitigations

| # | Risk | Mitigasi |
|---|---|---|
| R-C1 | Komentar berisik membuat pengguna mengabaikan seluruh tinjauan | Presisi diutamakan daripada jumlah (C-M2); gaya maksimal `info`; redam per aturan berdasarkan umpan balik |
| R-C2 | Halusinasi: temuan pada baris/berkas yang tidak ada | Wajib validasi lokasi terhadap diff; buang kalau tidak ada (US-C05); uji khusus |
| R-C3 | Biaya AI membengkak pada PR besar | Filter + jatah berkas + batas token + pemakaian model murah untuk pemeriksaan dangkal |
| R-C4 | Kredensial masuk ke log agen sendiri | Penyaring rahasia sebelum logging; pengujian khusus dengan nilai rahasia dummy |
| R-C5 | Webhook dipalsukan atau diulang | Verifikasi tanda tangan + idempotensi (US-C01) |
| R-C6 | Model drift: hasil memburuk setelah pergantian model/versi | Himpunan uji sebagai penjaga (US-C12); evaluasi dijalankan sebelum mengganti model |
| R-C7 | Agenda melebar ke "menulis patch sendiri" | NG2 eksplisit; kalau muncul keinginan, catat sebagai `OPEN:` |
| R-C8 | Analisis hanya dangkal (menghasilkan "komentar generik") | Himpunan uji memuat kasus multi-berkas dan kasus penalaran; C-M7 membuktikan di repo nyata |
| R-C9 | Echo: komentar mengulang hal yang sudah ada di PR/CI | Deduplikasi terhadap komentar yang sudah ada di baris itu; lewati berkas hasil generate |
| R-C10 | SSO Hub jadi single point of failure / kunci JWKS tidak terjangkau saat login dashboard | Login email+password lokal tetap wajib jalan (US-C15, US-C17); kunci JWKS di-cache + rotasi tanpa restart; timeout ≤5 detik dengan pesan jelas; bot tidak lewat SSO sama sekali (GitHub App) |

---

## 11. Assumptions & Open Questions

```
ASSUMPTION: MVP berjalan untuk satu platform VCS (yang dipakai repo A/B) agar integrasi tidak melebar.
ASSUMPTION: Hasil tinjauan tidak memblokir merge; tidak ada status check wajib (NG4).
ASSUMPTION: Semua analisis atas diff, bukan atas tinjauan penuh repo.
ASSUMPTION: Model bisa diganti lewat adapter; pemilihan model adalah konfigurasi.
ASSUMPTION: Himpunan uji adalah sumber kebenaran untuk mutu, bukan kesan dari satu PR.
```

```
OPEN: Apakah komentar "gaya" perlu diadakan sama sekali di MVP?
      → Rekomendasi: ya, tapi hanya sebagai `info` dan bisa dimatikan total lewat konfigurasi.
OPEN: Perlukah agen berjalan ulang saat komentar/revisi baru muncul?
      → Rekomendasi: ya, dan ringkasan diperbarui (bukan ditambah).
OPEN: Bagaimana jika repo punya aturan gaya sendiri (ESLint dsb.)?
      → Rekomendasi: agen menghormati laporan CI yang ada dan tidak mengulang temuan yang sama; dicatat sebagai aturan deduplikasi.
OPEN: Apakah perlu menyimpan diff mentah di database?
      → Rekomendasi: tidak; simpan ringkasan + temuan saja (diff bisa diambil dari VCS lagi).
OPEN: Berapa lama riwayat tinjauan disimpan?
      → Rekomendasi: 90 hari, lalu diarsipkan.
Diputuskan (2026-09-12): dashboard/riwayat MASUK MVP — spec sudah membangun
      Repos + PR List + PR Detail + Dashboard (5 halaman terdesain). Baris `Could`
      di §5 dianggap usang; yang tetap v2 hanya auto-fix (NG2).
```

> **Diputuskan (2026-09-10): Bahasa = bilingual, dan dua pengaturan yang terpisah.** (1) Bahasa **UI dashboard** (EN/ID, default Inggris). (2) Bahasa **komentar di PR** (yang sudah ada di konfigurasi). Keduanya independen: dashboard bisa Inggris sementara komentar Indonesia. Lihat US-C14, FR-C16..C17, NFR-C10..C12.

---

## 12. Release Plan & Exit Criteria

| Milestone | Isi | Exit criteria |
|---|---|---|
| **C0** | Fondasi: webhook + verifikasi + penyimpanan riwayat + pemfilteran berkas | Webhook palsu ditolak; berkas lock/generated dilewati (terbukti); idempotensi lolos uji |
| **C1** | Pemeriksaan ringan tanpa AI (US-C03) | Aturan `critical` lolos himpunan uji; agen menghasilkan keluaran bermakna dengan AI dimatikan |
| **C2** | Analisis AI + penggabungan + komentar di baris (US-C04, C06) | Komentar menempel di baris yang tepat pada PR nyata; JSON cacat tidak menggagalkan tinjauan |
| **C3** | Anti-halusinasi + ringkasan + nada/format (US-C05, C07, C08) | 0 komentar dengan lokasi tidak valid di himpunan uji; ringkasan jujur soal berkas yang dilewati |
| **C4** | Ketahanan + konfigurasi + biaya + bilingual (US-C09, C10, C11, C14) | AI dimatikan → tinjauan tetap punya hasil; biaya tercatat per PR; label dashboard ikut bahasa terpilih dan bahasa komentar PR terpisah (US-C14) |
| **C5** | Evaluasi + dogfooding (US-C12, C13) | Laporan recall/presisi tersimpan; ≥3 contoh temuan nyata di repo A/B terdokumentasi di README |
| **C6** | SSO Hub: login dashboard, provisioning JIT, batas akses app-local (US-C15, C16, C17) | Login Hub lolos verifikasi JWKS (tanda tangan, `exp`, `iss`/`aud`); kunci dirotasi → login tetap jalan tanpa restart; email cocok → ditautkan bukan akun kedua (jumlah `users` tidak bertambah); non-anggota ditolak **403** di server; bot tetap pakai GitHub App walau Hub mati |

**Definition of Done project C:**
1. Semua baris `Must` di §5 terimplementasi.
2. Semua AC `Must` di §6 terverifikasi dengan bukti.
3. Himpunan uji (satu contoh per aturan `Must`) ada di repo dan evaluasi otomatis dijalankan di CI.
4. Recall aturan `critical` = 100%; 0 komentar dengan lokasi tidak valid.
5. Terbukti berjalan pada PR nyata di repo A dan B, dengan tautan komentar nyata di README.
6. README menyatakan batasan secara jujur (gap antara temuan manusia dan agen, minimal satu contoh).
7. Test suite hijau di CI + badge.
8. Setiap keputusan tunda tercatat sebagai `OPEN:` di §11.

---

## 13. Traceability ke Spec Arsitektur

| Story | Bagian spec |
|---|---|
| US-C01 (webhook, idempotensi) | Endpoint webhook, verifikasi tanda tangan, kunci idempotensi |
| US-C02 (filter & jatah berkas) | Pemfilteran diff, skor risiko berkas, batas baris/token |
| US-C03 (pemeriksaan ringan) | Aturan statis (kredensial, kueri dirangkai, error ditelan), daftar aturan |
| US-C04 (analisis AI, JSON ketat) | Pipeline analisis per berkas, skema keluaran, percobaan ulang, koersi tingkat |
| US-C05 (anti-halusinasi) | Validasi lokasi terhadap diff, log pembuangan |
| US-C06 (komentar di baris) | Pemasangan komentar, pengelompokan per baris, fallback komentar berkas |
| US-C07 (nada & isi) | Templat komentar, pemeriksaan kata terlarang, tingkat maksimum gaya |
| US-C08 (ringkasan) | Templat ringkasan, pembaruan ringkasan |
| US-C09 (ketahanan) | Penanganan galat penyedia, jeda membesar, lewati dengan catatan |
| US-C10 (biaya) | Pencatatan token/biaya, batas harian |
| US-C11 (konfigurasi) | Berkas konfigurasi, validasi konfigurasi |
| US-C12 (evaluasi) | Himpunan uji, pelaporan presisi/recall |
| US-C13 (dogfooding) | Pemakaian pada repo A/B, dokumentasi temuan nyata |
| US-C14 (bilingual) | `C-code-review.md` → i18n provider + `language-switcher.tsx`; setelan bahasa komentar di `repos.settings_json.output_language` |
| US-C15 (login Hub SSO) | `C-code-review.md` → "Ops & Login lewat Hub" § Login lewat Hub |
| US-C16 (provisioning JIT Hub) | `C-code-review.md` → "Ops & Login lewat Hub" § Login lewat Hub (langkah 4); kolom `users.hub_sub` |
| US-C17 (akses repo app-local + bot GitHub App) | `C-code-review.md` → "Ops & Login lewat Hub" § Batas: bot bukan jalur Hub |

---

*Kembali ke [00-MASTER-PRD.md](00-MASTER-PRD.md) · Sebelumnya [A-platform-PRD.md](A-platform-PRD.md)*
