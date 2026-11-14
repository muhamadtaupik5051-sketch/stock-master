# Stock Master — Akses Publik + Kontrol Admin

Stock Master dapat dibuka langsung melalui link tanpa login untuk pengguna umum. Login email/password hanya diperlukan oleh Admin ketika ingin membuka menu **Kontrol Aplikasi**.

## Fitur
- Akses publik tanpa formulir login (menggunakan Firebase Anonymous Authentication di belakang layar).
- Admin masuk melalui tombol **Admin** dengan email dan password Firebase.
- Menu **Kontrol Aplikasi** untuk mengatur izin pengguna umum secara terpisah:
  - Tambah lembar: ON = semua pengunjung boleh; OFF = hanya Admin.
  - Hapus lembar: ON = semua pengunjung boleh; OFF = hanya Admin.
  - Tambah data stok: ON = semua pengunjung boleh; OFF = hanya Admin.
  - Edit data stok: ON = semua pengunjung boleh; OFF = hanya Admin.
  - Hapus data stok: ON = semua pengunjung boleh; OFF = hanya Admin.
  - Aktifkan aplikasi: OFF menampilkan halaman pemeliharaan kepada pengguna umum; Admin masih dapat masuk dan mengaktifkannya kembali.
- Admin tetap dapat mengubah nama lembar, mengelola akun, dan melakukan semua tindakan.
- Pengaturan hak akses diperiksa oleh Firestore Security Rules, bukan hanya dengan menyembunyikan tombol.
- Data stok, pencarian, filter LOT, impor CSV/XLSX, ekspor CSV, dan sinkronisasi realtime tetap tersedia.

## 1. Pengaturan Firebase wajib

Gunakan Firebase project yang sama dengan aplikasi Stock Master sebelumnya agar data stok lama tetap berada di database yang sama.

1. Buka Firebase Console > Authentication > Sign-in method.
2. Aktifkan **Anonymous** dan **Email/Password**.
3. Pastikan Firestore Database menggunakan database lama yang berisi koleksi `stockItems`.
4. Buat akun Admin di Authentication > Users > Add user (email dan password Admin).
5. Salin UID akun Admin. Di Firestore, buat dokumen `users/{UID}` dengan field:
   - `name` (string): `Administrator`
   - `email` (string): email Admin
   - `role` (string): `admin`
   - `active` (boolean): `true`
6. Buka Firestore > Rules, ganti dengan seluruh isi file `firestore.rules`, lalu tekan **Publish**.
7. Login ke aplikasi melalui tombol **Admin**. Buka **Kontrol Aplikasi** dan tekan **Siapkan pengaturan awal** jika dokumen pengaturan belum ada.

Dokumen pengaturan akan dibuat di `appControl/main`. Nilai awalnya: aplikasi aktif, lima izin pengguna umum ON, dan lembar 1–3 tersedia. Admin dapat mengubahnya kapan saja.

## 2. Cara menggunakan

- Pengguna umum: buka link. Tidak perlu memasukkan email/password.
- Admin: tekan tombol **Admin**, masukkan email/password Admin, lalu buka **Kontrol aplikasi**.
- ON berarti pengguna umum boleh melakukan tindakan tersebut.
- OFF berarti hanya Admin yang boleh melakukan tindakan tersebut.
- Untuk menutup akses umum sementara, ubah **Aktifkan aplikasi** menjadi OFF. Admin tetap bisa masuk dan mengaktifkannya kembali.
- Untuk menghapus lembar, pilih lembar tersebut lalu tekan ikon tempat sampah di samping judul lembar. Penghapusan lembar juga menghapus data di dalam lembar tersebut setelah konfirmasi.

## 3. Build dan deploy

```bash
npm install
npm run build
```

Upload seluruh isi folder proyek ke GitHub dan deploy hasil build `dist` ke hosting HTTPS (misalnya Netlify). Setelah perubahan dipublikasikan, buka ulang link aplikasi. Jika sebelumnya pernah dipasang sebagai PWA, tutup dan buka ulang aplikasi agar service worker mengambil versi baru.

## Catatan keamanan dan data
- Login publik tidak ditampilkan, tetapi aplikasi menggunakan sesi Firebase Anonymous untuk mengenali pengunjung dan menerapkan aturan akses.
- Kredensial Admin tetap diperlukan untuk mengubah pengaturan. Jangan membagikan password Admin.
- Tombol OFF aplikasi hanya menutup akses pengguna umum; Admin masih dapat masuk untuk mengaktifkannya kembali.
- Penghapusan lembar menghapus seluruh data pada lembar tersebut. Pastikan ekspor/cadangkan data sebelum menghapus.
- Jangan mengubah Firebase project ID jika ingin mempertahankan database stok lama.
- Perubahan kode saja belum mengubah website yang sedang online. Firestore Rules harus dipublikasikan dan proyek harus di-deploy ulang.
