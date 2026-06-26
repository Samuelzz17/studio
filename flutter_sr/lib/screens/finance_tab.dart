import 'package:flutter/material.dart';

import '../models/domain_models.dart';
import '../services/firestore_service.dart';
import '../utils/debouncer.dart';
import '../utils/formatters.dart';

enum FinanceSection { purchases, expenses, assetPurchases }

enum _FinanceSort { terbaru, az, za, terbanyak, terkecil }

class FinanceTab extends StatefulWidget {
  const FinanceTab({super.key, required this.outlet, required this.section});

  final OutletInfo outlet;
  final FinanceSection section;

  @override
  State<FinanceTab> createState() => _FinanceTabState();
}

class _FinanceTabState extends State<FinanceTab> {
  final _firestore = FirestoreService.instance;
  final TextEditingController _searchController = TextEditingController();
  final Debouncer _searchDebouncer = Debouncer(
    delay: const Duration(milliseconds: 220),
  );
  String _query = '';
  _FinanceSort _sort = _FinanceSort.az;
  bool _submitLock = false;

  Future<void> _runSingleFlight(Future<void> Function() action) async {
    if (_submitLock) return;
    _submitLock = true;
    try {
      await action();
    } finally {
      _submitLock = false;
    }
  }

  @override
  void dispose() {
    _searchDebouncer.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _confirmDelete({
    required String title,
    required Future<void> Function() onDelete,
  }) async {
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        scrollable: true,
        title: Text('Hapus $title?'),
        content: const Text('Aksi ini tidak bisa dibatalkan.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () async {
              await _runSingleFlight(() async {
                final navigator = Navigator.of(context);
                await onDelete();
                if (!mounted) return;
                navigator.pop();
              });
            },
            child: const Text('Hapus'),
          ),
        ],
      ),
    );
  }

  Future<void> _showRecordPurchaseDialog(List<RawMaterial> materials) async {
    if (materials.isEmpty) return;
    final sortedMaterials = List<RawMaterial>.from(materials)
      ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    String materialId = sortedMaterials.first.id;
    final qty = TextEditingController(text: '0');
    final totalCost = TextEditingController(text: '0');
    final supplier = TextEditingController();

    await showDialog<void>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialog) {
            final selected = sortedMaterials.firstWhere(
              (m) => m.id == materialId,
            );
            return AlertDialog(
              scrollable: true,
              title: const Text('Catat Pembelian Bahan'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: materialId,
                    items: sortedMaterials
                        .map(
                          (m) => DropdownMenuItem(
                            value: m.id,
                            child: Text(m.name),
                          ),
                        )
                        .toList(),
                    onChanged: (v) =>
                        setDialog(() => materialId = v ?? materialId),
                    decoration: const InputDecoration(labelText: 'Bahan baku'),
                  ),
                  TextField(
                    controller: qty,
                    decoration: const InputDecoration(labelText: 'Jumlah beli'),
                    keyboardType: TextInputType.number,
                  ),
                  TextField(
                    controller: totalCost,
                    decoration: const InputDecoration(labelText: 'Total biaya'),
                    keyboardType: TextInputType.number,
                  ),
                  TextField(
                    controller: supplier,
                    decoration: const InputDecoration(
                      labelText: 'Supplier (opsional)',
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text('Unit: ${selected.unit}'),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Batal'),
                ),
                FilledButton(
                  onPressed: () async {
                    await _runSingleFlight(() async {
                      final navigator = Navigator.of(context);
                      await _firestore.recordRawMaterialPurchase(
                        outletId: widget.outlet.id,
                        materialId: selected.id,
                        materialName: selected.name,
                        unit: selected.unit,
                        quantity: double.tryParse(qty.text) ?? 0,
                        totalCost: double.tryParse(totalCost.text) ?? 0,
                        supplier: supplier.text.trim().isEmpty
                            ? null
                            : supplier.text.trim(),
                      );
                      if (!mounted) return;
                      navigator.pop();
                    });
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

  Future<void> _showAddExpenseDialog() async {
    final name = TextEditingController();
    final category = TextEditingController();
    final amount = TextEditingController(text: '0');
    final notes = TextEditingController();

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        scrollable: true,
        title: const Text('Tambah Expense'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Nama'),
            ),
            TextField(
              controller: category,
              decoration: const InputDecoration(labelText: 'Kategori'),
            ),
            TextField(
              controller: amount,
              decoration: const InputDecoration(labelText: 'Jumlah'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: notes,
              decoration: const InputDecoration(labelText: 'Catatan'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () async {
              await _runSingleFlight(() async {
                final navigator = Navigator.of(context);
                await _firestore.addExpense(
                  outletId: widget.outlet.id,
                  name: name.text.trim(),
                  category: category.text.trim(),
                  amount: double.tryParse(amount.text) ?? 0,
                  expenseDate: DateTime.now(),
                  notes: notes.text.trim(),
                );
                if (!mounted) return;
                navigator.pop();
              });
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
  }

  Future<void> _showEditExpenseDialog(Expense expense) async {
    final name = TextEditingController(text: expense.name);
    final category = TextEditingController(text: expense.category);
    final amount = TextEditingController(text: expense.amount.toString());
    final notes = TextEditingController(text: expense.notes ?? '');

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        scrollable: true,
        title: const Text('Edit Expense'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Nama'),
            ),
            TextField(
              controller: category,
              decoration: const InputDecoration(labelText: 'Kategori'),
            ),
            TextField(
              controller: amount,
              decoration: const InputDecoration(labelText: 'Jumlah'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: notes,
              decoration: const InputDecoration(labelText: 'Catatan'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () async {
              await _runSingleFlight(() async {
                final navigator = Navigator.of(context);
                await _firestore.updateExpense(
                  outletId: widget.outlet.id,
                  expenseId: expense.id,
                  name: name.text.trim(),
                  category: category.text.trim(),
                  amount: double.tryParse(amount.text) ?? 0,
                  expenseDate: expense.expenseDate,
                  notes: notes.text.trim(),
                );
                if (!mounted) return;
                navigator.pop();
              });
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
  }

  Future<void> _showEditPurchaseDialog(Purchase purchase) async {
    final qty = TextEditingController(text: purchase.quantity.toString());
    final totalCost = TextEditingController(
      text: purchase.totalCost.toString(),
    );
    final supplier = TextEditingController(text: purchase.supplier ?? '');

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        scrollable: true,
        title: const Text('Edit Pembelian Bahan'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: qty,
              decoration: const InputDecoration(labelText: 'Jumlah beli'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: totalCost,
              decoration: const InputDecoration(labelText: 'Total biaya'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: supplier,
              decoration: const InputDecoration(
                labelText: 'Supplier (opsional)',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () async {
              await _runSingleFlight(() async {
                final navigator = Navigator.of(context);
                await _firestore.updatePurchase(
                  outletId: widget.outlet.id,
                  purchaseId: purchase.id,
                  quantity: double.tryParse(qty.text) ?? 0,
                  totalCost: double.tryParse(totalCost.text) ?? 0,
                  supplier: supplier.text.trim().isEmpty
                      ? null
                      : supplier.text.trim(),
                );
                if (!mounted) return;
                navigator.pop();
              });
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
  }

  Future<void> _showEditAssetDialog(AssetInvestment asset) async {
    final name = TextEditingController(text: asset.name);
    final value = TextEditingController(text: asset.value.toString());
    final years = TextEditingController(
      text: asset.depreciationYears.toString(),
    );

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        scrollable: true,
        title: const Text('Edit Aset'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Nama aset'),
            ),
            TextField(
              controller: value,
              decoration: const InputDecoration(labelText: 'Nilai aset'),
              keyboardType: TextInputType.number,
            ),
            TextField(
              controller: years,
              decoration: const InputDecoration(
                labelText: 'Masa depresiasi (tahun)',
              ),
              keyboardType: TextInputType.number,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () async {
              await _runSingleFlight(() async {
                final navigator = Navigator.of(context);
                await _firestore.updateAsset(
                  outletId: widget.outlet.id,
                  assetId: asset.id,
                  name: name.text.trim(),
                  value: double.tryParse(value.text) ?? 0,
                  purchaseDate: asset.purchaseDate,
                  depreciationYears:
                      int.tryParse(years.text) ?? asset.depreciationYears,
                );
                if (!mounted) return;
                navigator.pop();
              });
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final needsMaterials = widget.section == FinanceSection.purchases;
    final needsPurchases = widget.section == FinanceSection.purchases;
    final needsExpenses = widget.section == FinanceSection.expenses;
    final needsAssets = widget.section == FinanceSection.assetPurchases;

    return StreamBuilder<List<RawMaterial>>(
      stream: needsMaterials
          ? _firestore.streamRawMaterials(widget.outlet.id)
          : null,
      builder: (context, materialSnapshot) {
        return StreamBuilder<List<Purchase>>(
          stream: needsPurchases
              ? _firestore.streamPurchases(widget.outlet.id)
              : null,
          builder: (context, purchaseSnapshot) {
            return StreamBuilder<List<Expense>>(
              stream: needsExpenses
                  ? _firestore.streamExpenses(widget.outlet.id)
                  : null,
              builder: (context, expenseSnapshot) {
                return StreamBuilder<List<AssetInvestment>>(
                  stream: needsAssets
                      ? _firestore.streamAssets(widget.outlet.id)
                      : null,
                  builder: (context, assetSnapshot) {
                    final loading =
                        (needsMaterials &&
                            materialSnapshot.connectionState ==
                                ConnectionState.waiting) ||
                        (needsPurchases &&
                            purchaseSnapshot.connectionState ==
                                ConnectionState.waiting) ||
                        (needsExpenses &&
                            expenseSnapshot.connectionState ==
                                ConnectionState.waiting) ||
                        (needsAssets &&
                            assetSnapshot.connectionState ==
                                ConnectionState.waiting);

                    final materials =
                        materialSnapshot.data ?? const <RawMaterial>[];
                    final purchases =
                        purchaseSnapshot.data ?? const <Purchase>[];
                    final expenses = expenseSnapshot.data ?? const <Expense>[];
                    final assets =
                        assetSnapshot.data ?? const <AssetInvestment>[];

                    final filteredPurchases = purchases.where((p) {
                      final q = _query.trim().toLowerCase();
                      if (q.isEmpty) return true;
                      return p.materialName.toLowerCase().contains(q) ||
                          (p.supplier ?? '').toLowerCase().contains(q);
                    }).toList();
                    filteredPurchases.sort((a, b) {
                      switch (_sort) {
                        case _FinanceSort.terbaru:
                          return b.createdAt.compareTo(a.createdAt);
                        case _FinanceSort.az:
                          return a.materialName.toLowerCase().compareTo(
                            b.materialName.toLowerCase(),
                          );
                        case _FinanceSort.za:
                          return b.materialName.toLowerCase().compareTo(
                            a.materialName.toLowerCase(),
                          );
                        case _FinanceSort.terbanyak:
                          return b.totalCost.compareTo(a.totalCost);
                        case _FinanceSort.terkecil:
                          return a.totalCost.compareTo(b.totalCost);
                      }
                    });

                    final filteredExpenses = expenses.where((e) {
                      final q = _query.trim().toLowerCase();
                      if (q.isEmpty) return true;
                      return e.name.toLowerCase().contains(q) ||
                          e.category.toLowerCase().contains(q);
                    }).toList();
                    filteredExpenses.sort((a, b) {
                      switch (_sort) {
                        case _FinanceSort.terbaru:
                          return b.expenseDate.compareTo(a.expenseDate);
                        case _FinanceSort.az:
                          return a.name.toLowerCase().compareTo(
                            b.name.toLowerCase(),
                          );
                        case _FinanceSort.za:
                          return b.name.toLowerCase().compareTo(
                            a.name.toLowerCase(),
                          );
                        case _FinanceSort.terbanyak:
                          return b.amount.compareTo(a.amount);
                        case _FinanceSort.terkecil:
                          return a.amount.compareTo(b.amount);
                      }
                    });

                    final filteredAssets = assets.where((a) {
                      final q = _query.trim().toLowerCase();
                      if (q.isEmpty) return true;
                      return a.name.toLowerCase().contains(q);
                    }).toList();
                    filteredAssets.sort((a, b) {
                      switch (_sort) {
                        case _FinanceSort.terbaru:
                          return b.purchaseDate.compareTo(a.purchaseDate);
                        case _FinanceSort.az:
                          return a.name.toLowerCase().compareTo(
                            b.name.toLowerCase(),
                          );
                        case _FinanceSort.za:
                          return b.name.toLowerCase().compareTo(
                            a.name.toLowerCase(),
                          );
                        case _FinanceSort.terbanyak:
                          return b.value.compareTo(a.value);
                        case _FinanceSort.terkecil:
                          return a.value.compareTo(b.value);
                      }
                    });

                    if (loading) {
                      return const Center(child: CircularProgressIndicator());
                    }

                    return ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        TextField(
                          controller: _searchController,
                          onChanged: (v) {
                            _searchDebouncer.run(() {
                              if (!mounted) return;
                              setState(() => _query = v);
                            });
                          },
                          decoration: const InputDecoration(
                            labelText: 'Search item',
                            prefixIcon: Icon(Icons.search),
                          ),
                        ),
                        const SizedBox(height: 8),
                        DropdownButtonFormField<_FinanceSort>(
                          initialValue: _sort,
                          items: const [
                            DropdownMenuItem(
                              value: _FinanceSort.terbaru,
                              child: Text('Terbaru'),
                            ),
                            DropdownMenuItem(
                              value: _FinanceSort.az,
                              child: Text('A-Z'),
                            ),
                            DropdownMenuItem(
                              value: _FinanceSort.za,
                              child: Text('Z-A'),
                            ),
                            DropdownMenuItem(
                              value: _FinanceSort.terbanyak,
                              child: Text('Terbanyak'),
                            ),
                            DropdownMenuItem(
                              value: _FinanceSort.terkecil,
                              child: Text('Terkecil'),
                            ),
                          ],
                          onChanged: (v) {
                            if (v != null) setState(() => _sort = v);
                          },
                          decoration: const InputDecoration(
                            labelText: 'Sort item',
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (widget.section == FinanceSection.purchases) ...[
                          Row(
                            children: [
                              const Expanded(
                                child: Text(
                                  'Keuangan: Pembelian Bahan',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              FilledButton.icon(
                                onPressed: materials.isEmpty
                                    ? null
                                    : () =>
                                          _showRecordPurchaseDialog(materials),
                                icon: const Icon(Icons.add_shopping_cart),
                                label: const Text('Catat'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                children: filteredPurchases
                                    .take(20)
                                    .map(
                                      (p) => ListTile(
                                        contentPadding: EdgeInsets.zero,
                                        title: Text(p.materialName),
                                        subtitle: Text(
                                          '${p.quantity.toStringAsFixed(0)} ${p.unit} • ${formatDateTime(p.createdAt)}',
                                        ),
                                        trailing: PopupMenuButton<String>(
                                          onSelected: (value) async {
                                            if (value == 'edit') {
                                              await _showEditPurchaseDialog(p);
                                            } else if (value == 'delete') {
                                              await _confirmDelete(
                                                title: p.materialName,
                                                onDelete: () =>
                                                    _firestore.deletePurchase(
                                                      outletId:
                                                          widget.outlet.id,
                                                      purchaseId: p.id,
                                                    ),
                                              );
                                            }
                                          },
                                          itemBuilder: (context) => const [
                                            PopupMenuItem(
                                              value: 'edit',
                                              child: Text('Edit'),
                                            ),
                                            PopupMenuItem(
                                              value: 'delete',
                                              child: Text('Delete'),
                                            ),
                                          ],
                                          child: Text(
                                            formatCurrency(p.totalCost),
                                          ),
                                        ),
                                      ),
                                    )
                                    .toList(),
                              ),
                            ),
                          ),
                        ],
                        if (widget.section == FinanceSection.expenses) ...[
                          Row(
                            children: [
                              const Expanded(
                                child: Text(
                                  'Keuangan: Biaya Operasional',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              FilledButton.icon(
                                onPressed: _showAddExpenseDialog,
                                icon: const Icon(Icons.add),
                                label: const Text('Tambah'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                children: filteredExpenses
                                    .take(20)
                                    .map(
                                      (e) => ListTile(
                                        contentPadding: EdgeInsets.zero,
                                        title: Text(e.name),
                                        subtitle: Text(
                                          '${e.category} • ${formatDateTime(e.expenseDate)}',
                                        ),
                                        trailing: PopupMenuButton<String>(
                                          onSelected: (value) async {
                                            if (value == 'edit') {
                                              await _showEditExpenseDialog(e);
                                            } else if (value == 'delete') {
                                              await _confirmDelete(
                                                title: e.name,
                                                onDelete: () =>
                                                    _firestore.deleteExpense(
                                                      outletId:
                                                          widget.outlet.id,
                                                      expenseId: e.id,
                                                    ),
                                              );
                                            }
                                          },
                                          itemBuilder: (context) => const [
                                            PopupMenuItem(
                                              value: 'edit',
                                              child: Text('Edit'),
                                            ),
                                            PopupMenuItem(
                                              value: 'delete',
                                              child: Text('Delete'),
                                            ),
                                          ],
                                          child: Text(formatCurrency(e.amount)),
                                        ),
                                      ),
                                    )
                                    .toList(),
                              ),
                            ),
                          ),
                        ],
                        if (widget.section ==
                            FinanceSection.assetPurchases) ...[
                          const Text(
                            'Keuangan: Riwayat Pembelian Aset',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                children: filteredAssets
                                    .take(20)
                                    .map(
                                      (a) => ListTile(
                                        contentPadding: EdgeInsets.zero,
                                        title: Text(a.name),
                                        subtitle: Text(
                                          'Beli ${formatDateTime(a.purchaseDate)} • Depresiasi ${a.depreciationYears} thn',
                                        ),
                                        trailing: PopupMenuButton<String>(
                                          onSelected: (value) async {
                                            if (value == 'edit') {
                                              await _showEditAssetDialog(a);
                                            } else if (value == 'delete') {
                                              await _confirmDelete(
                                                title: a.name,
                                                onDelete: () =>
                                                    _firestore.deleteAsset(
                                                      outletId:
                                                          widget.outlet.id,
                                                      assetId: a.id,
                                                    ),
                                              );
                                            }
                                          },
                                          itemBuilder: (context) => const [
                                            PopupMenuItem(
                                              value: 'edit',
                                              child: Text('Edit'),
                                            ),
                                            PopupMenuItem(
                                              value: 'delete',
                                              child: Text('Delete'),
                                            ),
                                          ],
                                          child: Text(formatCurrency(a.value)),
                                        ),
                                      ),
                                    )
                                    .toList(),
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
  }
}
