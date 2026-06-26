import 'dart:typed_data';
import 'dart:io';

import 'package:blue_thermal_printer/blue_thermal_printer.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThermalPrinterService {
  ThermalPrinterService._();

  static final ThermalPrinterService instance = ThermalPrinterService._();

  final BlueThermalPrinter _printer = BlueThermalPrinter.instance;
  String? _connectedAddress;
  List<BluetoothDevice>? _bondedDevicesCache;
  DateTime? _bondedDevicesCacheAt;

  static const String _prefLastPrinterAddress = 'sr_last_printer_address';

  Future<bool> ensureBluetoothPermissions() async {
    if (!Platform.isAndroid) return true;

    final perms = <Permission>[
      Permission.bluetooth,
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.locationWhenInUse,
    ];

    // Checking status is much faster than calling request() every time.
    final current = <Permission, PermissionStatus>{};
    for (final p in perms) {
      current[p] = await p.status;
    }

    bool grantedFrom(Map<Permission, PermissionStatus> statuses) {
      final legacyBluetoothGranted =
          statuses[Permission.bluetooth]?.isGranted ?? false;
      final scanGranted =
          statuses[Permission.bluetoothScan]?.isGranted ?? false;
      final connectGranted =
          statuses[Permission.bluetoothConnect]?.isGranted ?? false;
      final locationGranted =
          statuses[Permission.locationWhenInUse]?.isGranted ?? false;

      final modernPermissionGranted = scanGranted && connectGranted;
      final legacyPermissionGranted = legacyBluetoothGranted && locationGranted;
      return modernPermissionGranted || legacyPermissionGranted;
    }

    if (grantedFrom(current)) return true;

    final requested = await perms.request();
    return grantedFrom(requested);
  }

  Future<bool> isBluetoothOn() async {
    final isOn = await _printer.isOn;
    return isOn ?? false;
  }

  Future<List<BluetoothDevice>> getBondedDevices() async {
    final devices = await _printer.getBondedDevices();
    return devices;
  }

  Future<List<BluetoothDevice>> getBondedDevicesCached({
    Duration ttl = const Duration(minutes: 5),
  }) async {
    final now = DateTime.now();
    final cachedAt = _bondedDevicesCacheAt;
    final cached = _bondedDevicesCache;
    if (cachedAt != null &&
        cached != null &&
        now.difference(cachedAt) <= ttl) {
      return cached;
    }
    final devices = await getBondedDevices();
    _bondedDevicesCache = devices;
    _bondedDevicesCacheAt = now;
    return devices;
  }

  Future<String?> getLastPrinterAddress() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final v = prefs.getString(_prefLastPrinterAddress);
      return (v == null || v.trim().isEmpty) ? null : v.trim();
    } catch (_) {
      return null;
    }
  }

  Future<void> setLastPrinterAddress(String? address) async {
    final v = address?.trim() ?? '';
    if (v.isEmpty) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefLastPrinterAddress, v);
    } catch (_) {
      // ignore
    }
  }

  Future<bool> isConnected() async {
    final connected = await _printer.isConnected;
    return connected ?? false;
  }

  Future<void> ensureConnected(BluetoothDevice device) async {
    final connected = await isConnected();
    if (connected && _connectedAddress == device.address) {
      return;
    }

    if (connected) {
      try {
        await _printer.disconnect();
      } catch (_) {}
      await Future<void>.delayed(const Duration(milliseconds: 200));
    }

    Object? lastError;
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        await _printer.connect(device);
        // Give socket/output stream a brief settle time.
        await Future<void>.delayed(const Duration(milliseconds: 250));
        _connectedAddress = device.address;
        return;
      } catch (e) {
        lastError = e;
        await Future<void>.delayed(const Duration(milliseconds: 220));
      }
    }
    throw Exception('Gagal konek printer: $lastError');
  }

  Future<void> connect(BluetoothDevice device) async {
    await ensureConnected(device);
  }

  Future<void> disconnect() async {
    await _printer.disconnect();
    _connectedAddress = null;
  }

  Future<void> printBytes(List<int> bytes) async {
    Object? lastError;
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        await _printer.writeBytes(Uint8List.fromList(bytes));
        return;
      } catch (e) {
        lastError = e;
        await Future<void>.delayed(const Duration(milliseconds: 180));
      }
    }
    throw Exception('Gagal kirim data print: $lastError');
  }

  Future<void> openCashDrawer() async {
    final commands = <List<int>>[
      // ESC p m t1 t2 (most common Epson-compatible pulses)
      [0x1B, 0x70, 0x00, 0x19, 0xFA], // pin 2
      [0x1B, 0x70, 0x01, 0x19, 0xFA], // pin 5
      [0x1B, 0x70, 0x00, 0x40, 0xF0], // alternative pulse timing
      [0x1B, 0x70, 0x01, 0x40, 0xF0], // alternative pulse timing
      // Legacy short commands used by some plugins/printers
      [0x1B, 0x70, 0x30],
      [0x1B, 0x70, 0x31],
    ];

    Object? lastError;
    for (final command in commands) {
      try {
        await printBytes(command);
        return;
      } catch (e) {
        lastError = e;
      }
    }

    try {
      await _printer.drawerPin2();
      return;
    } catch (e) {
      lastError = e;
    }

    try {
      await _printer.drawerPin5();
      return;
    } catch (e) {
      lastError = e;
    }

    throw Exception('Gagal kirim command cash drawer: $lastError');
  }
}
