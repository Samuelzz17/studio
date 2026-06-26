import 'dart:convert';

class EscPosBuilder {
  static const int _esc = 0x1B;
  static const int _gs = 0x1D;

  static List<int> buildTestReceipt({required String storeName}) {
    final out = <int>[];

    void push(List<int> bytes) => out.addAll(bytes);
    void line(String text) {
      out.addAll(utf8.encode(text));
      out.add(0x0A);
    }

    push([_esc, 0x40]);

    push([_esc, 0x61, 0x01]);
    push([_esc, 0x45, 0x01]);
    line('TEST PRINT');
    push([_esc, 0x45, 0x00]);

    line(storeName);
    line(DateTime.now().toString().substring(0, 19));
    push([_esc, 0x61, 0x00]);
    line('--------------------------------');
    line('Printer thermal: OK');
    line('Bluetooth classic: OK');
    line('--------------------------------');
    line('Jika terbaca, setup berhasil.');
    line('');
    line('WiFi:');
    line('SR     : @sumbersegalasumber25');
    line('SR Lt.2: @sumbersegalasumber');
    line('');

    push([_gs, 0x56, 0x01]);
    return out;
  }

  static List<int> buildSaleReceipt({
    required String storeName,
    required String outletCode,
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
  }) {
    const lineWidth = 32;
    final out = <int>[];

    void push(List<int> bytes) => out.addAll(bytes);
    void line(String text) {
      out.addAll(utf8.encode(text));
      out.add(0x0A);
    }

    String lr(String left, String right) {
      final space = lineWidth - left.length - right.length;
      return space > 0 ? '$left${' ' * space}$right' : '$left $right';
    }

    push([_esc, 0x40]);

    push([_esc, 0x61, 0x01]);
    // Simple thermal-friendly brand mark (text logo).
    push([_gs, 0x21, 0x11]);
    line('SR');
    push([_gs, 0x21, 0x00]);
    push([_esc, 0x45, 0x01]);
    line(storeName.toUpperCase());
    push([_esc, 0x45, 0x00]);
    line(outletCode);
    line('Invoice: $invoice');
    line('Pelanggan: ${customerName.isEmpty ? 'Anonymous' : customerName}');
    line(createdAt.toIso8601String().substring(0, 19).replaceFirst('T', ' '));
    line('--------------------------------');

    push([_esc, 0x61, 0x00]);
    for (final item in items) {
      line(item.name);
      line(
        lr(
          '${item.qty} x ${item.price.toStringAsFixed(0)}',
          item.total.toStringAsFixed(0),
        ),
      );
    }
    line('--------------------------------');
    line(lr('Subtotal', subtotal.toStringAsFixed(0)));
    line(lr('Diskon', discount.toStringAsFixed(0)));
    line(lr('Pajak', tax.toStringAsFixed(0)));
    line(lr('Total', total.toStringAsFixed(0)));
    line(lr('Bayar', customerPayment.toStringAsFixed(0)));
    line(lr('Kembali', change.toStringAsFixed(0)));
    line('Metode: $paymentMethod');
    line('--------------------------------');
    line('WiFi:');
    line('SR     : @sumbersegalasumber25');
    line('SR Lt.2: @sumbersegalasumber');
    line('--------------------------------');
    push([_esc, 0x61, 0x01]);
    line('Terima kasih');
    line('');
    line('');
    line('');
    line('');
    push([_gs, 0x56, 0x01]);
    return out;
  }
}

class SaleReceiptItem {
  SaleReceiptItem({required this.name, required this.qty, required this.price});

  final String name;
  final double qty;
  final double price;

  double get total => qty * price;
}
