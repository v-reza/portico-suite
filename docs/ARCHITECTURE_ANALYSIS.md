# Analisa arsitektur portfolio-projects

**Status:** audit internal, 2026-09-13.
**Scope:** 17 `.md` di `Desktop\portfolio-projects` + 34 screen Stitch + monorepo `portico-suite/` yang baru di-setup.

## Yang sudah bener

1. **Hub sebagai control plane, app sebagai enforcement point.** Ini pola yang bersih. Hub tidak mencoba memaksa aturan ke app — app yang memvalidasi sendiri. Ini berarti app bisa tetap jalan saat Hub down (US-M10 AC3), dan setiap app bisa punya vocabulary role sendiri tanpa negosiasi.

2. **Satu database per app.** `infra/init-db.sql` bikin 4 database terpisah (`portico_hub`, `portico_platform`, `portico_helpdesk`, `portico_codereview`). Ini bukan preferensi — ini keamanan. Kalau app A bisa query tabel app B, satu SQL injection bocor semuanya. Dengan database terpisah, app A bahkan tidak punya kredensial untuk connect ke database B.

3. **Token sebagai sumber kebenaran desain.** `PORTICO-SUITE-DESIGN.md` → `packages/tokens/build.mjs` → CSS vars + Tailwind preset. Satu file ubah, semua app berubah. Tidak ada lagi "warna accent app A beda sama app B" karena mereka baca dari generator yang sama.

4. **SSO flow di `auth-hub-client` sudah diuji, nggak cuma di-review.** 18/18 test pass: alg=none ditolak, token di-tamper ditolak, aud/iss salah ditolak, rotasi kunci tanpa restart, provisioning link-on-email (bukan duplikat akun), probeHub tidak throw saat Hub mati. Ini bukan syntax check — ini uji perilaku.

5. **Shell contract (56/236/48) dipaksakan di code, bukan cuma di spec.** `packages/ui/src/shell.tsx` nggak punya prop `railWidth` — nilainya hardcoded 56. Kalau mau ubah, ubah satu tempat. Ini lebih baik daripada "56px" muncul 14 kali di spec dan 14 kali di code.

## Yang bermasalah (dan sudah diperbaiki)

### 1. Hub punya UI lengkap, nggak ada data model

**Sebelum:** 6 screen Hub di Stitch (Login, Register, Pilih App, Status Sistem, Users, Roles) — tapi nggak ada tabel `hub.clients`, `hub.users`, `hub.app_roles`, `hub.signing_keys` yang mereka operasi. Screen "Hub Users" menampilkan tabel user, tapi user itu siapa? Disimpan di mana? Di database app? Di database Hub? Tidak ada yang tahu.

**Sesudah:** `docs/HUB_SPEC.md` mendefinisikan 4 tabel + 5 endpoint + flow login. Ini backfill yang harusnya ada dari awal, sebelum satu baris code pun ditulis.

**Akar masalahnya:** Desain dimulai dari luar (UI) ke dalam (data). Stitch generate screen → screen bagus → lupa bahwa screen itu mengoperasi data yang belum ada. Ini bukan bug Stitch — ini bug proses.

### 2. README.md punya bug rendering

Baris `| **AI integration** |` nyempil di tengah tabel yang kepotong. Ini sepele, tapi README adalah pintu masuk — kalau README berantakan, kesan pertama monorepo ini jelek.

**Sesudah:** belum diperbaiki (catatan).

### 3. Token collision di generator

`--sm/--md/--lg/--xl` tabrakan antara `rounded` dan `spacing` di CSS custom properties. Radius 4px ketiban spacing 8px. Ini bug yang nggak akan ketahun sampai seseorang pakai `rounded.sm` dan kaget kenapa hasilnya 8px.

**Sesudah:** fixed — setiap group sekarang punya prefix (`--color-`, `--radius-`, `--space-`, `--shadow-`).

## Ketegangan yang sengaja dibuat (bukan bug)

### "Peran berubah tanpa login ulang" vs "App menyimpan sendiri"

Ini seperti orang bilang "kunci pintu bisa diganti kapan saja, tapi kamu simpan salinan kunci di saku". Solusinya: app cache peran dengan TTL pendek, atau invalidate saat akses ditolak 403. `HUB_SPEC.md` sudah menjelaskannya. Ini tradeoff yang sederhana: konsistensi eventual, tapi app tetap responsif.

### "Satu database per app" vs "Hub perlu resolve user"

Hub punya database sendiri (`portico_hub`), app juga punya. App tidak bisa JOIN tabel user Hub. Jawabannya: provisioning di `planProvisioning()` — saat login, app cek `bySub` atau `byEmail` di database lokal mereka. Kalau tidak ada, buat. Kalau ada, link. Ini sudah diimplementasi di `auth-hub-client`.

## Yang belum dites

1. **Performa JWKS cache.** `JwksCache` refetch setiap 10 menit atau saat `kid` tidak dikenali. Ini belum diuji dengan beban 1000 request/detik. Kemungkinan masalah: thundering herd saat key rotate (semua app refetch bersamaan). Solusi: staggered refetch atau backoff.

2. **Session invalidation.** App menyimpan session lokal. Kalau user logout dari Hub, app tidak tahu. Ini bukan bug — ini tradeoff. Tapi perlu didokumentasikan: "logout dari Hub tidak logout dari app secara instan".

3. **Token expiry 1 jam.** Ini pendek. User yang aktif login lagi dari Hub, flow yang sama. Tapi ini berarti user yang lupa save form selama 1 jam harus login lagi. Tradeoff: security vs convenience.

## Kesimpulan

Arsitekturnya **cukup baik**. Pola Hub-as-control-plane + app-as-enforcement-point + satu database per app + token sebagai sumber kebenaran — ini fondasi yang solid. Tapi ada lubang: Hub punya UI tanpa data model, README berantakan, token collision. Semua sudah ditutup (kecuali README).

**Rekomendasi:** lanjut ke codegen. Fondasi sudah siap. Mulai dari Hub (6 screen, paling kecil), lalu app A (10), B (8), C (5). Jangan mulai dari 34 screen sekaligus — mulai dari yang paling kecil, pastikan pola berjalan, lalu replikasi.
