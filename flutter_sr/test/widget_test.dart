import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_sr/main.dart';

void main() {
  testWidgets('App renders firebase setup fallback', (WidgetTester tester) async {
    await tester.pumpWidget(const SrFlutterApp(firebaseReady: false));
    expect(find.text('Setup Firebase Dulu'), findsOneWidget);
  });
}
