import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../models/domain_models.dart';
import '../services/firestore_service.dart';
import '../utils/debouncer.dart';
import '../utils/formatters.dart';

enum InventorySection { products, rawMaterials, assets }

enum _InventorySort { az, za, terbanyak, terkecil }

class InventoryTab extends StatefulWidget {
  const InventoryTab({super.key, required this.outlet, required this.section});

  final OutletInfo outlet;
  final InventorySection section;

  @override
  State<InventoryTab> createState() => _InventoryTabState();
}

class _InventoryTabState extends State<InventoryTab> {
  final _firestore = FirestoreService.instance;
  final TextEditingController _searchController = TextEditingController();
  final Debouncer _searchDebouncer = Debouncer(
    delay: const Duration(milliseconds: 220),
  );
  String _query = '';
  _InventorySort _sort = _InventorySort.az;
  bool _submitLock = false;
  bool get _hideHppOnAndroid =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

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

  Future<void> _showEditRawMaterialDialog(RawMaterial material) async {
    final name = TextEditingController(text: material.name);
    final unit = TextEditingController(text: material.unit);
    final stock = TextEditingController(text: material.stock.toString());
    final minStock = TextEditingController(
      text: material.minimumStock.toString(),
    );
    final avgCost = TextEditingController(
      text: material.averageCost.toString(),
    );

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        scrollable: true,
        title: const Text('Edit Bahan Baku'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Nama'),
              ),
              TextField(
                controller: unit,
                decoration: const InputDecoration(labelText: 'Unit'),
              ),
              TextField(
                controller: stock,
                decoration: const InputDecoration(labelText: 'Stock'),
                keyboardType: TextInputType.number,
              ),
              TextField(
                controller: minStock,
                decoration: const InputDecoration(labelText: 'Minimum stock'),
                keyboardType: TextInputType.number,
              ),
              TextField(
                controller: avgCost,
                decoration: const InputDecoration(labelText: 'Average cost'),
                keyboardType: TextInputType.number,
              ),
            ],
          ),
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
                await _firestore.updateRawMaterial(
                  outletId: widget.outlet.id,
                  materialId: material.id,
                  name: name.text.trim(),
                  unit: unit.text.trim(),
                  stock: double.tryParse(stock.text) ?? 0,
                  minimumStock: double.tryParse(minStock.text) ?? 0,
                  averageCost: double.tryParse(avgCost.text) ?? 0,
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

  Future<void> _showEditProductDialog(
    Product product,
    List<RawMaterial> rawMaterials,
  ) async {
    final name = TextEditingController(text: product.name);
    final category = TextEditingController(text: product.category);
    final price = TextEditingController(text: product.price.toString());
    var active = product.active;
    final recipe = product.recipe
        .map(
          (r) => _RecipeDraft()
            ..materialId = r.materialId
            ..qty.text = r.quantity.toString(),
        )
        .toList();

    await showDialog<void>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialog) {
            return AlertDialog(
              scrollable: true,
              title: const Text('Edit Produk'),
              content: SingleChildScrollView(
                child: SizedBox(
                  width: 520,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TextField(
                        controller: name,
                        decoration: const InputDecoration(
                          labelText: 'Nama produk',
                        ),
                      ),
                      TextField(
                        controller: category,
                        decoration: const InputDecoration(
                          labelText: 'Kategori',
                        ),
                      ),
                      TextField(
                        controller: price,
                        decoration: const InputDecoration(labelText: 'Harga'),
                        keyboardType: TextInputType.number,
                      ),
                      SwitchListTile(
                        value: active,
                        onChanged: (v) => setDialog(() => active = v),
                        title: const Text('Aktif di POS'),
                      ),
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'Recipe/BOM',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                          TextButton.icon(
                            onPressed: () =>
                                setDialog(() => recipe.add(_RecipeDraft())),
                            icon: const Icon(Icons.add),
                            label: const Text('Tambah'),
                          ),
                        ],
                      ),
                      ...recipe.asMap().entries.map((entry) {
                        final index = entry.key;
                        final row = entry.value;
                        return Row(
                          children: [
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                initialValue: row.materialId,
                                items: rawMaterials
                                    .map(
                                      (m) => DropdownMenuItem(
                                        value: m.id,
                                        child: Text(m.name),
                                      ),
                                    )
                                    .toList(),
                                onChanged: (v) => row.materialId = v,
                                decoration: const InputDecoration(
                                  labelText: 'Bahan',
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            SizedBox(
                              width: 120,
                              child: TextField(
                                controller: row.qty,
                                decoration: const InputDecoration(
                                  labelText: 'Qty',
                                ),
                                keyboardType: TextInputType.number,
                              ),
                            ),
                            IconButton(
                              onPressed: () =>
                                  setDialog(() => recipe.removeAt(index)),
                              icon: const Icon(Icons.delete_outline),
                            ),
                          ],
                        );
                      }),
                    ],
                  ),
                ),
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
                      final mappedRecipe = recipe
                          .where((r) => (r.materialId ?? '').isNotEmpty)
                          .map(
                            (r) => ProductRecipeItem(
                              materialId: r.materialId!,
                              quantity: double.tryParse(r.qty.text) ?? 0,
                            ),
                          )
                          .where((r) => r.quantity > 0)
                          .toList();

                      await _firestore.updateProduct(
                        outletId: widget.outlet.id,
                        productId: product.id,
                        name: name.text.trim(),
                        category: category.text.trim(),
                        price: double.tryParse(price.text) ?? 0,
                        active: active,
                        recipe: mappedRecipe,
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

  Future<void> _showAddRawMaterialDialog() async {
    final name = TextEditingController();
    final unit = TextEditingController(text: 'g');
    final stock = TextEditingController(text: '0');
    final minStock = TextEditingController(text: '0');
    final avgCost = TextEditingController(text: '0');

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        scrollable: true,
        title: const Text('Tambah Bahan Baku'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Nama'),
              ),
              TextField(
                controller: unit,
                decoration: const InputDecoration(
                  labelText: 'Unit (g, mL, pcs)',
                ),
              ),
              TextField(
                controller: stock,
                decoration: const InputDecoration(labelText: 'Stock awal'),
                keyboardType: TextInputType.number,
              ),
              TextField(
                controller: minStock,
                decoration: const InputDecoration(labelText: 'Minimum stock'),
                keyboardType: TextInputType.number,
              ),
              TextField(
                controller: avgCost,
                decoration: const InputDecoration(
                  labelText: 'Average cost per unit',
                ),
                keyboardType: TextInputType.number,
              ),
            ],
          ),
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
                await _firestore.addRawMaterial(
                  outletId: widget.outlet.id,
                  name: name.text.trim(),
                  unit: unit.text.trim(),
                  stock: double.tryParse(stock.text) ?? 0,
                  minimumStock: double.tryParse(minStock.text) ?? 0,
                  averageCost: double.tryParse(avgCost.text) ?? 0,
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

  Future<void> _showAddProductDialog(List<RawMaterial> rawMaterials) async {
    final name = TextEditingController();
    final category = TextEditingController();
    final price = TextEditingController(text: '0');
    var active = true;
    final recipe = <_RecipeDraft>[];

    await showDialog<void>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialog) {
            return AlertDialog(
              scrollable: true,
              title: const Text('Tambah Produk'),
              content: SingleChildScrollView(
                child: SizedBox(
                  width: 520,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TextField(
                        controller: name,
                        decoration: const InputDecoration(
                          labelText: 'Nama produk',
                        ),
                      ),
                      TextField(
                        controller: category,
                        decoration: const InputDecoration(
                          labelText: 'Kategori',
                        ),
                      ),
                      TextField(
                        controller: price,
                        decoration: const InputDecoration(labelText: 'Harga'),
                        keyboardType: TextInputType.number,
                      ),
                      SwitchListTile(
                        value: active,
                        onChanged: (v) => setDialog(() => active = v),
                        title: const Text('Aktif di POS'),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'Recipe/BOM',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                          TextButton.icon(
                            onPressed: () {
                              setDialog(() {
                                recipe.add(_RecipeDraft());
                              });
                            },
                            icon: const Icon(Icons.add),
                            label: const Text('Tambah bahan'),
                          ),
                        ],
                      ),
                      ...recipe.asMap().entries.map((entry) {
                        final index = entry.key;
                        final row = entry.value;
                        return Row(
                          children: [
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                initialValue: row.materialId,
                                items: rawMaterials
                                    .map(
                                      (m) => DropdownMenuItem(
                                        value: m.id,
                                        child: Text(m.name),
                                      ),
                                    )
                                    .toList(),
                                decoration: const InputDecoration(
                                  labelText: 'Bahan',
                                ),
                                onChanged: (v) => row.materialId = v,
                              ),
                            ),
                            const SizedBox(width: 8),
                            SizedBox(
                              width: 120,
                              child: TextField(
                                controller: row.qty,
                                decoration: const InputDecoration(
                                  labelText: 'Qty',
                                ),
                                keyboardType: TextInputType.number,
                              ),
                            ),
                            IconButton(
                              onPressed: () {
                                setDialog(() {
                                  recipe.removeAt(index);
                                });
                              },
                              icon: const Icon(Icons.delete_outline),
                            ),
                          ],
                        );
                      }),
                    ],
                  ),
                ),
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
                      final mappedRecipe = recipe
                          .where((r) => (r.materialId ?? '').isNotEmpty)
                          .map(
                            (r) => ProductRecipeItem(
                              materialId: r.materialId!,
                              quantity: double.tryParse(r.qty.text) ?? 0,
                            ),
                          )
                          .where((r) => r.quantity > 0)
                          .toList();

                      await _firestore.addProduct(
                        outletId: widget.outlet.id,
                        name: name.text.trim(),
                        category: category.text.trim(),
                        price: double.tryParse(price.text) ?? 0,
                        active: active,
                        recipe: mappedRecipe,
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

  Future<void> _showAddAssetDialog() async {
    final name = TextEditingController();
    final value = TextEditingController(text: '0');
    final years = TextEditingController(text: '5');

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        scrollable: true,
        title: const Text('Tambah Aset'),
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
                await _firestore.addAsset(
                  outletId: widget.outlet.id,
                  name: name.text.trim(),
                  value: double.tryParse(value.text) ?? 0,
                  purchaseDate: DateTime.now(),
                  depreciationYears: int.tryParse(years.text) ?? 5,
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
    final needsRawMaterials =
        widget.section == InventorySection.rawMaterials ||
        widget.section == InventorySection.products;
    final needsProducts = widget.section == InventorySection.products;
    final needsAssets = widget.section == InventorySection.assets;

    return StreamBuilder<List<RawMaterial>>(
      stream: needsRawMaterials
          ? _firestore.streamRawMaterials(widget.outlet.id)
          : null,
      builder: (context, rawSnapshot) {
        return StreamBuilder<List<Product>>(
          stream: needsProducts ? _firestore.streamProducts(widget.outlet.id) : null,
          builder: (context, prodSnapshot) {
            return StreamBuilder<List<AssetInvestment>>(
              stream: needsAssets ? _firestore.streamAssets(widget.outlet.id) : null,
              builder: (context, assetSnapshot) {
                final loading =
                    (needsRawMaterials &&
                        rawSnapshot.connectionState ==
                            ConnectionState.waiting) ||
                    (needsProducts &&
                        prodSnapshot.connectionState ==
                            ConnectionState.waiting) ||
                    (needsAssets &&
                        assetSnapshot.connectionState ==
                            ConnectionState.waiting);

                final rawMaterials = rawSnapshot.data ?? const <RawMaterial>[];
                final products = prodSnapshot.data ?? const <Product>[];
                final assets = assetSnapshot.data ?? const <AssetInvestment>[];

                final filteredRaw = rawMaterials.where((m) {
                  final q = _query.trim().toLowerCase();
                  if (q.isEmpty) return true;
                  return m.name.toLowerCase().contains(q) ||
                      m.unit.toLowerCase().contains(q);
                }).toList();
                filteredRaw.sort((a, b) {
                  switch (_sort) {
                    case _InventorySort.az:
                      return a.name.toLowerCase().compareTo(
                        b.name.toLowerCase(),
                      );
                    case _InventorySort.za:
                      return b.name.toLowerCase().compareTo(
                        a.name.toLowerCase(),
                      );
                    case _InventorySort.terbanyak:
                      return b.stock.compareTo(a.stock);
                    case _InventorySort.terkecil:
                      return a.stock.compareTo(b.stock);
                  }
                });

                final filteredProducts = products.where((p) {
                  final q = _query.trim().toLowerCase();
                  if (q.isEmpty) return true;
                  return p.name.toLowerCase().contains(q) ||
                      p.category.toLowerCase().contains(q);
                }).toList();
                filteredProducts.sort((a, b) {
                  switch (_sort) {
                    case _InventorySort.az:
                      return a.name.toLowerCase().compareTo(
                        b.name.toLowerCase(),
                      );
                    case _InventorySort.za:
                      return b.name.toLowerCase().compareTo(
                        a.name.toLowerCase(),
                      );
                    case _InventorySort.terbanyak:
                      return b.price.compareTo(a.price);
                    case _InventorySort.terkecil:
                      return a.price.compareTo(b.price);
                  }
                });

                final filteredAssets = assets.where((a) {
                  final q = _query.trim().toLowerCase();
                  if (q.isEmpty) return true;
                  return a.name.toLowerCase().contains(q);
                }).toList();
                filteredAssets.sort((a, b) {
                  switch (_sort) {
                    case _InventorySort.az:
                      return a.name.toLowerCase().compareTo(
                        b.name.toLowerCase(),
                      );
                    case _InventorySort.za:
                      return b.name.toLowerCase().compareTo(
                        a.name.toLowerCase(),
                      );
                    case _InventorySort.terbanyak:
                      return b.value.compareTo(a.value);
                    case _InventorySort.terkecil:
                      return a.value.compareTo(b.value);
                  }
                });

                final rawMap = <String, RawMaterial>{
                  for (final m in rawMaterials) m.id: m,
                };

                int producibleQty(Product p) {
                  if (p.recipe.isEmpty) return 999999;
                  var minQty = 999999;
                  for (final r in p.recipe) {
                    final stock = rawMap[r.materialId]?.stock ?? 0;
                    if (r.quantity <= 0) continue;
                    minQty = min(minQty, (stock / r.quantity).floor());
                  }
                  return minQty;
                }

                double productCost(Product p) {
                  var cost = 0.0;
                  for (final r in p.recipe) {
                    cost +=
                        (rawMap[r.materialId]?.averageCost ?? 0) * r.quantity;
                  }
                  return cost;
                }

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
                    DropdownButtonFormField<_InventorySort>(
                      initialValue: _sort,
                      items: const [
                        DropdownMenuItem(
                          value: _InventorySort.az,
                          child: Text('A-Z'),
                        ),
                        DropdownMenuItem(
                          value: _InventorySort.za,
                          child: Text('Z-A'),
                        ),
                        DropdownMenuItem(
                          value: _InventorySort.terbanyak,
                          child: Text('Terbanyak'),
                        ),
                        DropdownMenuItem(
                          value: _InventorySort.terkecil,
                          child: Text('Terkecil'),
                        ),
                      ],
                      onChanged: (v) {
                        if (v != null) setState(() => _sort = v);
                      },
                      decoration: const InputDecoration(labelText: 'Sort item'),
                    ),
                    const SizedBox(height: 12),
                    if (widget.section == InventorySection.rawMaterials) ...[
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'Inventory: Bahan Baku',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          FilledButton.icon(
                            onPressed: _showAddRawMaterialDialog,
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
                            children: filteredRaw
                                .map(
                                  (m) => ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(m.name),
                                    subtitle: Text(
                                      '${m.stock.toStringAsFixed(0)} ${m.unit} • Min ${m.minimumStock.toStringAsFixed(0)} ${m.unit} • Avg ${formatCurrency(m.averageCost)}',
                                    ),
                                    trailing: PopupMenuButton<String>(
                                      onSelected: (value) async {
                                        if (value == 'edit') {
                                          await _showEditRawMaterialDialog(m);
                                        } else if (value == 'delete') {
                                          await _confirmDelete(
                                            title: m.name,
                                            onDelete: () =>
                                                _firestore.deleteRawMaterial(
                                                  outletId: widget.outlet.id,
                                                  materialId: m.id,
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
                                      child: Chip(
                                        label: Text(
                                          m.stock <= 0
                                              ? 'Habis'
                                              : (m.isLowStock
                                                    ? 'Menipis'
                                                    : 'Aman'),
                                        ),
                                      ),
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                        ),
                      ),
                    ],
                    if (widget.section == InventorySection.products) ...[
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'Inventory: Produk',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          FilledButton.icon(
                            onPressed: () =>
                                _showAddProductDialog(rawMaterials),
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
                            children: filteredProducts
                                .map(
                                  (p) => ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(p.name),
                                    subtitle: Text(
                                      _hideHppOnAndroid
                                          ? '${p.category} • Harga ${formatCurrency(p.price)}'
                                          : '${p.category} • Harga ${formatCurrency(p.price)} • HPP ${formatCurrency(productCost(p))}',
                                    ),
                                    trailing: PopupMenuButton<String>(
                                      onSelected: (value) async {
                                        if (value == 'edit') {
                                          await _showEditProductDialog(
                                            p,
                                            rawMaterials,
                                          );
                                        } else if (value == 'delete') {
                                          await _confirmDelete(
                                            title: p.name,
                                            onDelete: () =>
                                                _firestore.deleteProduct(
                                                  outletId: widget.outlet.id,
                                                  productId: p.id,
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
                                      child: Chip(
                                        label: Text(
                                          producibleQty(p) <= 0 || !p.active
                                              ? 'Unavailable'
                                              : 'Qty ${producibleQty(p) >= 999999 ? 'N/A' : producibleQty(p)}',
                                        ),
                                      ),
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                        ),
                      ),
                    ],
                    if (widget.section == InventorySection.assets) ...[
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'Inventory: Aset',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          FilledButton.icon(
                            onPressed: _showAddAssetDialog,
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
                            children: filteredAssets
                                .map(
                                  (a) => ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(a.name),
                                    subtitle: Text(
                                      'Nilai ${formatCurrency(a.value)} • Beli ${formatDateTime(a.purchaseDate)}',
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
                                                  outletId: widget.outlet.id,
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
                                      child: Text('${a.depreciationYears} thn'),
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
  }
}

class _RecipeDraft {
  String? materialId;
  TextEditingController qty = TextEditingController(text: '0');
}
