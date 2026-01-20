# eKlinik Printer Service

Service ringan berbasis [Bun](https://bun.sh) untuk mencetak ke thermal printer (ESC/POS) melalui koneksi USB. Service ini menyediakan API HTTP sehingga bisa dipanggil dari aplikasi web atau lokal lainnya.

## Fitur

- **HTTP API**: Endpoint `/print` untuk menerima data cetak.
- **Auto-Discovery**: Mencari printer USB secara otomatis.
- **Cross-Platform**: Berjalan di macOS (ARM/Intel) dan Windows (x64).
- **Standalone Binary**: Dapat dikompilasi menjadi `.exe` tanpa perlu install Node/Bun di PC tujuan.

---

## 🚀 Instalasi & Pengembangan

### Prasyarat

- [Bun](https://bun.sh) v1.1.x atau versi terbaru.

### Setup Proyek

```bash
# Clone repository dan masuk ke direktori
cd eklinik-printer-service

# Install dependencies
bun install
```

### Menjalankan Service (Mode Development)

```bash
bun start
```

Service akan berjalan di `http://localhost:5001`.

---

## 📦 Membangun Executable (.exe) untuk Windows

Untuk membuat file executable tunggal yang bisa dijalankan di Windows x64:

```bash
bun run build:win
```

Hasil akhir berupa `printer-service.exe` akan muncul di root folder.

---

## 🛠 Penggunaan API

### Health Check

**URL**: `GET /health`  
**Response**: `{"status": "ok", "bun": "1.1.38"}`

### Mencetak Dokumen

**URL**: `POST /print`  
**Content-Type**: `application/json`

#### Contoh Payload (Items):

```json
{
  "items": [
    {
      "type": "text",
      "content": "eKlinik Thermal Service\n",
      "options": { "align": "center", "size": [2, 2], "style": "b" }
    },
    { "type": "feed", "content": "3" },
    { "type": "cut" }
  ]
}
```

#### Contoh Payload (Ticket - Layout Spesial):

```json
{
  "ticket": {
    "number": "A-001",
    "service": "POLI UMUM",
    "date": "Senin, 19 Januari 2026",
    "time": "16:45:00"
  }
}
```

---

## 📝 Referensi Payload (Types)

Service ini menggunakan library `escpos`. Berikut adalah opsi yang tersedia untuk setiap item:

| Field                    | Tipe                                                                                                        | Deskripsi                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `type`                   | `text`, `qr`, `barcode`, `feed`, `cut`, `line`, `drawLine`, `doubleLine`, `newLine`, `table`, `tableCustom` | Jenis aksi yang dilakukan.                             |
| `content`                | `string` / `array`                                                                                          | Data sesuai `type` (teks atau array untuk table).      |
| `options.align`          | `left`, `center`, `right`                                                                                   | Perataan teks (atau `lt`, `ct`, `rt`).                 |
| `options.size`           | `[width, height]`                                                                                           | Skala font (contoh: `[1, 1]` atau `[2, 2]`).           |
| `options.style`          | `normal`, `b`, `i`, `u`, `u2`, `bi`, `biu`                                                                  | Style teks.                                            |
| `options.char`           | `string`                                                                                                    | Karakter untuk `line` (default: `-`).                  |
| `options.columns`        | `array`                                                                                                     | Definisi kolom untuk `tableCustom` (`width`, `align`). |
| `options.cellSize`       | `number`                                                                                                    | Ukuran pixel QR (default: 6).                          |
| `options.level`          | `L`, `M`, `Q`, `H`                                                                                          | Error correction QR (default: L).                      |
| `options.width_barcode`  | `number`                                                                                                    | Lebar barcode.                                         |
| `options.height_barcode` | `number`                                                                                                    | Tinggi barcode.                                        |

### Mendukung Perintah Kompleks

Anda bisa menambahkan implementasi untuk QR Code atau Barcode di `index.ts` dengan mengikuti dokumentasi [escpos npm](https://www.npmjs.com/package/escpos).

---

## ⚠️ Penting untuk Pengguna Windows (Driver)

Karena service ini mengakses USB secara langsung melalui `libusb`, printer thermal Anda mungkin tidak langsung terdeteksi jika masih menggunakan driver default bawaan Windows.

1. Download **[Zadig](https://zadig.akeo.ie/)**.
2. Pilih printer thermal Anda dari daftar device.
3. Klik **"Replace Driver"** untuk mengubah drivernya menjadi **WinUSB**.
4. Setelah itu, `printer-service.exe` baru bisa menemukan printer tersebut.

---

## Troubleshooting

- **Port In Use**: Jika muncul error `EADDRINUSE: Failed to start server`, pastikan tidak ada proses lain yang berjalan di port 5001. Gunakan `lsof -i :5001` (mac) untuk mengecek.
- **Printer Not Found**: Pastikan kabel USB tercolok rapat dan printer dalam kondisi ON.
