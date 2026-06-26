import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../models/domain_models.dart';
import '../services/firestore_service.dart';
import '../utils/debouncer.dart';
import '../utils/escpos_builder.dart';
import '../utils/formatters.dart';
import '../utils/receipt_printer.dart';

enum ReportSection { sales, inventory, finance }

enum _ReportSort { terbaru, az, za, terbanyak, terkecil }
enum _SalesRange { eightHours, day, week, month }
enum _FinanceSubPeriod { day, week, month }

class ReportsTab extends StatefulWidget {
  const ReportsTab({super.key, required this.outlet, required this.section});

  final OutletInfo outlet;
  final ReportSection section;

  @override
  State<ReportsTab> createState() => _ReportsTabState();
}

class _ReportsTabState extends State<ReportsTab> {
  final TextEditingController _salesSearchController = TextEditingController();
  final Debouncer _salesSearchDebouncer = Debouncer(
    delay: const Duration(milliseconds: 220),
  );
  String _salesQuery = '';
  _ReportSort _salesSort = _ReportSort.terbaru;
  DateTime _salesDay = DateTime.now();
  _SalesRange _financeRange = _SalesRange.month;
  _FinanceSubPeriod _financeSubPeriod = _FinanceSubPeriod.day;
  bool _salesActionBusy = false;

  @override
  void dispose() {
    _salesSearchDebouncer.dispose();
    _salesSearchController.dispose();
    super.dispose();
  }

  String _csvEscape(String value) {
    final escaped = value.replaceAll('"', '""');
    return '"$escaped"';
  }

  Future<void> _copyCsvToClipboard(
    BuildContext context,
    String csv,
    String label,
  ) async {
    await Clipboard.setData(ClipboardData(text: csv));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('CSV $label sudah disalin ke clipboard.')),
    );
  }

  Future<void> _reprintTransaction(
    BuildContext context,
    SalesTransaction tx,
    Map<String, Product> productMap,
  ) async {
    final items = tx.items
        .map(
          (item) => SaleReceiptItem(
            name: productMap[item.productId]?.name ?? item.productId,
            qty: item.qty,
            price: item.price,
          ),
        )
        .toList();

    await ReceiptPrinter.showPrintDialog(
      context: context,
      outlet: widget.outlet,
      invoice: tx.invoice,
      customerName: tx.customerName,
      paymentMethod: tx.paymentMethod,
      createdAt: tx.createdAt,
      items: items,
      subtotal: tx.subtotal > 0 ? tx.subtotal : tx.total,
      discount: tx.discountAmount,
      tax: tx.tax,
      total: tx.total,
      customerPayment: tx.customerPayment > 0 ? tx.customerPayment : tx.total,
      change: tx.change,
    );
  }

  Future<void> _showEditSalesDialog(SalesTransaction tx) async {
    final firestore = FirestoreService.instance;
    final customerController = TextEditingController(
      text: tx.customerName == 'Anonymous' ? '' : tx.customerName,
    );
    final paymentController = TextEditingController(
      text: tx.customerPayment.toStringAsFixed(0),
    );
    var paymentMethod = tx.paymentMethod;

    await showDialog<void>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialog) {
            final customerPayment =
                double.tryParse(paymentController.text.trim()) ?? 0;
            final change = paymentMethod.toLowerCase().contains('cash')
                ? (customerPayment - tx.total)
                : 0.0;
            final isCash = paymentMethod.toLowerCase().contains('cash');

            return AlertDialog(
              scrollable: true,
              title: const Text('Edit Transaksi'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: customerController,
                    decoration: const InputDecoration(
                      labelText: 'Nama customer',
                    ),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: paymentMethod,
                    items: const [
                      DropdownMenuItem(value: 'Cash', child: Text('Cash')),
                      DropdownMenuItem(value: 'QRIS', child: Text('QRIS')),
                      DropdownMenuItem(value: 'Card', child: Text('Card')),
                    ],
                    onChanged: (value) {
                      setDialog(() {
                        paymentMethod = value ?? paymentMethod;
                        if (!paymentMethod.toLowerCase().contains('cash')) {
                          paymentController.text = tx.total.toStringAsFixed(0);
                        }
                      });
                    },
                    decoration: const InputDecoration(
                      labelText: 'Metode pembayaran',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: paymentController,
                    enabled: isCash,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setDialog(() {}),
                    decoration: const InputDecoration(
                      labelText: 'Uang dibayar',
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text('Total: ${formatCurrency(tx.total)}'),
                  Text('Kembalian: ${formatCurrency(change)}'),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: _salesActionBusy
                      ? null
                      : () => Navigator.of(context).pop(),
                  child: const Text('Batal'),
                ),
                FilledButton(
                  onPressed: _salesActionBusy
                      ? null
                      : () async {
                          if (_salesActionBusy) return;
                          if (isCash && customerPayment < tx.total) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Pembayaran cash kurang.'),
                                backgroundColor: Colors.red,
                              ),
                            );
                            return;
                          }

                          setDialog(() => _salesActionBusy = true);
                          try {
                            await firestore.updateSalesTransaction(
                              outletId: widget.outlet.id,
                              transactionId: tx.id,
                              customerName: customerController.text.trim(),
                              paymentMethod: paymentMethod,
                              customerPayment: isCash
                                  ? customerPayment
                                  : tx.total,
                              change: isCash ? change : 0,
                            );
                            if (!context.mounted) return;
                            Navigator.of(context).pop();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Transaksi berhasil diupdate.'),
                              ),
                            );
                          } catch (e) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Gagal update transaksi: $e'),
                                backgroundColor: Colors.red,
                              ),
                            );
                          } finally {
                            if (context.mounted) {
                              setDialog(() => _salesActionBusy = false);
                            }
                          }
                        },
                  child: const Text('Simpan'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _confirmDeleteSales(SalesTransaction tx) async {
    final firestore = FirestoreService.instance;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hapus transaksi?'),
        content: Text('Invoice ${tx.invoice} akan dihapus permanen.'),
        actions: [
          TextButton(
            onPressed: _salesActionBusy
                ? null
                : () => Navigator.of(context).pop(),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: _salesActionBusy
                ? null
                : () async {
                    if (_salesActionBusy) return;
                    _salesActionBusy = true;
                    try {
                      await firestore.deleteSalesTransaction(
                        outletId: widget.outlet.id,
                        transactionId: tx.id,
                      );
                      if (!context.mounted) return;
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Transaksi berhasil dihapus.'),
                        ),
                      );
                    } catch (e) {
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Gagal hapus transaksi: $e'),
                          backgroundColor: Colors.red,
                        ),
                      );
                    } finally {
                      _salesActionBusy = false;
                    }
                  },
            child: const Text('Hapus'),
          ),
        ],
      ),
    );
  }

  DateTime _rangeStartByPreset(DateTime now, _SalesRange range) {
    switch (range) {
      case _SalesRange.eightHours:
        return now.subtract(const Duration(hours: 8));
      case _SalesRange.day:
        return now.subtract(const Duration(days: 1));
      case _SalesRange.week:
        return now.subtract(const Duration(days: 7));
      case _SalesRange.month:
        return now.subtract(const Duration(days: 30));
    }
  }

  @override
  Widget build(BuildContext context) {
    final firestore = FirestoreService.instance;
    final salesDayStart = DateTime(
      _salesDay.year,
      _salesDay.month,
      _salesDay.day,
    );
    final salesDayEnd = salesDayStart.add(const Duration(days: 1));
    final needsSales =
        widget.section == ReportSection.sales ||
        widget.section == ReportSection.finance;
    final needsProducts =
        widget.section == ReportSection.sales ||
        widget.section == ReportSection.finance;
    final needsExpenses = widget.section == ReportSection.finance;
    final needsAssets = widget.section == ReportSection.inventory;

    return StreamBuilder<List<SalesTransaction>>(
      stream: needsSales
          ? (widget.section == ReportSection.sales
                ? firestore.streamSalesByCreatedAtRange(
                    widget.outlet.id,
                    start: salesDayStart,
                    end: salesDayEnd,
                  )
                : firestore.streamRecentSales(widget.outlet.id, limit: null))
          : null,
      builder: (context, salesSnapshot) {
        return StreamBuilder<List<Product>>(
          stream: needsProducts ? firestore.streamProducts(widget.outlet.id) : null,
          builder: (context, productSnapshot) {
            return StreamBuilder<List<RawMaterial>>(
              stream: firestore.streamRawMaterials(widget.outlet.id),
              builder: (context, materialSnapshot) {
                return StreamBuilder<List<Expense>>(
                  stream: needsExpenses
                      ? firestore.streamExpenses(widget.outlet.id)
                      : null,
                  builder: (context, expenseSnapshot) {
                    return StreamBuilder<List<AssetInvestment>>(
                      stream: needsAssets
                          ? firestore.streamAssets(widget.outlet.id)
                          : null,
                      builder: (context, assetSnapshot) {
                        final loading =
                            (needsSales &&
                                salesSnapshot.connectionState ==
                                    ConnectionState.waiting) ||
                            (needsProducts &&
                                productSnapshot.connectionState ==
                                    ConnectionState.waiting) ||
                            materialSnapshot.connectionState ==
                                ConnectionState.waiting ||
                            (needsExpenses &&
                                expenseSnapshot.connectionState ==
                                    ConnectionState.waiting) ||
                            (needsAssets &&
                                assetSnapshot.connectionState ==
                                    ConnectionState.waiting);

                        if (loading) {
                          return const Center(
                            child: CircularProgressIndicator(),
                          );
                        }

                        final sales =
                            salesSnapshot.data ?? const <SalesTransaction>[];
                        final now = DateTime.now();
                        final salesByRange = widget.section == ReportSection.sales
                            ? sales
                            : sales.toList();
                        final salesFiltered = salesByRange.where((s) {
                          final q = _salesQuery.trim().toLowerCase();
                          if (q.isEmpty) return true;
                          return s.invoice.toLowerCase().contains(q) ||
                              s.customerName.toLowerCase().contains(q) ||
                              s.paymentMethod.toLowerCase().contains(q);
                        }).toList();
                        salesFiltered.sort((a, b) {
                          switch (_salesSort) {
                            case _ReportSort.terbaru:
                              return b.createdAt.compareTo(a.createdAt);
                            case _ReportSort.az:
                              return a.customerName.toLowerCase().compareTo(
                                b.customerName.toLowerCase(),
                              );
                            case _ReportSort.za:
                              return b.customerName.toLowerCase().compareTo(
                                a.customerName.toLowerCase(),
                              );
                            case _ReportSort.terbanyak:
                              return b.total.compareTo(a.total);
                            case _ReportSort.terkecil:
                              return a.total.compareTo(b.total);
                          }
                        });

                        final products =
                            productSnapshot.data ?? const <Product>[];
                        final materials =
                            materialSnapshot.data ?? const <RawMaterial>[];
                        final expenses =
                            expenseSnapshot.data ?? const <Expense>[];
                        final assets =
                            assetSnapshot.data ?? const <AssetInvestment>[];

                        final productMap = <String, Product>{
                          for (final p in products) p.id: p,
                        };
                        final materialMap = <String, RawMaterial>{
                          for (final m in materials) m.id: m,
                        };

                        double cogsPerProduct(Product p) {
                          if (p.recipe.isEmpty) return 0;
                          var total = 0.0;
                          for (final r in p.recipe) {
                            total +=
                                (materialMap[r.materialId]?.averageCost ?? 0) *
                                r.quantity;
                          }
                          return total;
                        }

                        final revenue = salesByRange.fold<double>(
                          0,
                          (sum, s) => sum + s.total,
                        );
                        final cashTotal = salesByRange
                            .where(
                              (s) => s.paymentMethod.toLowerCase().contains(
                                'cash',
                              ),
                            )
                            .fold<double>(0, (sum, s) => sum + s.total);
                        final qrisTotal = salesByRange
                            .where(
                              (s) => s.paymentMethod.toLowerCase().contains(
                                'qris',
                              ),
                            )
                            .fold<double>(0, (sum, s) => sum + s.total);
                        final cardTotal = salesByRange
                            .where(
                              (s) => s.paymentMethod.toLowerCase().contains(
                                'card',
                              ),
                            )
                            .fold<double>(0, (sum, s) => sum + s.total);

                        final financeRangeStart = _rangeStartByPreset(
                          now,
                          _financeRange,
                        );
                        final salesForFinance = sales
                            .where((s) => s.createdAt.isAfter(financeRangeStart))
                            .toList();
                        final expensesForFinance = expenses
                            .where(
                              (e) => e.expenseDate.isAfter(financeRangeStart),
                            )
                            .toList();

                        double transactionCogs(SalesTransaction tx) {
                          var txCost = 0.0;
                          for (final item in tx.items) {
                            final p = productMap[item.productId];
                            if (p == null) continue;
                            txCost += cogsPerProduct(p) * item.qty;
                          }
                          return txCost;
                        }

                        final financeRevenue = salesForFinance.fold<double>(
                          0,
                          (sum, s) => sum + s.total,
                        );
                        final financeCogs = salesForFinance.fold<double>(
                          0,
                          (sum, s) => sum + transactionCogs(s),
                        );
                        final financeGrossProfit = financeRevenue - financeCogs;
                        final financeExpenses = expensesForFinance.fold<double>(
                          0,
                          (sum, e) => sum + e.amount,
                        );
                        final financeNetProfit =
                            financeGrossProfit - financeExpenses;

                        DateTime financeBucketStart(DateTime dt) {
                          final day = DateTime(dt.year, dt.month, dt.day);
                          switch (_financeSubPeriod) {
                            case _FinanceSubPeriod.day:
                              return day;
                            case _FinanceSubPeriod.week:
                              return day.subtract(
                                Duration(days: day.weekday - 1),
                              );
                            case _FinanceSubPeriod.month:
                              return DateTime(dt.year, dt.month);
                          }
                        }

                        final financeBreakdownMap =
                            <DateTime, _FinanceBreakdownData>{};
                        for (final tx in salesForFinance) {
                          final key = financeBucketStart(tx.createdAt);
                          final row = financeBreakdownMap.putIfAbsent(
                            key,
                            () => _FinanceBreakdownData(periodStart: key),
                          );
                          row.revenue += tx.total;
                          row.cogs += transactionCogs(tx);
                        }
                        for (final e in expensesForFinance) {
                          final key = financeBucketStart(e.expenseDate);
                          final row = financeBreakdownMap.putIfAbsent(
                            key,
                            () => _FinanceBreakdownData(periodStart: key),
                          );
                          row.expenses += e.amount;
                        }
                        final financeBreakdown = financeBreakdownMap.values
                            .toList()
                          ..sort(
                            (a, b) => b.periodStart.compareTo(a.periodStart),
                          );

                        String two(int value) =>
                            value.toString().padLeft(2, '0');
                        String financePeriodLabel(DateTime start) {
                          switch (_financeSubPeriod) {
                            case _FinanceSubPeriod.day:
                              return '${two(start.day)}/${two(start.month)}/${start.year}';
                            case _FinanceSubPeriod.week:
                              final end = start.add(const Duration(days: 6));
                              return '${two(start.day)}/${two(start.month)} - ${two(end.day)}/${two(end.month)}';
                            case _FinanceSubPeriod.month:
                              return '${two(start.month)}/${start.year}';
                          }
                        }

                        final inventoryValue = materials.fold<double>(
                          0,
                          (sum, m) => sum + (m.stock * m.averageCost),
                        );

                        final currentAssetValue = assets.fold<double>(0, (
                          sum,
                          a,
                        ) {
                          final years = max(
                            0.0,
                            now.difference(a.purchaseDate).inDays / 365,
                          );
                          final depreciationPerYear = a.depreciationYears <= 0
                              ? a.value
                              : (a.value / a.depreciationYears);
                          final residual = max(
                            0,
                            a.value - (depreciationPerYear * years),
                          );
                          return sum + residual;
                        });

                        final salesCsv = StringBuffer()
                          ..writeln(
                            'invoice,customer,payment_method,created_at,total',
                          )
                          ..writeAll(
                            salesByRange.map(
                              (s) =>
                                  '${_csvEscape(s.invoice)},${_csvEscape(s.customerName)},${_csvEscape(s.paymentMethod)},${_csvEscape(s.createdAt.toIso8601String())},${s.total}',
                            ),
                            '\n',
                          );

                        final financeCsv = StringBuffer()
                          ..writeln('metric,value')
                          ..writeln('revenue,$financeRevenue')
                          ..writeln('cogs,$financeCogs')
                          ..writeln('gross_profit,$financeGrossProfit')
                          ..writeln('expenses,$financeExpenses')
                          ..writeln('net_profit,$financeNetProfit');

                        final inventoryCsv = StringBuffer()
                          ..writeln('type,name,value,extra')
                          ..writeAll(
                            materials.map(
                              (m) =>
                                  '${_csvEscape('raw_material')},${_csvEscape(m.name)},${m.stock * m.averageCost},${_csvEscape('${m.stock} ${m.unit}; avgCost=${m.averageCost}')}',
                            ),
                            '\n',
                          )
                          ..writeln()
                          ..writeAll(
                            assets.map(
                              (a) =>
                                  '${_csvEscape('asset')},${_csvEscape(a.name)},${a.value},${_csvEscape('depreciationYears=${a.depreciationYears}; purchaseDate=${a.purchaseDate.toIso8601String()}')}',
                            ),
                            '\n',
                          );

                        return ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            if (widget.section == ReportSection.sales) ...[
                              Row(
                                children: [
                                  const Expanded(
                                    child: Text(
                                      'Laporan Penjualan',
                                      style: TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  OutlinedButton.icon(
                                    onPressed: () async {
                                      final picked = await showDatePicker(
                                        context: context,
                                        initialDate: salesDayStart,
                                        firstDate: DateTime(2020, 1, 1),
                                        lastDate: DateTime(2100, 12, 31),
                                      );
                                      if (picked == null || !mounted) return;
                                      setState(() => _salesDay = picked);
                                    },
                                    icon: const Icon(Icons.calendar_month),
                                    label: Text(
                                      DateFormat('dd/MM/yyyy').format(salesDayStart),
                                    ),
                                  ),
                                  OutlinedButton.icon(
                                    onPressed: () => _copyCsvToClipboard(
                                      context,
                                      salesCsv.toString(),
                                      'Sales',
                                    ),
                                    icon: const Icon(Icons.download),
                                    label: const Text('Export CSV'),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              TextField(
                                controller: _salesSearchController,
                                onChanged: (v) {
                                  _salesSearchDebouncer.run(() {
                                    if (!mounted) return;
                                    setState(() => _salesQuery = v);
                                  });
                                },
                                decoration: const InputDecoration(
                                  labelText: 'Search transaksi',
                                  prefixIcon: Icon(Icons.search),
                                ),
                              ),
                              const SizedBox(height: 8),
                              DropdownButtonFormField<_ReportSort>(
                                initialValue: _salesSort,
                                items: const [
                                  DropdownMenuItem(
                                    value: _ReportSort.terbaru,
                                    child: Text('Terbaru'),
                                  ),
                                  DropdownMenuItem(
                                    value: _ReportSort.az,
                                    child: Text('A-Z'),
                                  ),
                                  DropdownMenuItem(
                                    value: _ReportSort.za,
                                    child: Text('Z-A'),
                                  ),
                                  DropdownMenuItem(
                                    value: _ReportSort.terbanyak,
                                    child: Text('Terbanyak'),
                                  ),
                                  DropdownMenuItem(
                                    value: _ReportSort.terkecil,
                                    child: Text('Terkecil'),
                                  ),
                                ],
                                onChanged: (v) {
                                  if (v != null) setState(() => _salesSort = v);
                                },
                                decoration: const InputDecoration(
                                  labelText: 'Sort transaksi',
                                ),
                              ),
                              const SizedBox(height: 10),
                              Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: [
                                  _MetricCard(
                                    title: 'Revenue',
                                    value: formatCurrency(revenue),
                                    icon: Icons.payments_outlined,
                                  ),
                                  _MetricCard(
                                    title: 'Total Sales',
                                    value: '${salesFiltered.length}',
                                    icon: Icons.receipt_long_outlined,
                                  ),
                                  _MetricCard(
                                    title: 'Uang Cash',
                                    value: formatCurrency(cashTotal),
                                    icon: Icons.payments_outlined,
                                  ),
                                  _MetricCard(
                                    title: 'Uang QRIS',
                                    value: formatCurrency(qrisTotal),
                                    icon: Icons.qr_code_2_outlined,
                                  ),
                                  _MetricCard(
                                    title: 'Uang Card',
                                    value: formatCurrency(cardTotal),
                                    icon: Icons.credit_card,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Card(
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Transaksi',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        DateFormat('dd/MM/yyyy').format(salesDayStart),
                                        style: Theme.of(context).textTheme.bodySmall,
                                      ),
                                      const SizedBox(height: 8),
                                      if (salesFiltered.isEmpty)
                                        const Text('Belum ada transaksi.')
                                      else
                                        SizedBox(
                                          height: 520,
                                          child: ListView.builder(
                                            itemCount: salesFiltered.length,
                                            itemBuilder: (context, index) {
                                              final s = salesFiltered[index];
                                              return ListTile(
                                                contentPadding: EdgeInsets.zero,
                                                title: Text('Invoice: ${s.invoice}'),
                                                subtitle: Text(
                                                  'Customer: ${s.customerName.isEmpty ? 'Anonymous' : s.customerName}\n'
                                                  '${formatDateTime(s.createdAt)} • ${s.paymentMethod}',
                                                ),
                                                isThreeLine: true,
                                                trailing:
                                                    PopupMenuButton<String>(
                                                  onSelected: (value) async {
                                                    if (value == 'edit') {
                                                      await _showEditSalesDialog(
                                                        s,
                                                      );
                                                    } else if (value == 'delete') {
                                                      await _confirmDeleteSales(
                                                        s,
                                                      );
                                                    } else if (value == 'print') {
                                                      await _reprintTransaction(
                                                        context,
                                                        s,
                                                        productMap,
                                                      );
                                                    }
                                                  },
                                                  itemBuilder: (context) => [
                                                    PopupMenuItem(
                                                      enabled: false,
                                                      child: Text(
                                                        formatCurrency(s.total),
                                                        style: const TextStyle(
                                                          fontWeight:
                                                              FontWeight.w700,
                                                        ),
                                                      ),
                                                    ),
                                                    const PopupMenuDivider(),
                                                    const PopupMenuItem(
                                                      value: 'edit',
                                                      child: Text(
                                                        'Edit Transaksi',
                                                      ),
                                                    ),
                                                    const PopupMenuItem(
                                                      value: 'delete',
                                                      child: Text('Delete'),
                                                    ),
                                                    const PopupMenuItem(
                                                      value: 'print',
                                                      child: Text(
                                                        'Cetak Ulang Struk',
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              );
                                            },
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                            if (widget.section == ReportSection.inventory) ...[
                              Row(
                                children: [
                                  const Expanded(
                                    child: Text(
                                      'Laporan Inventaris',
                                      style: TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  OutlinedButton.icon(
                                    onPressed: () => _copyCsvToClipboard(
                                      context,
                                      inventoryCsv.toString(),
                                      'Inventory',
                                    ),
                                    icon: const Icon(Icons.download),
                                    label: const Text('Export CSV'),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: [
                                  _MetricCard(
                                    title: 'Nilai Stok Bahan Baku',
                                    value: formatCurrency(inventoryValue),
                                    icon: Icons.inventory_2_outlined,
                                  ),
                                  _MetricCard(
                                    title: 'Nilai Aset Terkini',
                                    value: formatCurrency(currentAssetValue),
                                    icon: Icons.apartment_outlined,
                                  ),
                                ],
                              ),
                            ],
                            if (widget.section == ReportSection.finance) ...[
                              Row(
                                children: [
                                  const Expanded(
                                    child: Text(
                                      'Laporan Keuangan',
                                      style: TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  OutlinedButton.icon(
                                    onPressed: () => _copyCsvToClipboard(
                                      context,
                                      financeCsv.toString(),
                                      'Finance',
                                    ),
                                    icon: const Icon(Icons.download),
                                    label: const Text('Export CSV'),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: [
                                  _MetricCard(
                                    title: 'Revenue',
                                    value: formatCurrency(financeRevenue),
                                    icon: Icons.payments_outlined,
                                  ),
                                  _MetricCard(
                                    title: 'COGS',
                                    value: formatCurrency(financeCogs),
                                    icon: Icons.shopping_bag_outlined,
                                  ),
                                  _MetricCard(
                                    title: 'Gross Profit',
                                    value: formatCurrency(financeGrossProfit),
                                    icon: Icons.trending_up,
                                  ),
                                  _MetricCard(
                                    title: 'Expenses',
                                    value: formatCurrency(financeExpenses),
                                    icon: Icons.money_off_csred_outlined,
                                  ),
                                  _MetricCard(
                                    title: 'Net Profit',
                                    value: formatCurrency(financeNetProfit),
                                    icon: Icons.account_balance_wallet_outlined,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Card(
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Financial Summary Breakdown',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 16,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      const Text(
                                        'Detailed financial data for each sub-period.',
                                      ),
                                      const SizedBox(height: 12),
                                      SegmentedButton<_SalesRange>(
                                        segments: const [
                                          ButtonSegment(
                                            value: _SalesRange.eightHours,
                                            label: Text('8 Jam'),
                                          ),
                                          ButtonSegment(
                                            value: _SalesRange.day,
                                            label: Text('Hari'),
                                          ),
                                          ButtonSegment(
                                            value: _SalesRange.week,
                                            label: Text('Minggu'),
                                          ),
                                          ButtonSegment(
                                            value: _SalesRange.month,
                                            label: Text('Bulan'),
                                          ),
                                        ],
                                        selected: <_SalesRange>{_financeRange},
                                        onSelectionChanged: (value) {
                                          setState(
                                            () => _financeRange = value.first,
                                          );
                                        },
                                      ),
                                      const SizedBox(height: 8),
                                      SegmentedButton<_FinanceSubPeriod>(
                                        segments: const [
                                          ButtonSegment(
                                            value: _FinanceSubPeriod.day,
                                            label: Text('Per Hari'),
                                          ),
                                          ButtonSegment(
                                            value: _FinanceSubPeriod.week,
                                            label: Text('Per Minggu'),
                                          ),
                                          ButtonSegment(
                                            value: _FinanceSubPeriod.month,
                                            label: Text('Per Bulan'),
                                          ),
                                        ],
                                        selected: <_FinanceSubPeriod>{
                                          _financeSubPeriod,
                                        },
                                        onSelectionChanged: (value) {
                                          setState(
                                            () =>
                                                _financeSubPeriod = value.first,
                                          );
                                        },
                                      ),
                                      const SizedBox(height: 12),
                                      if (financeBreakdown.isEmpty)
                                        const Text(
                                          'Belum ada data untuk rentang ini.',
                                        )
                                      else
                                        ...financeBreakdown.map(
                                          (row) => ListTile(
                                            contentPadding: EdgeInsets.zero,
                                            title: Text(
                                              financePeriodLabel(
                                                row.periodStart,
                                              ),
                                            ),
                                            subtitle: Text(
                                              'Revenue ${formatCurrency(row.revenue)} • COGS ${formatCurrency(row.cogs)} • Expenses ${formatCurrency(row.expenses)}',
                                            ),
                                            trailing: Text(
                                              formatCurrency(row.netProfit),
                                              style: TextStyle(
                                                fontWeight: FontWeight.w700,
                                                color: row.netProfit >= 0
                                                    ? Colors.green
                                                    : Colors.red,
                                              ),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ],
                        );
                      },
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.title,
    required this.value,
    required this.icon,
  });

  final String title;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 260,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 18),
                  const SizedBox(width: 8),
                  Expanded(child: Text(title)),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FinanceBreakdownData {
  _FinanceBreakdownData({required this.periodStart});

  final DateTime periodStart;
  double revenue = 0;
  double cogs = 0;
  double expenses = 0;

  double get grossProfit => revenue - cogs;
  double get netProfit => grossProfit - expenses;
}
