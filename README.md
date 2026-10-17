# nyimak.

Radar koin meme berbahasa Indonesia dengan identitas hijau neon dan logo tangan animasi. Dibangun dengan React, TypeScript, dan Vite. Ekspor siap untuk static hosting ada di **`dist/`**, termasuk seluruh font, ilustrasi, favicon, dan gambar berbagi.

## Jalankan dan bangun ulang

Gunakan Node.js 22.12+ atau 20.19+ dan npm.

```sh
npm ci
npm run dev
```

Untuk memeriksa dan membuat ekspor produksi:

```sh
npm run typecheck
npm run build
npm run preview
```

Preview Vite biasanya tersedia di `http://localhost:4173`; gunakan alamat yang dicetak di terminal. Publikasikan **isi `dist/`** pada hosting statis. Tidak memerlukan server aplikasi, rewrite rute, atau dompet. Vite memakai `base: './'`; URL aset relatif dan navigasi hash mendukung hosting di subpath. Jangan menghapus `dist/` dari paket pengiriman: penerbit dapat langsung menyajikannya tanpa build ulang.

## Data contoh dan data X

**Saat pertama dibuka, situs memakai data contoh yang diberi label jelas.** Delapan koin dan 124 post/angka interaksi adalah ilustrasi, bukan hasil pengambilan X. Akun contoh fiktif, tidak ditautkan ke profil atau post X sungguhan. Waktu contoh ditetapkan sekali per sesi; tombol Perbarui tidak menciptakan post baru.

Untuk data sungguhan, pilih **Sumber data**, masukkan URL feed JSON HTTPS publik, lalu pilih **Hubungkan feed**. Sumber baru dipakai setelah berhasil diambil dan divalidasi. Pengaturan disimpan di browser tersebut. Situs tidak menyertakan akun X, API key, scraper, atau layanan agregasi. Penyedia feed harus mengambil data X melalui akses yang dimilikinya, menyimpan kredensial di servernya, dan mengizinkan CORS untuk origin situs. Jangan menaruh API key dalam URL atau ekspor statis.

Feed mengembalikan objek dengan daftar `posts`. Berikut **skema**, bukan post pengganti yang harus diterbitkan:

| Kolom | Jenis | Makna |
| --- | --- | --- |
| `id` | string tidak kosong | ID post, untuk deduplikasi |
| `text` | string | Teks post asli |
| `author` | string | Handle akun, boleh diawali `@` |
| `createdAt` | string ISO 8601 dengan zona waktu | Waktu post |
| `likes` | integer aman, ≥ 0 | Jumlah suka |
| `reposts` | integer aman, ≥ 0 | Jumlah repost |
| `url` | string opsional | URL HTTPS post `x.com` / `twitter.com`, pola `/akun/status/ID` |

Contoh struktur kosong yang valid: `{"posts":[]}`. Batas feed: 2 MB dan 20.000 post. Respons HTTP gagal, format rusak, timeout 12 detik, atau kegagalan jaringan menghasilkan pesan yang dapat ditindaklanjuti. Data terakhir tetap ditampilkan saat refresh gagal; aplikasi tidak diam-diam mengganti feed yang gagal dengan contoh.

## Cara radar menghitung

- Post harus mengandung kata **meme** tanpa membedakan huruf besar/kecil, serta cashtag **$** yang dimulai huruf. Panjang ticker maksimal 12 karakter alfanumerik.
- Hanya post dari 48 jam terakhir menurut jam browser, atau 24 jam bila dipilih. Post bertanggal masa depan dan ID duplikat tidak dihitung.
- Setiap ticker dihitung sekali per post. Satu post dengan beberapa ticker dapat masuk ke beberapa koin; ringkasan post menghitung ID unik.
- Urutan awal berdasarkan jumlah post, kemudian jumlah interaksi sebagai pemecah seri. Interaksi = suka + repost. **Paling ramai** memilih empat ticker dengan post terbanyak. Grafik berisi 12 rentang jumlah post, bukan harga atau persentase kenaikan.
- Nama dan ikon delapan ticker bawaan hanya membantu pengenalan. Ticker lain memakai namanya sendiri dan avatar inisial. Ticker tidak menetapkan identitas atau kontrak token.
- Pembaruan otomatis memeriksa feed setiap 60 detik selama tab terlihat, dan memeriksa lagi saat tab kembali terlihat. Sakelar **Otomatis** menjeda permintaan. Umur data diperiksa ulang setiap 30 detik. Filter aktif tetap dipertahankan ketika post baru muncul.
- Simpanan dan sumber feed disimpan di `localStorage` browser ini, bukan akun bersama. Jika penyimpanan diblokir, antarmuka tetap berfungsi selama sesi dan mengumumkan keterbatasannya.

## Validasi yang dijalankan

Hasil aktual dan peninjauan keenam domain Better Interface ada di [`artifacts/validation.md`](artifacts/validation.md). Bukti terstruktur ada di [`artifacts/interaction-results.json`](artifacts/interaction-results.json) dan [`artifacts/taste-checks.json`](artifacts/taste-checks.json).

| Pemeriksaan akhir | Hasil |
| --- | --- |
| Build produksi, Vite 7.3.7 | Berhasil; JavaScript 216,09 kB / 68,44 kB gzip, CSS 28,38 kB / 6,20 kB gzip |
| TypeScript `tsc --noEmit` | Berhasil |
| Interaksi pada ekspor di `/preview/`, Chromium 141 | 14 kelompok uji lulus |
| Axe 4.10.3, WCAG A/AA yang dapat diotomasi | 27 aturan lulus, 0 pelanggaran, 0 hasil tidak pasti pada halaman utama |
| Probe desain taste@1, termasuk mode offline | 16/16 pemeriksaan lulus pada 320, 390, dan 1440 px |
| Tata letak | Tanpa overflow pada 320, 390, 630, 768, 960, 1150, 1440 px; pembesaran teks 200% juga diperiksa pada 320, 390, 1440 px |
| Layar pertama 390 × 844 | Tombol Perbarui dan baris koin pertama terlihat utuh |
| `npm audit --omit=dev` | 0 kerentanan yang dilaporkan |
| WebKit | Dicoba; gagal diluncurkan karena dependensi sistem tidak tersedia. Tidak diklaim lulus |

Untuk mengulang uji interaksi pada mesin dengan dependensi browser yang sesuai:

```sh
npx playwright install chromium webkit
npm run build
npm run validate
```

`scripts/validate.mjs` menjalankan server sementara dalam prosesnya sendiri, melayani `dist/` di subpath `/preview/`, memakai fixture feed terkontrol, dan menutup server saat selesai. Pembaruan 60 detik diuji dengan jam simulasi, tanpa menunggu satu menit. Hasil dan screenshot diperbarui di `artifacts/`. Browser yang tidak tersedia dicatat sebagai keterbatasan; setidaknya satu browser harus berhasil berjalan agar skrip berhasil. Hasil tersebut bukan sertifikasi aksesibilitas atau validasi data X produksi.

Pada mesin pengerjaan ini, dependensi dipasang di `/tmp` dan tidak disertakan dalam repositori. Artefak cache/lock sementara npm dibersihkan sebelum pengiriman. Build memakai `NYIMAK_NODE_MODULES` dan `PATH` untuk toolchain tersebut; typecheck memakai konfigurasi sementara yang memperluas `tsconfig.json` dan hanya memetakan lokasi tipe React eksternal. Instalasi npm biasa menggunakan perintah standar di atas tanpa pengaturan tambahan. Tidak ada cache, browser biner, paket `.tgz`, atau dependensi vendored yang disertakan.

## Berkas utama

- [`src/App.tsx`](src/App.tsx): layar radar, filter, simpanan, dialog, pemuatan feed, dan polling.
- [`src/data.ts`](src/data.ts): contoh yang diungkapkan, validasi feed, pengelompokan, dan batas waktu.
- [`src/styles.css`](src/styles.css): token, komponen, adaptasi responsif, dan preferensi gerak.
- [`src/icons.tsx`](src/icons.tsx): ikon SVG, tangan, avatar koin, dan grafik aktivitas.
- [`DESIGN.md`](DESIGN.md): sistem desain yang diimplementasikan.
- [`NOTICE.md`](NOTICE.md): atribusi panduan, font, dan ilustrasi.

## Batasan

Belum diuji dengan akun/API X produksi, pembaca layar, perangkat fisik, Safari/WebKit, RTL, forced-colors secara visual, atau zoom native browser. Pembesaran teks CSS bukan pengganti pengujian zoom native. Semua pemrosesan menggunakan feed dan jam browser; kelengkapan feed, identitas akun, keaslian koin, dan aktivitas seluruh X tidak dapat dijamin oleh ekspor statis. Situs tidak memberikan harga, rekomendasi beli, transaksi, atau verifikasi kontrak.
