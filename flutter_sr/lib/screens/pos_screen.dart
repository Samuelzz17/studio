import 'package:flutter/material.dart';

import '../models/domain_models.dart';
import 'pos_tab.dart';

class PosScreen extends StatelessWidget {
  const PosScreen({super.key, required this.outlet});

  final OutletInfo outlet;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(title: Text('POS • ${outlet.name}')),
      body: SafeArea(child: PosTab(outlet: outlet)),
    );
  }
}
