import 'dart:math';

import 'package:flutter/material.dart';

import '../models/domain_models.dart';
import '../services/firestore_service.dart';
import '../utils/debouncer.dart';
import '../utils/escpos_builder.dart';
import '../utils/formatters.dart';
import '../utils/receipt_printer.dart';

enum _PosSort { az, za, highest, lowest }

class PosTab extends StatefulWidget {
  const PosTab({super.key, required this.outlet});

  final OutletInfo outlet;

  @override
  State<PosTab> createState() => _PosTabState();
}

class _PosTabState extends State<PosTab> {
  final _firestore = FirestoreService.instance;
  final Map<String, int> _cartQtyByProductId = <String, int>{};
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _discountController = TextEditingController();
  final TextEditingController _taxController = TextEditingController();
  final Debouncer _searchDebouncer = Debouncer(
    delay: const Duration(milliseconds: 220),
  );
  late final Listenable _pricingListenable;
  late Stream<List<Product>> _productsStream;
  late Stream<List<RawMaterial>> _rawMaterialsStream;

  String _discountType = 'percentage';
  bool _isSubmitting = false;
  String _searchQuery = '';
  _PosSort _productSort = _PosSort.az;
  String _lastDefaultTaxText = '12';

  String _defaultTaxPercentForOutlet(OutletInfo outlet) {
    final name = outlet.name.trim().toLowerCase();
    final code = outlet.code.trim().toLowerCase();
    if (name == 'sr jalur 11' || name.contains('jalur 11') || code.contains('jalur11')) {
      return '0';
    }
    return '12';
  }

  // Cache heavy computations so rebuilds caused by keyboard (MediaQuery changes)
  // don't repeatedly filter/sort large product lists.
  List<Product>? _visibleCacheProductsSource;
  String _visibleCacheQuery = '';
  _PosSort? _visibleCacheSort;
  List<Product> _visibleCache = const <Product>[];

  List<Product>? _productMapCacheSource;
  Map<String, Product> _productMapCache = const <String, Product>{};

  List<RawMaterial>? _rawMaterialMapCacheSource;
  Map<String, RawMaterial> _rawMaterialMapCache = const <String, RawMaterial>{};

  List<Product> _computeVisibleProducts(List<Product> products) {
    final q = _searchQuery.trim().toLowerCase();
    final sort = _productSort;
    if (identical(_visibleCacheProductsSource, products) &&
        _visibleCacheQuery == q &&
        _visibleCacheSort == sort) {
      return _visibleCache;
    }

    final filtered = <Product>[];
    for (final p in products) {
      if (!p.active) continue;
      if (q.isNotEmpty) {
        final name = p.name.toLowerCase();
        final cat = p.category.toLowerCase();
        if (!name.contains(q) && !cat.contains(q)) continue;
      }
      filtered.add(p);
    }

    filtered.sort((a, b) {
      switch (sort) {
        case _PosSort.az:
          return a.name.toLowerCase().compareTo(b.name.toLowerCase());
        case _PosSort.za:
          return b.name.toLowerCase().compareTo(a.name.toLowerCase());
        case _PosSort.highest:
          return b.price.compareTo(a.price);
        case _PosSort.lowest:
          return a.price.compareTo(b.price);
      }
    });

    _visibleCacheProductsSource = products;
    _visibleCacheQuery = q;
    _visibleCacheSort = sort;
    _visibleCache = filtered;
    return filtered;
  }

  Map<String, Product> _computeProductMap(List<Product> products) {
    if (identical(_productMapCacheSource, products)) return _productMapCache;
    final map = <String, Product>{for (final p in products) p.id: p};
    _productMapCacheSource = products;
    _productMapCache = map;
    return map;
  }

  Map<String, RawMaterial> _computeRawMaterialMap(List<RawMaterial> materials) {
    if (identical(_rawMaterialMapCacheSource, materials)) {
      return _rawMaterialMapCache;
    }
    final map = <String, RawMaterial>{for (final m in materials) m.id: m};
    _rawMaterialMapCacheSource = materials;
    _rawMaterialMapCache = map;
    return map;
  }

  @override
  void initState() {
    super.initState();
    _pricingListenable = Listenable.merge([_discountController, _taxController]);
    _bindStreams();
  }

  @override
  void didUpdateWidget(covariant PosTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.outlet.id != widget.outlet.id) {
      _bindStreams();
    }
  }

  void _bindStreams() {
    _productsStream = _firestore.streamProducts(widget.outlet.id);
    _rawMaterialsStream = _firestore.streamRawMaterials(widget.outlet.id);
    final nextDefault = _defaultTaxPercentForOutlet(widget.outlet);
    final current = _taxController.text.trim();
    if (current.isEmpty || current == _lastDefaultTaxText) {
      _taxController.text = nextDefault;
    }
    _lastDefaultTaxText = nextDefault;
  }

  @override
  void dispose() {
    _searchDebouncer.dispose();
    _searchController.dispose();
    _discountController.dispose();
    _taxController.dispose();
    super.dispose();
  }

  double get _discountValue {
    return double.tryParse(_discountController.text.trim()) ?? 0;
  }

  double get _taxRatePercent {
    return double.tryParse(_taxController.text.trim()) ?? 0;
  }

  int _qtyInCart(String productId) => _cartQtyByProductId[productId] ?? 0;

  int _calculateProducibleQty(
    Product product,
    Map<String, RawMaterial> rawMaterialsMap,
  ) {
    if (product.recipe.isEmpty) return 999999;
    var minQty = 999999;
    for (final recipe in product.recipe) {
      final material = rawMaterialsMap[recipe.materialId];
      final stock = material?.stock ?? 0;
      if (recipe.quantity <= 0) continue;
      final ratio = (stock / recipe.quantity).floor();
      minQty = min(minQty, ratio);
    }
    return minQty;
  }

  void _addProduct(Product product, Map<String, RawMaterial> rawMaterialsMap) {
    setState(() {
      final inCart = _qtyInCart(product.id);
      _cartQtyByProductId[product.id] = inCart + 1;
    });
  }

  void _updateQty(
    Product product,
    int delta,
    Map<String, RawMaterial> rawMaterialsMap,
  ) {
    final current = _qtyInCart(product.id);
    if (current <= 0 && delta < 0) return;

    final next = current + delta;
    setState(() {
      if (next <= 0) {
        _cartQtyByProductId.remove(product.id);
      } else {
        _cartQtyByProductId[product.id] = next;
      }
    });
  }

  void _clearOrder() {
    final defaultTax = _defaultTaxPercentForOutlet(widget.outlet);
    setState(() {
      _cartQtyByProductId.clear();
      _discountType = 'percentage';
      _discountController.clear();
      _taxController.text = defaultTax;
      _lastDefaultTaxText = defaultTax;
    });
  }

  double _subtotal(Map<String, Product> productMap) {
    var total = 0.0;
    _cartQtyByProductId.forEach((productId, qty) {
      total += (productMap[productId]?.price ?? 0) * qty;
    });
    return total;
  }

  double _discountAmount(double subtotal) {
    if (_discountType == 'percentage') {
      return subtotal * (_discountValue / 100);
    }
    return _discountValue;
  }

  double _roundUpToThousand(double amount) {
    if (amount <= 0) return 0;
    return ((amount / 1000).ceil() * 1000).toDouble();
  }

  Future<void> _showCheckoutDialog({
    required Map<String, Product> productMap,
    required Map<String, RawMaterial> rawMaterialsMap,
  }) async {
    final customerNameController = TextEditingController();
    final cashPaymentController = TextEditingController();

    var paymentMethod = 'Cash';

    final subtotal = _subtotal(productMap);
    final discountAmount = _discountAmount(
      subtotal,
    ).clamp(0, subtotal).toDouble();
    final afterDiscount = subtotal - discountAmount;
    final taxAmount = afterDiscount * (_taxRatePercent / 100);
    final baseTotal = afterDiscount + taxAmount;
    final grandTotal = _roundUpToThousand(baseTotal);
    final rounding = grandTotal - baseTotal;

    await showDialog<void>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final cashPayment =
                double.tryParse(cashPaymentController.text) ?? 0;
            final changeAmount = cashPayment - grandTotal;

            return AlertDialog(
              scrollable: true,
              insetPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 16,
              ),
              title: const Text('Checkout'),
              content: SizedBox(
                width: 420,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextField(
                      controller: customerNameController,
                      decoration: const InputDecoration(
                        labelText: 'Nama pelanggan (opsional)',
                      ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: paymentMethod,
                      items: const [
                        DropdownMenuItem(value: 'Cash', child: Text('Tunai')),
                        DropdownMenuItem(value: 'QRIS', child: Text('QRIS')),
                        DropdownMenuItem(value: 'Card', child: Text('Card')),
                      ],
                      onChanged: (value) {
                        setDialogState(() => paymentMethod = value ?? 'Cash');
                      },
                      decoration: const InputDecoration(
                        labelText: 'Metode pembayaran',
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (paymentMethod == 'Cash') ...[
                      TextField(
                        controller: cashPaymentController,
                        decoration: const InputDecoration(
                          labelText: 'Uang dibayar',
                        ),
                        keyboardType: TextInputType.number,
                        onChanged: (_) => setDialogState(() {}),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [20000, 25000, 50000, 100000]
                            .map(
                              (amount) => OutlinedButton(
                                onPressed: () {
                                  cashPaymentController.text = amount
                                      .toString();
                                  setDialogState(() {});
                                },
                                child: Text(formatCurrency(amount)),
                              ),
                            )
                            .toList(),
                      ),
                    ],
                    const SizedBox(height: 12),
                    _SummaryRow(
                      label: 'Subtotal',
                      value: formatCurrency(subtotal),
                    ),
                    _SummaryRow(
                      label: 'Diskon',
                      value: '- ${formatCurrency(discountAmount)}',
                    ),
                    _SummaryRow(
                      label: 'Pajak',
                      value: formatCurrency(taxAmount),
                    ),
                    const Divider(),
                    _SummaryRow(
                      label: 'Total',
                      value: formatCurrency(grandTotal),
                      isBold: true,
                    ),
                    if (paymentMethod == 'Cash')
                      _SummaryRow(
                        label: 'Kembalian',
                        value: formatCurrency(changeAmount),
                        isBold: true,
                      ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: _isSubmitting
                      ? null
                      : () => Navigator.of(context).pop(),
                  child: const Text('Batal'),
                ),
                FilledButton(
                  onPressed: _isSubmitting
                      ? null
                      : () async {
                          if (_isSubmitting) return;
                          if (_cartQtyByProductId.isEmpty) return;
                          final cashPayment =
                              double.tryParse(cashPaymentController.text) ?? 0;
                          if (paymentMethod == 'Cash' &&
                              cashPayment < grandTotal) {
                            _showMessage(
                              'Pembayaran tunai kurang.',
                              isError: true,
                            );
                            return;
                          }

                          setState(() => _isSubmitting = true);
                          try {
                            final receiptItems = _cartQtyByProductId.entries
                                .map(
                                  (entry) => SaleReceiptItem(
                                    name:
                                        productMap[entry.key]?.name ??
                                        entry.key,
                                    qty: entry.value.toDouble(),
                                    price: productMap[entry.key]?.price ?? 0,
                                  ),
                                )
                                .toList();

                            final items = _cartQtyByProductId.entries
                                .map(
                                  (entry) => PosCheckoutItem(
                                    productId: entry.key,
                                    qty: entry.value.toDouble(),
                                    price: productMap[entry.key]?.price ?? 0,
                                  ),
                                )
                                .toList();

                            final navigator = Navigator.of(context);

                            final invoice = await _firestore
                                .checkoutPosTransaction(
                                  outletId: widget.outlet.id,
                                  items: items,
                                  customerName: customerNameController.text
                                      .trim(),
                                  paymentMethod: paymentMethod,
                                  subtotal: subtotal,
                                  discountAmount: discountAmount,
                                  discountType: _discountType,
                                  discountValue: _discountValue,
                                  taxRate: _taxRatePercent / 100,
                                  taxAmount: taxAmount,
                                  total: grandTotal,
                                  rounding: rounding,
                                  customerPayment: paymentMethod == 'Cash'
                                      ? cashPayment
                                      : grandTotal,
                                  changeAmount: paymentMethod == 'Cash'
                                      ? (cashPayment - grandTotal)
                                      : 0,
                                  rawMaterialMap: rawMaterialsMap,
                                  productMap: productMap,
                                );

                            if (!mounted) return;
                            navigator.pop();
                            _showMessage('Checkout sukses. Invoice: $invoice');
                            await ReceiptPrinter.showPrintDialog(
                              context: this.context,
                              outlet: widget.outlet,
                              invoice: invoice,
                              customerName: customerNameController.text.trim(),
                              paymentMethod: paymentMethod,
                              createdAt: DateTime.now(),
                              items: receiptItems,
                              subtotal: subtotal,
                              discount: discountAmount,
                              tax: taxAmount,
                              total: grandTotal,
                              customerPayment: paymentMethod == 'Cash'
                                  ? cashPayment
                                  : grandTotal,
                              change: paymentMethod == 'Cash'
                                  ? (cashPayment - grandTotal)
                                  : 0,
                            );
                            _clearOrder();
                          } catch (e) {
                            _showMessage(e.toString(), isError: true);
                          } finally {
                            if (mounted) {
                              setState(() => _isSubmitting = false);
                            }
                          }
                        },
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Bayar'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showMessage(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Product>>(
      stream: _productsStream,
      builder: (context, productSnapshot) {
        return StreamBuilder<List<RawMaterial>>(
          stream: _rawMaterialsStream,
          builder: (context, materialSnapshot) {
            final loading =
                productSnapshot.connectionState == ConnectionState.waiting ||
                materialSnapshot.connectionState == ConnectionState.waiting;

            final products = productSnapshot.data ?? const <Product>[];
            final visibleProducts = _computeVisibleProducts(products);
            final rawMaterials = materialSnapshot.data ?? const <RawMaterial>[];

            final productMap = _computeProductMap(products);
            final rawMaterialMap = _computeRawMaterialMap(rawMaterials);

            if (loading) {
              return const Center(child: CircularProgressIndicator());
            }

            Widget searchField = TextField(
              controller: _searchController,
              onChanged: (value) {
                _searchDebouncer.run(() {
                  if (!mounted) return;
                  setState(() => _searchQuery = value);
                });
              },
              decoration: InputDecoration(
                labelText: 'Cari produk',
                hintText: 'Nama produk / kategori',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchQuery.isEmpty
                    ? null
                    : IconButton(
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                        icon: const Icon(Icons.close),
                      ),
              ),
            );

            Widget sortField = DropdownButtonFormField<_PosSort>(
              initialValue: _productSort,
              items: const [
                DropdownMenuItem(value: _PosSort.az, child: Text('A-Z')),
                DropdownMenuItem(value: _PosSort.za, child: Text('Z-A')),
                DropdownMenuItem(
                  value: _PosSort.highest,
                  child: Text('Termahal'),
                ),
                DropdownMenuItem(
                  value: _PosSort.lowest,
                  child: Text('Termurah'),
                ),
              ],
              onChanged: (value) {
                if (value != null) {
                  setState(() => _productSort = value);
                }
              },
              decoration: const InputDecoration(labelText: 'Sort item'),
            );

            Widget buildProductGrid({required bool shrinkWrap}) {
              return GridView.builder(
                shrinkWrap: shrinkWrap,
                primary: !shrinkWrap,
                physics: shrinkWrap
                    ? const NeverScrollableScrollPhysics()
                    : const ClampingScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 280,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.35,
                ),
                itemCount: visibleProducts.length,
                itemBuilder: (_, index) {
                  final product = visibleProducts[index];
                  final producibleQty = _calculateProducibleQty(
                    product,
                    rawMaterialMap,
                  );
                  return Card(
                    color: producibleQty > 0 ? null : Colors.grey.shade200,
                    child: InkWell(
                      onTap: () => _addProduct(product, rawMaterialMap),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              product.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 8),
                            Text(formatCurrency(product.price)),
                            const SizedBox(height: 6),
                            Text(
                              producibleQty >= 999999
                                  ? 'Est. Qty: N/A'
                                  : 'Est. Qty: $producibleQty',
                              style: TextStyle(
                                fontSize: 12,
                                color: producibleQty > 0
                                    ? Colors.black54
                                    : Colors.red,
                              ),
                            ),
                            if (producibleQty <= 0)
                              const Padding(
                                padding: EdgeInsets.only(top: 6),
                                child: Chip(label: Text('Stok kosong, tetap bisa dijual')),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              );
            }

            Widget cartCard = Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Keranjang Pesanan',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 10),
                    if (_cartQtyByProductId.isEmpty)
                      const Text('Belum ada item di keranjang.')
                    else
                      ..._cartQtyByProductId.entries.map((entry) {
                        final product = productMap[entry.key];
                        if (product == null) return const SizedBox.shrink();
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(product.name),
                          subtitle: Text(formatCurrency(product.price)),
                          trailing: Wrap(
                            crossAxisAlignment: WrapCrossAlignment.center,
                            spacing: 8,
                            children: [
                              IconButton(
                                onPressed: () =>
                                    _updateQty(product, -1, rawMaterialMap),
                                icon: const Icon(Icons.remove_circle_outline),
                              ),
                              Text(
                                '${entry.value}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              IconButton(
                                onPressed: () =>
                                    _updateQty(product, 1, rawMaterialMap),
                                icon: const Icon(Icons.add_circle_outline),
                              ),
                            ],
                          ),
                        );
                      }),
                    const Divider(),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _discountController,
                            decoration: const InputDecoration(
                              labelText: 'Diskon',
                            ),
                            keyboardType: TextInputType.number,
                            textInputAction: TextInputAction.next,
                          ),
                        ),
                        const SizedBox(width: 8),
                        SegmentedButton<String>(
                          segments: const [
                            ButtonSegment(
                              value: 'percentage',
                              label: Text('%'),
                            ),
                            ButtonSegment(value: 'amount', label: Text('Rp')),
                          ],
                          selected: <String>{_discountType},
                          onSelectionChanged: (value) {
                            setState(() => _discountType = value.first);
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _taxController,
                      decoration: const InputDecoration(labelText: 'Pajak (%)'),
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.done,
                    ),
                    const SizedBox(height: 12),
                    ListenableBuilder(
                      listenable: _pricingListenable,
                      builder: (context, _) {
                        final liveSubtotal = _subtotal(productMap);
                        final liveDiscount = _discountAmount(
                          liveSubtotal,
                        ).clamp(0, liveSubtotal).toDouble();
                        final liveAfterDiscount = liveSubtotal - liveDiscount;
                        final liveTax =
                            liveAfterDiscount * (_taxRatePercent / 100);
                        final liveTotal = _roundUpToThousand(
                          liveAfterDiscount + liveTax,
                        );

                        return Column(
                          children: [
                            _SummaryRow(
                              label: 'Subtotal',
                              value: formatCurrency(liveSubtotal),
                            ),
                            _SummaryRow(
                              label: 'Diskon',
                              value: '- ${formatCurrency(liveDiscount)}',
                            ),
                            _SummaryRow(
                              label: 'Pajak',
                              value: formatCurrency(liveTax),
                            ),
                            const Divider(),
                            _SummaryRow(
                              label: 'Total',
                              value: formatCurrency(liveTotal),
                              isBold: true,
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _cartQtyByProductId.isEmpty
                                ? null
                                : _clearOrder,
                            icon: const Icon(Icons.clear),
                            label: const Text('Clear'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: _cartQtyByProductId.isEmpty
                                ? null
                                : () => _showCheckoutDialog(
                                    productMap: productMap,
                                    rawMaterialsMap: rawMaterialMap,
                                  ),
                            icon: const Icon(Icons.payment),
                            label: const Text('Checkout'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );

            return LayoutBuilder(
              builder: (context, constraints) {
                final wide = constraints.maxWidth >= 1100;
                if (!wide) {
                  return ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      const Text(
                        'Point of Sale',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Menu visual, keranjang dinamis, diskon/pajak, checkout Cash/QRIS.',
                      ),
                      const SizedBox(height: 12),
                      searchField,
                      const SizedBox(height: 8),
                      sortField,
                      const SizedBox(height: 12),
                      if (visibleProducts.isEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(
                            'Produk tidak ditemukan.',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ),
                      buildProductGrid(shrinkWrap: true),
                      const SizedBox(height: 16),
                      cartCard,
                    ],
                  );
                }

                return Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: RepaintBoundary(
                          child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Point of Sale',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Menu visual, keranjang dinamis, diskon/pajak, checkout Cash/QRIS.',
                            ),
                            const SizedBox(height: 12),
                            searchField,
                            const SizedBox(height: 8),
                            sortField,
                            const SizedBox(height: 12),
                            if (visibleProducts.isEmpty)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Text(
                                  'Produk tidak ditemukan.',
                                  style: Theme.of(context).textTheme.bodyMedium,
                                ),
                              ),
                            Expanded(child: buildProductGrid(shrinkWrap: false)),
                          ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      SizedBox(
                        width: 420,
                        child: RepaintBoundary(
                          child: SingleChildScrollView(child: cartCard),
                        ),
                      ),
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.isBold = false,
  });

  final String label;
  final String value;
  final bool isBold;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontWeight: isBold ? FontWeight.w700 : FontWeight.w400,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: style),
          Text(value, style: style),
        ],
      ),
    );
  }
}
