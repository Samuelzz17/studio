import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/domain_models.dart';

class FirestoreService {
  FirestoreService._();

  static final FirestoreService instance = FirestoreService._();
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  Future<UserProfile?> getUserProfile(String uid) async {
    final doc = await _db.collection('users').doc(uid).get();
    if (!doc.exists) return null;
    return UserProfile.fromDoc(doc);
  }

  Future<List<OutletInfo>> getOutletsByIds(List<String> outletIds) async {
    if (outletIds.isEmpty) return const [];

    final chunks = <List<String>>[];
    for (var i = 0; i < outletIds.length; i += 10) {
      final end = (i + 10 < outletIds.length) ? i + 10 : outletIds.length;
      chunks.add(outletIds.sublist(i, end));
    }

    final allDocs = <QueryDocumentSnapshot<Map<String, dynamic>>>[];
    for (final chunk in chunks) {
      final snap = await _db
          .collection('outlets')
          .where(FieldPath.documentId, whereIn: chunk)
          .get();
      allDocs.addAll(snap.docs);
    }

    final outlets = allDocs.map(OutletInfo.fromDoc).toList();
    outlets.sort((a, b) => a.name.compareTo(b.name));
    return outlets;
  }

  Future<void> updateOutletLogoUrl({
    required String outletId,
    required String logoUrl,
  }) async {
    await _db.collection('outlets').doc(outletId).update({
      'logoUrl': logoUrl.trim(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Stream<List<SalesTransaction>> streamRecentSales(
    String outletId, {
    int? limit = 10,
  }) {
    var query = _db
        .collection('outlets')
        .doc(outletId)
        .collection('sales')
        .orderBy('createdAt', descending: true);
    if (limit != null && limit > 0) {
      query = query.limit(limit);
    }
    return query
        .snapshots()
        .map(
          (snap) => snap.docs
              .where((doc) => doc.id != '_init')
              .map(SalesTransaction.fromDoc)
              .toList(),
        );
  }

  Stream<List<SalesTransaction>> streamSalesByCreatedAtRange(
    String outletId, {
    required DateTime start,
    required DateTime end,
  }) {
    final startTs = Timestamp.fromDate(start);
    final endTs = Timestamp.fromDate(end);
    return _db
        .collection('outlets')
        .doc(outletId)
        .collection('sales')
        .where('createdAt', isGreaterThanOrEqualTo: startTs)
        .where('createdAt', isLessThan: endTs)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map(
          (snap) => snap.docs
              .where((doc) => doc.id != '_init')
              .map(SalesTransaction.fromDoc)
              .toList(),
        );
  }

  Future<void> ensureDefaultStaffMembers(String outletId) async {
    final outletRef = _db.collection('outlets').doc(outletId);
    final staffRef = outletRef.collection('employees');
    final existing = await staffRef.limit(1).get();
    if (existing.docs.isNotEmpty) return;

    // Migrate legacy collection if present.
    final legacy = await outletRef.collection('employee_staff').get();
    if (legacy.docs.isNotEmpty) {
      final batch = _db.batch();
      for (final doc in legacy.docs) {
        final data = doc.data();
        final rawPos = (data['position'] ?? 'Staff').toString();
        final normalizedPos = rawPos.toLowerCase().contains('kasir')
            ? 'Cashier'
            : (rawPos.toLowerCase().contains('barista') ? 'Barista' : rawPos);
        batch.set(staffRef.doc(doc.id), {
          'name': (data['name'] ?? '').toString(),
          'position': normalizedPos,
          'createdAt': data['createdAt'] ?? FieldValue.serverTimestamp(),
          'migratedFrom': 'employee_staff',
        });
      }
      await batch.commit();
      return;
    }

    final defaults = <Map<String, dynamic>>[
      {
        'id': 'cashier-1',
        'name': 'Meika',
        'position': 'Cashier',
        'createdAt': FieldValue.serverTimestamp(),
      },
      {
        'id': 'cashier-2',
        'name': 'Indri',
        'position': 'Cashier',
        'createdAt': FieldValue.serverTimestamp(),
      },
      {
        'id': 'cashier-3',
        'name': 'Freelance',
        'position': 'Cashier',
        'createdAt': FieldValue.serverTimestamp(),
      },
      {
        'id': 'barista-1',
        'name': 'Sila',
        'position': 'Barista',
        'createdAt': FieldValue.serverTimestamp(),
      },
      {
        'id': 'barista-2',
        'name': 'Marhaen',
        'position': 'Barista',
        'createdAt': FieldValue.serverTimestamp(),
      },
      {
        'id': 'barista-3',
        'name': 'Eka',
        'position': 'Barista',
        'createdAt': FieldValue.serverTimestamp(),
      },
      {
        'id': 'barista-4',
        'name': 'Wiri',
        'position': 'Barista',
        'createdAt': FieldValue.serverTimestamp(),
      },
      {
        'id': 'barista-5',
        'name': 'Krisna',
        'position': 'Barista',
        'createdAt': FieldValue.serverTimestamp(),
      },
    ];

    final batch = _db.batch();
    for (final item in defaults) {
      final id = (item['id'] ?? '').toString();
      final payload = Map<String, dynamic>.from(item)..remove('id');
      batch.set(staffRef.doc(id), payload);
    }
    await batch.commit();
  }

  Stream<List<StaffMember>> streamStaffMembers(String outletId) {
    return _db
        .collection('outlets')
        .doc(outletId)
        .collection('employees')
        .snapshots()
        .map((snap) => snap.docs.map(StaffMember.fromDoc).toList());
  }

  Future<void> addStaffMember({
    required String outletId,
    required String name,
    required String position,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('employees')
        .add({
          'name': name,
          'position': position,
          'createdAt': FieldValue.serverTimestamp(),
        });
  }

  Future<void> updateStaffMember({
    required String outletId,
    required String staffId,
    required String name,
    required String position,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('employees')
        .doc(staffId)
        .update({
          'name': name,
          'position': position,
          'updatedAt': FieldValue.serverTimestamp(),
        });
  }

  Future<void> deleteStaffMember({
    required String outletId,
    required String staffId,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('employees')
        .doc(staffId)
        .delete();
  }

  Stream<List<StaffSchedule>> streamStaffSchedulesByDate(
    String outletId,
    String dateKey,
  ) {
    return _db
        .collection('outlets')
        .doc(outletId)
        .collection('attendance')
        .where('date', isEqualTo: dateKey)
        .snapshots()
        .map((snap) => snap.docs.map(StaffSchedule.fromDoc).toList());
  }

  Stream<List<StaffSchedule>> streamStaffSchedulesInRange(
    String outletId,
    List<String> dateKeys,
  ) {
    if (dateKeys.isEmpty) return Stream.value(const <StaffSchedule>[]);
    // Keep this stream focused on attendance only.
    // Shift overrides are streamed separately to avoid extra reads per update.
    return _db
        .collection('outlets')
        .doc(outletId)
        .collection('attendance')
        .where('date', whereIn: dateKeys)
        .snapshots()
        .map((snap) => snap.docs.map(StaffSchedule.fromDoc).toList());
  }

  Stream<Map<String, Map<String, String>>> streamShiftOverridesInRange(
    String outletId,
    List<String> dateKeys,
  ) {
    if (dateKeys.isEmpty) {
      return Stream.value(const <String, Map<String, String>>{});
    }
    return _db
        .collection('outlets')
        .doc(outletId)
        .collection('shift_overrides')
        .where(FieldPath.documentId, whereIn: dateKeys)
        .snapshots()
        .map((snap) {
          final result = <String, Map<String, String>>{};
          for (final doc in snap.docs) {
            if (doc.id == '_init') continue;
            final data = doc.data();
            final raw = data['overrides'];
            if (raw is! Map) continue;
            final overrides = <String, String>{};
            raw.forEach((key, value) {
              overrides[key.toString()] = value.toString();
            });
            result[doc.id] = overrides;
          }
          return result;
        });
  }

  Future<void> upsertStaffSchedule({
    required String outletId,
    required String staffId,
    required String dateKey,
    required String shift,
    DateTime? checkInTime,
    DateTime? checkOutTime,
  }) async {
    final outletRef = _db.collection('outlets').doc(outletId);
    final employeeDoc = await outletRef.collection('employees').doc(staffId).get();
    final employeeName =
        (employeeDoc.data()?['name'] ?? '').toString().trim().isEmpty
        ? staffId
        : (employeeDoc.data()?['name'] ?? '').toString();

    final attendanceDocId = '${dateKey}_$staffId';
    final attendanceRef = outletRef.collection('attendance').doc(attendanceDocId);
    final overrideRef = outletRef.collection('shift_overrides').doc(dateKey);

    await _db.runTransaction((tx) async {
      final attendancePayload = <String, dynamic>{
        'employeeId': staffId,
        'employeeName': employeeName,
        'shift': shift,
        'date': dateKey,
        'updatedAt': FieldValue.serverTimestamp(),
      };
      if (checkInTime != null) {
        attendancePayload['checkInTime'] = Timestamp.fromDate(checkInTime);
      }
      if (checkOutTime != null) {
        attendancePayload['checkOutTime'] = Timestamp.fromDate(checkOutTime);
      }
      tx.set(attendanceRef, attendancePayload, SetOptions(merge: true));

      final overrideSnap = await tx.get(overrideRef);
      final current = (overrideSnap.data()?['overrides'] as Map?) ?? const {};
      final next = <String, dynamic>{...current, staffId: shift};
      tx.set(
        overrideRef,
        {
          'overrides': next,
          'updatedAt': FieldValue.serverTimestamp(),
        },
        SetOptions(merge: true),
      );
    });
  }

  Future<void> checkInAttendance({
    required String outletId,
    required String staffId,
    required String employeeName,
    required String dateKey,
    required String shift,
  }) async {
    final outletRef = _db.collection('outlets').doc(outletId);
    final attendanceCol = outletRef.collection('attendance');
    // Match web behavior: always add a new attendance row for each check-in.
    await attendanceCol.add({
      'employeeId': staffId,
      'employeeName': employeeName,
      'date': dateKey,
      'shift': shift,
      'checkInTime': FieldValue.serverTimestamp(),
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> checkOutAttendance({
    required String outletId,
    required String attendanceId,
    String? staffId,
    String? dateKey,
  }) async {
    final attendanceRef = _db
        .collection('outlets')
        .doc(outletId)
        .collection('attendance');

    try {
      await attendanceRef.doc(attendanceId).set({
        'checkOutTime': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
      return;
    } catch (_) {
      // Fallback below.
    }

    if (staffId == null || dateKey == null) return;

    final fallback = await attendanceRef
        .where('employeeId', isEqualTo: staffId)
        .where('date', isEqualTo: dateKey)
        .limit(10)
        .get();
    if (fallback.docs.isEmpty) return;
    fallback.docs.sort((a, b) {
      final aAt = (a.data()['checkInTime'] as Timestamp?)?.toDate();
      final bAt = (b.data()['checkInTime'] as Timestamp?)?.toDate();
      if (aAt == null && bAt == null) return 0;
      if (aAt == null) return 1;
      if (bAt == null) return -1;
      return bAt.compareTo(aAt);
    });
    await attendanceRef.doc(fallback.docs.first.id).set({
      'checkOutTime': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  Future<void> updateSalesTransaction({
    required String outletId,
    required String transactionId,
    required String customerName,
    required String paymentMethod,
    required double customerPayment,
    required double change,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('sales')
        .doc(transactionId)
        .update({
          'customerName': customerName.trim().isEmpty
              ? 'Anonymous'
              : customerName.trim(),
          'paymentMethod': paymentMethod,
          'customerPayment': customerPayment,
          'change': change,
          'updatedAt': FieldValue.serverTimestamp(),
        });
  }

  Future<void> deleteSalesTransaction({
    required String outletId,
    required String transactionId,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('sales')
        .doc(transactionId)
        .delete();
  }

  Stream<List<RawMaterial>> streamRawMaterials(String outletId) {
    return _db
        .collection('outlets')
        .doc(outletId)
        .collection('inventory_raw_materials')
        .snapshots()
        .map(
          (snap) => snap.docs
              .where((doc) => doc.id != '_init')
              .map(RawMaterial.fromDoc)
              .toList(),
        );
  }

  Stream<List<Purchase>> streamPurchases(String outletId) {
    return _db
        .collection('outlets')
        .doc(outletId)
        .collection('purchases')
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map(
          (snap) => snap.docs
              .where((doc) => doc.id != '_init')
              .map(Purchase.fromDoc)
              .toList(),
        );
  }

  Future<void> updatePurchase({
    required String outletId,
    required String purchaseId,
    required double quantity,
    required double totalCost,
    String? supplier,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('purchases')
        .doc(purchaseId)
        .update({
          'quantity': quantity,
          'totalCost': totalCost,
          'supplier': supplier,
          'updatedAt': FieldValue.serverTimestamp(),
        });
  }

  Future<void> deletePurchase({
    required String outletId,
    required String purchaseId,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('purchases')
        .doc(purchaseId)
        .delete();
  }

  Stream<List<Expense>> streamExpenses(String outletId) {
    return _db
        .collection('outlets')
        .doc(outletId)
        .collection('expenses')
        .orderBy('expenseDate', descending: true)
        .snapshots()
        .map(
          (snap) => snap.docs
              .where((doc) => doc.id != '_init')
              .map(Expense.fromDoc)
              .toList(),
        );
  }

  Stream<List<AssetInvestment>> streamAssets(String outletId) {
    return _db
        .collection('outlets')
        .doc(outletId)
        .collection('inventory_assets')
        .orderBy('purchaseDate', descending: true)
        .snapshots()
        .map(
          (snap) => snap.docs
              .where((doc) => doc.id != '_init')
              .map(AssetInvestment.fromDoc)
              .toList(),
        );
  }

  Stream<List<Product>> streamProducts(String outletId) {
    return _db
        .collection('outlets')
        .doc(outletId)
        .collection('inventory_products')
        .snapshots()
        .map(
          (snap) => snap.docs
              .where((doc) => doc.id != '_init')
              .map(Product.fromDoc)
              .toList(),
        );
  }

  Future<String> checkoutPosTransaction({
    required String outletId,
    required List<PosCheckoutItem> items,
    required String customerName,
    required String paymentMethod,
    required double subtotal,
    required double discountAmount,
    required String discountType,
    required double discountValue,
    required double taxRate,
    required double taxAmount,
    required double total,
    double? rounding,
    required double customerPayment,
    required double changeAmount,
    required Map<String, RawMaterial> rawMaterialMap,
    required Map<String, Product> productMap,
  }) async {
    final salesRef = _db
        .collection('outlets')
        .doc(outletId)
        .collection('sales')
        .doc();
    final invoice = 'INV-${DateTime.now().millisecondsSinceEpoch}';
    final stockDeductions = <String, double>{};

    for (final item in items) {
      final product = productMap[item.productId];
      if (product == null) {
        throw Exception('Produk tidak ditemukan: ${item.productId}');
      }
      for (final recipe in product.recipe) {
        final current = stockDeductions[recipe.materialId] ?? 0;
        stockDeductions[recipe.materialId] = current + (recipe.quantity * item.qty);
      }
    }

    final batch = _db.batch();

    for (final entry in stockDeductions.entries) {
      final materialRef = _db
          .collection('outlets')
          .doc(outletId)
          .collection('inventory_raw_materials')
          .doc(entry.key);
      batch.update(materialRef, {
        'stock': FieldValue.increment(-entry.value),
      });
    }

    final payload = <String, dynamic>{
      'invoice': invoice,
      'customerName': customerName.isEmpty ? 'Anonymous' : customerName,
      'items': items
          .map(
            (e) => <String, dynamic>{
              'productId': e.productId,
              'qty': e.qty,
              'price': e.price,
              'preference': 'normal',
            },
          )
          .toList(),
      'subtotal': subtotal,
      'discountType': discountType,
      'discountValue': discountValue,
      'discountAmount': discountAmount,
      'taxRate': taxRate,
      'tax': taxAmount,
      'total': total,
      'rounding': rounding,
      'paymentMethod': paymentMethod,
      'customerPayment': customerPayment,
      'change': changeAmount,
      // Use client timestamp so query orderBy(createdAt) updates instantly in UI.
      'createdAt': Timestamp.now(),
    };

    batch.set(salesRef, payload);
    await batch.commit();

    return invoice;
  }

  Future<void> addRawMaterial({
    required String outletId,
    required String name,
    required String unit,
    required double stock,
    required double minimumStock,
    required double averageCost,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('inventory_raw_materials')
        .add({
          'name': name,
          'unit': unit,
          'stock': stock,
          'minimumStock': minimumStock,
          'averageCost': averageCost,
          'createdAt': FieldValue.serverTimestamp(),
        });
  }

  Future<void> updateRawMaterial({
    required String outletId,
    required String materialId,
    required String name,
    required String unit,
    required double stock,
    required double minimumStock,
    required double averageCost,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('inventory_raw_materials')
        .doc(materialId)
        .update({
          'name': name,
          'unit': unit,
          'stock': stock,
          'minimumStock': minimumStock,
          'averageCost': averageCost,
        });
  }

  Future<void> deleteRawMaterial({
    required String outletId,
    required String materialId,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('inventory_raw_materials')
        .doc(materialId)
        .delete();
  }

  Future<void> addProduct({
    required String outletId,
    required String name,
    required String category,
    required double price,
    required bool active,
    required List<ProductRecipeItem> recipe,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('inventory_products')
        .add({
          'name': name,
          'category': category,
          'price': price,
          'active': active,
          'recipe': recipe
              .map(
                (r) => <String, dynamic>{
                  'materialId': r.materialId,
                  'quantity': r.quantity,
                },
              )
              .toList(),
          'createdAt': FieldValue.serverTimestamp(),
        });
  }

  Future<void> updateProduct({
    required String outletId,
    required String productId,
    required String name,
    required String category,
    required double price,
    required bool active,
    required List<ProductRecipeItem> recipe,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('inventory_products')
        .doc(productId)
        .update({
          'name': name,
          'category': category,
          'price': price,
          'active': active,
          'recipe': recipe
              .map(
                (r) => <String, dynamic>{
                  'materialId': r.materialId,
                  'quantity': r.quantity,
                },
              )
              .toList(),
        });
  }

  Future<void> deleteProduct({
    required String outletId,
    required String productId,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('inventory_products')
        .doc(productId)
        .delete();
  }

  Future<void> addExpense({
    required String outletId,
    required String name,
    required String category,
    required double amount,
    required DateTime expenseDate,
    String? notes,
  }) async {
    await _db.collection('outlets').doc(outletId).collection('expenses').add({
      'name': name,
      'category': category,
      'amount': amount,
      'expenseDate': Timestamp.fromDate(expenseDate),
      'notes': notes,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> updateExpense({
    required String outletId,
    required String expenseId,
    required String name,
    required String category,
    required double amount,
    required DateTime expenseDate,
    String? notes,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('expenses')
        .doc(expenseId)
        .update({
          'name': name,
          'category': category,
          'amount': amount,
          'expenseDate': Timestamp.fromDate(expenseDate),
          'notes': notes,
        });
  }

  Future<void> deleteExpense({
    required String outletId,
    required String expenseId,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('expenses')
        .doc(expenseId)
        .delete();
  }

  Future<void> addAsset({
    required String outletId,
    required String name,
    required double value,
    required DateTime purchaseDate,
    required int depreciationYears,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('inventory_assets')
        .add({
          'name': name,
          'value': value,
          'purchaseDate': Timestamp.fromDate(purchaseDate),
          'depreciationYears': depreciationYears,
          'createdAt': FieldValue.serverTimestamp(),
        });
  }

  Future<void> updateAsset({
    required String outletId,
    required String assetId,
    required String name,
    required double value,
    required DateTime purchaseDate,
    required int depreciationYears,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('inventory_assets')
        .doc(assetId)
        .update({
          'name': name,
          'value': value,
          'purchaseDate': Timestamp.fromDate(purchaseDate),
          'depreciationYears': depreciationYears,
        });
  }

  Future<void> deleteAsset({
    required String outletId,
    required String assetId,
  }) async {
    await _db
        .collection('outlets')
        .doc(outletId)
        .collection('inventory_assets')
        .doc(assetId)
        .delete();
  }

  Future<void> recordRawMaterialPurchase({
    required String outletId,
    required String materialId,
    required String materialName,
    required String unit,
    required double quantity,
    required double totalCost,
    String? supplier,
  }) async {
    final materialRef = _db
        .collection('outlets')
        .doc(outletId)
        .collection('inventory_raw_materials')
        .doc(materialId);
    final purchaseRef = _db
        .collection('outlets')
        .doc(outletId)
        .collection('purchases')
        .doc();

    await _db.runTransaction((transaction) async {
      final materialSnap = await transaction.get(materialRef);
      if (!materialSnap.exists) {
        throw Exception('Material tidak ditemukan.');
      }

      final materialData = materialSnap.data() ?? <String, dynamic>{};
      final currentStock = (materialData['stock'] as num?)?.toDouble() ?? 0;
      final currentAverageCost =
          (materialData['averageCost'] as num?)?.toDouble() ?? 0;

      final newStock = currentStock + quantity;
      final newAverageCost = newStock > 0
          ? ((currentStock * currentAverageCost) + totalCost) / newStock
          : 0;

      transaction.update(materialRef, {
        'stock': newStock,
        'averageCost': newAverageCost,
      });

      transaction.set(purchaseRef, {
        'materialName': materialName,
        'materialId': materialId,
        'quantity': quantity,
        'unit': unit,
        'totalCost': totalCost,
        'supplier': supplier,
        'createdAt': FieldValue.serverTimestamp(),
      });
    });
  }
}

class PosCheckoutItem {
  PosCheckoutItem({
    required this.productId,
    required this.qty,
    required this.price,
  });

  final String productId;
  final double qty;
  final double price;
}
