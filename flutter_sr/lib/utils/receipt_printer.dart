import 'package:blue_thermal_printer/blue_thermal_printer.dart';
import 'package:flutter/material.dart';

import '../models/domain_models.dart';
import '../services/thermal_printer_service.dart';
import 'escpos_builder.dart';

class ReceiptPrinter {
  ReceiptPrinter._();

  static Future<void> showPrintDialog({
    required BuildContext context,
    required OutletInfo outlet,
    required String invoice,
    required String customerName,
    required String paymentMethod,
    required DateTime createdAt,
    required List<SaleReceiptItem> items,
    required double subtotal,
    required double discount,
    required double tax,
    required double total,
    required double customerPayment,
    required double change,
  }) async {
    final thermal = ThermalPrinterService.instance;
    List<BluetoothDevice> devices = const <BluetoothDevice>[];
    BluetoothDevice? selected;
    var isPrinting = false;
    var isLoading = true;
    String? loadError;
    var loadStarted = false;

    await showDialog<void>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialog) {
            Future<void> ensureLoaded() async {
              if (loadStarted) return;
              loadStarted = true;
              try {
                final hasPermission = await thermal.ensureBluetoothPermissions();
                if (!context.mounted) return;
                if (!hasPermission) {
                  setDialog(() {
                    loadError =
                        'Izin Bluetooth belum diberikan. Aktifkan izin Bluetooth dan Location di Settings aplikasi.';
                    isLoading = false;
                  });
                  return;
                }

                final isBluetoothOn = await thermal.isBluetoothOn();
                if (!context.mounted) return;
                if (!isBluetoothOn) {
                  setDialog(() {
                    loadError = 'Bluetooth sedang mati. Nyalakan dulu Bluetooth.';
                    isLoading = false;
                  });
                  return;
                }

                final bonded = await thermal.getBondedDevicesCached(
                  ttl: const Duration(minutes: 5),
                );
                final lastAddr = await thermal.getLastPrinterAddress();
                if (!context.mounted) return;
                setDialog(() {
                  devices = bonded;
                  if (bonded.isNotEmpty && lastAddr != null) {
                    selected = bonded.firstWhere(
                      (d) => (d.address ?? '').trim() == lastAddr,
                      orElse: () => bonded.first,
                    );
                  } else {
                    selected = bonded.isNotEmpty ? bonded.first : null;
                  }
                  loadError = bonded.isEmpty
                      ? 'Tidak ada printer paired. Pair dulu di Bluetooth Android.'
                      : null;
                  isLoading = false;
                });
              } catch (e) {
                if (!context.mounted) return;
                setDialog(() {
                  loadError = 'Gagal load printer: $e';
                  isLoading = false;
                });
              }
            }

            // Start loading on first build without blocking dialog presentation.
            if (!loadStarted) {
              Future<void>.microtask(ensureLoaded);
            }

            Future<void> doPrint() async {
              if (selected == null || isPrinting || isLoading) return;
              setDialog(() => isPrinting = true);
              try {
                await thermal.ensureConnected(selected!);
                final payload = EscPosBuilder.buildSaleReceipt(
                  storeName: 'Sumber Redjeki',
                  outletCode: outlet.code,
                  invoice: invoice,
                  customerName: customerName,
                  paymentMethod: paymentMethod,
                  createdAt: createdAt,
                  items: items,
                  subtotal: subtotal,
                  discount: discount,
                  tax: tax,
                  total: total,
                  customerPayment: customerPayment,
                  change: change,
                );
                await thermal.printBytes(payload);
                await thermal.setLastPrinterAddress(selected!.address);
                await Future<void>.delayed(const Duration(milliseconds: 120));
                var drawerOpened = true;
                try {
                  await Future<void>.delayed(
                    const Duration(milliseconds: 220),
                  );
                  await thermal.openCashDrawer();
                } catch (_) {
                  drawerOpened = false;
                }
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      drawerOpened
                          ? 'Struk berhasil dicetak. Cash drawer terbuka.'
                          : 'Struk berhasil dicetak. Command cash drawer gagal.',
                    ),
                    backgroundColor: drawerOpened ? null : Colors.orange,
                  ),
                );
              } catch (e) {
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Print gagal: $e'),
                    backgroundColor: Colors.red,
                  ),
                );
              } finally {
                if (context.mounted) {
                  setDialog(() => isPrinting = false);
                }
              }
            }

            return AlertDialog(
              scrollable: true,
              title: const Text('Cetak Struk Thermal'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Pilih printer Bluetooth:'),
                  const SizedBox(height: 8),
                  if (isLoading)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          SizedBox(width: 10),
                          Expanded(child: Text('Memuat daftar printer...')),
                        ],
                      ),
                    )
                  else if (loadError != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Text(
                        loadError!,
                        style: const TextStyle(color: Colors.red),
                      ),
                    )
                  else
                    DropdownButtonFormField<BluetoothDevice>(
                      initialValue: selected,
                      items: devices
                          .map(
                            (d) => DropdownMenuItem(
                              value: d,
                              child: Text(d.name ?? d.address ?? 'Unknown'),
                            ),
                          )
                          .toList(),
                      onChanged: (v) =>
                          setDialog(() => selected = v ?? selected),
                    ),
                ],
              ),
              actions: [
                TextButton.icon(
                  onPressed: isPrinting
                      ? null
                      : () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                  label: const Text('Close'),
                ),
                OutlinedButton(
                  onPressed:
                      (isPrinting || isLoading || loadError != null) ? null : doPrint,
                  child: isPrinting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Cetak'),
                ),
              ],
            );
          },
        );
      },
    );
    // Intentionally keep printer connected to speed up subsequent prints.
  }
}
