import 'package:intl/intl.dart';

final NumberFormat _idrThousands = NumberFormat.decimalPattern('id_ID');

String formatCurrency(num value) => 'Rp ${_idrThousands.format(value.round())}';

String formatDateTime(DateTime dateTime) {
  return DateFormat('dd/MM/yyyy HH:mm').format(dateTime);
}
