# Sistem desain nyimak.

## Overview

Nyimak adalah radar ringan bagi pembaca Indonesia yang ingin melihat koin meme yang dibicarakan di X. Satu halaman menempatkan daftar koin, pencarian, pengurutan, dan pembaruan sebagai pekerjaan utama. Identitasnya berupa hijau neon di atas latar gelap bernuansa hijau, dengan logo telapak tangan dan orbit radar sebagai satu perangkat ilustratif.

Konten contoh diberi label amber dan penjelasan langsung. Mode feed terhubung mempunyai label berbeda; tidak ada indikator “live” palsu. Komposisi desktop memakai daftar dan cuplikan percakapan di kanan. Ponsel memprioritaskan daftar dan menyembunyikan cuplikan samping. Ini adalah keputusan untuk halaman radar, bukan kewajiban setiap halaman baru.

## Colors

Sumber kanonis adalah `:root` di [`src/styles.css`](src/styles.css). Sistem hanya mempunyai tema gelap, dengan `color-scheme: dark` agar kontrol native menyesuaikan.

| Token | Nilai | Penggunaan |
| --- | --- | --- |
| `--color-page` | `#10130f` | Latar halaman dan input sumber |
| `--color-surface` | `#171b15` | Daftar, pencarian, select, dialog |
| `--color-hover` | `#20271c` | Bidang informasi dan aksi sekunder |
| `--color-text` | `#eff1eb` | Judul dan isi utama |
| `--color-muted` | `#a0a69b` | Keterangan dan isi sekunder |
| `--color-subtle` | `#899180` | Metadata, label kolom, ikon pendukung |
| `--color-border` | `#30372a` | Struktur, pemisah, dan tepi kontrol |
| `--color-accent` | `#c1ff72` | Tombol utama, pilihan aktif, tangan, grafik, dan fokus |
| `--color-accent-soft` | `#27351b` | Latar pilihan dan simpanan aktif |
| `--color-on-accent` | `#18220e` | Teks pada tombol neon |
| `--color-error` | `#ffb7a9` | Pesan kesalahan |

Label contoh memakai teks `#d0c693`, latar `#25251b`, dan border `#4b4931`. Banner gagal memakai latar `#2c201a` dan border `#674538`. Warna avatar koin adalah ilustrasi; tidak menandakan status atau kualitas token. Orbit, post, dan efek hover mempunyai nada pendukung lokal yang tercantum pada kelas komponennya, bukan tema kedua.

Pasangan solid yang benar-benar dihitung saat validasi: teks utama/latar halaman **16,44:1**; teks sekunder/latar halaman **7,51:1**; metadata/surface **5,34:1**; teks aktif/latar pilihan **11,06:1**; teks tombol/neon **13,98:1**; label contoh/latar label **8,96:1**; pesan gagal/latar banner **9,48:1**. Probe juga mengukur teks yang dirender pada halaman awal. Nilai tersebut tidak menyatakan setiap kemungkinan isi feed, browser, atau keadaan telah diaudit.

## Typography

Font lokal **Manrope**, variable WOFF2 400–800, memakai fallback `Arial, sans-serif`. Berkas: [`public/assets/manrope-latin.woff2`](public/assets/manrope-latin.woff2), dengan lisensi OFL di folder sama. Status font `loaded` diamati pada browser. Bobot yang dipakai antarmuka adalah **400, 600, 800**. `font-synthesis: none`, font smoothing, dan `lang="id"` diterapkan.

| Peran/token | Ukuran dasar | Pemakaian |
| --- | --- | --- |
| `--text-xs` | 12 px / .75 rem | Label, metadata, kontrol radar padat |
| `--text-sm` | 14 px / .875 rem | Post, nama koin, narasi singkat |
| `--text-base` | 16 px / 1 rem | Input URL dan pencarian/select ponsel |
| `--text-title` | 20 px / 1.25 rem | Brand, judul bagian/dialog, ringkasan |
| `--text-display` | 52 px / 3.25 rem | Judul halaman pada layar lebar |
| Override `--text-display` | 32 px / 2 rem | Judul halaman pada ≤ 630 px |

`--text-stat: 2rem` juga dideklarasikan sebagai ukuran cadangan, tetapi tidak dipakai komponen saat ini. Jangan menambahkan ukuran baru untuk variasi yang sudah tercakup. Judul memakai line-height sekitar 1,12–1,15 dan tracking −.055em desktop / −.045em ponsel; brand −.04em; isi tidak diberi tracking. Post memakai line-height 1,7, isi umum 1,5, dan teks pembantu 1,7. Judul diseimbangkan dengan `text-wrap: balance`, paragraf memakai `pretty`.

Angka berubah memakai `font-variant-numeric: tabular-nums`. Nama/ticker tidak dipotong dengan ellipsis: nilai panjang dapat membungkus. URL input tetap dapat digulir secara native. Pembesaran teks 200% diuji untuk overflow halaman pada 320, 390, dan 1440 px; zoom native dan pembaca layar belum diuji.

## Layout

`.page-width` membatasi konten menjadi 1200 px dengan margin desktop total 96 px. Pada ≤ 1150 px, margin total 64 px; pada ≤ 780 px menjadi 40 px; pada ≤ 370 px menjadi 32 px. Semua bagian memakai tepi konten yang sama.

Token jarak yang tersedia: `--space-1` 4 px, `--space-2` 8 px, `--space-3` 12 px, `--space-4` 16 px, `--space-6` 24 px, `--space-8` 32 px. Deklarasi komponen saat ini juga menulis nilai jarak langsung, dengan skala tersebut sebagai dasar. Jarak 6, 10, 14, 20, 28, dan nilai container khusus dipakai bila kebutuhan komponen berbeda.

- `.workspace`: kolom utama fleksibel dan kolom percakapan 300 px, gap 28 px. Pada ≤ 1150 px kolom samping 250 px/gap 24 px; pada ≤ 960 px 228 px/gap 20 px.
- Pada ≤ 780 px, kolom samping disembunyikan; konteks post tetap dapat diakses dari tombol nama koin. Data interaksi yang disembunyikan pada rentang tablet muncul kembali di grid satu kolom yang lebih luas.
- Pada ≤ 630 px, header menjadi ringkas, dekorasi tangan mengecil, ringkasan menjadi tiga kolom, input minimal 16 px, dan daftar hanya menampilkan identitas, jumlah post/akun, serta simpanan. Detail post tetap ada melalui nama koin.
- Pada ≤ 370 px, bantuan header menggunakan tanda `?`, beberapa dekorasi dan label sekunder dihilangkan. Nama aksesibel tombol tetap tersedia.
- Toolbar, judul bagian, dan kelompok filter dapat membungkus. Ringkasan mempunyai `min-width: 0` dan teks dapat membungkus untuk pembesaran teks. Tidak ada bilah atau tombol fixed yang menutupi daftar.

Daftar memakai grid CSS dengan satu `.coin-row` per artikel; ini bukan elemen HTML table. DOM tetap berurutan: identitas, hitungan post, interaksi, aktivitas, tindakan. Baris memakai `min-height`, bukan tinggi teks tetap. Dialog mempunyai tinggi maksimal viewport dan scroll vertikal internal. Layout diperiksa pada 320, 390, 630, 768, 960, 1150, dan 1440 px. Pada 390 × 844, tombol Perbarui dan baris pertama terlihat utuh.

## Elevation & Depth

Antarmuka pada dasarnya datar. Border tipis menstrukturkan daftar dan kontrol; baris dipisahkan tanpa kartu bersarang. Tidak ada kombinasi border dan shadow untuk membentuk surface. Logo tangan besar memiliki `drop-shadow` dekoratif, terpisah dari surface UI.

`Dialog` memakai elemen `<dialog>` native di top layer. Backdrop `#060904cc` dan blur 5 px meredam halaman di belakangnya. Background dinonaktifkan oleh modal native; scroll halaman dikunci sampai dialog ditutup.

## Shapes

`--radius` 12 px untuk daftar. Kontrol umumnya 8 px, tab/ikon 7 px, keyword/label 5 px, avatar dan indikator berupa lingkaran. Dialog 20 px desktop dan 16 px pada ponsel, dengan padding 28/20 px. Surface dalam modal memiliki radius 8–10 px. Orbit berbentuk lingkaran, dengan satu orbit luar putus-putus.

## Components

| Komponen/pola | Sumber | Perilaku dan keadaan |
| --- | --- | --- |
| `Dialog` | `src/App.tsx` | Fungsi lokal, judul terkait `aria-labelledby`; fokus masuk, Tab/Shift+Tab membungkus, Escape/close/backdrop menutup, fokus kembali ke pemicu |
| `PostItem` | `src/App.tsx` | Varian `compact`; author, waktu, isi, suka/repost; contoh ditandai, tautan X hanya muncul bila URL valid |
| Tombol `.primary-button` | `src/styles.css` | Neon dengan teks gelap; satu aksi utama radar. Hover lebih terang, disabled saat fetch, ikon refresh dan label memeriksa saat pending |
| `.secondary-button`, `.text-button`, `.icon-button` | `src/styles.css` | Hierarki sekunder; hover/fokus/pressed terpisah; icon-only memakai nama aksesibel |
| `.view-tabs` | `src/App.tsx` | Tombol toggle dengan `aria-pressed`, bukan tablist; Semua koin, empat teratas, dan Tersimpan; nama Tersimpan tersedia saat label visual disembunyikan |
| `.search-field`, `.select-field` | `src/App.tsx` | Input search dan select native dengan label; pencarian nama/ticker, periode 24/48 jam, tiga urutan |
| `.coin-row` | `src/App.tsx` | Nama membuka detail; bookmark toggle disimpan di browser; angka dan sparkline berasal dari post yang lolos filter |
| `CoinAvatar` | `src/icons.tsx` | SVG lokal untuk delapan ticker; inisial untuk ticker lain. Semuanya dekoratif di samping nama |
| `Sparkline` | `src/icons.tsx` | 12 bin jumlah post; dekoratif, tidak menyatakan harga. Data post tersedia dalam detail |
| `Hand` / `Icon` | `src/icons.tsx` | SVG lokal, `currentColor`, dekoratif bila disertai teks. Hand wave 2,2 detik sekali; hover brand .8 detik |
| Sakelar `.auto-button` | `src/App.tsx` | `role="switch"`, `aria-checked`, label dan posisi knob memberi cue statis; on memeriksa setiap 60 detik saat terlihat |
| Banner / empty state | `src/App.tsx` | Gagal memuat mempertahankan data lama dan menawarkan Coba lagi; hasil kosong menyebut sebab dan menawarkan Lihat semua koin |
| Form sumber feed | `src/App.tsx` | Validasi saat submit, pesan terkait input, fokus pada input gagal; koneksi baru harus berhasil sebelum sumber diganti |

Fokus keyboard memakai outline neon 2 px dan offset 4 px (input 2 px). Forced-colors memakai `Highlight`, tetapi belum diperiksa secara visual. Target minimum/spasi diperiksa oleh probe; beberapa kontrol padat masih lebih kecil dari ukuran nyaman 44 × 44 px, meskipun lolos ambang 24 px/spasi.

Transisi terbatas pada properti yang berubah dan umumnya 150 ms. Gerak tangan, spinner 1,3 detik, dan efek tekan `.96` hanya aktif saat `prefers-reduced-motion: no-preference`. Pada reduced motion, animasi dan transisi dimatikan. Tidak ada ticker bergerak terus-menerus atau animasi masuk daftar.

## Do's and Don'ts

- Mulai permukaan baru dengan `.page-width`, tipografi, dan token warna yang ada. Gunakan satu aksi neon utama untuk satu pekerjaan.
- Gunakan nama yang langsung menjelaskan tindakan. Semua isi produk baru tetap berbahasa Indonesia.
- Pertahankan label contoh, sumber feed, dan penjelasan angka. Jangan menyebut contoh sebagai live, grafik sebagai harga, atau ticker sebagai kontrak terverifikasi.
- Pakai input/button/link native; ikon dekoratif tidak menggantikan nama aksesibel. Pertahankan jalur keyboard dan preferensi gerak.
- Tambahkan data lewat `Post`/`parseFeed`/`aggregatePosts` di `src/data.ts`. Jangan menulis angka keramaian terpisah dari post yang mendasarinya.
- Untuk bagian baru, tempatkan judul singkat di tepi konten, gunakan jarak 16–32 px untuk kelompok, pilih komponen yang sudah ada, lalu periksa pada 390 dan 320 px sebelum menambah dekorasi atau ukuran huruf.

Metode dokumentasi dan desain mengikuti panduan Better Interface dan Impeccable yang diatribusikan dalam [`NOTICE.md`](NOTICE.md). Hasil peninjauan dan keterbatasan ada di [`artifacts/validation.md`](artifacts/validation.md).
