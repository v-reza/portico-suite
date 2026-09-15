# Portico Suite — monorepo

Satu identitas, tiga produk, satu control plane.

```
portico-suite/
├── apps/
│   ├── hub/            Portico — identity provider + control plane
│   ├── platform/       A — AI SaaS workflow / internal-tool builder
│   ├── helpdesk/       B — self-hosted helpdesk
│   └── code-review/    C — AI multi-agent PR reviewer
├── packages/
│   ├── tokens/         design token (sumber: PORTICO-SUITE-DESIGN.md)
│   ├── ui/             komponen shell + primitif (rail 56 / sidebar 236 / topbar 48)
│   └── auth-hub-client/ verifikasi JWT RS256 + PKCE flow (dipakai A, B, C)
├── infra/
│   └── docker-compose.yml   postgres 16 + redis 7
└── docs/               PRD + spec (sumber kebenaran desain)
```

## Aturan yang mengikat

1. **Hub = control plane, app = enforcement point.** Hub menyimpan definisi peran
   per-app + penugasannya. App menyimpan salinan lokal dan menegakkan sendiri.
2. **Kemandirian app.** Hub mati tidak boleh membuat A/B/C tidak bisa dipakai.
   Login email+password lokal tetap default dan wajib jalan.
3. **Vocabulary peran tidak diseragamkan.** A `admin/builder/viewer`,
   B `admin/agent/customer`, C akses per-repo. Hub menyimpan ketiganya.
4. **Token desain satu sumber.** `packages/tokens` di-generate dari
   `docs/PORTICO-SUITE-DESIGN.md`. Jangan tulis hex langsung di komponen.

## Mulai

```bash
cp .env.example .env          # lalu isi
npm install                   # workspaces, sekali di root
npm run infra:up              # postgres + redis
npm run tokens:build          # generate CSS vars dari DESIGN.md
npm run dev:hub               # http://localhost:3100
```

Port: Hub **3100**, Platform **3001**, Helpdesk **3002**, CodeReview **3003**.

## Skrip

| Skrip | Guna |
|---|---|
| `npm run tokens:build` | generate `packages/tokens/dist/tokens.css` + `tokens.ts` |
| `npm run tokens:check` | gagal kalau token di disk beda dari DESIGN.md |
| `npm run infra:up` / `infra:down` | docker compose postgres + redis |
| `npm run dev:<app>` | dev server app |
| `npm run build:all` | build semua app |
| `npm run db:migrate -w apps/<app>` | prisma migrate |

## Alur kerja otonom

Pengerjaan fitur di repo ini jalan lewat papan Kanban: satu card = satu user
story, dikerjakan agent di git worktree terpisah, terus diverifikasi terhadap
PRD + design sebelum masuk `master`.

```bash
bash scripts/bootstrap-worktree.sh   # di worktree card: link deps, .env, tokens/dist
bash scripts/merge-card-branch.sh    # kerjaan terakhir: fast-forward + push ke origin
bash scripts/kanban-run.sh           # jalankan papan sampai sepi
```

Tiga skrip itu nutup tiga lubang yang bikin kerjaan hilang:

- **`bootstrap-worktree.sh`** — worktree `git worktree add` polos nggak punya
  `node_modules`/`.env`/`tokens/dist`. Tanpa ini agent langsung mati di
  `Cannot find module 'next'`.
- **`merge-card-branch.sh`** — card `done` **nggak** otomatis nge-merge
  branch-nya; dispatcher cuma spawn worker, dan worktree dibongkar pas selesai.
  Tanpa langkah ini hasilnya ada di object database tapi nggak kelihatan di
  `master`. Fast-forward doang, dan **nolak** kalau master divergen / kotor
  daripada bikin merge commit atau nimpa kerjaan orang.
- **`kanban-run.sh`** — loop `hermes kanban dispatch` sampai papan berhenti
  berubah, karena nggak ada yang spawn otomatis.

Semuanya ada tesnya:

```bash
bash scripts/test-merge-card-branch.sh scripts/merge-card-branch.sh   # 38 assertion
```

Tes dijalanin di repo git buangan di direktori temp — nggak pernah nyentuh repo
asli. Yang dites termasuk jalur nolak (worktree kotor, master kotor, master
divergen), jalur push, dan push yang gagal.

