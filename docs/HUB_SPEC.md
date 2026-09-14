# Hub — data model & SSO contract

**Status:** backfill. 34 screen Hub ada di Stitch (UI-only), tabel dan endpoint yang mereka operasi belum dispesifikasi. File ini menutup celah itu sebelum codegen berjalan. Merujuk `00-MASTER-PRD.md §5.1`, `A-Platform.md §⚙️`, `DESIGN-GUIDE.md §2a`.

## Model data

Tiga tabel. Semua constraint ada di database (`infra/init-db.sql`); prisma schema mengikuti.

### `hub.clients` — app yang boleh minta token

| kolom | tipe | keterangan |
|---|---|---|
| `id` | text PK | client_id OAuth, format `portico_<app>` |
| `name` | text | "Platform" / "Helpdesk" / "Code Review" |
| `redirect_uris` | text[] | whitelist, exact match |
| `secret_hash` | text | bcrypt client_secret (tidak di-log) |
| `is_active` | boolean | nonaktifkan = login dari app itu ditolak |
| `created_at` | timestamptz | — |

Client pertama adalah `portico_hub` — Hub memakai dirinya sendiri untuk login antara-Hub (multi-tenant future).

### `hub.users` — akun yang bisa login

| kolom | tipe | keterangan |
|---|---|---|
| `id` | uuid PK | — |
| `email` | text UNIQUE | lowercase, verified sebelum akun aktif |
| `password_hash` | text | bcrypt (auth lokal) |
| `display_name` | text | — |
| `avatar_url` | text NULL | default: identicon dari email |
| `is_active` | boolean | — |
| `last_login_at` | timestamptz NULL | — |
| `created_at` | timestamptz | — |

### `hub.app_roles` — peran per app (bukan peran Hub)

| kolom | tipe | keterangan |
|---|---|---|
| `user_id` | uuid PK,FK→users | — |
| `app_id` | text PK,FK→clients | — |
| `role` | text | bebas per app: `owner` / `admin` / `editor` / `viewer` (Platform), `agent` / `supervisor` / `admin` (Helpdesk), `reviewer` / `lead` / `admin` (Code Review) |

Vocabulary sengaja **tidak diseragamkan** (`5.1`). Setiap app memvalidasi sendiri apakah role yang dibaca dari endpoint Hub ada di daftar yang mereka kenal.

### `hub.signing_keys` — private key RS256 untuk tanda tangan id_token

| kolom | tipe | keterangan |
|---|---|---|
| `kid` | text PK | v4 UUID, unik per putaran |
| `private_key_pem` | text | encrypted at rest |
| `public_jwk` | text NULL | kolom turunan, di-compute saat baca |
| `is_current` | boolean | hanya satu `true` per waktu |
| `created_at` | timestamptz | — |
| `retired_at` | timestamptz NULL | — |

Rotasi: key baru di-insert, `is_current=true` lama di-false, lama **diretire** (bukan dihapus) sampai token yang ditandatangannya expire. Cache JWKS app hanya perlu refetch saat `kid` tidak dikenali (sudah diimplementasi di `packages/auth-hub-client`).

## Endpoint publik

### `GET /.well-known/jwks.json` — JWKS, publik

```json
{ "keys": [ { "kty":"RSA","use":"sig","kid":"v4-uuid","alg":"RS256","n":"..","e":"AQAB" } ] }
```

Hanya key yang `is_current=true` atau `retired_at` belum lewat expire. Cache: `Cache-Control: max-age=600`.

### `GET /authorize` — mulai login

Query wajib: `response_type=code`, `client_id`, `redirect_uri`, `state`, `code_challenge`, `code_challenge_method=S256`.

- Session Hub tidak ada → render halaman login (email+password lokal, atau "Lanjutkan ke <app>" jika session lain masih valid).
- Credential valid → set `hub_session` cookie (httpOnly, SameSite=Lax), redirect ke `redirect_uri` dengan `code` + `state`.
- Client tidak dikenal atau `redirect_uri` tidak cocok → 400, tidak ada redirect.

### `POST /token` — tukar code dengan token

Body `application/x-www-form-urlencoded`: `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `client_secret`, `code_verifier`.

Verifikasi: `code` belum dipakai + belum expired (10 menit) + `code_challenge` cocok dengan S256 dari `verifier` + `redirect_uri` sama persis dengan saat `/authorize`.

Response:

```json
{
  "access_token": "...",
  "id_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

`id_token` adalah RS256 JWT dengan klaim: `sub`, `email`, `name`, `iss`, `aud`, `exp`, `nbf`. **Tidak ada klaim role** — lihat §5.1.

### `GET /api/session/resolve` — app polling peran

Authorization: `Bearer <access_token>`.

Mengembalikan status session + peran per app, sehingga app bisa menentukan apakah user boleh masuk, dan peran apa yang mereka pegang. App menyimpan hasil ini sendiri, buka lagi setiap request kritis, bukan baca dari token.

```json
{
  "user_id": "uuid",
  "email": "a@x.com",
  "apps": {
    "platform": { "allowed": true, "role": "admin" },
    "helpdesk": { "allowed": false },
    "codereview": { "allowed": true, "role": "reviewer" }
  }
}
```

Peran berubah tanpa login ulang (`US-M09 AC`) — ini caranya. App cache dengan TTL pendek, atau invalidate saat akses ditolak 403.

### `POST /logout` — hapus session Hub

Cookie `hub_session` dihapus, `code` yang belum dipakai dibatalkan. App tetap harus hapus session lokal mereka sendiri (Hub tidak mungkin menjangkau setiap app).

## Login flow (gambar sederhana)

```
User -> GET /authorize?client_id=platform&...
  Hub (no session) -> 200 halaman login
User -> POST email+password
  Hub -> verify bcrypt, set cookie, redirect 302
       -> redirect_uri=/api/auth/hub/callback?code=..&state=..
App -> POST /token (code + verifier)
  Hub -> issue id_token (RS256)
App -> verifyIdToken() + planProvisioning()
     -> create session lokal, redirect ke halaman utama
```

## Catatan keamanan

- `client_secret` tidak pernah dikirim ke browser — hanya di server-side app.
- `id_token` berisi `email` tapi bukan `role` — `role` ada di endpoint `/api/session/resolve`. Ini sengaja: kalau token bocor, penyerang cuma dapet identitas, bukan izin.
- Token expiry 1 jam, tanpa refresh token (simplicity over session longevity). User yang masih aktif login lagi dari Hub, flow yang sama.
- Cookie `hub_session`: `HttpOnly`, `Secure`, `SameSite=Lax`, domain `hub.localhost`.
