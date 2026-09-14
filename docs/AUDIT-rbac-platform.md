# AUDIT — RBAC + isolasi tenant Platform (`apps/platform`)

- Card: `t_aae61d62` · **read-only**: nggak ada file di `apps/*/src` yang diubah
- Commit: `374149c` · Branch: `portico-suite/t_aae61d62-audit-rbac-isolasi-tenant-platform-audit`
- PRD yang dibaca dari file: `docs/A-platform-PRD.md` → **US-A04** (6 AC, baris 207–216), **US-A31** (7 AC, baris 533–542)
- Acuan kontrak Hub: `docs/00-MASTER-PRD.md` §5.1 (baris 120–150)

## Ringkasan (baca ini dulu)

| # | Temuan | AC | Parah |
|---|---|---|---|
| T1 | **16 method handler di 9 file route nggak punya filter `org_id`.** Admin workspace lain bisa baca + **tulis** data workspace X dengan nebak URL. Terbukti runtime, bukan cuma baca kode. | US-A04 AC6 | **Kritis** |
| T2 | **Endpoint kelola anggota nggak ada sama sekali** (`/api/orgs/*/members` → 404). AC2, AC3, AC4 nggak mungkin lulus karena fiturnya belum dibangun. | US-A04 AC2/AC3/AC4 | Tinggi (bukan bug, tapi gap fitur) |
| T3 | Log aktivitas cuma punya 1 penulis (`ai/generate-app`); perubahan peran nggak mungkin tercatat karena T2. Nggak ada endpoint pembaca log. | US-A04 AC3 | Sedang |
| T4 | **`HUB_CLIENT_ID` nggak ada di `.env`** — Platform baca nama env yang beda dari yang didefinisikan (`PLATFORM_CLIENT_ID`). `/api/auth/hub/start` → 500. | US-A31 AC1 | **Kritis (bloker AC1)** |
| T5 | **PKCE nggak nyambung**: Platform kirim `code_challenge_method=plain`, Hub cuma nerima `S256`. Alur nggak akan pernah selesai walau T4 dibetulin. | US-A31 AC1 | **Kritis** |
| T6 | Callback SSO semua jalur error pakai `NextResponse.redirect('/login?...')` — URL **relatif**. Next 15 ngelempar → **500**, bukan redirect. AC4 minta 401. | US-A31 AC4 | Tinggi |
| T7 | Hub mati: login lokal tetap jalan (bagus), tapi tombol "Masuk lewat Hub" tetap dirender tanpa notifikasi, dan klik-nya mendarat di **JSON 500** — persis "alur buntu" yang dilarang AC3. | US-A31 AC3 | Tinggi |
| T8 | JIT provisioning `SELECT` lalu `INSERT` tanpa `ON CONFLICT`. Dua login bareng → yang kedua kena `23505` → 500, dan organisasi yatim kemungkinan sudah keburu dibuat. | US-A31 AC6 | Tinggi |
| T9 | `verifyHubJwt` rekursi tanpa batas saat `kid` nggak dikenal → stack overflow, bukan retry sekali. | US-A31 AC5 | Sedang |
| T10 | `hub_login_states` nggak pernah dibersihkan; `expires_at` cuma dipakai saat consume. Tabel tumbuh terus. | — | Rendah |
| T11 | JIT penautan lewat email pakai `WHERE email = $1` — case-sensitive. `Maya@x.com` vs `maya@x.com` bikin akun kedua, yang AC2 larang. | US-A31 AC2 | Sedang (perlu cek manual) |

## Tabel lengkap 22 route handler (19 di `api/` + 3 operasional)

Kolom `org_id` = ada filter kepemilikan workspace di query SQL-nya, bukan cuma di `can()`.
`-` artinya handler-nya memang nggak menyentuh data milik satu workspace.

| Route | Method | Cek sesi | Cek peran (`can()`) | Filter `org_id` | Risiko |
|---|---|---|---|---|---|
| `api/apps` | GET | ya | — (semua peran) | **ya** `WHERE org_id=$1` | aman |
| `api/apps` | POST | ya | `['admin','builder']` | **ya** (insert `user.org_id`) | aman |
| `api/apps/[id]` | DELETE | ya | `['admin']` | **ya** (guard `SELECT ... AND org_id`) | aman |
| `api/apps/[id]` | PATCH | ya | `['builder']` | **ya** (guard `SELECT ... AND org_id`) | aman |
| `api/apps/[id]/pages` | GET | ya | — | **TIDAK** | **bocor baca** |
| `api/apps/[id]/pages` | POST | ya | `['builder']` | **TIDAK** | **bocor tulis** |
| `api/apps/[id]/data` | GET | ya | — | **TIDAK** | **bocor baca** |
| `api/apps/[id]/data` | POST | ya | `['builder']` | **TIDAK** | **bocor tulis** |
| `api/apps/[id]/publish` | POST | ya | `['admin']` | **TIDAK** | **bocor tulis** |
| `api/apps/[id]/workflows` | GET | ya | — | **TIDAK** | **bocor baca** |
| `api/apps/[id]/workflows` | POST | ya | `['builder']` | **TIDAK** | **bocor tulis** |
| `api/pages/[pageId]/components` | GET | ya | — | **TIDAK** | **bocor baca** |
| `api/pages/[pageId]/components` | POST | ya | `['builder']` | **TIDAK** | **bocor tulis** |
| `api/pages/[pageId]/duplicate` | POST | ya | `['builder']` + `org_id` eksplisit | **ya** | aman |
| `api/components/[id]` | PATCH | ya | `['builder']` | **TIDAK** | **bocor tulis** |
| `api/components/[id]` | DELETE | ya | `['builder']` | **TIDAK** | **bocor tulis** |
| `api/workflows/[id]/steps` | GET | ya | — | **TIDAK** | **bocor baca** |
| `api/workflows/[id]/steps` | POST | ya | `['builder']` | **TIDAK** | **bocor tulis** |
| `api/workflows/[id]/toggle` | PATCH | ya | `['builder']` | **TIDAK** | **bocor tulis** |
| `api/workflow-steps/[id]` | PATCH | ya | `['builder']` | **TIDAK** | **bocor tulis** |
| `api/workflow-steps/[id]` | DELETE | ya | `['builder']` | **TIDAK** | **bocor tulis** |
| `api/ai/generate-app` | POST | ya | `['builder']` | **ya** (pakai `user.org_id`) | aman |
| `api/auth/login` | POST | n/a | n/a | n/a | aman |
| `api/auth/register` | POST | n/a | n/a | n/a | aman |
| `api/auth/logout` | POST | n/a | n/a | n/a | aman |
| `api/auth/me` | GET | ya | — | — | aman |
| `api/auth/hub/start` | GET | n/a | n/a | n/a | **T4/T5** |
| `api/auth/hub/callback` | GET | n/a | n/a | n/a | **T6/T8/T9/T11** |
| `app/favicon.ico` | GET | n/a | n/a | n/a | aman (redirect statis ke `/icon.svg`) |
| `app/health` | GET | n/a | n/a | n/a | aman |
| `app/ready` | GET | n/a | n/a | n/a | aman |

### Endpoint yang bocor, diurut dari paling bahaya

1. **`api/apps/[id]/data` GET/POST** — baca + tulis **isi data** workspace X. Ini data pengguna, bukan metadata. Terbukti: 200 dengan 2 baris + `POST` 201.
2. **`api/pages/[pageId]/components` GET/POST** — baca + tulis definisi halaman/form workspace X.
3. **`api/components/[id]` PATCH/DELETE** — ubah atau **hapus** komponen workspace X.
4. **`api/apps/[id]/publish` POST** — admin workspace lain bisa **mematikan tautan publik** app workspace X (toggle).
5. **`api/apps/[id]/pages` GET/POST** — baca daftar halaman + sisipkan halaman baru.
6. **`api/apps/[id]/workflows` GET/POST** — baca + bikin otomatisasi di app workspace X.
7. **`api/workflows/[id]/steps` GET/POST**, **`workflows/[id]/toggle` PATCH**, **`workflow-steps/[id]` PATCH/DELETE** — baca, ubah, hapus, dan **aktifkan** otomatisasi workspace X.

Semua di atas lolos cuma dengan `can(user, [...])`: peran dicek, **kepemilikan tidak**. Admin workspace B secara definisi berperan `admin`, jadi `can()` selalu meloloskannya.

## Metode

1. Baca **semua** 22 route handler di `apps/platform/src/app/**/route.ts` (bukan sampel) — 19 di `api/`, 3 operasional.
2. Untuk tiap handler catat: cek sesi, cek peran (`can()`), dan **filter `org_id` di query SQL**.
3. Jalankan probe HTTP nyata (`$LOCALAPPDATA/Temp/audit-probe.cjs` dan `audit-probe2.cjs`) terhadap dev server dari worktree ini di port **3011**, dengan dua identitas: admin workspace B (dibuat lewat register) + viewer seed-org-1.
4. Fixture dibersihkan; DB dicek balik ke angka seed.

> Server 3001 yang sudah hidup di host ini **nggak punya `PLATFORM_DATABASE_URL`** (`/ready` → `database: down`, login → 500), jadi probe dijalankan di instance sendiri dari worktree. Probe pertama di 3001 menghasilkan 401/500 semua dan itu **bukan bukti apa pun** — dicatat di sini supaya nggak dikira temuan.

## Temuan per AC

### US-A04 AC6 — admin workspace Y menyentuh data workspace X → **GAGAL** (kritis)

Kutipan kode yang bikin bocor — semuanya **nggak ada `org_id`** di query-nya:

- `apps/platform/src/app/api/apps/[id]/pages/route.ts:14` — `SELECT id FROM apps WHERE id = $1` (tanpa `org_id`), lalu `:16` `SELECT * FROM pages WHERE app_id = $1`. Cuma `can(user, ['builder'])` di `:24`.
- `apps/platform/src/app/api/apps/[id]/data/route.ts:11` — `SELECT * FROM app_data_rows WHERE app_id = $1`. `:19` cuma `can(user, ['builder'])`.
- `apps/platform/src/app/api/apps/[id]/publish/route.ts:11` — `SELECT id, is_published FROM apps WHERE id = $1`; `:14` `UPDATE apps SET is_published = NOT is_published WHERE id = $1`.
- `apps/platform/src/app/api/apps/[id]/workflows/route.ts:17` — `SELECT * FROM workflows WHERE app_id = $1`.
- `apps/platform/src/app/api/pages/[pageId]/components/route.ts` — cek app lewat `page_id`, bukan lewat `apps.org_id`.
- `apps/platform/src/app/api/components/[id]/route.ts` — `WHERE id = $1` saja.
- `apps/platform/src/app/api/workflows/[id]/steps/route.ts`, `workflows/[id]/toggle/route.ts`, `workflow-steps/[id]/route.ts` — idem.

Bandingkan dengan yang **benar** (jadi pola perbaikannya sudah ada di repo):

- `apps/platform/src/app/api/apps/[id]/route.ts:11` — `SELECT id FROM apps WHERE id = $1 AND org_id = $2` → 404 kalau bukan miliknya.
- `apps/platform/src/app/api/pages/[pageId]/duplicate/route.ts:47-58` — join `apps a ON a.id = p.app_id`, ambil `a.org_id`, lalu `if (!can(user, ['builder']) || src.org_id !== user.org_id) return 403`.

**Bukti runtime** (probe #1, admin org B yang baru daftar, `org_id` beda dari `seed-org-1`):

```
PASS  US-A04 AC6  org-B admin GET /api/apps/app-1/pages       status=200 leaked_pages=3 names=["Home","Dashboard","Settings"]
PASS  US-A04 AC6  org-B admin GET /api/apps/app-1/data        status=200 leaked_rows=2 first={"name":"Bob","plan":"free","email":"bob@example.com"}
PASS  US-A04 AC6  org-B admin POST /api/apps/app-1/pages      status=201 new_page_id=e5e35303d9108dfa (row written into org X app)
PASS  US-A04 AC6  org-B admin POST /api/apps/app-1/publish    status=200 is_published=false (was true)
PASS  US-A04 AC6  org-B admin PATCH /api/components/<orgX>    status=200
```

(`PASS` di sini artinya "assertion AC6 terpenuhi oleh probe", bukan "AC6 lulus" — assertion-nya `status===200 && data kebaca`, jadi `PASS` = bocor.)

Probe #2, user baru **tanpa keanggotaan workspace mana pun** (persis skenario US-A31 AC7):

```
US-A31 AC7  GET   /api/apps/app-1/pages              status=200 -> LEAK
US-A31 AC7  GET   /api/apps/app-1/data               status=200 -> LEAK
US-A31 AC7  GET   /api/apps/app-1/workflows          status=200 -> LEAK
US-A31 AC7  GET   /api/pages/page-1/components       status=200 -> LEAK
US-A31 AC7  POST  /api/apps/app-1/publish            status=200 -> LEAK
US-A31 AC7  POST  /api/apps/app-1/data               status=201 -> LEAK
US-A31 AC7  POST  /api/apps/app-1/pages              status=201 -> LEAK
US-A31 AC7  PATCH /api/components/7262a9b8f9738fef   status=200 -> LEAK
US-A31 AC7  POST  /api/pages/page-1/duplicate        status=403 -> OK-403
US-A31 AC7  PATCH /api/apps/app-1                    status=404 -> other-404
```

Dua baris terakhir itu **kontrol positif**: `duplicate` dan `PATCH /api/apps/[id]` balas 403/404 karena memang punya guard `org_id`. Jadi bocornya bukan karena probe salah, tapi karena 8 handler lain nggak punya guard yang sama.

Catatan `PATCH /api/apps/app-1 → 404`: guard-nya benar (404, bukan 403) dan **nggak ada baris berubah** — aman.

### US-A04 AC1 — viewer ditolak **di server** → **LULUS** (perilaku; belum ada test yang meng-cite-nya)

Catatan penting: gate masih melaporkan `US-A04 PARTIAL AC 1/6` — **cuma AC5** yang punya test meng-cite-nya (`e2e.mjs: 'no session -> 401'`). AC1 di bawah ini **lulus perilakunya** menurut probe, tapi **belum ada assertion** di suite. Jadi perbaikannya bukan cuma guard `org_id`; AC1 juga butuh test yang bikin user non-admin.

`can()` di `apps/platform/src/lib/auth.ts:29-36` benar secara hierarki (`admin 3 ≥ builder 2 ≥ viewer 1`), dan 403-nya dari server, bukan tombol disembunyikan:

```
PASS  US-A04 AC1  viewer PATCH /api/apps/app-1   status=403 body={"error":"forbidden","message":"Akses ditolak."}
PASS  US-A04 AC1  viewer POST /api/apps          status=403
PASS  US-A04 AC1  viewer POST /api/apps/app-1/pages status=403
```

### US-A04 AC5 — tanpa sesi → 401 → **LULUS**

Semua endpoint data yang dicek balas 401 tanpa cookie. Handler tanpa `getSessionUser` cuma `login`/`register`/`logout`/`hub/*` — itu memang endpoint anonim.

```
PASS  US-A04 AC5  anon GET /api/apps                    status=401
PASS  US-A04 AC5  anon GET /api/apps/app-1/pages        status=401
PASS  US-A04 AC5  anon GET /api/apps/app-1/data         status=401
PASS  US-A04 AC5  anon GET /api/pages/page-1/components status=401
PASS  US-A04 AC5  anon GET /api/auth/me                 status=401
```

### US-A04 AC2, AC3, AC4 — **endpoint-nya nggak ada** (fitur belum dibangun)

Nggak ada route anggota/undangan/peran sama sekali:

```
find apps/platform/src/app/api -type d   → nggak ada .../members, nggak ada .../invites
grep -rn "activity_logs" apps/platform/src → cuma 1 hit, dan itu INSERT di ai/generate-app/route.ts:77
```

```
FAIL  US-A04 AC2  builder opens member settings  status=404 — endpoint tidak ada
FAIL  US-A04 AC3  admin changes a member role    status=404 — endpoint tidak ada
FAIL  US-A04 AC4  admin demotes self (last admin) status=404 — endpoint tidak ada
```

AC3 minta perubahan peran **tercatat di log aktivitas**; `activity_logs` cuma ditulis oleh `ai/generate-app`. Jadi AC3 gagal dua kali: endpoint-nya nggak ada, dan jalur pencatatannya juga belum ada. Ini **bukan bug isolasi** — ini fitur yang belum dibangun (US-A03 undangan juga `NO-TEST` di gate). Perlu card terpisah.

### US-A04 AC6 dan US-A31 AC7 itu satu akar yang sama

AC6 (admin org Y nyentuh app org X) dan AC7 (user Hub tanpa keanggotaan) dua-duanya gagal karena **alasan identik**: handler cek `can(user, [role])` tapi nggak pernah memverifikasi `app.org_id === user.org_id`. Satu perbaikan (guard kepemilikan di 16 handler / 9 file) menutup dua AC sekaligus.

## US-A31 (login lewat Hub) — 7 AC, semuanya belum terbukti

### T4 — **SSO-nya nggak bisa jalan sama sekali**: nama env var nggak nyambung (kritis)

`apps/platform/src/app/api/auth/hub/start/route.ts:15` baca `process.env.HUB_CLIENT_ID`. `.env` nggak punya variabel itu — yang ada `PLATFORM_CLIENT_ID` / `PLATFORM_CLIENT_SECRET` (`.env:27-28`), sedangkan Hub mendaftarkan client-nya sebagai `platform` (`apps/hub/scripts/seed.mjs:56`).

Konsekuensinya, live:

```
GET /api/auth/hub/start → 500 {"error":"misconfigured","message":"SSO Hub tidak dikonfigurasi."}
```

`AUTH_HUB_URL` juga sama: dibaca di `hub/start/route.ts:14` dan `hub/callback/route.ts:36,126`, tapi `.env` cuma punya `HUB_ISSUER=http://localhost:3100` (`.env:40`). Grep konfirmasi:

```
grep -rn "AUTH_HUB_URL" .env* apps/*/.env*   → nggak ada hasil (cuma kena source + .next build)
grep -oE "^[A-Z_]+=" .env                    → HUB_ISSUER ada, AUTH_HUB_URL nggak ada
```

Jadi AC1 (masuk lewat Authorization Code flow) **belum bisa dieksekusi sama sekali** di environment ini. Fallback `?? 'http://localhost:3100'` bikin `AUTH_HUB_URL` nggak kelihatan rusak, tapi `HUB_CLIENT_ID` nggak punya fallback → 500 telak.

### T5 — **PKCE nggak nyambung**: Platform kirim `plain`, Hub cuma nerima `S256`

- `apps/platform/src/app/api/auth/hub/start/route.ts:34-35` — `code_challenge: codeVerifier` (verifier mentah) + `code_challenge_method: 'plain'`.
- `apps/hub/src/app/authorize/route.ts:44-46` — `if (!codeChallenge || method !== 'S256') return html(400, 'PKCE wajib', ...)`.

Jadi walau T4 dibetulin, alur tetap berhenti di Hub dengan halaman 400. Ini temuan terpisah dari T4 dan harus dibetulin bareng — kalau cuma env yang diperbaiki, orang berikutnya bakal ngira SSO-nya masih rusak.

### T9 — `verifyHubJwt` rekursi tanpa batas saat `kid` nggak dikenal

`hub/callback/route.ts:60` panggil `verifyHubJwt(idToken)`, fungsinya di `:119-172`. Dua masalah:

1. `:135-140` — kalau `kid` nggak dikenal, dia set `jwksCache = null` lalu `return verifyHubJwt(token)` **tanpa penghitung**. Kunci asing → rekursi tanpa batas → stack overflow. AC5 minta rotasi kunci bikin verifikasi tetap jalan; yang ini malah crash kalau `kid`-nya nggak ketemu walau sekali. Perlu flag `retried`.
2. `:146` — `createPublicKey({ key: key.pem ?? key, format: key.pem ? 'pem' : 'jwk' })`. JWKS Hub (`apps/hub/src/lib/keys.ts:80-87`) mengembalikan JWK (`n`/`e`/`kid`/`alg`/`use`), jadi cabang `jwk` yang kepakai. Perlu diverifikasi manual apakah Node menerima JWK yang masih ada `alg`/`use`/`kid` — ini yang gw tandai **"perlu dicek manual"** karena gw nggak bisa jalanin tanpa Hub hidup.

### T6 — AC4 minta **401**, yang dikerjakan **302 ke /login** (dan 500 di kasus tertentu)

`hub/callback/route.ts:22,32,51,56,62` semuanya `NextResponse.redirect('/login?error=...')`. AC4 bilang "server membalas 401 dan tidak ada sesi setengah jadi".

Yang benar dari AC4: **nggak ada cookie sesi yang di-set** dan **nggak ada user lokal baru** — itu terpenuhi:

```
US-A31 AC4  callback (unknown state)  status=500 location=null session_cookie_set=0
```

Tapi statusnya **500**, bukan 401. Penyebabnya bukan tebakan — ini stack trace dari dev server:

```
Error: URL is malformed "/login?error=sso_invalid". Please use only absolute URLs
    at GET (src\app\api\auth\hub\callback\route.ts:32:25)
  [cause]: TypeError: Invalid URL
    code: 'ERR_INVALID_URL',
    input: '/login?error=sso_invalid'
 GET /api/auth/hub/callback?code=x&state=y 500 in 207ms
```

Jadi `NextResponse.redirect()` di Next 15 butuh URL absolut; semua jalur error (`:22,32,51,56,62`) kena masalah yang sama. AC4 gagal di dua titik: kode status salah (500/302, bukan 401), dan redirect-nya sendiri error.

### T7 — AC3 (Hub mati → notifikasi non-blocking) **belum ada UI-nya**

`apps/platform/src/app/login/page.tsx:47-52` merender link "Masuk lewat Hub" **tanpa syarat** — nggak ada fetch status Hub, nggak ada cabang notifikasi. Kalau Hub mati, user diklik ke `/api/auth/hub/start` → 500 JSON. Itu persis "halaman error" yang AC3 larang.

Login lokal sendiri **tetap jalan** (bagian yang gampang dari AC3 sudah benar):

```
PASS  US-A31 AC3  local login works while Hub is down  status=200
FAIL  US-A31 AC3  /api/auth/hub/start while Hub down   status=500 — JSON error, bukan notifikasi non-blocking
FAIL  US-A31 AC3  login page shows Hub-down notice     link dirender tanpa syarat, tidak ada teks notifikasi
```

### T8 — AC6 (JIT idempoten) **GAGAL**: constraint unik nggak nutup balapan

`hub/callback/route.ts:66-83` pola read-then-insert. `users.hub_sub` memang `UNIQUE` (`migrations/001_init.sql:18`), tapi kode nggak menangani `23505` — kalau dua login bersamaan, yang kedua **crash** dengan error DB, bukan "ditautkan ke user yang sama".

Lebih buruk: org dibikin **sebelum** insert user (`:74-81`), jadi yang kalah balapan ninggalin **organisasi yatim**. Bukti:

```
US-A31 AC6  race results=[{"ok":false,"code":"23505","orgCreated":"7abefad02795b9ae"},{"ok":true,"userId":"5b21cdc3a60e938c","orgCreated":"af42ba5113b8d3ef"}]
            users_with_sub=1 jit_orgs_left=2
```

`users_with_sub=1` (bagian "tepat satu user lokal" **lulus**), tapi `jit_orgs_left=2` — satu organisasi sampah per login yang kalah. Fix-nya: `INSERT ... ON CONFLICT (hub_sub) DO UPDATE ... RETURNING`, atau tangkap `23505` lalu `SELECT` ulang, dan bikin org **setelah** user menang.

### T11 — AC2 (tautan lewat email) belum diuji dan gampang salah

`:69` `SELECT * FROM users WHERE email = $1` — pencocokan email **case-sensitive**. `Maya@x.com` di Hub vs `maya@x.com` lokal → nggak ketemu → bikin akun kedua. AC2 melarang tepat hal itu. Ini **perlu dicek manual** (butuh Hub hidup), tapi kodenya jelas nggak menormalkan.

### Ringkasan US-A31

| AC | Verdict | Alasan |
|---|---|---|
| AC1 Authorization Code | **NO-TEST** | `HUB_CLIENT_ID` nggak ada → `/start` 500 (T4) |
| AC2 JIT + tautkan email | **NO-TEST** | belum jalan; `WHERE email=` case-sensitive (T9) |
| AC3 Hub mati, login lokal jalan | **PARTIAL** | login lokal jalan; notifikasi non-blocking nggak ada, `/start` 500 (T7) |
| AC4 token invalid → 401 | **GAGAL** | balas 500/302, bukan 401 (T6); sisi "tanpa sesi setengah jadi" benar |
| AC5 rotasi JWKS | **NO-TEST** | belum jalan; rekursi tanpa batas saat `kid` asing (T5) |
| AC6 JIT idempoten | **GAGAL** | kalah balapan → `23505` + org yatim (T8) |
| AC7 user Hub tanpa keanggotaan → 403 | **GAGAL** | 8 endpoint balas 200/201 (T1/T2) |

## T10 (rendah) — `hub_login_states` nggak pernah dibersihkan

`start/route.ts:24-28` selalu `INSERT`, `callback:27` cuma `DELETE` state yang dikonsumsi. Baris kedaluwarsa numpuk selamanya. Bukan masalah keamanan (state tetap single-use + TTL dicek), tapi tabelnya tumbuh tanpa batas. Perlu `DELETE ... WHERE expires_at < now()` berkala.

## Yang **bukan** temuan (biar nggak salah dibaca)

- `can()` hierarkis — benar, dan sudah menutup AC1.
- `apps/[id]` PATCH/DELETE punya guard `org_id` — benar, jadi kontrol positif di probe.
- `pages/[pageId]/duplicate` join `apps` dan cek `org_id` — benar, contoh pola yang harus ditiru 16 handler lain.
- Token Hub nggak bawa claim peran (`apps/hub/src/lib/tokens.ts:5-9`) — benar, sesuai §5.1 master PRD; peran diambil dari DB lokal, bukan dari token.
- `/health` dan `/ready` tanpa sesi — benar, itu endpoint operasional.

## Work-list untuk card perbaikan (siap dipakai)

Diurut dari paling bahaya. Tiap baris: file yang disentuh + assertion yang harus ditulis.

**Card 1 — guard kepemilikan `org_id` (menutup US-A04 AC6 + US-A31 AC7).**
Pola perbaikannya sudah ada di repo: `apps/[id]/route.ts:11` (`AND org_id = $2`) dan `pages/[pageId]/duplicate/route.ts:47-58` (join `apps`, bandingkan `org_id`). Terapkan ke **16 method handler di 9 file**:
`apps/[id]/pages` (GET+POST), `apps/[id]/data` (GET+POST), `apps/[id]/publish` (POST), `apps/[id]/workflows` (GET+POST), `pages/[pageId]/components` (GET+POST), `components/[id]` (PATCH+DELETE), `workflows/[id]/steps` (GET+POST), `workflows/[id]/toggle` (PATCH), `workflow-steps/[id]` (PATCH+DELETE).
Assertion: akun org B → **403** (atau 404), lalu **baca ulang DB** dan buktikan jumlah baris nggak berubah — bukan cuma cek status.

**Card 2 — perbaiki konfigurasi SSO (menutup T4 + T5).**
Samakan nama env: pakai `PLATFORM_CLIENT_ID`/`PLATFORM_CLIENT_SECRET`, atau tambah `HUB_CLIENT_ID`/`HUB_CLIENT_SECRET` di `.env`. Ubah `hub/start` ke PKCE `S256` (kirim `code_challenge = sha256(verifier)` base64url, `code_challenge_method='S256'`). Assertion: `/api/auth/hub/start` → 302 ke Hub (bukan 500), dan Hub balas 200 (bukan halaman "PKCE wajib").

**Card 3 — callback SSO yang benar (menutup T6 + T9 + T11).**
Ganti semua `NextResponse.redirect('/login?...')` jadi URL absolut. Balas **401** untuk token invalid/state invalid (AC4), bukan redirect. Tambah flag `retried` di `verifyHubJwt` supaya rekursi maksimal sekali. Normalkan email (`lower(email)`) saat mencocokkan. Assertion: callback tanpa parameter → **401**, `set-cookie` kosong, dan **0 user baru** di DB.

**Card 4 — JIT idempoten (menutup T8).**
`INSERT INTO users ... ON CONFLICT (hub_sub) DO UPDATE ... RETURNING`, atau tangkap `23505` lalu `SELECT` ulang. Bikin organisasi **sesudah** user berhasil dimasukkan. Assertion: 2 login bersamaan → **tepat 1 user**, dan **tepat 0 organisasi yatim**.

**Card 5 — notifikasi Hub mati (menutup T7).**
Login page fetch status Hub; kalau mati, tampilkan notifikasi non-blocking dan **jangan** arahkan ke `/api/auth/hub/start`. Assertion: Hub mati → login lokal 200, ada teks notifikasi di HTML, nggak ada JSON error ke user.

**Card 6 — endpoint anggota/undangan (menutup T2 + T3).** Ini **fitur belum dibangun**, bukan bug — US-A03 (undangan, 5 AC) juga masih `NO-TEST` di gate. Butuh card sendiri, jangan digabung ke card isolasi.

## Bukti

- Probe #1 `audit-probe.cjs` (cross-tenant + role + Hub-down), probe #2 `audit-probe2.cjs` (AC7 + AC4 + AC6 race). Keduanya di `$LOCALAPPDATA/Temp/`, cuma bikin fixture sementara lalu menghapusnya.
- Cleanup diverifikasi balik ke angka seed — `users=2 apps=2 orgs=1 pages=4 comps=1 rows=2 wfs=0`, `orgs: [seed-org-1]`, `users: [admin@seed.dev, builder@seed.dev]`.
- Instance probe: worktree ini, port **3011** (3001 sudah dipakai proses lain dan DB-nya mati; 3000 memang ditempati proses asing). Dev server probe sudah dimatikan setelah selesai.
- Gate: `python check_coverage.py --prd docs/A-platform-PRD.md --scan apps/platform/scripts` → `orphan-citations=0 unannotated-tests=0`. US-A04 dan US-A31 masih belum PASS karena card ini **read-only** — perbaikannya ada di 6 card di atas.




