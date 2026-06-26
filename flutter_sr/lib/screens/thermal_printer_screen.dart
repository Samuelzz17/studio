import 'package:blue_thermal_printer/blue_thermal_printer.dart';
import 'package:flutter/material.dart';

import '../services/thermal_printer_service.dart';
import '../utils/escpos_builder.dart';

class ThermalPrinterScreen extends StatefulWidget {
  const ThermalPrinterScreen({super.key});

  @override
  State<ThermalPrinterScreen> createState() => _ThermalPrinterScreenState();
}

class _ThermalPrinterScreenState extends State<ThermalPrinterScreen> {
  final _service = ThermalPrinterService.instance;
  List<BluetoothDevice> _devices = const [];
  bool _loading = false;
  String? _busyAddress;

  @override
  void initState() {
    super.initState();
    _loadDevices();
  }

  Future<void> _loadDevices() async {
    setState(() => _loading = true);
    try {
      final hasPermission = await _service.ensureBluetoothPermissions();
      if (!hasPermission) {
        _showMessage(
          'Izin Bluetooth belum diberikan. Aktifkan izin Bluetooth dan Location.',
          error: true,
        );
        if (mounted) setState(() => _devices = const []);
        return;
      }

      final isBluetoothOn = await _service.isBluetoothOn();
      if (!isBluetoothOn) {
        _showMessage('Bluetooth sedang mati. Nyalakan dulu Bluetooth.', error: true);
        if (mounted) setState(() => _devices = const []);
        return;
      }

      final devices = await _service.getBondedDevices();
      if (!mounted) return;
      setState(() => _devices = devices);
    } catch (e) {
      _showMessage('Gagal load printer: $e', error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _testPrint(BluetoothDevice device) async {
    setState(() => _busyAddress = device.address);
    try {
      final hasPermission = await _service.ensureBluetoothPermissions();
      if (!hasPermission) {
        _showMessage(
          'Izin Bluetooth belum diberikan. Aktifkan izin Bluetooth dan Location.',
          error: true,
        );
        return;
      }
      await _service.ensureConnected(device);
      final bytes = EscPosBuilder.buildTestReceipt(storeName: 'Sumber Redjeki');
      await _service.printBytes(bytes);
      await Future<void>.delayed(const Duration(milliseconds: 120));
      var drawerOpened = true;
      try {
        await Future<void>.delayed(const Duration(milliseconds: 220));
        await _service.openCashDrawer();
      } catch (_) {
        drawerOpened = false;
      }
      _showMessage(
        drawerOpened
            ? 'Print test + command drawer terkirim ke ${device.name ?? device.address}.'
            : 'Print test terkirim, tapi command drawer gagal.',
        error: !drawerOpened,
      );
    } catch (e) {
      _showMessage('Print gagal: $e', error: true);
    } finally {
      try {
        await _service.disconnect();
      } catch (_) {
        // ignore disconnect error
      }
      if (mounted) setState(() => _busyAddress = null);
    }
  }

  void _showMessage(String message, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? Colors.red : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thermal Printer'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _loadDevices,
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _devices.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Text(
                      'Tidak ada printer paired. Pair dulu printer thermal di Bluetooth Android.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemBuilder: (_, index) {
                    final device = _devices[index];
                    final busy = _busyAddress == device.address;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Card(
                        child: ListTile(
                          title: Text(device.name ?? 'Unknown Device'),
                          subtitle: Text(device.address ?? '-'),
                          trailing: busy
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : FilledButton(
                                  onPressed: () => _testPrint(device),
                                  child: const Text('Test Print'),
                                ),
                        ),
                      ),
                    );
                  },
                  itemCount: _devices.length,
                ),
    );
  }
}
