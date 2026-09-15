# AUDIT — Workflow Runner Platform (US-A20 / US-A21)

- Card: `t_f99491b6` · **read-only**: nggak ada file di `apps/*/src` yang diubah
- Commit dasar: `1594910` · Branch: `portico-suite/t_f99491b6-audit-workflow-runner-us-a20-a21-apa-yan`
- PRD yang dibaca dari FILE: `docs/A-platform-PRD.md` → **US-A20** (6 AC, baris 402–410), **US-A21** (5 AC, baris 414–421), plus US-A22..A25/A30 sebagai konteks ketergantungan
- Design ground truth yang dibaca utuh: `docs/stitch_output/stitch_portico_full_ui_set/platform_workflow_builder/code.html` (447 baris), `platform_workflow_runs/code.html` (610 baris), `platform_metrik/code.html` (379 baris)

## Ringkasan (baca ini dulu)

**Nggak ada workflow runner. Sama sekali.** Yang ada cuma CRUD baris tabel.

| # | Temuan | AC yang kena | Parah |
|---|---|---|---|
| T1 | **Nggak ada kode eksekusi.** `workflow_runs` punya 0 baris penulis, 0 baris pembaca di seluruh `apps/`, `packages/`. Runner Engine yang disebut PRD baris 696 nggak ada wujudnya. | US-A20 AC1/AC3/AC4/AC5, US-A21 AC1–AC5 | **Kritis** |
| T2 | **Nggak ada trigger.** Nol pemanggil. `form_submit` cuma string di `CHECK` constraint + whitelist. Nggak ada cron loop, nggak ada endpoint webhook, nggak ada form publik. | US-A20 AC1/AC3/AC4 | **Kritis** |
| T3 | **`POST /steps` balikin id yang salah** — `step.id` diisi variabel route param `id` (workflow id), padahal baris yang di-INSERT pakai `stepId` yang beda. Respons 201 bohong; klien yang percaya id itu nggak bisa PATCH/DELETE langkah yang barusan dia buat. | US-A21 AC1 | Tinggi (bug, bukan gap) |
| T4 | **Nggak ada tabel `workflow_run_steps`** → US-A25 AC2 ("per langkah: input, output, error") nggak punya tempat nyimpan. | US-A25 AC2, US-A21 AC3 | Tinggi |
| T5 | **Nggak ada reorder langkah.** `PATCH /api/workflow-steps/:id` cuma nerima `config_json` + `on_error`; `step_order` di-drop → 400 `no_changes`. | US-A21 AC4 | Tinggi |
| T6 | **Nggak ada failure path.** 0 `try/catch` di 4 file route workflow. Nggak ada retry, nggak ada dead-letter, nggak ada kolom `attempt`. | US-A23 AC1–AC3 | Tinggi |
| T7 | **`workflow_runs` ada tapi tanpa `run_steps`/`duration`/`cost`.** Kolom yang ada: `status, trigger_by, input_json, output_json, error, started_at, finished_at`. UI Stitch minta DURASI, LANGKAH n/m, BIAYA TOKEN — tiga-tiganya nggak punya kolom. | US-A25 AC1, US-A30 AC1 | Sedang |
| T8 | **UI workflow nggak ada.** `AppView` terima prop `workflows` terus di-`useState` tanpa pernah dirender — mati. Sidebar `Alur Kerja`/`Eksekusi` nggak punya `href`. | US-A20 AC2 (UI), US-A25 | Sedang |
| T9 | **`DELETE /api/workflow-steps/:id` nggak cek kepemilikan.** Hapus langkah workflow app siapa pun asal tahu id-nya. | US-A04 AC6 (lintas card) | Sedang |
| T10 | **`GET /api/workflows/:id` → 404.** Nggak ada route.ts di level `[id]`, padahal `[id]/steps` dan `[id]/toggle` ada. Detail workflow nggak bisa dibaca. | US-A25 AC2 | Rendah |
| T11 | **`.env` udah punya `METRICS_TOKEN`, tapi nol pembaca.** Nggak ada endpoint metrik sama sekali (`grep -rn METRICS_TOKEN apps/ packages/` → kosong). Jadi US-A30 AC4 ("dibatasi token bearer") udah ada bahannya, tinggal dipakai. | US-A30 AC4 | Rendah |

**Kesimpulan satu baris:** US-A20 dan US-A21 bukan "PARTIAL karena test kurang" — dua-duanya **belum dibangun**. Yang lulus di `e2e-features.mjs` cuma bikin baris + balik flag.

---

## 1. Apa yang beneran jalan sekarang?

Output command (dari root worktree):

```
$ find apps/platform/src -path '*workflow*' | sort
apps/platform/src/app/api/apps/[id]/workflows/route.ts
apps/platform/src/app/api/workflows/[id]/steps/route.ts
apps/platform/src/app/api/workflows/[id]/toggle/route.ts
apps/platform/src/app/api/workflow-steps/[id]/route.ts

$ grep -rn "workflow_runs\|run_id\|trigger_type" apps/platform/src | sort
… (10 baris, SEMUANYA soal kolom `trigger_type` di tabel `workflows`;
     nol baris nyebut `workflow_runs`, nol baris nyebut `run_id`)
```

Per file, satu per satu:

| File | Method | Isi | Logic eksekusi? |
|---|---|---|---|
| `api/apps/[id]/workflows/route.ts` | GET | `SELECT * FROM workflows WHERE app_id=$1` | — |
| | POST | validasi `trigger_type` ∈ whitelist → `INSERT INTO workflows` | **tidak** |
| `api/workflows/[id]/steps/route.ts` | GET | `SELECT * FROM workflow_steps WHERE workflow_id=$1` | — |
| | POST | validasi `action_type` ∈ whitelist → `INSERT INTO workflow_steps` | **tidak** |
| `api/workflows/[id]/toggle/route.ts` | PATCH | `UPDATE workflows SET active = NOT active` | **tidak** — cuma balik flag |
| `api/workflow-steps/[id]/route.ts` | DELETE | `DELETE FROM workflow_steps WHERE id=$1` | — |
| | PATCH | `UPDATE workflow_steps SET config_json/on_error` | **tidak** |

Nol dari empat file itu punya `try` (dicek dengan `grep -c try` → 0,0,0,0). Nol yang nyentuh `workflow_runs`.

**Toggle bukan eksekusi.** `PATCH /toggle` cuma `NOT active`. US-A20 AC5 ("kalau dinonaktifkan, saat pemicunya terjadi tidak ada eksekusi") nggak bisa dibuktikan karena pemicunya sendiri nggak ada — flag-nya nggak di-baca siapa pun. Buktinya:

```
$ grep -rn "active" apps/platform/src --include=*.ts --include=*.tsx | grep -v is_published
… cuma 3 baris yang nyentuh workflows.active, SEMUANYA di toggle/route.ts
  (SELECT id, active / UPDATE … NOT active / balikin !active).
  Nol pembaca. Sisa hasil grep itu `activePageId`/`active` prop sidebar — nggak nyambung.

$ grep -rniE "executeWorkflow|runWorkflow|runner|dead.?letter|retry|attempt" apps/platform/src
apps/platform/src/app/api/auth/hub/callback/route.ts:137:  // Key rotation — force a retry once
```

Satu-satunya hit "retry" di seluruh `apps/platform/src` ada di callback SSO Hub. Nol simbol runner.

---

## 2. Trigger: ada yang nge-fire nggak? Nggak ada.

Cara cek: `grep -rn "form_submit" apps/ packages/ docs/A-platform-PRD.md`. Hasilnya 5 baris:

```
apps/platform/migrations/002_features.sql:29:  trigger_type text NOT NULL CHECK(trigger_type IN ('form_submit','cron','webhook','button'))
apps/platform/scripts/e2e-features.mjs:126:  body: JSON.stringify({ name: 'Notify on submit', trigger_type: 'form_submit' })
apps/platform/src/app/api/ai/generate-app/route.ts:7:   const ALLOWED_TRIGGERS = new Set([...])
apps/platform/src/app/api/ai/generate-app/route.ts:169: trigger_type: 'form_submit'
apps/platform/src/app/api/apps/[id]/workflows/route.ts:6: const ALLOWED_TRIGGERS = new Set([...])
```

Empat dari lima adalah **deklarasi/whitelist**. Yang kelima cuma test yang bikin baris. **Nggak ada satu pun konsumen.** Nggak ada `setInterval`, nggak ada cron loop, nggak ada endpoint webhook, nggak ada route form publik (`/api/public/*` nggak ada — dicek dengan `grep -rn "public\|submit" apps/platform/src/app`).

Bukti runtime, bukan cuma baca kode — probe `apps/platform/scripts/_audit_trigger_probe.mjs` (read-only, bikin app → workflow → step → aktifkan → fire, lalu hapus):

```
login: 200
app created: 201 d0f6a5600e97b239
workflow created (form_submit): 201 81b16047c59227f4 active=false
step created (create_row): 201
workflow activated: 200 {"active":true}
POST /data (closest thing to form submit): 201
POST /api/workflows/:id/run (guessed endpoint): 404
GET  /api/workflows/:id/runs (guessed endpoint): 404
workflow_runs rows after firing trigger: 0
workflow_steps rows: 1
cleanup DELETE /api/apps/:id: 200
```

Workflow **aktif**, satu step terpasang, data masuk — **0 baris `workflow_runs`**. Itu US-A20 AC1 dalam bentuk paling langsung: gagal.

Probe kedua (`_audit_step_probe.mjs`) nambah dua temuan runtime:

```
workflow id      : 130c9e61bd5c2007
POST steps reply : {"step":{"id":"130c9e61bd5c2007","workflow_id":"130c9e61bd5c2007",...}}
returned step.id === workflow id ? true   ← T3
PATCH step {step_order:5} -> 400 {"error":"no_changes"}   ← T5
steps readback   : [{"id":"cdee124eda6c928e","order":0}]  ← id di DB beda dari yang dibalas
GET /api/workflows/:id -> 404   ← T10
anon POST /data  -> 401         ← nggak ada jalur form publik
```

Dua probe itu **menghapus app yang dia bikin** di akhir (`cleanup DELETE /api/apps/:id: 200`), dan `workflows`/`workflow_steps`/`workflow_runs` balik ke **ROWS 0** (dicek dengan `_audit_schema.mjs` setelahnya).

---

## 3. Tabel apa yang ada?

Query langsung ke `portico_platform` (`_audit_schema.mjs`):

```
TABLES: _migrated, activity_logs, app_data_rows, apps, components, data_sources,
        hub_login_states, organizations, pages, users, workflow_runs, workflow_steps, workflows

workflow_runs exists: true
workflow_run_steps exists: false   ← T4
cron_jobs exists: false            ← disebut PRD baris 696, nggak pernah dibuat
```

`workflow_runs` sudah ada (dari `002_features.sql:47`), tapi kolomnya:

```
id, workflow_id, status (pending|running|success|failed), trigger_by, input_json,
output_json, error, started_at, finished_at, created_at
```

**Yang kurang, dibanding apa yang UI Stitch dan AC minta:**

| Kebutuhan | Dari mana | Kolom sekarang | Kurang |
|---|---|---|---|
| Hasil per langkah (input, output, error) | US-A25 AC2 | nggak ada | **tabel `workflow_run_steps`** |
| "langkah ke-berapa, aksi apa" | US-A21 AC3 | nggak ada | `step_order`, `action_type` di run_steps |
| DURASI (kolom tabel `platform_workflow_runs`) | design | `started_at`+`finished_at` | dihitung; ok |
| LANGKAH `2/4`, `5/5` | design | nggak ada | `steps_done`/`steps_total` |
| BIAYA TOKEN `840 tok` | design + US-A30 AC1 | nggak ada | `tokens_used` |
| Percobaan ke-berapa (retry ≤3) | US-A23 AC3 | nggak ada | `attempt` di run_steps |
| Pemicu yang kebaca manusia (`Webhook Form`) | design | `trigger_by` text | ok, isi string deskriptif |
| "run gagal ditandai gagal + penyebab" | US-A23 AC2 | `error` text | ok |
| Counter `sukses`/`gagal` bertambah tepat 1 | US-A30 AC3 | nggak ada | kolom status di `workflows`/agregat, atau dihitung dari run — **tapi idempotensi butuh kunci unik** |

**Usul schema minimal** (bukan dieksekusi di card ini):

```sql
-- riwayat per langkah: US-A21 AC3, US-A23 AC1-AC3, US-A25 AC2
CREATE TABLE IF NOT EXISTS workflow_run_steps (
  id           text PRIMARY KEY,
  run_id       text NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_id      text REFERENCES workflow_steps(id) ON DELETE SET NULL,  -- NULL = langkah sudah dihapus
  step_order   int  NOT NULL,
  action_type  text NOT NULL,
  status       text NOT NULL CHECK(status IN ('success','failed','skipped','retrying')),
  attempt      int  NOT NULL DEFAULT 1,          -- US-A23 AC3: maks 3
  input_json   jsonb,
  output_json  jsonb,
  error        text,                             -- US-A25 AC4: pesan kebaca manusia
  started_at   timestamptz,
  finished_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_wrs_run ON workflow_run_steps(run_id, step_order);
```

`step_id` sengaja `ON DELETE SET NULL`, bukan CASCADE — US-A21 AC5 minta **riwayat lama tetap utuh** waktu langkah dihapus. CASCADE akan menghapus riwayatnya. Ini keputusan penting, jangan salah.

```sql
-- kolom tambahan di workflow_runs (US-A25 AC1 + US-A30 AC1)
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS trigger_type text;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS steps_total  int;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS steps_done   int;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS tokens_used  int DEFAULT 0;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS duration_ms  int;
```

```sql
-- US-A30 AC3: counter hasil bertambah TEPAT 1. Kuncinya idempotensi,
-- bukan counter-nya: satu run punya id unik, jadi agregat dihitung dari
-- workflow_runs, bukan dari variabel in-memory.
CREATE INDEX IF NOT EXISTS idx_wfr_wf_status ON workflow_runs(workflow_id, status);
```

Kenapa indeks, bukan tabel counter: AC3 minta "tidak dobel, tidak hilang". Tabel counter bisa dobel kalau penulisnya dipanggil dua kali (retry, dua instance). `workflow_runs` dengan `id` PK **nggak bisa** dobel. Counter = `SELECT status, count(*) GROUP BY status`. Indeks di atas bikin itu O(log n) buat p95 <1 detik di US-A25 AC5.

---

## 4. Step action: apa yang keimplementasi?

Whitelist di kode (`ALLOWED_ACTIONS`, sama persis di 3 file):

```
send_email, call_api, create_row, update_row, delete_row, slack_notify, webhook_out, condition
```

**Yang beneran ada handler-nya: NOL.** `grep -rn "send_email\|call_api\|create_row\|slack_notify\|webhook_out\|'condition'" apps/platform/src` cuma balik whitelist + data dummy di `ai/generate-app`. Nggak ada satu fungsi yang nerima `action_type` terus ngerjain sesuatu.

Yang AC US-A21 minta secara eksplisit:

- AC1 `kirim email` dengan penerima + isi → **belum ada**. `config_json.to` diterima dan disimpan, nggak pernah dikirim.
- AC2 `panggil API` dengan URL + metode → **belum ada**. Nggak ada `fetch()` ke URL dari `config_json`.
- AC3 langkah gagal → pesan error yang nyebut langkah ke-berapa + aksi apa → **belum ada** (nggak ada tempat nyimpen).
- AC4 pindah urutan langkah → **belum ada** (T5).
- AC5 langkah dihapus → eksekusi berikutnya nggak jalan, riwayat lama utuh → **belum ada** (dan schema usulannya harus `SET NULL` biar AC ini bisa lulus).

Catatan dependency: `send_email` yang beneran ngirim butuh SMTP. `.env` **nggak punya** variabel SMTP/mail (dicek: `grep -oE '^[A-Z_]+=' .env` → nggak ada `SMTP_*`/`MAIL_*`). Jadi `send_email` harus diimplementasi sebagai *transport terpilih*: kalau `SMTP_URL` kosong → langkah **tetap tercatat** dengan output `{"delivered": false, "reason": "smtp_not_configured"}` dan status `success` (bukan `failed`), karena AC1 minta "langkah dijalankan **dan hasilnya tercatat**", bukan "email benar-benar tiba di inbox". Ini keputusan desain yang harus ditulis di card implementasi, bukan diem-diem.

---

## 5. Failure path

US-A23 minta tiga perilaku. Yang ada sekarang: **nol**.

- `grep -c try` di 4 file route workflow → `0,0,0,0`. Nggak ada `try/catch` sama sekali, jadi error DB ngelempar ke Next → 500 HTML, bukan JSON.
- Nggak ada kolom `attempt` di mana pun → retry ≤3 (AC3) nggak punya state.
- Nggak ada dead-letter / antrian gagal.
- `on_error` (`continue|stop|retry`) ada di `CHECK` constraint dan diterima di body POST, tapi **nggak dibaca siapa pun** — sama seperti `trigger_type`.

Ini pola yang sama dengan US-A20: constraint-nya sudah dirancang, konsumennya belum ditulis. Bagusnya, artinya schema-nya nggak perlu dibongkar.

---

## 6. Rencana minimal — urutan terkecil biar US-A20 AC1 lulus

AC1: *"Kalau Adit membuat workflow dengan pemicu 'ketika form dikirim' pada halaman tertentu, saat form itu dikirim, satu catatan eksekusi baru muncul di riwayat."*

Jalur terpendek, 5 langkah, tiap langkah satu file baru:

| # | Langkah | File yang kesentuh | Bikin AC mana lulus |
|---|---|---|---|
| 1 | `packages/runner` (atau `apps/platform/src/lib/runner.ts`): fungsi `runWorkflow(wfId, {triggerType, input})` — bikin baris `workflow_runs` status `running`, ambil steps `ORDER BY step_order`, jalanin satu-satu, tutup jadi `success`/`failed`. Nggak ada action handler dulu — `switch(action_type)` dengan satu cabang `create_row` yang beneran nulis `app_data_rows`. | `apps/platform/src/lib/runner.ts` (baru) | US-A20 AC1 (setengah) |
| 2 | Migration `003_workflow_runner.sql`: `workflow_run_steps` (`step_id ON DELETE SET NULL`) + 5 kolom baru di `workflow_runs`. | `apps/platform/migrations/003_*.sql` (baru) | US-A21 AC3, AC5, US-A25 AC2 |
| 3 | Route form publik `POST /api/public/apps/[slug]/submit` — tanpa sesi, validasi field wajib, `INSERT app_data_rows`, terus **panggil `runWorkflow` buat tiap workflow app itu yang `trigger_type='form_submit' AND active=true`**. | `apps/platform/src/app/api/public/apps/[slug]/submit/route.ts` (baru) | **US-A20 AC1**, AC5 |
| 4 | `POST /api/workflows/[id]/run` (manual/uji) + `GET /api/workflows/[id]` + `GET /api/workflows/[id]/runs` | 3 route baru di bawah `api/workflows/[id]/` | US-A20 AC1 (kontrol), US-A24 AC1 |
| 5 | Perbaiki `step.id` di respons POST `/steps` (T3) + terima `step_order` di PATCH `/workflow-steps/:id` (T5) | 2 file existing | US-A21 AC1, AC4 |

Yang **jangan** dikerjain di card pertama: cron (US-A20 AC3), webhook + HMAC (AC4), `condition` (US-A22), retry (US-A23 AC3), UI. Semua itu nambah permukaan tanpa bikin AC1 lulus.

**Bukti yang harus ada sebelum bilang AC1 lulus:** kirim form publik tanpa sesi → `SELECT count(*) FROM workflow_runs` naik 1 → `SELECT count(*) FROM workflow_run_steps` = jumlah langkah → lalu **kirim lagi dan pastikan naik lagi tepat 1** (bukan 2). Test-nya harus baca ulang DB, bukan cuma cek `201`.

**Urutan yang gw rekomendasiin buat card-card berikutnya** (satu card = satu AC-group, biar bisa diverifikasi terpisah):

1. `US-A20 AC1` + `AC5` — form publik → 1 run; workflow nonaktif → 0 run. **Blokir semua yang lain.**
2. `US-A21 AC1/AC2/AC3` — handler `create_row` + `send_email` (transport-opsional) + `call_api`, semuanya nulis `workflow_run_steps` dengan error kebaca manusia.
3. `US-A21 AC4/AC5` — reorder + delete (dan test riwayat lama tetap utuh).
4. `US-A20 AC3/AC4/AC6` — cron + webhook HMAC + validasi jadwal. Butuh tabel `cron_jobs` yang sekarang belum ada.
5. `US-A22` — `condition` dengan ekspresi aman (tanpa `eval`).
6. `US-A23` — `on_error` continue/stop/retry + `attempt`.
7. `US-A24` — mode uji (dry-run: tulis ke `workflow_run_steps`, JANGAN ke `app_data_rows`).
8. `US-A25` + `US-A30` — halaman Eksekusi (design `platform_workflow_runs`) + metrik.

---

## 7. Catatan design (buat card UI-nya nanti)

Dibaca utuh dari file, bukan dari ingatan. Yang perlu ditiru persis waktu bikin halaman Eksekusi:

- **Tabel `platform_workflow_runs/code.html`**: header kolom verbatim `WAKTU MULAI · WORKFLOW · PEMICU · DURASI · LANGKAH · STATUS · BIAYA TOKEN`, semua uppercase `font-medium`, `h-12` per baris, `border-l-2 border-transparent hover:bg-surface-hover`, kolom angka `font-mono`.
- **Badge status**: `Sukses` = `bg-[#e8f6ee] text-[#15803d]`, `Gagal` = `bg-[#fdecec] text-[#b91c1c]`, `rounded-full px-2 py-0.5 text-[11px] font-medium`.
- **Drawer kanan 420px**: header `RUN-98214` + badge, judul, baris `Mulai: … • Total: … • Token: …` semua `font-mono text-[11px] text-text-tertiary`. Timeline langkah pakai dot `w-2 h-2 rounded-full` + `ring-4` senada badge, garis konektor `absolute left-[3px] w-[2px] bg-border-standard`.
- **Tiga state langkah yang design-nya punya**: sukses (dot hijau + kotak payload `bg-surface-sunken font-mono`), gagal (dot merah + callout `bg-[#fdecec] border border-[#dc2626]/20` + tombol "Coba lagi dari langkah ini"), **dilewati** (dot `bg-text-quaternary`, teks abu, `(Dilewati karena langkah sebelumnya gagal)`).
- **Pemicu kebaca manusia**: design nulis `Upload File`, `Webhook Form`, `Jadwal Berkala`, `Event Aplikasi`, `Webhook Mobile`, `Jadwal Harian` — bukan `form_submit`. Jadi kolom `trigger_by` diisi label Indonesia, mapping dari `trigger_type`.
- **`platform_workflow_builder/code.html`** nunjukin node bertipe `TRIGGER`/`LOGIKA`/`SMTP`/`POSTGRES` — itu bukti design-nya ngarep `send_email` + `create_row` beneran jalan, bukan cuma baris tabel.

**Keputusan yang gw ambil** (design nggak nyediain, jadi disusun dari pola + token yang ada): nggak ada satu pun dari tiga screen itu yang nunjukin tombol "Jalankan" manual di halaman builder. Tapi US-A24 AC1 butuh tombol "uji coba". Gw usul tombol itu pakai pola `bg-accent hover:bg-accent-hover text-white text-xs px-3.5 py-2 rounded font-medium` — persis tombol "Jalankan Ulang Alur" di drawer `platform_workflow_runs/code.html:603`. Nggak ngarang style baru.

---

## 8. Kenapa coverage gate bilang PARTIAL, bukan NO-TEST

`check_coverage.py` ngasih `US-A20 PARTIAL 3/6` dan `US-A21 PARTIAL 1/5`. Angka itu **kebetulan bener secara label, salah secara arti**: tiga AC US-A20 yang "ke-cover" itu:

```
US-A20 AC2 <- e2e-features.mjs: 'create workflow'          → status 201 + ada id
US-A20 AC5 <- e2e-features.mjs: 'toggle workflow back off' → flag balik false
US-A20 AC6 <- e2e-features.mjs: 'invalid trigger refused'  → status 400
```

AC6 memang beneran lulus (validasi whitelist jalan). AC2 **cuma ngecek `201` + ada id** — sama sekali nggak nge-assert `active === false`, padahal itu inti AC-nya ("tidak aktif secara default"). AC5 **salah arti**: test-nya ngecek flag balik jadi `false` lewat `PATCH /toggle`, sedangkan AC-nya minta "saat pemicunya terjadi, tidak ada eksekusi dibuat" — dan pemicunya nggak ada, jadi yang di-assert bukan yang diminta. Yang `b?.active === true` di baris 163 juga cuma baca **respons**, bukan `SELECT active FROM workflows` — jadi nggak membuktikan apa pun soal state tersimpan.

`orphan-citations=0` dan `unannotated-tests=0`, jadi nggak ada label nyasar. Yang bermasalah bukan pemetaan labelnya — **assertion-nya lebih lemah dari AC-nya**. Ini persis kasus yang bikin `prd-coverage-gate` bilang "jangan promosi ke PASS kalau assertion-nya lebih lemah".

---

## 9. File probe (read-only, dihapus sebelum merge)

Tiga script sekali-pakai yang ngasih bukti runtime di atas. Semuanya bikin fixture terus **menghapusnya sendiri**, dan udah diverifikasi DB balik ke `ROWS 0`:

- `apps/platform/scripts/_audit_schema.mjs` — daftar tabel + kolom + index + row count
- `apps/platform/scripts/_audit_trigger_probe.mjs` — fire trigger, hitung `workflow_runs`
- `apps/platform/scripts/_audit_step_probe.mjs` — bug id respons + reorder + 404 detail

Nggak di-commit (nggak masuk `git add`) — prefix `_audit_` cuma penanda lokal, bukan pelindung.

**Jebakan yang kena waktu audit ini:** `check_coverage.py` scan SEMUA file di `--scan` dan regex anotasinya (`(US-[A-Z]\d{2})\s*[,/ ]\s*(AC\d+)`) nggak peduli itu komentar, string, atau nama variabel. Probe gw nulis `// can we reorder? (US-A21 AC4)` di komentar → gate naik dari `US-A21 PARTIAL 1/5` jadi `2/5` **tanpa satu assertion pun**. Yang lebih bahaya: `orphan-citations` tetap 0, jadi naiknya kelihatan sah.

Aturannya: **jangan pernah nulis `US-XX ACn` di file yang di-scan kalau itu bukan assertion beneran** — sebut temuan pakai kode sendiri (`T3`, `T5`) atau tanpa nomor AC. Angka gate di bagian 8 diambil setelah probe dibersihin dari pola itu, biar yang dilaporkan sama dengan baseline `1594910`.

---

## 10. Server yang dipakai

Probe jalan lawan instance yang gw start sendiri dari worktree, port **3110** (di luar set standing 3100/3001/3002/3003):

```
$ curl -s http://localhost:3110/ready
{"status":"ready","components":{"database":{"status":"up","latencyMs":2}},"checkedAt":"2026-09-15T13:11:06.877Z"}
```

`status: ready` + `database: up` — jadi probe-nya beneran nulis ke DB, bukan nguji server yang salah konfigurasi. Instance-nya gw matiin setelah selesai.
