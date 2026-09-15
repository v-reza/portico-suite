# AUDIT — US-A32 Rate Limiting (Platform)

Card: `t_1a26a90c` · tanggal audit: 2026-09-14 · **direvisi: 2026-09-15 (run kedua card yang sama)**
sifat: **read-only** (nggak ada kode aplikasi yang diubah)

Verdict singkat: **belum ada kodenya, bukan cuma belum ada testnya.** 6 AC Must, semuanya NO-TEST.
`check_coverage.py` baris terakhir: `NO-TEST US-A32  [Must   ] AC 0/6`, `stories=32 NO-TEST=18 PARTIAL=14`,
`orphan-citations=0`.

> **Apa yang run kedua kerjain.** Run pertama (2026-09-14) nulis laporan ini tapi ke-block sebelum sempat
> `kanban_complete`. Run kedua **nggak nulis ulang analisisnya** — dia **memverifikasi ulang tiap klaim di
> sini** (grep, redis ping, schema, coverage gate: semua reproduce), lalu:
> 1. nandain **§4 yang basi** (3 dari 5 butir udah nggak berlaku — itu aktif nyasarin worker berikutnya), dan
> 2. **mutusin 3 blocker yang di run pertama digantung ke manusia** — lihat **§5**.
>
> Kalau lu baca ini sebagai worker implementasi: **mulai dari §5**, jangan dari §4.

---

## 1. Bukti mentah (output command apa adanya)

### E1 — grep inti, hasil kosong itu jawabannya

```
$ grep -rn "ratelimit\|rate_limit\|Retry-After" apps/platform/src
exit=1   (kosong)

$ grep -rn "429" apps/platform/src
exit=1   (kosong)

$ grep -rn "REDIS_URL\|redis" apps/platform --include=*.ts --include=*.mjs --include=*.mts
exit=1   (kosong)
```

### E2 — Redis hidup, dan bisa dijangkau pakai stdlib

```
$ docker exec portico-redis redis-cli ping
PONG

$ docker exec portico-redis redis-cli info server | head -2
redis_version:7.4.11

$ docker exec portico-redis redis-cli dbsize
0        <- store masih kosong, belum ada counter apa pun
```

Probe stdlib (`node:net`, RESP manual, pola yang sama dipakai `apps/hub/src/app/ready/route.ts:21`):

```
$ node audit-a32-probe.mjs        (throwaway, sudah dihapus)
REDIS_URL=redis://localhost:6379
"+PONG\r\n+OK\r\n:1\r\n:2\r\n:-1\r\n:2\r\n+OK\r\n"
```

Bacaan: PING→PONG, SET→OK, INCR→1, INCR→2, TTL→**-1**, DEL→2, QUIT→OK.
`TTL = -1` artinya key tanpa expire — ini yang bikin AC6 (jendela lewat → normal lagi) gagal kalau
implementasinya lupa `EXPIRE`. **Nggak butuh dependency `redis`/`ioredis`**: RESP-nya bisa ditulis
sendiri di atas `node:net`, dan repo ini sudah punya presedennya di `apps/hub`.

### E3 — schema `portico_platform`: nggak ada tempat config

```
$ docker exec ... psql -d portico_platform -c "select table_name from information_schema.tables where table_schema='public' order by 1;"
 _migrated | activity_logs | app_data_rows | apps | components | data_sources
 hub_login_states | organizations | pages | users | workflow_runs | workflow_steps | workflows
(13 rows)

$ ... -c "select table_name, column_name from information_schema.columns
          where table_schema='public' and (column_name ilike '%setting%' or column_name ilike '%config%'
             or column_name ilike '%limit%' or column_name ilike '%rate%') order by 1,2;"
 components     | config_json
 data_sources   | config_encrypted
 workflow_steps | config_json
 workflows      | config_json
(4 rows)
```

Nol kolom bertema setting/limit/rate. Empat kolom yang muncul itu `config_json` milik komponen/workflow
(isi spesifik entitas, bukan konfigurasi platform) dan `config_encrypted` (kredensial sumber data) —
**nggak ada satu pun yang bisa nampung "limit = 10/menit"** (AC5).

Cek DB lain biar nggak salah tuduh: `portico_hub` juga nol tabel bertema setting. `hub_clients` cuma
punya `id, name, redirect_uris, secret_hash, is_active, created_at`.

### E4 — test yang ada sekarang menghantam endpoint yang bakal dibatasi

```
$ grep -c "api/auth/login" apps/platform/scripts/{e2e,e2e-features,ui}.mjs
e2e.mjs: 2        e2e-features.mjs: 1        ui.mjs: 0 (tapi form submit 2x)

$ grep -n "ai/generate-app" apps/platform/scripts/e2e-features.mjs
174, 194, 202, 210, 220      <- 5 hit per run
```

Semua pakai email yang sama: `admin@seed.dev`. `e2e.mjs:37` sengaja login **gagal** 1x
(`password: 'wrongpassword'`), dan suite ini diminta dijalankan 2x.

---

## 2. Jawaban pertanyaan card

### Q1 — endpoint mana yang harus dibatasi?

**Temuan yang mengubah bentuk jawabannya: jalur "kirim form publik" belum ada di kode.**

```
$ find apps/platform/src/app -path "*public*"
(kosong)

$ grep -n "is_published" apps/platform/src/app/apps/\[id\]/page.tsx apps/platform/src/app/apps/page.tsx
(kosong)

$ grep -rn "getSessionUser" apps/platform/src/app/api | wc -l
35
```

`GET`/`POST /api/apps/:id/data` dua-duanya 401 tanpa sesi (`apps/platform/src/app/api/apps/[id]/data/route.ts:9,18`).
`apps/[id]/page.tsx:8` redirect ke `/login` kalau nggak ada sesi. Artinya US-A08 AC1/AC2/AC5 dan US-A18 AC1
(halaman publik + submit tanpa akun) **belum diimplementasi** — padahal US-A32 AC2/AC3 nyebut "kirim form publik"
dan "baris di tabel data app". Ini dependency yang harus diberesin dulu, bukan sesuatu yang bisa ditambal limiter.

Jadi pembagiannya:

| Prioritas | Path persis | Alasan | Kondisi |
|---|---|---|---|
| P0 — AC2/AC3 | `POST /api/apps/:id/data` | Satu-satunya jalur tulis data app yang ada hari ini. AC2/AC3 nge-assert "tidak ada baris tertulis" → bisa diuji **sekarang** tanpa nunggu halaman publik. | endpoint ada |
| P0 — AC2/AC3 | `POST /api/public/apps/:slug/submissions` | Jalur "kirim form publik" yang dimaksud AC. | **belum ada** — perlu card sendiri |
| P1 — AC1 "API" | seluruh `/api/*` yang ada sesi, per-token = `user.id` | AC1 minta batas per-token; token = identitas pemanggil. Titik masuk paling murah: satu helper yang dipanggil di awal handler, bukan middleware (belum ada `middleware.ts` di repo). | endpoint ada |
| P1 — US-A02 AC3 | `POST /api/auth/login` | AC terpisah: 5 gagal / 10 menit per email → blokir 15 menit. Sekarang **nol kode** (grep `failed\|attempt\|lockout\|blokir` di `apps/platform/src` cuma nemu `validation_failed` di generate-app). | endpoint ada |
| P2 — US-A17 AC4 | `POST /api/ai/generate-app` | AC1 bilang "API"; ini yang ngabisin jatah AI. Catatan: US-A17 sendiri masih NO-TEST, kuota harian juga belum ada (`grep quota\|kuota\|daily\|budget` → kosong). | endpoint ada |

**Rekomendasi gw: P0 = `/api/apps/:id/data` + helper generik. Card US-A32 bisa PASS tanpa nyentuh halaman publik**,
karena AC2/AC3/AC4/AC5/AC6 bisa diuji di endpoint itu. Jalur `POST /api/public/...` masuk card terpisah yang
jadi parent-nya.

Dua pertanyaan desain di bawah **sudah diputusin di §5 (B2)** — jangan digantung lagi sebagai pertanyaan
terbuka. Ringkasnya tetap ditulis di sini biar konteksnya kebaca berurutan:

1. **Kunci limiter.** `ip:<ip>` untuk request tanpa sesi, `tok:<user.id>` untuk request bersesi;
   untuk endpoint AI **dua-duanya** (per-IP DAN per-token, sesuai AC1 "per-IP dan per-token"). Kalau token
   dan IP dua-duanya kena, permintaan ke-11 ditolak oleh yang lebih dulu penuh — jangan di-`&&`, biar nggak
   ada dua permintaan yang saling nunggu. **(diputusin: §5 B2)**
2. **Sumber IP.** `grep x-forwarded-for\|remoteAddress` di `apps/platform/src` → kosong. Belum ada konvensi.
   Di belakang proxy (`PLATFORM_BASE_URL=http://localhost:3001`), `x-forwarded-for` bisa di-spoof klien.
   Baca `x-forwarded-for` **hanya** kalau `TRUST_PROXY=1`, kalau nggak pakai alamat socket; di dev/test
   `TRUST_PROXY=1` supaya test bisa nentuin IP sendiri (biar test bisa isolasi). **(diputusin: §5 B2)**

### Q2 — penyimpanan counter di mana?

**Redis, dan itu wajib, bukan pilihan.** AC4 eksplisit: "app berjalan di 2 instance … permintaan ke-11 tetap
ditolak 429 (penghitung disimpan di store bersama antarinstande, bukan di memori per-proses)".
In-memory Map di modul Next = per-proses → gagal AC4. `portico-redis` sudah hidup di 6379 dan `REDIS_URL`
sudah ada di `.env` root.

**Client Redis: belum ke-wire, dan nggak perlu nambah dependency.** `grep '"redis"\|ioredis\|@redis'` di
root + semua `package.json` workspace → nggak ada; `ls node_modules | grep -i redis` → nggak ada.
Preseden yang ada di repo ini: `apps/hub/src/app/ready/route.ts:21-49` bikin koneksi sendiri pakai
`node:net` dan nulis RESP mentah (`sock.write('PING\r\n')`). Probe E2 ngebuktiin pola yang sama cukup buat
`INCR` + `EXPIRE` + `TTL`.

Usul: `apps/platform/src/lib/ratelimit.ts`, satu koneksi lazy di `globalThis` (pola yang sama dengan
`lib/db.ts:3` buat pool), perintah: `INCR key` lalu `EXPIRE key windowSec` **hanya kalau hasil INCR = 1**,
lalu `TTL key` buat isi `Retry-After`. Atomic-nya dari `INCR` — nggak ada read-modify-write, jadi nggak ada
race (AC7-nya US-B33, tapi prinsipnya sama).

Catatan kegagalan: kalau Redis mati, jangan diam-diam lolos. Usul: **fail-open** (permintaan lanjut) tapi
`console.warn` — app harus tetap kepakai saat Redis down (semangat "Aturan kemandirian" §5.1 master PRD),
dan Redis yang mati kelihatan di `/ready`. Keputusan ini harus ditulis di kode, bukan di kepala.

### Q3 — konfigurasi vs hardcode (AC5)

Belum ada tabel/kolom yang bisa nampung. Usul schema, pilih satu:

**Opsi A (rekomendasi gw) — tabel `app_settings` di `portico_platform`:**
```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key        text PRIMARY KEY,
  value_json jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
```
Seed: `('rate_limit.submit', '{"limit":10,"windowSec":60}')`, `('rate_limit.api', ...)`,
`('rate_limit.login', '{"limit":5,"windowSec":600,"lockoutSec":900}')`.
Dibaca lewat helper `getLimit(key)` dengan cache TTL ~5 detik di `globalThis` (biar AC5 "berlaku tanpa
deploy ulang" jalan, tapi nggak nabrak DB tiap request). "Admin mengubah lewat konfigurasi" = `UPDATE`
baris itu. **Keunggulan: AC5 bisa diuji beneran** — ubah baris di DB, hit lagi, dan limit baru berlaku tanpa
restart. Ini yang gw rekomendasikan karena AC5 minta bukti yang bisa dijalankan.

**Opsi B — env (`RATE_LIMIT_SUBMIT=10/60`).** Lebih murah, tapi AC5 bilang "tanpa deploy ulang" — ubah env
di dev = restart proses, dan itu persis yang AC5 larang. Kalau mau Opsi B, harus ada endpoint admin yang
nulis ulang `.env`/state — sama ribetnya tapi lebih jelek.

**Opsi C — Hub sebagai control plane.** Master PRD §5.1 bilang Hub yang ngatur peran/akses lintas-app, dan
US-M11 nyebut "app-settings di Hub". Tapi Hub mati nggak boleh bikin app mati → app tetap butuh salinan
lokal, jadi tetap butuh tabel di `portico_platform`. Buang untuk card ini; kalau nanti US-M11 nambah
app-settings di Hub, `app_settings` lokal ini jadi salinan yang disinkronkan.

Catatan desain yang penting: **UI "Pengaturan Aplikasi" Stitch nggak punya kontrol rate limit.**
`platform_pengaturan_aplikasi_sumber_data/code.html` cuma punya *Batas Maksimal Bulanan* (token AI/bulan,
`id="monthly-limit"`) dan toggle "Hentikan generasi saat batas tercapai" — itu milik US-A17, bukan US-A32.
Jadi AC5 **nggak boleh** bikin kontrol UI baru di layar itu (card melarang nambah elemen yang design-nya
nggak punya). AC5 cukup dibuktikan di level konfigurasi (DB/env) lewat test.

### Q4 — bentuk respons

Helper yang ada: `jsonError(status, code, message)` di `apps/platform/src/lib/auth.ts:25-27`, bentuk
`{ error, message }`. **Belum ada helper yang bisa nyisipin header**, jadi butuh satu tambahan:

```ts
export function tooMany(retryAfterSec: number, message: string) {
  return NextResponse.json(
    { error: 'rate_limited', message, retryAfter: retryAfterSec },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec), 'Cache-Control': 'no-store' } },
  );
}
```

Detail yang gampang kelewat:
- `Retry-After` harus **detik sisa**, bukan panjang jendela. Ambil dari `TTL key` (Redis), jangan dari
  `windowSec` — kalau nggak, request ke-11 di detik ke-59 dapet `Retry-After: 60` padahal sisa 1 detik.
- `TTL = -1` (nggak ada expire) harus diperlakukan sebagai "jendela baru", bukan dibalas `Retry-After: -1`.
- **FR-A01** (`docs/A-platform-PRD.md:564`) bilang "semua respons API memakai bentuk konsisten `{ data, error }`"
  — kode sekarang pakai `{ error, message }` + payload bertema (`{ apps }`, `{ app }`). Ini drift yang udah ada
  sebelum card ini; gw **nggak** nyaranin ngerombak semua endpoint di card US-A32. Rekomendasi: ikut
  `jsonError` yang ada + tambah field `retryAfter` di body, dan catat drift FR-A01 sebagai card terpisah.
- Pesannya harus bisa dibaca manusia (AC1 US-B33) dan **jangan** bocorin kunci limiter (IP/token) ke body.

### Q5 — dampak ke test yang ada + cara isolasi

Yang kena:

| Suite | Hit | Kena limit apa | Kalau dibiarin |
|---|---|---|---|
| `e2e.mjs:37,41` | 2x `POST /api/auth/login`, 1 gagal | login 5 gagal/10 menit | aman di run ke-1; **run ke-2** masih 1 gagal (jendela 10 menit belum lewat) — masih di bawah 5, tapi ini yang paling mepet dan paling rapuh |
| `e2e-features.mjs:38` | 1x login | sama | aman |
| `e2e-features.mjs:174,194,202,210,220` | **5x `POST /api/ai/generate-app`** | kalau limit API 10/menit → aman 1 run, **2 run = 10, run ke-3 langsung 429** | ini yang paling gampang bikin suite merah |
| `ui.mjs:45,57` | 2x submit form login (1 gagal) | login | sama seperti e2e.mjs |
| semua suite | `POST /api/apps/:id/data` 1-2x | submit 10/menit | aman |

Isolasi yang gw usul (urut dari paling gw rekomendasiin):

1. **Namespace + reset counter di awal suite.** Kunci Redis dikasih prefix dari env
   (`RATE_LIMIT_PREFIX`, default `rl:platform:`). Tiap suite mulai dengan `DEL` semua key ber-prefix itu
   (atau `SCAN`+`DEL`), dan di akhir suite dibersihin lagi. Ini yang paling jujur: limit tetap 10 seperti
   produksi, yang diisolasi cuma *state*-nya. Butuh ~15 baris helper test.
2. **Limit longgar di test env.** `RATE_LIMIT_MULTIPLIER=100` yang dibaca cuma kalau
   `NODE_ENV !== 'production'`. Lebih simpel, tapi bikin AC2/AC3 nggak bisa diuji di suite normal (harus
   ada suite khusus yang naikin limitnya balik) — dan itu artinya jalur 429 nggak pernah kejaga CI.
3. Kombinasi: helper test yang bisa **set limit per-test** (tulis ke `app_settings`, hit, lalu balikin).
   Ini yang paling fleksibel buat AC2/AC3/AC5/AC6, tapi butuh Opsi A (Q3) dulu.

Rekomendasi final: **Opsi A (Q3) + isolasi #1**, ditambah suite baru `scripts/e2e-ratelimit.mjs` yang
sengaja naikin limit jadi 10, hit 11x, dan assert 429 + `Retry-After` + jumlah baris tetap 10.
Suite itu yang jadi bukti AC2/AC3/AC4/AC5/AC6.

---

## 3. Rencana implementasi (buat card implementasi berikutnya)

Semua file di `apps/platform` kecuali disebut lain.

1. `migrations/003_rate_limit.sql` — tabel `app_settings` + seed 3 kunci limit (lihat Q3 Opsi A).
2. `src/lib/ratelimit.ts` — klien Redis RESP di atas `node:net` (koneksi lazy di `globalThis`, pola
   `lib/db.ts`), fungsi `getLimit(key)`, `consume(key, limitCfg)` → `{ ok, retryAfter }`, dan `tooMany()`.
   Fail-open + warn kalau Redis mati.
3. `src/app/api/apps/[id]/data/route.ts` — panggil `consume()` di **awal handler, sebelum `INSERT`**
   (AC2: nggak ada baris tertulis untuk permintaan yang ditolak). Kalau ditolak → `tooMany()` dan `return`
   sebelum nyentuh DB.
4. Jalur `/api/public/apps/:slug/submissions` — **card terpisah** (endpoint-nya belum ada).
5. `POST /api/auth/login` — limiter 5 gagal/10 menit per email + blokir 15 menit → **card terpisah
   (US-A02 AC3)**, karena itu AC story lain; kalau digabung, card US-A32 nggak bisa "naik ke PASS" bersih.
6. `scripts/e2e-ratelimit.mjs` — suite bukti AC1..AC6 (naikin limit, hit 11x, cek `Retry-After`,
   hitung baris di `app_data_rows`, ubah limit lewat DB lalu hit lagi buat AC5, tunggu jendela lewat buat AC6).
7. `scripts/e2e.mjs` + `scripts/e2e-features.mjs` — tambah reset counter di awal, biar suite yang ada
   nggak rapuh saat dijalankan berulang.
8. `scripts/e2e-ratelimit-two-instance.mjs` (atau satu proses yang nembak 2 port) — **AC4 butuh 2 instance
   beneran.** Cara termurah: `next dev -p 3001` dan `next dev -p 3011` di dua background process dengan
   `PLATFORM_BASE_URL` beda, lalu 5 kiriman ke masing-masing dan kiriman ke-11 harus 429. Kalau cuma satu
   instance yang jalan, AC4 **nggak boleh** ditandai lulus — harus jujur NO-TEST/PARTIAL.

## 4. Risiko & prasyarat operasional

> **Revisi 2026-09-15 (run `t_1a26a90c` kedua).** Tiga dari lima butir di bawah **sudah nggak berlaku** dan
> butir yang salah itu aktif nyasarin worker berikutnya, jadi ditandai per butir. Yang masih berlaku tetap
> ditulis apa adanya.

- **AC4 butuh 2 instance jalan — SUDAH DIPUTUS (lihat §5 B1).** Jangan digantung lagi; keputusannya
  dan cara jalankannya ada di §5.
- **[BASI] "Worktree kosong" — jangan dipercaya lagi.** Butir aslinya bilang worktree `t_1a26a90c` dan
  `t_e95f6048` kosong dan card berikutnya perlu setup ulang. Run 2026-09-15 nemu `t_1a26a90c` **utuh**
  (semua `apps/`, `docs/`, `scripts/` ada, `git status` bersih, branch == master di `1594910`).
  **Metode yang bener, bukan state:** worktree `git worktree add` polos itu memang nggak punya
  `node_modules` / `.env` / `packages/tokens/dist` — itu normal, bukan "kosong", dan itu yang bikin
  `Cannot find module 'next'` atau `/login` 500. Jalanin `bash scripts/bootstrap-worktree.sh` dari root
  worktree (harus berakhir `bootstrap: ready`). Sebelum nuduh sesuatu hilang, `ls` dulu path-nya.
- **[BASI] `docs/stitch_output/` sekarang ADA di repo dan ter-track git.** Ada di
  `docs/stitch_output/stitch_portico_full_ui_set/<screen>/{code.html,screen.png}`. Nggak perlu nyari ke
  `Desktop\portfolio-projects\stitch_output\` lagi.
- **[BASI] `--critical-tint` sekarang ADA.** `docs/PORTICO-SUITE-DESIGN.md:31` mendefinisikan
  `critical-tint: "#fdecec"` dan `packages/tokens/dist/tokens.css` udah nge-emit var-nya. Diperbaiki di
  commit `d2daa26` (nilainya diambil dari `badge-danger.backgroundColor`, jadi nge-ekspor nilai design yang
  sudah ada — bukan bikin token baru). Jadi pesan 429 di UI boleh pakai `var(--critical-tint)`.
- **Drift FR-A01** (`{ data, error }` vs `{ error, message }`) — **masih berlaku**, lihat Q4. Card terpisah.

## 5. Keputusan atas 3 blocker (diputusin di sini, bukan dieskalasi)

Ketiga butir ini di run pertama ditulis "perlu diputusin SEBELUM nulis kode (bukan sama worker berikutnya)".
Semuanya bisa diputusin dari dokumen yang sudah ada di repo, dan card body secara eksplisit nyuruh
"self-improve, bukan eskalasi". Jadi diputusin di sini, **dengan sitasi**, biar card implementasi nggak
berhenti nanya lagi.

### B1 — AC4: dua instance beneran, bukan simulasi

**Keputusan: dua proses `next dev` terpisah** (`-p 3001` dan `-p 3011`), dua-duanya dari worktree ini,
dua-duanya `set -a && . ../../.env && set +a`. 5 kiriman bergantian ke masing-masing, kiriman ke-11 → 429.

Alasan: AC4 nulis *"Kalau app berjalan di 2 instance"* — dua koneksi Redis dari satu proses **bukan** yang
diminta AC, dan nggak membuktikan batas ditegakkan lintas proses. Kalau cuma satu instance yang bisa jalan,
AC4 **tetap NO-TEST/PARTIAL** — jangan ditandai lulus. Ini keputusan operasional (cara ngejalanin test),
bukan pertanyaan produk.

Jangan pakai port 3000: `netstat` nunjukin PID asing (2532) masih LISTENING di sana.

### B2 — Kunci limiter + sumber IP

**Keputusan:**

- Kunci `ip:<ip>` buat request **tanpa sesi**; `tok:<user.id>` buat request **bersesi**. Buat endpoint yang
  kena dua-duanya (AI), **konsumsi dua counter dan tolak dari yang lebih dulu penuh** — jangan `&&` yang
  bikin satu permintaan nunggu counter lain.
- `x-forwarded-for` **cuma dipercaya kalau `TRUST_PROXY=1`**; selain itu pakai alamat socket. Di dev/test
  `TRUST_PROXY=1` supaya test bisa nentuin IP sendiri (itu yang bikin suite bisa isolasi).

Alasan: AC1 nyebut eksplisit *"per-IP dan per-token"*, jadi dua kunci itu memang diminta, bukan pilihan gw.
Sumber IP belum ada konvensinya di repo (`grep -rn "x-forwarded-for" apps packages` → kosong), jadi ini
**bikin konvensi baru** — dan konvensinya harus aman: `x-forwarded-for` tanpa gate = klien bisa nge-spoof
kuncinya dan lolos limit sepenuhnya. Itu sebabnya gate `TRUST_PROXY` bukan opsional.

### B3 — Redis mati: fail-open, tapi kelihatan

**Keputusan: fail-open + `console.warn`, dan jangan diam-diam.** Permintaan tetap dilayani saat Redis mati,
tapi kejadiannya di-log (tanpa nulis IP/token mentah ke log — itu AC6-nya US-B33).

Alasan: master PRD §5.1 "Aturan kemandirian" — *"Hub mati tidak boleh membuat app A, B, atau C tidak bisa
dipakai"*. Prinsip yang sama berlaku buat store bersama: fail-closed bikin satu Redis mati = **semua**
endpoint berlimit mati total, yang lebih parah daripada sementara nggak ada limit. Tapi fail-open berarti
"nggak ada limit selama Redis mati", jadi itu wajib kelihatan — bukan pilihan diam.

Catatan: `apps/platform/src/app/ready/route.ts` **sekarang cuma nge-probe `db`** (nggak ada komponen
`redis`). Jadi visibility-nya belum ada; nambah komponen `redis` ke `/ready` itu ranah US-A29 (AC2-nya udah
minta status per komponen), bukan US-A32. Jangan digabung ke card US-A32.
