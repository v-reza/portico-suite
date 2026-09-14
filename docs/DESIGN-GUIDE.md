# DESIGN Guide — Copy-Paste ke stitchwithgoogle

**Versi 2 — LIGHT.** Semua project (A/B/C) pakai satu design system yang sama.
Kalau file ini bilang light, jangan generate dark. Dark lama sudah dibuang.

## Cara Pakai

1. Buka stitchwithgoogle.com
2. Paste blok **Surface Rules** di bawah dulu (sekali, di awal sesi)
3. Paste isi `*-DESIGN.md` project yang lagi dikerjain
4. Paste blok **Layout Blueprint** — shell + blueprint yang dipakai app itu.
   Ini wajib sebelum generate halaman pertama; kalau nggak, tiap halaman bakal
   punya top bar dan sidebar sendiri-sendiri
5. Baru generate page satu per satu pakai spec di file ini
6. Tiap kali ganti page, ulangi paste **Anti-Slop Rules** — ini yang bikin hasil
   nggak balik jadi template generik
7. Ganti page = ganti isi pane doang. Kalau Stitch nge-generate ulang top bar,
   sidebar, atau rail-nya: **tolak, minta regenerate dengan shell yang sama**

---

## ⚠️ Referensi Visual (wajib dilihat dulu)

Folder: `Desktop\portfolio-projects\refs-helpdesk-light\`

Patokan utama = **01_27608234-Support-Inbox-Page-Perch**. Ambil *sistem*-nya:
3-pane (sidebar → list → thread), angka di tiap nav item, aksen cuma di elemen
interaktif, hairline border, density tinggi tapi kebaca. Tiap baris list bawa
3 lapis info: nama · fungsi · waktu relatif.

Pendukung: **04** (tabel tiket + filter), **13** (panel analytics),
**19** (hierarchy tajam), **09**/**14**/**16** (inbox + composer).

Jangan jiplak warnanya (Perch violet-nya beda) — jiplak **kepadatan dan sistematikanya**.

---

## Surface Rules (Beri tahu stitch sebelum generate halaman apapun)

```
Design system: LIGHT, product-grade, off-white + white panels + hairline borders.
Referensi: Linear-style density, tapi LIGHT (bukan Linear dark).

- Page bg: #f7f7f8 (off-white, JANGAN #ffffff — panel nanti nggak kebedain)
- Panel/sidebar/header: #ffffff, dipisah border 1px rgba(15,23,42,0.10)
- Hover: #f1f1f3 · Sunken/inset (canvas, well, kbd): #ededf0
- Accent tint (item aktif, bubble keluar): #f2f0fe
- Canvas/editor bg (project A): #f1f1f4 — semua node putih harus POP dari sini

- Font: Inter, font-feature-settings "cv01","ss03" di SEMUA teks
- Mono: JetBrains Mono — WAJIB untuk angka, ID tiket, timestamp, SLA, kolom tabel
- Text: #101014 primary · #4b5058 secondary · #62676f tertiary · #9aa0aa disabled
  (JANGAN #333/#666/#999 generik, JANGAN pure black #000)

- Border: rgba(15,23,42,0.10) standard, rgba(15,23,42,0.06) subtle.
  HAIRLINE 1px. Nggak ada border 2px selain indikator severity/aktif.
- Elevation WAJIB shadow berlapis, bukan cuma garis:
  card:     0 1px 2px rgba(15,23,42,.06), 0 0 0 1px rgba(15,23,42,.08)
  elevated: 0 2px 4px rgba(15,23,42,.06), 0 6px 16px rgba(15,23,42,.06), 0 0 0 1px rgba(15,23,42,.08)
  dialog:   0 16px 48px rgba(15,23,42,.16), 0 4px 12px rgba(15,23,42,.08), 0 0 0 1px rgba(15,23,42,.10)
- Radius: 4/6/8/12, pill = full. Input 6px, card 8px, modal 12px.
- Accent: #6e5ae6 (violet, BUKAN biru #3b82f6). Hover #5b46d6.
  Accent CUMA di: CTA primer, item aktif, focus ring, link, unread dot.
- Focus ring: borderColor #6e5ae6 + boxShadow 0 0 0 3px rgba(110,90,230,.18)

- Buttons: primer = solid violet, teks putih. Sekunder = putih + border hairline.
  Nggak ada "outline button" ala Bootstrap, nggak ada tombol abu-abu flat.
- Badge: pill (radius full, padding 2px 8px), teks caption + label, BUKAN titik warna.
  Warna badge = tint pastel + teks gelap senada. Dot status/severity PATEN 8px.
- Pemilih bahasa (US-A27, US-B29, US-C14, US-M07): WAJIB ada di top bar 48px tiap
  app, BUKAN dua tombol bendera, BUKAN dropdown besar. Bentuknya segmented control kecil
  (paling kanan, sebelum avatar): dua segmen teks mono 11px "ID" / "EN", tinggi 24px,
  radius 6px, segmen aktif bg #f2f0fe teks #5b46d6, yang tidak aktif teks #62676f.
  Border hairline di sekeliling kontrol.
  KEBIJAKAN BAHASA (mengikat): default **Inggris**, diturunkan dari `Accept-Language`;
  pilihan user menang atas deteksi dan bertahan lintas reload + login. Bahasa komentar
  AI di C adalah pengaturan TERPISAH (default Indonesia) — bukan satu setelan.
  Label di prompt/spec halaman ditulis Indonesia sebagai **contoh isi**; yang mengikat
  adalah aturan ini, bukan literal labelnya. Jangan hardcode string di komponen.
  angka/tanggal, bukan cuma label. JANGAN ikon bendera, JANGAN emoji.
- Tabel: header bg #f7f7f8 teks mono-label #62676f, row transparent + borderBottom hairline.
  Baris hover #f1f1f3. Kolom angka/tanggal rata KANAN + font mono.

SHELL / LAYOUT (WAJIB, sama di semua halaman app):
- Full-bleed 100% viewport, NO max-width container centered. App kerja, bukan landing.
- Rail ikon 56px | Sidebar 236px | pane isi flex-1. Tabel lebar: list 340, palette 220,
  inspector 280, sidebar meta 300, drawer 420, nav tab 200.
- Top bar 48px cuma di atas pane isi (bukan span sejajar rail/sidebar).
- Scroll PER-PANEL. Body overflow hidden. Top bar/toolbar sticky, tidak ikut scroll.
- Shell (rail+sidebar+topbar) IDENTIK di semua halaman app yang sama. Ganti halaman =
  ganti isi pane doang, shell tidak pernah di-generate ulang.
- Centered cuma untuk Login/Register/Hub. Semua halaman app lain kiri-rata.
```

---

## 🚫 Aturan Anti-Slop — Paste ke stitch SEBELUM tiap page

```
INI ATURAN YANG WAJIB DIINGAT SEPANJANG GENERATE. LIGHT MODE.

1. NO gradient background di mana pun — solid only. (Satu pengecualian: area fill
   chart 8% opacity, itu grafik bukan background.)
2. NO glassmorphism / backdrop-blur / frosted panel.
3. NO emoji di UI — pakai ikon garis 1.5px atau teks.
4. NO kartu generik "ikon + judul + kalimat". Tiap card isi data asli atau state kosong.
5. NO strip aksen di tepi kiri kartu sebagai hiasan. Strip kiri HANYA untuk 3 hal:
   severity finding (project C), internal note (project B), dan baris list/rail AKTIF
   (2px accent). Selain tiga itu = dekorasi, hapus.
6. NO fake data. Tulis state kosong atau skeleton, jangan angka karangan biar "rame".
7. NO pure black teks (#000) — #101014. NO pure white panel di atas pure white page.
   Page #f7f7f8, panel #ffffff. Selalu ada beda 1 tingkat.
8. NO border tebal. HAIRLINE 1px. Nggak ada border 2px kecuali indikator severity/nav aktif.
9. NO biru generik (#3b82f6, #2563eb). Accent violet #6e5ae6. NO pelangi aksen.
10. NO shadow gelap pekat ala 2010 (0 4px 8px #000). Shadow lembut + lapis:
    1px hairline tight + 1 sebaran lebar low-alpha.
11. Text minimal 3 tingkat kedalaman: #101014 / #4b5058 / #62676f. Semua satu warna = salah.
12. Utility text (label kolom, meta, kbd, counter, ID) WAJIB JetBrains Mono,
    ukuran 12px, warna #62676f.
13. Tombol jangan center di dalam card. Kiri rata, atau kanan rata di header baris.
14. Variasikan layout antar section. Grid 3 kartu sama rata di semua tempat = slop.
15. Tabel: header JANGAN tebal dan JANGAN berwarna. Tipis, abu, mono. Row hover lembut.
16. Tiap halaman butuh: loading (skeleton), empty (CTA jelas), error (retry).
    Generate ketiganya, jangan cuma happy path.
17. Table/card WAJIB punya header baris alat: search/filter di kiri, aksi primer di kanan.
    Jangan langsung tempel tabel polos di bawah judul halaman.
18. Tinggi baris list PATEN 44px, padding 8px 12px. Jangan 40, jangan 48.

Slop self-check sebelum bilang selesai:
- Semua di-center? → SALAH. Kiri rata. Center cuma untuk empty state & auth.
- Tiap card punya ikon sama di kiri atas? → SALAH. Itu template.
- Aksen violet muncul di 5+ tempat per layar? → SALAH. Cuma CTA + item aktif + focus.
- Semua teks ukuran sama? → SALAH. Butuh hierarki 11/13/14/16/20px.
- Kelihatan seperti Stripe template? → SALAH. Kelihatan seperti Linear versi terang? → BENAR.
```

---

## 📐 Aturan Density & State (penyebab output Stitch "kurang banget")

Stitch default-nya bikin: kartu besar, spasi longgar, hierarki rata, isi kosong.
Itu yang bikin berasa murah. Paksa aturan ini:

```
DENSITY:
- Baris list/nav: tinggi PATEN 44px. Header section: 56px. Toolbar: 44px.
- Sidebar 236px. Inspector 280px. Palette 220px.
- Padding card: 16px. Padding panel: 20px. Gap antar card: 12px (bukan 24px).
- Font isi 14px (body), utility 12px (mono). JANGAN 16px buat isi tabel/list.
- Satu layar harus kelihatan minimal 10-14 baris konten — kalau cuma 3-5 baris, terlalu longgar dan kelihatan seperti template.

HIERARKI (tiap layar, urut dari atas):
1. Judul halaman + hitungan jumlah ("Tiket · 24")
2. Baris tab/preset view (angka di sebelah kanan label, pakai mono)
3. Toolbar: search + filter chips + tombol aksi kanan
4. Konten (tabel/list/grid)
5. Footer: pagination atau hitungan ("Menampilkan 1-50 dari 312")

METADATA (pembeda paling kentara dari AI slop):
- Tiap baris bawa 2-3 lapis info: judul (14px #101014) + sub (12px #62676f) + waktu/status kanan
- Angka selalu mono, selalu punya unit ("9m 12s", "24", "312")
- Timestamp relatif ("4m", "2j", "kemarin") bukan tanggal penuh

STATE MATRIX WAJIB per halaman:

| Halaman | Empty | Loading | Error | Special |
|---|---|---|---|---|
| Login/Register | n/a | spinner di tombol, disabled | inline di bawah form | Hub tak terjangkau -> pesan <=5s |
| List (tiket/PR/repo) | CTA + teks penyebab dari filter | 8-10 skeleton baris (bukan spinner) | banner + retry | bulk-select: checkbox muncul di hover, header jadi "N dipilih" |
| Detail | "Belum ada balasan" + CTA | skeleton header + 3 blok body | banner + retry | internal note (strip warning), resolved (badge + composer terkunci) |
| Settings | "Belum ada X" + tombol tambah | skeleton form field | inline per field | unsaved changes -> sticky bar bawah |
| Canvas/Builder (A) | drop zone dashed + "Tarik komponen ke sini" | n/a | n/a | drag-over, selected ring, inspector sinkron |
| Dashboard (C) | "Hubungkan repo pertama" + CTA | skeleton 4 stat + chart shimmer | banner + retry | angka 0 -> tampilkan "—", bukan "0" |
| Modal/Overlay | n/a | spinner + teks proses + cancel | pesan + coba lagi | Esc tutup, focus trap, belum ada perubahan = tombol simpan disabled |

INTERAKSI (biar terasa produk, bukan mockup):
- Hover state di SEMUA baris dan tombol — jangan cuma tombol primer
- Bulk-select: checkbox tersembunyi, muncul saat hover; header baris berubah jadi
  "12 dipilih" + tombol aksi massal. Ini yang paling kentara "produk beneran"
- Keyboard hint di command/canvas: tampilkan "⌘K", "Esc", "⌘Enter" pakai mono
- Item aktif nav: bg #f2f0fe + teks #5b46d6 + indikator
- Angka counter di nav (mis. "Tiket Saya 24", "SLA Lewat 4" warna merah)
```

### Yang HARUS dihindari (bikin balik ke generik)

- Stat cards 4 buah rata dengan ikon bulat warna-warni di kiri → ganti: angka besar
  mono + label mono + delta kecil, tanpa ikon
- Chart area gradient biru → garis violet 2px + fill 8%, grid horizontal tipis
- Card putih semua dengan shadow sama rata → bedakan: panel (border) vs card (shadow)
- Tombol "Add New" besar di tengah empty state → CTA primer + teks penyebab di bawahnya
- Avatar bulat besar di tiap baris → avatar 26px, atau inisial mono 2 huruf

---

## 🧱 Layout Blueprint — FONDASI (paste SEBELUM spec halaman mana pun)

Ini yang paling sering salah. Stitch itu default-nya bikin **halaman baru tiap
generate**: top bar beda, sidebar pindah, konten di-center, tiap section stack
vertikal. Hasilnya kelihatan kayak 10 template tempel-tempel, bukan satu produk.

Aturannya: **shell-nya SATU, cuma isi tengahnya yang ganti.** Shell nggak pernah
di-generate ulang.

```
ATURAN SHELL — WAJIB, semua halaman dalam satu app:

1. APP FRAME = 100% viewport, TANPA max-width container yang di-center.
   Ini aplikasi kerja, bukan landing page. Nggak ada "konten 1200px di tengah
   dengan background putih di kiri kanan".
2. SHELL IDENTIK di semua halaman app yang sama. Yang berubah cuma: judul di top
   bar, item yang aktif di sidebar, dan ISI PANEL TENGAH. Top bar, sidebar, dan
   rail-nya JANGAN didesain ulang per halaman.
3. RAIL + SIDEBAR: rail ikon 56px full-height di paling kiri, nempel ke tepi.
   Daftar item rail diturunkan dari daftar halaman top-level app itu, dan JUMLAH +
   URUTANNYA identik di semua halaman shell-app app yang sama. Jangan dikarang
   per halaman. Halaman full-bleed (editor canvas) tidak punya rail.
   Di kanannya sidebar 236px. Halaman shell-app selalu punya rail + sidebar.
   Halaman ber-nav-tab (settings) memakai **shell yang sama** (rail 56 + sidebar
   236 + top bar 48), dan nav tab 200px hidup **di dalam pane isi** — rail TIDAK
   disembunyikan, sidebar TIDAK diganti. Jangan bikin varian shell kedua.
4. LEBAR KOLOM DIPATOK. Nggak ada "kira-kira". Pakai angka di tabel bawah.
   Panel isi = sisa ruang (flex 1), TIDAK dipatok supaya nggak ada 2 scrollbar.
5. SCROLL ITU PER-PANEL, bukan satu scroll di body. Body = overflow hidden —
   nggak pernah body yang scroll. Tiap pane punya scroll sendiri (lihat tabel
   peta layout; contoh: di Blueprint B, pane list DAN pane thread scroll
   masing-masing, tapi sidebar, rail, dan top bar diam). Top bar dan toolbar
   JANGAN ikut kescroll — pakai sticky di dalam pane-nya.
6. URUTAN Z: page #f7f7f8 → panel putih di atasnya → drawer/modal di atas panel
   → toast paling atas. Tiap tingkat naik pakai shadow, bukan warna beda.
7. GRID: kelipatan 4px. Gap standar 12px (jarang 16). Padding pane 16px.
   Konten nempel tepi pane — jangan tambah margin 24px lagi di dalam pane.
8. LEBAR PATOK: rail 56 | sidebar 236 | pane list 340 | palette 220 | inspector 280 |
   sidebar meta 300 | drawer 420 | nav tab 200 | top bar 48 | toolbar 44 |
   baris list 44 | baris tabel 48, header tabel 36 | avatar 26 | dot 8 | pane isi flex-1.
```

### Blueprint B — Helpdesk (3-pane, aplikasi utama)

```
┌──────┬────────────────┬──────────────────┬─────────────────────────────────┐
│      │                │  TOP BAR 48px    │  (top bar cuma di atas pane      │
│ RAIL │   SIDEBAR      │  putih, sticky   │   list + detail — JANGAN span    │
│ 56px │   236px        │  borderBottom    │   ke rail & sidebar)             │
│      │                ├──────────────────┼─────────────────────────────────┤
│ [A]  │  wordmark      │ Percakapan · 24  │  Amelia Fox · Online            │
│      │  ─────────     │ [search]         │  #TKT-2231 · Tinggi · SLA 42m   │
│ [B]  │  PRODUK        ├──────────────────┼─────────────────────────────────┤
│      │  Dashboard     │ ● Amelia    4m   │  ┌───────────────────────────┐  │
│ [C]  │  Inbox    ←aktif│  @amelia         │  │ bubble masuk #ededf0      │  │
│      │  Reports       │  invoice salah…  │  └───────────────────────────┘  │
│      │  VIEWS         │                  │          ┌──────────────────┐   │
│ ──── │  Tiket saya 24 │  Daniel    12m   │          │ bubble keluar    │   │
│      │  Belum 7       │  •••             │          │ #f2f0fe violet   │   │
│ ▣    │  SLA lewat 4   │                  │          └──────────────────┘   │
│      │  WORKSPACE     │  Priya     34m   │                                 │
│      │  Kontak        │                  │  ── internal note ──            │
│      │  Makro         │  Marcus     1j   │  ┌───────────────────────────┐  │
│      │  ─────────     │         ⬇ scroll │  │ composer putih + hairline │  │
│      │  [profil]      │                  │  └───────────────────────────┘  │
└──────┴────────────────┴──────────────────┴─────────────────────────────────┘
   56         236                340                flex-1 (min 480)

RAIL B (3 ikon, urutan tetap): [A] Platform · [B] Helpdesk ←aktif · [C] Code Review,
  dipisah divider tipis dari ikon settings paling bawah. Rail = app switcher
  portofolio, BUKAN menu halaman. Isi & urutan identik di ketiga app.
SCROLL: cuma pane list + pane thread (masing-masing). Sidebar scroll sendiri
        kalau kepanjangan. Rail tidak scroll (tinggi tetap, item selalu muat).
JANGAN: top bar nge-span penuh sejajar rail — itu yang bikin kelihatan template.
JANGAN: tambah ikon rail lain (search, notifikasi, chat) — itu bikin jadi template.
```

### Blueprint A — Platform (shell app + shell editor canvas)

```
SHELL APP (Apps List, Data Table, Settings — sama pola B):
┌──────┬────────────────┬──────────────────────────────────────────────────┐
│ RAIL │ SIDEBAR 236px  │  TOP BAR 48px (judul + aksi primer kanan)        │
│ 56px │                ├──────────────────────────────────────────────────┤
│      │                │  toolbar 44px: [search] [filter] │ [+ Aplikasi]    │
│      │                ├──────────────────────────────────────────────────┤
│      │                │  konten: grid kartu / tabel      ⬇ scroll        │
└──────┴────────────────┴──────────────────────────────────────────────────┘

SHELL EDITOR (App Builder, Workflow Builder — FULL BLEED, TANPA sidebar):
┌──────────────────────────────────────────────────────────────────────────┐
│ TOP BAR 56px: nama app (editable) │ ← → undo/redo │ Pratinjau │ Terbitkan │
│                tab halaman ────────▔▔▔▔ (aktif = underline 2px violet)   │
├─────────┬────────────────────────────────────────────────┬───────────────┤
│ PALETTE │               CANVAS #f1f1f4                  │  INSPECTOR    │
│  220px  │        grid titik 16px rgba(15,23,42,.05)      │    280px      │
│ putih   │                                                │    putih      │
│         │   ┌──────────┐      ┌──────────┐              │  ─────────    │
│ ▽ TRIG  │   │ node     │─────▶│ node     │              │  Label        │
│ • Email │   │ putih    │      │ putih    │              │  [input]      │
│ • Webh  │   └──────────┘      └──────────┘              │  ─────────    │
│ ▽ AKSI  │    shadow card     shadow card                │  Hapus (merah │
│ • HTTP  │                                                │  teks, bukan  │
│ • Kond  │        (canvas nggak scroll — pan & zoom)      │  tombol solid)│
└─────────┴────────────────────────────────────────────────┴───────────────┘
   border  borderRight hairline                      borderLeft hairline

CANVAS: TIDAK scroll. Pan + zoom. Grid titik di dalam SVG/div, bukan background-image.
        Node = kartu PUTIH + shadow card → WAJIB pop dari canvas #f1f1f4.
        Zoom control di kanan bawah (pill putih), minimap opsional kanan bawah.
PALETTE + INSPECTOR: scroll sendiri-sendiri. Grup label mono uppercase 11px.
RAIL A: sama persis dengan Rail B (3 ikon app switcher) — jangan didefinisikan ulang.
Halaman editor canvas TIDAK punya rail (full-bleed).
TOP BAR EDITOR = 56px (bukan 48px) — karena ada baris tab halaman di dalamnya.
TOPBAR 48px cuma dipakai di shell app biasa (tanpa tab).
JANGAN: canvas gelap, sidebar di dalam editor, node berwarna per tipe.
```

### Blueprint C — Code Review (list + split detail, beda dari B)

```
LIST (Repos, PR List — rail + sidebar + topbar, SAMA pola A):
┌──────┬────────────────┬──────────────────────────────────────────────────┐
│ RAIL │ SIDEBAR 236px  │  breadcrumb mono │ toolbar: segmen + chips + aksi  │
│ 56px │                ├──────────────────────────────────────────────────┤
│      │                │  TABEL: header mono 36px, baris 48px   ⬇ scroll  │
│      │                │  PR# │ Judul │ Penulis │ Status │ Temuan │ Kritis │
└──────┴────────────────┴──────────────────────────────────────────────────┘
        Kolom angka (Temuan, Kritis, Tinggi) rata KANAN + mono. Header sticky.

DETAIL (PR Detail — split tetap, BUKAN tab dan BUKAN accordion penuh):
┌──────────────────────────────────────────────────────────────────────────┐
│ HEADER CARD putih: PR#4021 mono · judul · penulis · branch mono · [Tinjau ulang]│
├─────────────────────────────────────────┬────────────────────────────────┤
│  DAFTAR TEMUAN    flex-1, min 560px     │  SIDEBAR META 300px, putih     │
│                                         │  borderLeft hairline           │
│  ● KRITIS  3px strip #b91c1c            │  ─────────                     │
│    SQL injection di search handler      │  Penulis    (mono per nilai)   │
│    src/api/search.ts:88  mono 11px      │  Branch     feat/x              │
│    ┌──────────────────────────────┐     │  File       4 diubah           │
│    │ code mono #fbfbfc, gutter    │     │  Commit     12                 │
│    │ +baris bg hijau 10%          │     │  ─────────                     │
│    │ -baris bg merah 8%           │     │  tanpa tombol fix (NG2)        │
│    └──────────────────────────────┘     │                                │
│  ● TINGGI  ...                          │  ⬇ scroll                      │
│                             ⬇ scroll    │                                │
└─────────────────────────────────────────┴────────────────────────────────┘

Temuan = kartu putih + strip kiri 3px sesuai severity + tint sangat tipis.
Kritis/Tinggi default TERBUKA, Sedang/Rendah terlipat. Bukan accordion semua.
RAIL C: sama persis dengan Rail B (3 ikon app switcher). Jangan tambah ikon lain.
JANGAN: drawer yang nutup konteks, tab per-severity, badge warna solid tebal.
```

### Blueprint D — Auth & Hub (satu-satunya yang boleh centered)

```
Login / Register / Hub-login:
  Page #f7f7f8. KARTU PUTIH centered, LEBAR 380px (Hub "pilih app" 560px),
  padding 28px, radius 8px, border hairline + shadow card.
  Center vertikal DI TENGAH VIEWPORT (bukan nempel atas).
  Nggak ada top bar, nggak ada sidebar, nggak ada ilustrasi di samping kiri.
  Di bawah kartu: caption mono 11px #9aa0aa (versi build / link status).

ATURAN: ini SATU-SATUNYA layout yang boleh center. Semua halaman lain kiri-rata.
```

### Tabel lebar & tinggi (PATO — jangan dikira-kira)

| Elemen | Ukuran |
|---|---|
| Rail (ikon) | 56px, full height, paling kiri |
| Sidebar nav | 236px |
| Pane list (inbox/tiket) | 340px |
| Detail/thread (layout 3-pane) | flex-1, min 480px |
| Body split detail (B Ticket Detail, C PR Detail) | flex-1, min 560px |
| Palette komponen | 220px |
| Inspector kanan | 280px |
| Drawer detail (data row) | 420px |
| Sidebar meta (PR detail) | 300px |
| Nav tab settings | 200px |
| Top bar | 48px (56px kalau ada tab di dalamnya) |
| Toolbar | 44px |
| Baris list | 44px (paten — jangan 40, jangan 48) |
| Baris tabel | 48px · header tabel 36px |
| Header section | 56px |
| Konten pane | flex-1 — mengisi sisa, JANGAN dipatok |
| Avatar baris | 26px (24px di tabel padat) |
| Gap grid kartu | 12px |
| Padding pane | 16px · padding card 16px · padding panel 20px |

### Peta layout per halaman (biar nggak diarang sendiri sama Stitch)

| Halaman | Blueprint | Pane yang scroll |
|---|---|---|
| B/A/C — Login & Register | D | n/a |
| B — Ticket List | B | list + thread |
| B — Ticket Detail | B (tanpa pane list) | thread + sidebar meta |
| B — KB | A | konten utama |
| B — Settings | A (nav tab ganti sidebar) | pane form |
| B — Reports | A | konten utama |
| B — Lacak Tiket (publik) | D (lebar 560px, tanpa shell) | n/a |
| A — Apps List | A | grid kartu |
| A — App Builder / Workflow | A-editor | palette + inspector (**canvas tidak**) |
| A — Data Table | A | tabel |
| A — Workflow Runs | A | tabel + drawer |
| A — Metrics | A | konten utama |
| A — Workspace Settings | A + nav tab di dalam pane isi | pane form |
| A — App Settings | A + nav tab di dalam pane isi | pane form |
| A — Onboarding | D (lebar 560px, tanpa shell) | n/a |
| A — AI Prompt Modal | overlay (bukan halaman) | textarea saja |
| C — Dashboard | A | konten utama |
| C — Repos / PR List | C-list | tabel |
| C — PR Detail | C-detail | daftar temuan + sidebar meta |
| C — Repo Settings | A + nav tab di dalam pane isi | pane form |
| Hub — Login / Register | D | n/a |
| Hub — Pilih App | D (560px) | n/a |
| Hub — Users / Roles | A (rail + sidebar 236 Pengguna/Peran, TANPA nav tab) | drawer 420 / pane kanan |
| Hub — Status | D (lebar 560px) | n/a |

---

## B — Helpdesk Pages

**Blueprint: B** (rail 56 + sidebar 236 + list 340 + detail flex-1).
**Referensi:** `refs-helpdesk-light\01` (utama), `09`, `14`, `16`, `04`

### 1. Login Page
```
Page: Login
Surface: Operate
Layout: Blueprint D — satu-satunya layout centered. Kartu putih 380px, center viewport.
        Kartu putih: border 1px rgba(15,23,42,.10) + shadow card (JANGAN shadow pekat).
Elemen: wordmark teks "Helpdesk" (Inter 1.25rem #101014, bukan gambar), di bawahnya
        satu baris caption #62676f. Label DI ATAS input, bukan placeholder-only.
        Input email + password (tinggi 40px, radius 6px, border hairline).
        Tombol primer full-width "Masuk". Link "Lupa password?" caption di kanan atas form.
State: idle, focused (border #6e5ae6 + ring 3px 18%), error (teks #b91c1c
       di bawah field, spesifik "Email atau password tidak cocok"), loading
       (spinner inline di tombol, tombol disabled, pointer-events none),
       Hub tidak terjangkau -> pesan <=5 detik, form lokal tetap jalan.
DO NOT: ilustrasi, gradient, glassmorphism, kartu sosial-login berjajar, checkbox
        "ingat saya" besar, hero apa pun.
```

### 2. Register Page
```
Page: Register
Surface: Operate
Layout: Blueprint D, sama persis dengan login — jangan bikin varian layout lain.
Elemen: nama organisasi, email, password, konfirmasi password, tombol "Buat akun".
        Helper text caption #62676f di bawah tiap field (aturan panjang password).
State: idle -> focused -> loading -> error (email sudah dipakai, inline) -> sukses
       (redirect /tickets, tanpa layar perantara).
```

### 3. Ticket List (halaman utama — paling penting)
```
Page: Ticket List
Surface: Monitor + Operate
Layout 3 kolom ala ref 01:
  [Rail ikon 56px]
  [Sidebar 236px putih, borderRight hairline]
  [Panel list tiket 340px, putih, borderRight hairline]
  [Detail flex-1, min 480px — boleh kosong kalau belum ada tiket dipilih]
Sidebar: wordmark atas. Grup label mono uppercase 11px #9aa0aa ("PRODUK", "VIEWS",
  "WORKSPACE"). Item: ikon garis 16px + label + counter jumlah di kanan
  (mono 11px, pill #ededf0; merah #fdecec/#b91c1c kalau SLA lewat).
  Item aktif: bg #f2f0fe + teks #5b46d6. Bawah: profil user. JANGAN ada kartu ringkasan harian atau progress bar di sidebar.
Top bar (48px, putih, borderBottom hairline):
  Kiri: "Tiket" heading-card + dot hijau 8px "Live · 2 menit lalu" caption.
  Kanan: search compact + ikon filter + avatar user. JANGAN lebih dari ini —
  dropdown channel, avatar stack, dan bell besar bikin toolbar rame dan tidak fokus.
Panel list:
  Header: "Percakapan · 24" + ikon compose. Search bawahnya.
  Baris (tinggi 44px, padding 10/12): avatar 26px + dot online, baris 1 = nama
  14px #101014, baris 2 = subjek 12px #62676f satu baris terpotong,
  kanan = timestamp mono 11px. Unread = dot violet 8px + nama weight 560.
  Baris aktif: bg #f2f0fe + strip kiri 2px #6e5ae6.
  Tiap 3-4 baris kasih pemisah tanggal caption mono uppercase.
Detail panel:
  Header: avatar + nama + "Online" dot hijau; tombol "Lihat profil" sekunder,
  menu "...". Sub-header mono 11px: #TKT-2231 · Prioritas Tinggi (dot merah) · SLA 42m.
  Thread: bubble masuk = bg #ededf0 border hairline. Bubble keluar = bg #f2f0fe
  border violet 18%. Nama + waktu mono 11px di atas tiap bubble.
  Internal note: bg rgba(217,119,6,.07) + strip kiri 2px #d97706 + label "INTERNAL" mono.
  Composer: putih + border hairline + shadow hairline. Textarea 3 baris, toolbar
  bawah (lampiran, makro, internal-note toggle), tombol violet "Kirim".
States: loading (skeleton 8 baris list), empty ("Tidak ada tiket cocok filter" +
  "Bersihkan filter"), error (banner + retry),
  bulk-select (checkbox muncul saat hover; header list berubah jadi "3 dipilih" +
    tombol Setujui/Tugaskan/Tutup).
  DO NOT: hero section, stat besar di atas, layout centered, tabel polos di halaman penuh.
  DO NOT tambah ke detail pane: metadata/host/trace ID, system telemetry,
  error dump, automation log, atau panel eskalasi. Detail pane cuma:
    header tipis + thread + internal note + composer.
  Telemetry/teknis: kalau perlu, hanya satu disclosure "Lihat detail teknis"
  yang TERTUTUP default. Jangan tampil terbuka.
```

### 4. Ticket Detail (halaman terpisah / full width)
```
Page: Ticket Detail
Surface: Operate
Layout: Blueprint B tanpa pane list. Header card putih (subjek + nomor mono +
  badge status + badge prioritas + SLA hitungan mono merah kalau kritis).
  Body split: kiri flex-1 (min 560px), kanan sidebar meta 300px.
Kiri: timeline status (SLA bar + transisi, tiap transisi ada aktor + waktu mono),
  thread komentar (avatar 26px + nama + waktu mono + body + thumbnail lampiran),
  form balasan (textarea + toggle "Catatan internal" + lampiran + tombol kirim).
  Catatan internal: strip kiri kuning + badge INTERNAL.
Kanan (300px, panel putih, borderLeft hairline): assignee dropdown, grup dropdown, tag (pill editable),
  info requester (card kecil: email, telepon, organisasi, mono untuk ID),
  status SLA, skor CSAT.
Composer juga punya tombol sekunder "Draf dengan AI" (US-B35) di kiri, sejajar
  baris aksi composer — BUKAN tombol primer, BUKAN di toolbar terpisah.
  Saat diklik: spinner di tombol -> draf masuk ke textarea sebagai teks editable.
  Di bawah textarea muncul baris caption 12px #62676f "Sumber: <judul artikel KB>"
  dengan tautan tiap artikel. Kalau tidak ada artikel cocok: caption
  "Tidak ada artikel KB yang cocok" dan textarea dibiarkan kosong.
  Kalau penyedia AI mati: error inline #b91c1c + tombol "Coba lagi" di baris yang
  sama; textarea tetap bisa ditulis manual (jangan pernah kunci composer).
  Kalau fitur dimatikan di Settings: tombol ini tidak dirender sama sekali.
State: loading (skeleton header + 3 blok), empty ("Belum ada balasan" + CTA),
  error (banner + retry), resolved (badge hijau + composer terkunci dengan alasan),
  drafting (spinner di tombol AI, composer tetap editable), draft-ready (teks +
  baris sumber), no-source (caption "tidak ada artikel KB yang cocok").
```

### 5. KB Page
```
Page: Knowledge Base
Surface: Explore
Layout: Blueprint A — rail 56 + sidebar kategori 236px + konten utama (pane scroll).
Kiri: kategori collapsible + jumlah artikel (mono kanan). Kategori aktif bg sunken.
Kanan: breadcrumb mono 11px + search input. Di bawah: grid artikel 2 kolom, gap 12px.
Kartu artikel: judul heading-card, preview 2 baris #62676f, meta baris bawah mono 11px
  (jumlah dibaca · diperbarui 5 hari lalu) + badge "Terbit" kalau publik.
Empty: "Belum ada artikel di kategori ini" + tombol "Tulis artikel pertama".
DO NOT: kartu KB dengan ikon dokumen besar di tengah, atau grid 3 kartu rata.
```

### 6. Admin Settings
```
Page: Settings
Surface: Configure
Layout: Blueprint A + nav tab 200px di dalam pane isi — rail 56 + sidebar 236 tetap (General, Users, SLA, Webhooks,
  Email) + pane kanan (scroll sendiri).
General: nama org, upload logo (kotak dashed, bukan tombol besar), dropdown timezone.
Users: tabel (email, nama, badge role, badge status, menu aksi). Header mono.
SLA: satu card per policy (nama, prioritas badge, waktu respons pertama mono,
  waktu selesai mono, toggle aktif). Card putih + shadow card.
Webhooks: card per webhook (nama, URL mono terpotong, terakhir dipicu mono, toggle, hapus).
Email: alamat inbound mono di dalam well #ededf0 + tombol salin, instruksi forwarding.
State: skeleton form, empty tiap tab, inline error per field,
  unsaved changes -> sticky bar bawah "Perubahan belum disimpan" + Simpan/Batal.
```

### 7. Reports (kinerja tim)
```
Page: Reports
Surface: Configure
Layout: Blueprint A — shell app penuh (rail 56 + sidebar 236 + top bar 48 + pane isi).

BUKAN dashboard kartu. Struktur: baris alat 44px (rentang waktu kiri, dropdown
  agen, tombol sekunder "Ekspor CSV" kanan), lalu DUA bagian:
1. Baris KPI sebagai BARIS TABEL (bukan kartu ikon): label caption #62676f +
   angka mono 20px #101014 + delta mono 11px (naik hijau / turun merah, pakai
   teks bukan panah dekoratif). Metrik: tiket selesai · rata-rata first response ·
   rata-rata resolusi · tingkat pelanggaran SLA · CSAT (US-B24).
2. Tabel per agen: header 36px mono-label #62676f bg #f7f7f8, baris 48px,
   hairline. Kolom: agen (26px avatar + nama) · tiket selesai (mono, rata KANAN) ·
   first response (mono, rata KANAN) · resolusi (mono, rata KANAN) · SLA breach
   (badge pill tint merah kalau >0, mono) · CSAT (mono, rata KANAN).
   Baris bisa diurut ulang dari header kolom.

State WAJIB: loading (skeleton baris), empty ("Belum ada data periode ini" +
  tombol "Ubah rentang"), error (retry), periode tanpa tiket ("Tidak ada tiket
  pada rentang ini").
JANGAN: grafik garis/area, donut chart, kartu ikon bulat warna-warni, heatmap.
```

### 8. Lacak Tiket (publik, tanpa akun)
```
Page: Lacak Tiket
Surface: Explore — halaman PUBLIK, tanpa shell app, tanpa rail/sidebar.
Layout: Blueprint D — kartu putih 560px, center viewport, di atas page #f7f7f8.
  Ini pengecualian centered yang sah (halaman masuk, bukan halaman kerja).

Isi kartu:
- Wordmark teks "Helpdesk" (Inter 1.25rem, #101014) + caption #62676f.
- Input "Kode tiket" (mono, placeholder "TKT-2231") + tombol primer "Lacak".
  Label caption DI ATAS input, tinggi 40px, radius 6px, border hairline.
- Setelah ketemu: ringkasan tiket di dalam kartu — kode (mono) · status (badge
  pill) · prioritas (badge) · waktu diperbarui (mono). Di bawahnya timeline
  ringkas: balasan publik saja, mono timestamp, TANPA catatan internal.
- Akses lewat token tautan dari email (US-B20), bukan tebak kode. Kode salah
  atau kedaluwarsa -> pesan #b91c1c inline di bawah field, spesifik.

State WAJIB: idle · loading (spinner di tombol) · tidak ketemu (inline error) ·
  kedaluwarsa (inline error + hint minta tautan baru) · ketemu (ringkasan).
JANGAN: catatan internal ikut tampil, data pelanggan lain, daftar tiket,
  login/signup di halaman ini, ilustrasi atau gradient.
```

---

## A — Platform Pages (AI SaaS workflow builder)

**Blueprint: A** (shell app) atau **A-editor** (App Builder & Workflow Builder —
full bleed, TANPA sidebar app, top bar ber-tab).
**Referensi:** pakai *sistem* ref 01 (rail + counter angka) tapi ini builder —
canvas harus beda jelas dari panel. Canvas `#f1f1f4`, semua node **putih + shadow** -> pop.

### 1. Apps List
```
Page: Apps List
Surface: Operate
Layout: Blueprint A — rail 56 + sidebar 236 + main.
Main: header "Apps" + tombol primer "Aplikasi baru" (kanan).
Baris toolbar: search input + filter "Status" + segment "Semua/Saya/Tim" (angka mono).
Grid kartu 3 kolom, gap 12px. Kartu: nama app (heading-card), slug mono 11px #62676f,
  deskripsi 2 baris, footer meta (badge status + "diubah 2j lalu" mono).
Empty: "Belum ada aplikasi" + 2 CTA: primer "Buat dari prompt", sekunder "Mulai kosong".
Loading: 6 skeleton kartu.
DO NOT: kartu dengan ikon besar di tengah, grid 2 kolom longgar.
```

### 2. App Builder (halaman tersulit)
```
Page: App Builder
Surface: Configure
Layout: Blueprint A-editor — full bleed, TANPA sidebar app, top bar ber-tab.
3 panel:
  Palette kiri 220px (putih): grup label mono uppercase + item draggable
    (ikon 16px + label 13px). Hover bg #f1f1f3. Border hairline kanan.
  Canvas tengah flex 1: bg #f1f1f4, grid titik halus 16px rgba(15,23,42,.05).
    Komponen dirender sebagai kotak PUTIH + shadow card -> kontras jelas dari canvas.
    Hover: selection ring 3px rgba(110,90,230,.18). Terpilih: border 1.5px #6e5ae6.
    Kosong: drop zone dashed 1px rgba(15,23,42,.18) + teks #62676f "Tarik komponen ke sini"
      + di bawahnya hint mono "⌘K untuk tambah cepat".
  Inspector kanan 280px (putih): sub-header nama komponen + badge tipe mono.
    Field: label caption #62676f DI ATAS input. Input merah border kalau invalid.
    Bawah: tombol "Hapus komponen" teks merah (bukan tombol merah solid).
Top toolbar 56px (putih, borderBottom hairline): nama app editable inline,
  tab halaman horizontal (tab aktif underline 2px violet), undo/redo ikon,
  "Pratinjau" sekunder, "Generate dengan AI" violet, "Terbitkan" sekunder.
State: drag-over (drop zone highlight), selected (inspector sinkron), empty canvas,
  invalid prop (border merah + pesan), max komponen tercapai (toast + disable drag).
DO NOT: canvas gelap, node gelap, garis penghubung tebal warna-warni.
```

### 3. AI Prompt Modal
```
Page: AI Prompt Modal
Surface: Command/Inspect
Layout: Overlay (bukan halaman) — modal centered 560px, putih, radius 12px, shadow dialog, overlay rgba(16,16,20,.40).
Elemen: judul heading-section + caption penjelas. Textarea auto-grow 4-6 baris
  (bg #f7f7f8, border hairline). Di bawah: contoh prompt sebagai pill yang bisa diklik
  (mono 11px, bg sunken). Footer: "Batal" sekunder kiri, "Generate" violet kanan.
State: idle (tombol disabled sampai ada teks), generating (spinner + "AI sedang menyusun..."
  + tombol Batal), result (kartu preview: nama, halaman, jumlah komponen mono),
  error (pesan #b91c1c + tombol "Coba lagi").
DO NOT: ilustrasi robot/otak, gradient, animasi konfeti.
```

### 4. Data Table View
```
Page: App Data
Surface: Monitor
Layout: Blueprint A — rail 56 + sidebar 236 + toolbar 44 + tabel full width
  (satu-satunya pane yang scroll). Klik baris -> drawer 420px dari kanan.
Kolom: dinamis dari label komponen. Header mono-label #62676f, bg #f7f7f8.
Drawer 420px putih, shadow elevated, slide dari kanan (TIDAK menutup konteks tabel):
  JSON mentah dalam blok mono bg #ededf0, plus
  meta (waktu masuk mono, sumber, ID).
Empty: "Belum ada data. Bagikan aplikasi untuk mulai menerima respons." + tombol salin link.
Bulk: checkbox hover + header "N baris dipilih" + tombol ekspor/hapus.
```

### 5. Workflow Builder
```
Page: Workflow Builder
Surface: Configure
Layout: Blueprint A-editor — full bleed, TANPA sidebar app. Palette 220 + canvas
  flex-1 + inspector 280. Canvas TIDAK scroll (pan & zoom), palette & inspector scroll.
Node: kartu putih radius 8px + shadow node (1px hairline + 2 lapis sebaran),
  ikon 16px + label aksi 13px + badge konfigurasi mono.
Edge: 2px rgba(15,23,42,.14) dengan panah kecil; saat node terpilih -> #6e5ae6.
Palette kiri: grup "Trigger" dan "Aksi", item draggable + hint mono.
Kanvas kosong: "Tarik trigger untuk mulai" + contoh mini alur 3 node abu.
Inspector kanan: form config node terpilih (label di atas input).
Top: nama workflow editable, dropdown tipe trigger, toggle "Aktif".
State: selected (inspector sinkron), invalid node (border merah + pesan),
  cycle terdeteksi (banner kuning + sebut nama node), unsaved (dot kuning di judul).
DO NOT: node berwarna-warni per tipe, edge gradient, background gelap.
```

### 6. Workflow Runs (riwayat eksekusi)
```
Page: Workflow Runs
Surface: Operate
Layout: Blueprint A — shell app penuh (rail 56 + sidebar 236 + top bar 48 + pane isi).
Referensi rasa: tabel ref 04 (rapat, mono, filter di baris alat).

Baris alat 44px: search kiri, dropdown status (Semua/Sukses/Gagal/Dilewati),
  rentang waktu, tombol sekunder "Ekspor CSV" kanan.
Tabel: header 36px mono-label #62676f bg #f7f7f8, baris 48px, hairline antar baris.
  Kolom: waktu mulai (mono, rata KANAN) · workflow (nama + versi mono) · pemicu ·
  durasi (mono, rata KANAN) · langkah (mono "5/5" atau "3/5") · status (badge pill
  tint pastel: Sukses hijau / Gagal merah / Berjalan abu) · biaya token (mono,
  rata KANAN) · chevron.
Klik baris = drawer kanan 420px: timeline langkah per langkah (nama langkah,
  durasi mono, status dot 8px, payload masuk/keluar di well #ededf0), dan untuk
  langkah gagal: pesan error + tombol sekunder "Coba lagi dari langkah ini".

State WAJIB: loading (skeleton 3 baris), empty ("Belum ada eksekusi" + CTA
  "Jalankan uji"), error (retry), filter tanpa hasil ("Tidak ada eksekusi yang
  cocok" + tombol "Reset filter").
JANGAN: grafik garis, 4 stat card di atas tabel, badge status warna-warni
  menyala, sparkline durasi.
```

### 7. Metrik & Biaya (internal)
```
Page: Metrics
Surface: Configure
Layout: Blueprint A — shell app penuh, pane isi berisi daftar angka + tabel.

BUKAN dashboard kartu. Bentuknya: satu baris KPI ringkas (4 angka, tapi sebagai
  BARIS tabel bukan kartu ikon: label caption #62676f + angka mono 20px #101014
  + delta mono 11px), di bawahnya tabel rincian.
Tabel rincian: header 36px mono-label, baris 48px, hairline. Kolom: metrik
  (mono) · nilai (mono, rata KANAN) · satuan · jendela waktu · catatan.
Sumber: `/health` + `/ready` (US-A29) dan hasil run workflow (US-A25).
  Tampilkan juga status per komponen (dot 8px hijau/merah/kuning + latensi mono).

State WAJIB: loading (skeleton baris), empty ("Belum ada data metrik"),
  error (retry), komponen tidak terjangkau -> dot kuning "tidak diketahui".
JANGAN: grafik donut, kartu ikon bulat warna-warni, gauge, hero angka besar
  di tengah.
```

### 8b. App Settings (per-aplikasi)
```
Page: App Settings
Surface: Configure
Layout: Blueprint A + nav tab 200px di dalam pane isi — rail 56 + sidebar 236
  tetap (General, Sumber Data, Anggaran AI, Zona Berbahaya) + pane kanan.
General: nama app, slug (mono, prefix domain ditampilkan statis), deskripsi,
  toggle "Terbitkan" (US-A08) dengan baris konsekuensi di bawahnya ("Slug berubah
  -> tautan lama mati"), toggle "Wajib login untuk submit".
Sumber Data (US-A26): tabel sumber (nama · tipe badge · status koneksi dot 8px ·
  terakhir diuji mono). Aksi: "Uji koneksi" (spinner di tombol, hasil inline),
  "Ganti kredensial" -> modal. Kredensial TIDAK PERNAH ditampilkan kembali —
  hanya "terakhir diperbarui <tanggal>". Kalau gagal: banner #fdecec + #b91c1c.
Anggaran AI (US-A17): baris "Pemakaian bulan ini" + angka mono + bar tipis
  (track #ededf0, isi #6e5ae6), batas bulanan input 40px + satuan, toggle
  "Hentikan generasi saat batas tercapai". Kalau lewat batas: bar isi #b91c1c
  + teks peringatan. BUKAN gauge, BUKAN donut.
Zona Berbahaya (US-A07): card border #fdecec, judul "Hapus aplikasi", teks
  konsekuensi konkret (jumlah halaman + baris data yang ikut terhapus, angka
  mono), lalu input konfirmasi ketik nama app + tombol merah #b91c1c.
State: skeleton form, empty sumber data, inline error per field, unsaved ->
  sticky bar bawah "Perubahan belum disimpan" + Simpan/Batal.
```

### 8. Workspace Settings
```
Page: Workspace Settings
Surface: Configure
Layout: Blueprint A + nav tab 200px di dalam pane isi — rail 56 + sidebar 236 tetap (General, Anggota, Peran,
  Kredensial, Integrasi) + pane kanan (scroll sendiri). Shell sama dengan B Settings.

General: nama workspace, upload logo (kotak dashed, bukan tombol besar), dropdown
  timezone, pemilih bahasa default.
Anggota (US-A03): baris alat 44px (search kiri, tombol primer "Undang anggota"
  kanan). Tabel: header 36px mono-label #62676f bg #f7f7f8, baris 48px, hairline.
  Kolom: nama (26px avatar + nama) · email (mono 12px) · peran (badge pill) ·
  status (badge: Aktif / Menunggu undangan) · terakhir aktif (mono, rata KANAN) ·
  menu aksi rata kanan. Aksi baris: ubah peran, cabut akses.
  Aturan yang harus kelihatan di UI: admin terakhir tidak bisa diturunkan —
  pilihannya disabled + caption alasan (US-A04 AC4).
Peran (US-A04): daftar tiga peran tetap (admin, builder, viewer) dengan
  deskripsi satu baris masing-masing, plus MATRIKS PERMISSION BACA-SAJA di
  bawahnya (baris = aksi, kolom = peran, sel = centang/garis). Matriks ini
  dokumentasi, bukan editor — sel tidak bisa diklik. Caption 12px #62676f
  menjelaskan itu. JANGAN tombol "Tambah peran".
Kredensial (US-A26): satu card per kredensial sumber data (nama, tipe, terakhir
  dipakai mono, tombol hapus). Nilai rahasia TIDAK PERNAH ditampilkan — tampilkan
  well #ededf0 bertuliskan "••••••••" + tombol ganti.
Integrasi: alamat webhook keluar (mono di dalam well #ededf0 + tombol salin),
  status aktif, log pengiriman terakhir (mono).

State WAJIB: skeleton form, empty tiap tab, inline error per field,
  unsaved changes -> sticky bar bawah "Perubahan belum disimpan" + Simpan/Batal.
JANGAN: 4 stat card, permission matrix yang bisa diklik, avatar besar di atas
  form profil.
```

### 9. Onboarding (user Hub tanpa keanggotaan)
```
Page: Onboarding
Surface: Explore
Layout: Blueprint D — kartu putih 560px, center viewport, page #f7f7f8.

Ini yang muncul saat user login lewat Hub tapi belum punya keanggotaan di
workspace mana pun (US-M10 AC1). Dua pilihan, sebagai dua kartu 1 kolom
(bukan grid), masing-masing: judul (16px weight 560) + deskripsi 1 baris
#62676f + chevron:
1. "Buat workspace baru" — langsung bikin workspace dan user jadi admin.
2. "Saya punya undangan" — input email + tombol "Cari undangan"; kalau ketemu,
   tampilkan daftar undangan tertunda (nama workspace + peran yang ditawarkan +
   tombol Terima).

Caption di bawah kartu: 12px #62676f yang bilang peran ditentukan pemilik
workspace, bukan dipilih sendiri di sini.

State WAJIB: idle · loading (skeleton daftar undangan) · tidak ada undangan
  ("Tidak ada undangan untuk email ini" + hint hubungi admin workspace) ·
  error (retry).
JANGAN: daftar semua workspace yang ada (kebocoran), pemilih peran untuk diri
  sendiri, ilustrasi.
```

---

## C — Code Review Pages

**Blueprint: C-list** (tabel di shell A) atau **C-detail** (split temuan + meta 300px).
**Referensi:** *sistem* ref 01 + tabel ref 04. Severity = DOT + LABEL + tint + strip.

### 1. Dashboard/Stats
```
Page: Code Review Dashboard
Surface: Monitor
Layout: Blueprint A — rail 56 + sidebar 236 (Repos, PR, Statistik + counter mono)
  + konten utama (pane scroll tunggal).
Baris 1 = 4 stat card (PR Ditinjau, Isu Kritis, Rata-rata Temuan/PR, Repo Terhubung).
  Kartu: bg putih, border hairline, shadow card. ANGKA besar mono 32px weight 590 #101014,
  label mono 11px #62676f di BAWAH angka, delta kecil (naik hijau / turun merah) mono 11px.
  JANGAN pakai ikon bulat warna-warni.
Baris 2: line chart 7 hari. Garis #6e5ae6 2px + area fill 8%. Grid horizontal tipis
  rgba(15,23,42,.06), tanpa garis vertikal. Sumbu pakai mono 11px #62676f.
Baris 3: tabel "Isu Terbanyak Minggu Ini" (judul, jumlah mono kanan, panah tren).
State: loading (skeleton 4 kartu + chart shimmer), empty ("Hubungkan repo pertama" + CTA),
  error (banner + retry). Angka 0 -> tampilkan "—" mono, bukan "0".
```

### 2. Repo List
```
Page: Repos
Surface: Operate
Layout: Blueprint C-list — toolbar 44px + tabel (pane scroll). Header kolom sticky.
Baris tinggi 48px: nama repo (14px #101014), org mono 11px #62676f, terakhir ditinjau mono,
  jumlah PR mono, dot status (hijau #16a34a sehat / merah #dc2626 ada kritis).
Hover bg #f1f1f3.
Empty: "Belum ada repo terhubung" + CTA "Hubungkan dengan GitHub".
```

### 3. PR List (per repo)
```
Page: PR List
Surface: Operate + Monitor
Layout: Blueprint C-list — rail + sidebar + top bar (breadcrumb mono di kiri).
  toolbar 44px: segmen status + chips severity + rentang tanggal, aksi di kanan. Tabel scroll.
Tabel kolom: PR# (mono), Judul, Penulis (avatar 26px + nama), Status (badge:
  menunggu=neutral, selesai=success, ada kritis=danger), Total temuan (mono kanan),
  Kritis (mono merah), Tinggi (mono oranye). Angka rata KANAN.
Klik baris -> PR Detail. Hover bg #f1f1f3.
Bulk: checkbox hover + header "N PR dipilih" + tombol "Tinjau ulang".
```

### 4. PR Detail (halaman paling penting)
```
Page: PR Detail
Surface: Monitor + Inspect
Layout: Blueprint C-detail — header card putih penuh lebar (PR# mono + judul, penulis,
  repo, branch mono, jumlah file mono, tombol "Tinjau ulang"), di bawahnya SPLIT TETAP:
  daftar temuan flex-1 (min 560px, scroll) | sidebar meta 300px (scroll sendiri).
  Temuan digrup per severity; kritis/tinggi default terbuka, sedang/rendah terlipat.
Severity — WAJIB dot + label teks, warna saja nggak kebedain:
  kritis -> dot #b91c1c + strip kiri 3px #b91c1c + tint rgba(185,28,28,.06) + label "KRITIS"
  tinggi -> dot #dc2626 + strip #dc2626 + tint rgba(220,38,38,.04) + label "TINGGI"
  sedang -> dot #d97706 + strip #d97706 + tint rgba(217,119,6,.05) + label "SEDANG"
  rendah -> dot #9aa0aa + strip #9aa0aa + transparan + label "RENDAH"
Tiap temuan: judul 14px weight 560, path file:baris mono 11px #62676f, deskripsi,
  snippet kode mono di blok bg #fbfbfc border hairline (baris tambah bg rgba(22,163,74,.10)
  + strip kiri hijau, baris hapus bg rgba(220,38,38,.08) + strip kiri merah,
  nomor baris mono abu di gutter), saran italic. TIDAK ADA tombol "Buat
  perbaikan" — NG2: menulis patch itu non-goal, jangan render affordance-nya.
Terlipat: dot + judul + path. Terbuka: isi penuh.
Empty: centang hijau + "Tidak ada isu — PR bersih!" + caption "PR jenis ini yang terbaik."
Loading: skeleton 5 kartu temuan.
DO NOT: emoji (🐛🔒), badge warna solid tebal, strip kiri yang cuma dekorasi.
```

### 5. Settings per Repo
```
Page: Repo Settings
Surface: Configure
Layout: Blueprint A + nav tab 200px di dalam pane isi — rail 56 + sidebar 236 tetap + form kanan (scroll sendiri).
  Field: label caption di atas input.
Isi: toggle agen (Bug/Security/Style) — toggle violet, bukan biru; dropdown ambang severity;
  input maksimal temuan (mono); (TIDAK ADA toggle auto-fix — NG2, masuk v2);
  dropdown model per agen + badge mono nama model.
State: skeleton, inline error, unsaved -> sticky bar bawah.
```

---

## 🔐 Hub — Halaman Masuk Terpadu (SEMUA project)

Halaman milik **Hub** (identity provider portofolio), bukan milik app A/B/C.
Buat SEKALI, dipakai ketiganya. Keputusan yang mengikat: **langsung redirect,
tanpa layar persetujuan per-app**.

### 1. Hub — Login
```
Layout: Blueprint D — kartu putih 380px, center viewport, di atas page #f7f7f8.
Elemen:
- Wordmark teks "Portico" (bukan gambar), Inter 1.25rem, #101014.
- Input email + password (label di atas, bukan placeholder-only, tinggi 40px).
- Tombol primer full-width "Masuk" (violet solid).
- Divider tipis "atau" (garis hairline + teks caption tengah) + 1 tombol sekunder.
- Baris error: teks #b91c1c di bawah field, spesifik ("Email atau password tidak cocok"),
  BUKAN toast yang hilang sendiri.
State WAJIB: loading (spinner di tombol, disabled), error (inline), empty (n/a),
  sukses (redirect tanpa layar perantara).
DO NOT: ilustrasi, gradient, glassmorphism, kartu sosial-login berjajar.
```

### 1b. Hub — Register (akun Hub)
```
Page: Hub Register
Layout: Blueprint D — kartu putih 380px, center viewport, di atas page #f7f7f8.
Elemen:
- Wordmark teks "Portico", Inter 1.25rem, #101014.
- Input nama, email, password (label di atas, tinggi 40px). Baris kekuatan password
  (3 segmen tipis, bukan meter besar).
- Tombol primer full-width "Buat akun" (violet solid).
- Divider tipis "atau" + 1 tombol sekunder "Masuk".
- TANPA tombol "Masuk lewat Hub" (di Hub sendiri tombol itu melingkar).
State WAJIB: loading (spinner di tombol, disabled), error (inline per field +
  ringkasan #b91c1c), sukses (redirect ke Hub — Pilih App, BUKAN ke app tertentu;
  user Hub baru belum punya akses app mana pun).
DO NOT: ilustrasi, gradient, kartu sosial-login berjajar, checkbox "setuju S&K" palsu.
```

### 2. Hub — Pilih / Lanjut ke App
```
Layout: Blueprint D (lebar 560px) — daftar kartu 1 kolom, center viewport.
Elemen:
- Header "Lanjutkan ke aplikasi" (heading-section).
- Satu kartu per app terdaftar: nama app (heading-card), deskripsi 1 baris #62676f,
  chevron kanan. Klik = langsung redirect dengan Authorization Code (TANPA consent).
- App yang redirect-URI-nya tidak di allowlist TIDAK muncul dan tidak bisa dituju.
- App yang user-nya TIDAK punya akses: kartu tetap tampil tapi DISABLED —
  opacity turun, chevron hilang, cursor not-allowed, dan di bawah deskripsi ada
  satu baris caption 12px #62676f alasan ("Belum punya akses — minta undangan").
  Klik tidak melakukan apa pun. Server tetap menolak redirect-nya (403), jadi
  disabled-nya bukan satu-satunya penjaga.
State WAJIB: loading skeleton daftar, error (retry), empty ("Belum ada aplikasi terdaftar"),
  no-access (semua kartu disabled + caption "Belum ada aplikasi yang bisa diakses").
```

### 2a. SHELL HUB (rail + sidebar) — PATOKAN, jangan diarang sendiri
```
Rail 56px (sama seperti A/B/C, tapi Portico ikut jadi entri switcher):
  [Portico] <-AKTIF (bg #f2f0fe, ikon violet #6e5ae6)
  [A] Platform · [B] Helpdesk · [C] Code Review
  --- divider tipis ---
  [settings] paling bawah
  Urutan & isi rail IDENTIK di semua halaman Hub yang bershell.

Sidebar 236px (putih, borderRight hairline):
  Header: wordmark teks "Portico" (Inter 1.25rem #101014)
  Item: Pengguna · Peran
  Item aktif: bg #f2f0fe + teks #5b46d6 + strip kiri 2px violet
  Bawah: profil user (avatar 26px + nama)
  TIDAK ADA item lain. JANGAN tambah "Overview", "Directory",
  "Audit Logs", "Security", "Laporan", badge organisasi, atau metrik
  apa pun — Hub cuma punya dua halaman bershell.

Top bar 48px: HANYA di atas pane isi (tidak menge-span sejajar rail/sidebar).
  Kiri: judul halaman (heading-section). KANAN: avatar user. Tidak lebih.
  JANGAN breadcrumb, JANGAN pengalih organisasi, JANGAN kotak search global.

Nav tab 200px: TIDAK ADA di Hub. Sidebar 236 sudah memuat seluruh navigasi Hub.
  JANGAN bikin kolom nav kedua — itu bikin Stitch ngarang isinya.
```

### 2b. Hub — Users (kelola user Hub)
```
Page: Hub Users
Layout: Blueprint A — rail 56 + sidebar 236 (Pengguna, Peran) + top bar 48 + pane isi.
  TANPA nav tab. Lihat §2a SHELL HUB.

Pane Users: baris alat 44px (search kiri, tombol primer "Undang user" kanan).
Tabel: header 36px mono-label #62676f bg #f7f7f8, baris 48px, hairline antar baris.
  Kolom: nama (26px avatar + nama) · email (mono 12px) · akses app (3 badge kecil,
  satu per app A/B/C — badge abu #ededf0 kalau tidak punya akses) · status
  (badge pill: Aktif / Menunggu undangan) · menu aksi rata kanan.
Kolom angka/tanggal rata KANAN + font mono.
Klik baris = drawer kanan 420px: detail user + editor akses app (toggle per app)
  + pemilih peran per app (dropdown yang isinya mengikuti app-nya).
State WAJIB: loading (skeleton 3 baris), empty ("Belum ada user" + CTA undang),
  error (retry), unsaved changes -> sticky bar bawah.
JANGAN: 4 stat card di atas tabel, ikon bulat warna-warni, kartu grid.
```

### 2c. Hub — Roles (kelola peran & matriksnya)
```
Page: Hub Roles
Layout: Blueprint A — rail 56 + sidebar 236 (Pengguna, Peran) + top bar 48 + pane isi.
  TANPA nav tab. Lihat §2a SHELL HUB.

Pane Roles: daftar peran DIKELOMPOKKAN PER APP — grup label mono uppercase 11px
  #9aa0aa ("PLATFORM", "HELPDESK", "CODE REVIEW"), lalu baris peran di bawahnya.
  Tiap baris 48px: nama peran (14px #101014) · jumlah user (mono 12px #62676f,
  rata kanan) · chevron.
Pilih satu peran = pane kanan menampilkan MATRIKS PERMISSION, baca-saja:
  baris = aksi, kolom = peran se-app, sel = centang/garis.
  Ini tabel keputusan, bukan editor — sel tidak bisa diklik (lihat NG11).
  Judul di atas matriks: "Akses peran" + caption 12px #62676f yang bilang
  matriks ini dokumentasi, bukan konfigurasi.
Vocabulary per app (JANGAN diseragamkan):
  - Platform   : admin · builder · viewer
  - Helpdesk   : admin · agent · customer
  - Code Review: akses per repo (bukan peran app) — barisnya menjelaskan bahwa
                 akses C diberikan per-repo lewat GitHub App installation, bukan
                 lewat peran Hub. Tandai dengan caption, jangan bikin role palsu.
State WAJIB: loading (skeleton), empty ("Belum ada peran"), error (retry).
JANGAN: editor permission matrix yang bisa diklik, tombol "Tambah peran",
  role builder generik, permission granular per-resource.
```

### 2d. Hub — Status & Akses user (bukan halaman terpisah)
```
Tidak perlu halaman baru: status akses user muncul di dua tempat yang sudah ada —
badge "akses app" di tabel Users, dan toggle per app di drawer detail user.
```

### 3. App — Tombol "Masuk lewat Hub" (di login tiap app)
```
Di halaman Login tiap app (A/B/C), di ATAS form email+password:
- Tombol sekunder full-width "Masuk lewat Hub" + pemisah "atau login lokal".
- Form email+password TETAP terlihat dan tetap bisa dipakai (bukan fallback tersembunyi):
  ini jalur pemulihan saat Hub mati dan wajib lolos AC PRD masing-masing.
State WAJIB: kalau Hub tidak terjangkau, klik tombol menampilkan pesan jelas dalam
  <=5 detik ("Hub tidak bisa dihubungi, silakan login lokal"), form lokal tidak terpengaruh.
Catatan: spec Login & Register di section B dipakai **verbatim** untuk A dan C.
  Kartu 380px Blueprint D, field sama, cuma wordmark-nya beda ("Platform" / "CodeReview").
  Halaman ini WAJIB ada di ketiga app — jangan dilewat.
```

### 4. B — Badge Notifikasi Breach SLA (navbar)
```
Di navbar helpdesk, sebelum avatar:
- Ikon bell + badge angka (pill #fdecec teks #b91c1c, mono 11px) jumlah tiket breach
  yang belum di-dismiss (per user). Angka 0 = badge disembunyikan.
- Klik = dropdown maksimal 5 tiket terbaru (kode tiket mono, judul, nama SLA, waktu breach).
  Tiap item ada tombol dismiss; dismiss per-user dan persisten.
State WAJIB: loading (skeleton 3 baris), empty ("Tidak ada pelanggaran SLA"), error (retry).
Catatan: pelanggan (role customer) TIDAK melihat badge ini.
```

### 5. Health / Status (publik, minimal)
```
Layout: Blueprint D (lebar 560px, center). Halaman /status sederhana untuk
portofolio (bukan dashboard ops):
- Satu baris per komponen: nama, dot status (hijau #16a34a / merah #dc2626 /
  kuning #d97706), latensi ms (mono, rata kanan).
- Tanpa grafik, tanpa tabel berat. Sumber: GET /ready tiap app.
State WAJIB: loading, error (endpoint tidak terjangkau -> tampilkan "tidak diketahui" kuning).
```

---

## ✅ Urutan Generate yang Disarankan

1. Paste Surface Rules + Anti-Slop Rules.
2. Paste `*-DESIGN.md` project + **Layout Blueprint** (shell + blueprint-nya).
3. Generate **Ticket List / PR Detail / App Builder** dulu (halaman tersulit).
   Kalau halaman ini udah bener, sisanya gampang — dan kalau salah, ketahuan di awal.
4. Baru generate halaman list/settings/modal yang lebih sederhana.
5. Tiap halaman: generate **happy path + empty + loading** sekaligus, jangan belakangan.
6. Kalau hasil mulai generic: paste ulang Anti-Slop Rules, sebut halaman mana yang
   kurang dan apa yang salah (mis. "kurang density, baris list terlalu tinggi").

**Cek cepat sebelum lanjut ke halaman berikutnya (kalau gagal → regenerate, jangan diteruskan):**
- Top bar & sidebar-nya identik dengan halaman sebelumnya?
- Cuma pane yang ditandai yang scroll? Body-nya nggak ikut scroll?
- Lebar rail/sidebar/list-nya pas dengan tabel patokan (56/236/340)?
- Ada halaman yang kontennya di-center padahal bukan login? → salah
- Ada 4 stat card sama rata dengan ikon bulat warna-warni? → salah
