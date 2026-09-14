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
npm run dev:hub               # http://localhost:3000
```

## Skrip

| Skrip | Guna |
|---|---|
| `npm run tokens:build` | generate `packages/tokens/dist/tokens.css` + `tokens.ts` |
| `npm run tokens:check` | gagal kalau token di disk beda dari DESIGN.md |
| `npm run infra:up` / `infra:down` | docker compose postgres + redis |
| `npm run dev:<app>` | dev server app |
| `npm run build:all` | build semua app |
| `npm run db:migrate -w apps/<app>` | prisma migrate |
