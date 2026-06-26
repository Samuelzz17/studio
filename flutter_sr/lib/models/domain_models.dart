import 'package:cloud_firestore/cloud_firestore.dart';

class UserProfile {
  UserProfile({
    required this.id,
    required this.name,
    required this.role,
    required this.outletAccess,
  });

  final String id;
  final String name;
  final String role;
  final List<String> outletAccess;

  factory UserProfile.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    return UserProfile(
      id: doc.id,
      name: (data['name'] ?? '').toString(),
      role: (data['role'] ?? 'operator').toString(),
      outletAccess: ((data['outletAccess'] as List?) ?? const [])
          .map((e) => e.toString())
          .toList(),
    );
  }
}

class OutletInfo {
  OutletInfo({
    required this.id,
    required this.name,
    required this.code,
    required this.active,
    this.address,
    this.phone,
    this.logoUrl,
  });

  final String id;
  final String name;
  final String code;
  final String? address;
  final String? phone;
  final String? logoUrl;
  final bool active;

  OutletInfo copyWith({
    String? id,
    String? name,
    String? code,
    String? address,
    String? phone,
    String? logoUrl,
    bool? active,
  }) {
    return OutletInfo(
      id: id ?? this.id,
      name: name ?? this.name,
      code: code ?? this.code,
      address: address ?? this.address,
      phone: phone ?? this.phone,
      logoUrl: logoUrl ?? this.logoUrl,
      active: active ?? this.active,
    );
  }

  factory OutletInfo.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    return OutletInfo(
      id: doc.id,
      name: (data['name'] ?? '').toString(),
      code: (data['code'] ?? '').toString(),
      address: data['address']?.toString(),
      phone: data['phone']?.toString(),
      logoUrl: data['logoUrl']?.toString(),
      active: data['active'] == true,
    );
  }
}

class RawMaterial {
  RawMaterial({
    required this.id,
    required this.name,
    required this.stock,
    required this.minimumStock,
    required this.unit,
    required this.averageCost,
  });

  final String id;
  final String name;
  final double stock;
  final double minimumStock;
  final String unit;
  final double averageCost;

  bool get isLowStock => stock <= minimumStock;
  bool get isOutOfStock => stock <= 0;

  factory RawMaterial.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    return RawMaterial(
      id: doc.id,
      name: (data['name'] ?? '').toString(),
      stock: (data['stock'] as num?)?.toDouble() ?? 0,
      minimumStock: (data['minimumStock'] as num?)?.toDouble() ?? 0,
      unit: (data['unit'] ?? '').toString(),
      averageCost: (data['averageCost'] as num?)?.toDouble() ?? 0,
    );
  }
}

class SalesTransaction {
  SalesTransaction({
    required this.id,
    required this.invoice,
    required this.customerName,
    required this.items,
    required this.subtotal,
    required this.discountAmount,
    required this.tax,
    required this.total,
    this.taxRate,
    this.discountType,
    this.discountValue,
    this.rounding,
    required this.paymentMethod,
    required this.customerPayment,
    required this.change,
    required this.createdAt,
  });

  final String id;
  final String invoice;
  final String customerName;
  final List<SalesTransactionItem> items;
  final double subtotal;
  final double discountAmount;
  final double tax;
  final double total;
  final double? taxRate;
  final String? discountType;
  final double? discountValue;
  final double? rounding;
  final String paymentMethod;
  final double customerPayment;
  final double change;
  final DateTime createdAt;

  factory SalesTransaction.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    final rawCreatedAt = data['createdAt'];
    DateTime createdAt;
    if (rawCreatedAt is Timestamp) {
      createdAt = rawCreatedAt.toDate();
    } else {
      createdAt = DateTime.now();
    }

    return SalesTransaction(
      id: doc.id,
      invoice: (data['invoice'] ?? '').toString(),
      customerName: (data['customerName'] ?? 'Anonymous').toString(),
      items: ((data['items'] as List?) ?? const [])
          .map(
            (e) => SalesTransactionItem.fromJson(
              (e is Map<String, dynamic>) ? e : <String, dynamic>{},
            ),
          )
          .toList(),
      subtotal: (data['subtotal'] as num?)?.toDouble() ?? 0,
      discountAmount: (data['discountAmount'] as num?)?.toDouble() ?? 0,
      tax: (data['tax'] as num?)?.toDouble() ?? 0,
      total: (data['total'] as num?)?.toDouble() ?? 0,
      taxRate: (data['taxRate'] as num?)?.toDouble(),
      discountType: data['discountType']?.toString(),
      discountValue: (data['discountValue'] as num?)?.toDouble(),
      rounding: (data['rounding'] as num?)?.toDouble(),
      paymentMethod: (data['paymentMethod'] ?? 'Cash').toString(),
      customerPayment: (data['customerPayment'] as num?)?.toDouble() ?? 0,
      change: (data['change'] as num?)?.toDouble() ?? 0,
      createdAt: createdAt,
    );
  }
}

class SalesTransactionItem {
  SalesTransactionItem({
    required this.productId,
    required this.qty,
    required this.price,
  });

  final String productId;
  final double qty;
  final double price;

  factory SalesTransactionItem.fromJson(Map<String, dynamic> json) {
    return SalesTransactionItem(
      productId: (json['productId'] ?? '').toString(),
      qty: (json['qty'] as num?)?.toDouble() ?? 0,
      price: (json['price'] as num?)?.toDouble() ?? 0,
    );
  }
}

class Product {
  Product({
    required this.id,
    required this.name,
    required this.category,
    required this.price,
    required this.active,
    required this.recipe,
  });

  final String id;
  final String name;
  final String category;
  final double price;
  final bool active;
  final List<ProductRecipeItem> recipe;

  static ProductRecipeItem _parseRecipeItem(dynamic item) {
    final map = (item is Map<String, dynamic>) ? item : <String, dynamic>{};
    return ProductRecipeItem(
      materialId: (map['materialId'] ?? '').toString(),
      quantity: (map['quantity'] as num?)?.toDouble() ?? 0,
    );
  }

  factory Product.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    return Product(
      id: doc.id,
      name: (data['name'] ?? '').toString(),
      category: (data['category'] ?? '').toString(),
      price: (data['price'] as num?)?.toDouble() ?? 0,
      active: data['active'] == true,
      recipe: ((data['recipe'] as List?) ?? const [])
          .map(_parseRecipeItem)
          .where((e) => e.materialId.isNotEmpty && e.quantity > 0)
          .toList(),
    );
  }
}

class ProductRecipeItem {
  ProductRecipeItem({required this.materialId, required this.quantity});

  final String materialId;
  final double quantity;
}

class AssetInvestment {
  AssetInvestment({
    required this.id,
    required this.name,
    required this.value,
    required this.purchaseDate,
    required this.depreciationYears,
  });

  final String id;
  final String name;
  final double value;
  final DateTime purchaseDate;
  final int depreciationYears;

  factory AssetInvestment.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    final rawDate = data['purchaseDate'];
    final purchaseDate = rawDate is Timestamp
        ? rawDate.toDate()
        : DateTime.now();
    return AssetInvestment(
      id: doc.id,
      name: (data['name'] ?? '').toString(),
      value: (data['value'] as num?)?.toDouble() ?? 0,
      purchaseDate: purchaseDate,
      depreciationYears: (data['depreciationYears'] as num?)?.toInt() ?? 1,
    );
  }
}

class Purchase {
  Purchase({
    required this.id,
    required this.materialName,
    required this.materialId,
    required this.quantity,
    required this.unit,
    required this.totalCost,
    required this.createdAt,
    this.supplier,
  });

  final String id;
  final String materialName;
  final String materialId;
  final double quantity;
  final String unit;
  final double totalCost;
  final DateTime createdAt;
  final String? supplier;

  factory Purchase.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    final rawDate = data['createdAt'];
    final createdAt = rawDate is Timestamp ? rawDate.toDate() : DateTime.now();
    return Purchase(
      id: doc.id,
      materialName: (data['materialName'] ?? '').toString(),
      materialId: (data['materialId'] ?? '').toString(),
      quantity: (data['quantity'] as num?)?.toDouble() ?? 0,
      unit: (data['unit'] ?? '').toString(),
      totalCost: (data['totalCost'] as num?)?.toDouble() ?? 0,
      supplier: data['supplier']?.toString(),
      createdAt: createdAt,
    );
  }
}

class Expense {
  Expense({
    required this.id,
    required this.name,
    required this.category,
    required this.amount,
    required this.expenseDate,
    this.notes,
  });

  final String id;
  final String name;
  final String category;
  final double amount;
  final DateTime expenseDate;
  final String? notes;

  factory Expense.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    final rawDate = data['expenseDate'];
    final expenseDate = rawDate is Timestamp
        ? rawDate.toDate()
        : DateTime.now();
    return Expense(
      id: doc.id,
      name: (data['name'] ?? '').toString(),
      category: (data['category'] ?? '').toString(),
      amount: (data['amount'] as num?)?.toDouble() ?? 0,
      expenseDate: expenseDate,
      notes: data['notes']?.toString(),
    );
  }
}

class StaffMember {
  StaffMember({
    required this.id,
    required this.name,
    required this.position,
    required this.pattern,
    required this.offset,
    required this.active,
  });

  final String id;
  final String name;
  final String position;
  final String pattern;
  final int offset;
  final bool active;

  factory StaffMember.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    return StaffMember(
      id: doc.id,
      name: (data['name'] ?? '').toString(),
      position: (data['position'] ?? 'Staff').toString(),
      pattern: (data['pattern'] ?? 'cashier3').toString(),
      offset: (data['offset'] as num?)?.toInt() ?? 0,
      active: data['active'] != false,
    );
  }
}

class StaffSchedule {
  StaffSchedule({
    required this.id,
    required this.staffId,
    required this.dateKey,
    required this.shift,
    this.checkIn,
    this.checkOut,
  });

  final String id;
  final String staffId;
  final String dateKey;
  final String shift;
  final String? checkIn;
  final String? checkOut;

  factory StaffSchedule.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    String? normalizeTime(dynamic value) {
      if (value == null) return null;
      if (value is Timestamp) {
        final d = value.toDate();
        final hh = d.hour.toString().padLeft(2, '0');
        final mm = d.minute.toString().padLeft(2, '0');
        return '$hh:$mm';
      }
      return value.toString();
    }

    return StaffSchedule(
      id: doc.id,
      staffId: (data['staffId'] ?? data['employeeId'] ?? '').toString(),
      dateKey: (data['dateKey'] ?? data['date'] ?? '').toString(),
      shift: (data['shift'] ?? 'OFF').toString(),
      checkIn: normalizeTime(data['checkIn'] ?? data['checkInTime']),
      checkOut: normalizeTime(data['checkOut'] ?? data['checkOutTime']),
    );
  }
}
