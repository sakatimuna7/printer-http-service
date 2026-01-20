# Panduan Setup eKlinik Printer Service (Windows)

Dokumen ini berisi langkah-langkah untuk menginstal dan mengkonfigurasi service printer thermal di komputer Windows.

---

## 1. Persiapan Awal

- Pastikan Printer Thermal sudah tercolok ke port USB.
- Pastikan Printer dalam kondisi **ON**.

## 2. Instalasi Driver (Wajib)

Printer thermal tidak akan terdeteksi oleh service jika driver aslinya masih aktif. Kita harus merubahnya ke driver **WinUSB**.

1. Download tool **Zadig** di: [https://zadig.akeo.ie/](https://zadig.akeo.ie/)
2. Jalankan `zadig.exe`.
3. Klik menu **Options** > centang **List All Devices**.
4. Pada dropdown, pilih nama printer Anda (Contoh: `USB Printing Support`, `POS-58`, atau nama merk printer).
5. Pada bagian kanan (panah hijau), pastikan target drivernya adalah **WinUSB**.
6. Klik tombol **Replace Driver** atau **Reinstall Driver**.
7. Tunggu sampai muncul pesan "Driver installed successfully".

## 3. Menjalankan Service

1. Copy file `printer-service.exe` ke folder pilihan Anda (misal: `C:\aplikasi-kamu\`).
2. Double-click `printer-service.exe`.
3. Jendela hitam (Console) akan muncul dan menampilkan pesan:
   `Printer service starting on port 5001...`
   `Server running at http://localhost:5001`
4. **Jangan tutup jendela ini** selama aplikasi digunakan.

## 4. Setup Auto-Start (Berjalan Otomatis Saat Windows Nyala)

Supaya Anda tidak perlu klik manual setiap kali komputer dinyalakan:

1. Klik kanan pada file `printer-service.exe`, pilih **Create Shortcut**.
2. Tekan tombol `Windows + R` di keyboard secara bersamaan.
3. Ketik `shell:startup` lalu tekan **Enter**. Folder _Startup_ akan terbuka.
4. Pindahkan (Cut/Paste) **Shortcut** yang Anda buat tadi ke dalam folder _Startup_ tersebut.
5. Selesai! Sekarang service akan langsung berjalan begitu komputer dihidupkan.

---

## Troubleshooting

- **Printer Tidak Ditemukan**: Ulangi langkah **No. 2 (Zadig)**. Pastikan driver yang dipilih adalah WinUSB.
- **Port Terpakai**: Jika muncul error `EADDRINUSE`, artinya ada aplikasi lain yang memakai port 5001. Coba restart komputer.
- **Firewall**: Jika aplikasi dari komputer lain ingin mengakses printer ini, pastikan Anda memberikan izin (Allow) pada Windows Firewall untuk port 5001.
