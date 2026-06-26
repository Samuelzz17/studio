# SR Flutter (Migrasi dari Next.js + Capacitor)

Project ini adalah fondasi migrasi ke Flutter dengan tujuan fitur tetap sama:
- Frontend: Flutter
- Backend: Firebase (Auth + Firestore)
- Kegunaan: POS + cetak thermal printer Bluetooth

## Yang sudah dibuat
- Login email/password + anonymous demo (`lib/screens/login_screen.dart`)
- App shell modul bisnis: Dashboard, POS, Inventory, Keuangan, Laporan, Settings (`lib/screens/dashboard_screen.dart`)
- Kontrol akses outlet berdasarkan `users/{uid}.outletAccess`
- Outlet switcher (multi outlet)
- Dashboard real-time (per outlet): total revenue, total sales, low stock count, recent transactions, low stock alerts
- POS implementasi awal end-to-end:
  - menu visual dari `inventory_products`
  - produk auto nonaktif saat bahan baku tidak cukup (berdasarkan recipe/BOM)
  - keranjang dinamis (+/- qty)
  - diskon `%` / nominal + pajak
  - checkout Cash / QRIS
  - simpan transaksi ke `outlets/{outletId}/sales`
  - pengurangan stok bahan baku atomik via Firestore transaction
- File POS: `lib/screens/pos_tab.dart`
  - termasuk prompt cetak struk thermal langsung setelah checkout
- Inventory implementasi:
  - bahan baku: tambah + list status stok
  - produk: tambah + recipe/BOM + estimasi ketersediaan
  - aset: tambah + list
  - File: `lib/screens/inventory_tab.dart`
  - sudah ada aksi edit/delete untuk bahan baku, produk, aset
- Keuangan implementasi:
  - catat pembelian bahan baku (otomatis update stock + average cost)
  - list purchases
  - tambah & list expenses
  - list asset purchases
  - File: `lib/screens/finance_tab.dart`
  - expense sudah support edit/delete
- Laporan implementasi:
  - revenue, COGS, gross profit, expenses, net profit
  - nilai stok bahan baku
  - nilai aset setelah depresiasi
  - ringkasan penjualan terbaru
  - File: `lib/screens/reports_tab.dart`
  - termasuk export CSV (sales/finance/inventory) ke clipboard
- Thermal printer test via Bluetooth Classic (`lib/screens/thermal_printer_screen.dart`)
- Builder ESC/POS untuk test receipt (`lib/utils/escpos_builder.dart`)
- Service auth + printer (`lib/services/*`)
- Service Firestore sesuai struktur lama Next.js (`lib/services/firestore_service.dart`)
- Domain model untuk transaksi/outlet/material/user (`lib/models/domain_models.dart`)
- Android package id disamakan ke `com.sr.app`

## Setup Firebase Android
1. Daftarkan app Android dengan package `com.sr.app` di Firebase Console.
2. Download `google-services.json`.
3. Taruh file di:
   - `android/app/google-services.json`
4. (Opsional tahap berikutnya) Tambahkan plugin Google Services jika ingin integrasi penuh lintas build flavor.

## Jalankan app
```bash
cd /Users/macbook/Documents/CODE/studio/flutter_sr
/opt/homebrew/Caskroom/flutter/3.41.2/flutter/bin/flutter pub get
/opt/homebrew/Caskroom/flutter/3.41.2/flutter/bin/flutter run
```

## Build APK debug
```bash
cd /Users/macbook/Documents/CODE/studio/flutter_sr
/opt/homebrew/Caskroom/flutter/3.41.2/flutter/bin/flutter build apk --debug
```
APK output:
- `build/app/outputs/flutter-apk/app-debug.apk`

## Catatan thermal printer
- Saat ini menggunakan package `blue_thermal_printer` (Android, Bluetooth Classic).
- Pair printer dulu di setting Bluetooth Android.
- Dari app: Dashboard -> Thermal Printer -> Test Print.
