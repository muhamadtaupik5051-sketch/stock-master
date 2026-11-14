# Stock Master — Website + Android (PWA)

Aplikasi stok bersama berdasarkan kolom pada contoh: **SO, QTY, LOT, KET**.
Data tersinkron otomatis secara realtime melalui Firebase Firestore. Bisa dibuka di browser dan dipasang ke layar utama Android sebagai aplikasi (PWA).

## Fitur
- Tambah dan edit data SO/QTY/LOT/KET.
- Nomor SO dibuat unik (pemeriksaan di sisi aplikasi).
- Cari SO/keterangan dan filter LOT.
- Ekspor hasil filter ke CSV yang bisa dibuka di Excel.
- Sinkronisasi realtime antarpengguna.
- Login anonim otomatis; pengguna tidak perlu membuat akun.

## 1. Siapkan Firebase (gratis untuk mulai, perhatikan kuota dan ketentuan paket)
1. Buka https://console.firebase.google.com/ lalu buat project.
2. Tambahkan aplikasi Web di Project settings > Your apps.
3. Salin konfigurasi Firebase dan isi `src/firebase.js` mengganti semua teks `GANTI_...`.
4. Authentication > Sign-in method > aktifkan **Anonymous**.
5. Firestore Database > Create database.
6. Buka tab Rules, salin isi file `firestore.rules`, lalu Publish.

**Penting:** aturan contoh ini memberi setiap pengguna anonim yang membuka aplikasi izin membaca, menambah, mengubah data stok. Penghapusan data dinonaktifkan pada versi awal. Bagikan link hanya kepada kelompok yang memang boleh mengelola stok. Untuk pemakaian perusahaan/produksi, sebaiknya tambahkan login, pembatasan akses per kelompok, dan audit log sebelum dipakai.

## 2. Jalankan di komputer
Perlu Node.js versi 20 atau lebih baru.
```bash
npm install
npm run dev
```
Buka alamat lokal yang ditampilkan Vite.

## 3. Terbitkan agar semua orang bisa mengakses
1. Upload folder proyek ke GitHub.
2. Hubungkan repo ke Firebase Hosting atau layanan hosting HTTPS.
3. Jalankan `npm run build`; folder hasilnya `dist`.
4. Hosting folder `dist` melalui HTTPS.

PWA perlu HTTPS agar dapat dipasang. Pada Android, buka link di Chrome > menu ⋮ > **Tambahkan ke layar utama / Install app**.

## Catatan penting
- Data tidak disimpan di HP; Firestore menjadi sumber data bersama.
- Semua pengguna melihat pembaruan hampir seketika saat online.
- Koneksi internet diperlukan untuk sinkronisasi.
- Untuk menjaga konsistensi, sebaiknya SO dianggap unik. Pemeriksaan duplikat saat ini dilakukan di aplikasi; untuk skala besar perlu validasi server-side.
- Ini adalah starter project. Firebase project dan hosting harus dibuat serta dikonfigurasi oleh pemilik aplikasi sebelum link publik aktif.
