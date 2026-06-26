import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../models/domain_models.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../services/thermal_printer_service.dart';
import '../utils/app_theme_controller.dart';
import '../utils/debouncer.dart';
import '../utils/formatters.dart';
import 'finance_tab.dart';
import 'inventory_tab.dart';
import 'employee_schedule_tab.dart';
import 'login_screen.dart';
import 'pos_screen.dart';
import 'reports_tab.dart';
import 'thermal_printer_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _firestore = FirestoreService.instance;

  bool _loadingSetup = true;
  int _selectedTab = 0;
  bool _sidebarCollapsed = false;

  UserProfile? _profile;
  List<OutletInfo> _outlets = const [];
  OutletInfo? _activeOutlet;

  @override
  void initState() {
    super.initState();
    _loadAccessAndOutlets();
  }

  Future<void> _loadAccessAndOutlets() async {
    final currentUser = AuthService.instance.currentUser;
    if (currentUser == null) {
      if (!mounted) return;
      setState(() => _loadingSetup = false);
      return;
    }

    try {
      final profile = await _firestore.getUserProfile(currentUser.uid);
      final access = profile?.outletAccess ?? const <String>[];
      final outlets = await _firestore.getOutletsByIds(access);

      if (!mounted) return;
      setState(() {
        _profile = profile;
        _outlets = outlets;
        _activeOutlet = outlets.isNotEmpty ? outlets.first : null;
        _loadingSetup = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingSetup = false);
    }
  }

  Future<void> _logout() async {
    await AuthService.instance.signOut();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  void _selectTab(int index, {bool closeDrawer = false}) {
    setState(() => _selectedTab = index);
    if (closeDrawer) {
      Navigator.of(context).maybePop();
    }
  }

  void _openPos() {
    if (_activeOutlet == null) return;
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => PosScreen(outlet: _activeOutlet!)),
    );
  }

  void _onOutletLogoUpdated(String logoUrl) {
    if (_activeOutlet == null) return;
    final updated = _activeOutlet!.copyWith(logoUrl: logoUrl);
    setState(() {
      _activeOutlet = updated;
      _outlets = _outlets.map((o) => o.id == updated.id ? updated : o).toList();
    });
  }

  Widget? _buildHeaderAction(bool isDesktop) {
    if (_selectedTab != 0) return null;
    if (isDesktop) {
      return FilledButton.icon(
        onPressed: _openPos,
        icon: const Icon(Icons.storefront_outlined),
        label: const Text('Buka POS'),
      );
    }
    return IconButton(
      tooltip: 'Buka POS',
      onPressed: _openPos,
      icon: const Icon(Icons.storefront_outlined),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingSetup) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_profile == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Sumber Redjeki')),
        body: const Center(
          child: Text('User profile tidak ditemukan pada koleksi users.'),
        ),
      );
    }

    if (_outlets.isEmpty) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Sumber Redjeki'),
          actions: [
            IconButton(onPressed: _logout, icon: const Icon(Icons.logout)),
          ],
        ),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'Anda belum memiliki akses outlet. Tambahkan outlet id ke users/{uid}.outletAccess.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    final isDesktop = MediaQuery.of(context).size.width >= 960;
    final titleByTab = <String>[
      'Dashboard',
      'Jadwal Karyawan',
      'Inventory: Products',
      'Inventory: Raw Materials',
      'Inventory: Assets',
      'Financial: Purchases',
      'Financial: Expenses',
      'Financial: Asset Purchases',
      'Reports: Sales',
      'Reports: Inventory',
      'Settings',
    ];

    final pages = <Widget>[
      _DashboardTab(
        activeOutlet: _activeOutlet!,
        profile: _profile!,
        firestore: _firestore,
        onOpenReports: () => _selectTab(8),
      ),
      EmployeeScheduleTab(outlet: _activeOutlet!),
      InventoryTab(outlet: _activeOutlet!, section: InventorySection.products),
      InventoryTab(
        outlet: _activeOutlet!,
        section: InventorySection.rawMaterials,
      ),
      InventoryTab(outlet: _activeOutlet!, section: InventorySection.assets),
      FinanceTab(outlet: _activeOutlet!, section: FinanceSection.purchases),
      FinanceTab(outlet: _activeOutlet!, section: FinanceSection.expenses),
      FinanceTab(
        outlet: _activeOutlet!,
        section: FinanceSection.assetPurchases,
      ),
      ReportsTab(outlet: _activeOutlet!, section: ReportSection.sales),
      ReportsTab(outlet: _activeOutlet!, section: ReportSection.inventory),
      _SettingsTab(
        outlet: _activeOutlet!,
        profile: _profile!,
        onLogoUpdated: _onOutletLogoUpdated,
      ),
    ];

    final sidebar = _SidebarPanel(
      collapsed: _sidebarCollapsed,
      selectedTab: _selectedTab,
      profile: _profile!,
      outlet: _activeOutlet!,
      userEmail: AuthService.instance.currentUser?.email ?? 'anonymous@local',
      onToggleCollapsed: () =>
          setState(() => _sidebarCollapsed = !_sidebarCollapsed),
      onSelectTab: (tab) => _selectTab(tab, closeDrawer: !isDesktop),
      onToggleTheme: AppThemeController.toggle,
      onLogout: _logout,
      desktop: isDesktop,
    );

    // Guard against stale tab indexes when pages change (e.g., after updates).
    if (_selectedTab >= pages.length) {
      _selectedTab = 0;
    }

    return Scaffold(
      resizeToAvoidBottomInset: !isDesktop,
      drawer: isDesktop ? null : Drawer(child: SafeArea(child: sidebar)),
      appBar: AppBar(
        leading: isDesktop
            ? null
            : Builder(
                builder: (context) => IconButton(
                  icon: const Icon(Icons.menu),
                  onPressed: () => Scaffold.of(context).openDrawer(),
                ),
              ),
        title: Text(titleByTab[_selectedTab]),
        actions: [
          if (isDesktop)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: SizedBox(
                width: 260,
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    isExpanded: true,
                    value: _activeOutlet?.id,
                    items: _outlets
                        .map(
                          (o) => DropdownMenuItem<String>(
                            value: o.id,
                            child: Text('${o.name} (${o.code})'),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      final selected = _outlets
                          .where((e) => e.id == value)
                          .firstOrNull;
                      if (selected != null) {
                        setState(() => _activeOutlet = selected);
                      }
                    },
                  ),
                ),
              ),
            ),
          if (!isDesktop)
            PopupMenuButton<String>(
              tooltip: 'Pilih outlet',
              icon: const Icon(Icons.store_mall_directory_outlined),
              onSelected: (value) {
                final selected = _outlets
                    .where((e) => e.id == value)
                    .firstOrNull;
                if (selected != null) {
                  setState(() => _activeOutlet = selected);
                }
              },
              itemBuilder: (context) => _outlets
                  .map(
                    (o) => PopupMenuItem<String>(
                      value: o.id,
                      child: Text('${o.name} (${o.code})'),
                    ),
                  )
                  .toList(),
            ),
          if (_buildHeaderAction(isDesktop) != null)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _buildHeaderAction(isDesktop)!,
            ),
        ],
      ),
      body: Row(
        children: [
          if (isDesktop)
            SizedBox(
              width: _sidebarCollapsed ? 84 : 280,
              child: SafeArea(child: sidebar),
            ),
          if (isDesktop) const VerticalDivider(width: 1),
          Expanded(child: pages[_selectedTab]),
        ],
      ),
    );
  }
}

class _SidebarPanel extends StatefulWidget {
  const _SidebarPanel({
    required this.collapsed,
    required this.selectedTab,
    required this.profile,
    required this.outlet,
    required this.userEmail,
    required this.onToggleCollapsed,
    required this.onSelectTab,
    required this.onToggleTheme,
    required this.onLogout,
    required this.desktop,
  });

  final bool collapsed;
  final int selectedTab;
  final UserProfile profile;
  final OutletInfo outlet;
  final String userEmail;
  final VoidCallback onToggleCollapsed;
  final ValueChanged<int> onSelectTab;
  final VoidCallback onToggleTheme;
  final VoidCallback onLogout;
  final bool desktop;

  @override
  State<_SidebarPanel> createState() => _SidebarPanelState();
}

class _SidebarPanelState extends State<_SidebarPanel> {
  bool inventoryOpen = true;
  bool financialOpen = true;
  bool reportsOpen = true;

  @override
  Widget build(BuildContext context) {
    final selectedColor = Theme.of(context).colorScheme.primaryContainer;

    Widget navItem({
      required IconData icon,
      required String title,
      required int tab,
    }) {
      final selected = widget.selectedTab == tab;
      if (widget.collapsed && widget.desktop) {
        return Tooltip(
          message: title,
          child: IconButton(
            onPressed: () => widget.onSelectTab(tab),
            icon: Icon(
              icon,
              color: selected ? Theme.of(context).colorScheme.primary : null,
            ),
          ),
        );
      }
      return ListTile(
        leading: Icon(icon),
        title: Text(title),
        selected: selected,
        selectedTileColor: selectedColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        onTap: () => widget.onSelectTab(tab),
      );
    }

    Widget grouped({
      required IconData icon,
      required String title,
      required bool open,
      required ValueChanged<bool> onOpen,
      required List<Widget> children,
    }) {
      if (widget.collapsed && widget.desktop) {
        return Tooltip(
          message: title,
          child: IconButton(onPressed: () {}, icon: Icon(icon)),
        );
      }
      return Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          leading: Icon(icon),
          title: Text(title),
          initiallyExpanded: open,
          onExpansionChanged: onOpen,
          childrenPadding: const EdgeInsets.only(left: 36, right: 8, bottom: 8),
          children: children,
        ),
      );
    }

    return Container(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: widget.collapsed && widget.desktop
                ? Column(
                    children: [
                      CircleAvatar(
                        radius: 16,
                        backgroundImage:
                            (widget.outlet.logoUrl ?? '').trim().isNotEmpty
                            ? NetworkImage(widget.outlet.logoUrl!.trim())
                            : null,
                        child: (widget.outlet.logoUrl ?? '').trim().isEmpty
                            ? Padding(
                                padding: const EdgeInsets.all(5),
                                child: SvgPicture.asset(
                                  'assets/images/sr_logo.svg',
                                  fit: BoxFit.contain,
                                ),
                              )
                            : null,
                      ),
                      const SizedBox(height: 6),
                      IconButton(
                        onPressed: widget.onToggleCollapsed,
                        icon: const Icon(Icons.chevron_right),
                        visualDensity: VisualDensity.compact,
                      ),
                    ],
                  )
                : Row(
                    children: [
                      CircleAvatar(
                        backgroundImage:
                            (widget.outlet.logoUrl ?? '').trim().isNotEmpty
                            ? NetworkImage(widget.outlet.logoUrl!.trim())
                            : null,
                        child: (widget.outlet.logoUrl ?? '').trim().isEmpty
                            ? Padding(
                                padding: const EdgeInsets.all(7),
                                child: SvgPicture.asset(
                                  'assets/images/sr_logo.svg',
                                  fit: BoxFit.contain,
                                ),
                              )
                            : null,
                      ),
                      if (!widget.collapsed || !widget.desktop) ...[
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'Sumber Redjeki',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                      if (widget.desktop)
                        IconButton(
                          onPressed: widget.onToggleCollapsed,
                          icon: const Icon(Icons.chevron_left),
                        ),
                    ],
                  ),
          ),
          const Divider(height: 1, indent: 12, endIndent: 12),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(8),
              children: [
                navItem(
                  icon: Icons.dashboard_outlined,
                  title: 'Dashboard',
                  tab: 0,
                ),
                navItem(
                  icon: Icons.badge_outlined,
                  title: 'Employee Schedule',
                  tab: 1,
                ),
                grouped(
                  icon: Icons.inventory_2_outlined,
                  title: 'Inventory',
                  open: inventoryOpen,
                  onOpen: (v) => setState(() => inventoryOpen = v),
                  children: [
                    navItem(
                      icon: Icons.coffee_outlined,
                      title: 'Products',
                      tab: 2,
                    ),
                    navItem(
                      icon: Icons.science_outlined,
                      title: 'Raw Materials',
                      tab: 3,
                    ),
                    navItem(
                      icon: Icons.apartment_outlined,
                      title: 'Assets',
                      tab: 4,
                    ),
                  ],
                ),
                grouped(
                  icon: Icons.account_balance_wallet_outlined,
                  title: 'Financial',
                  open: financialOpen,
                  onOpen: (v) => setState(() => financialOpen = v),
                  children: [
                    navItem(
                      icon: Icons.shopping_cart_outlined,
                      title: 'Purchases',
                      tab: 5,
                    ),
                    navItem(
                      icon: Icons.money_off_csred_outlined,
                      title: 'Expenses',
                      tab: 6,
                    ),
                    navItem(
                      icon: Icons.price_change_outlined,
                      title: 'Asset Purchases',
                      tab: 7,
                    ),
                  ],
                ),
                grouped(
                  icon: Icons.bar_chart_outlined,
                  title: 'Reports',
                  open: reportsOpen,
                  onOpen: (v) => setState(() => reportsOpen = v),
                  children: [
                    navItem(
                      icon: Icons.receipt_long_outlined,
                      title: 'Sales',
                      tab: 8,
                    ),
                    navItem(
                      icon: Icons.inventory_outlined,
                      title: 'Inventory',
                      tab: 9,
                    ),
                  ],
                ),
                navItem(
                  icon: Icons.settings_outlined,
                  title: 'Settings',
                  tab: 10,
                ),
              ],
            ),
          ),
          const Divider(height: 1, indent: 12, endIndent: 12),
          Padding(
            padding: const EdgeInsets.all(10),
            child: widget.collapsed && widget.desktop
                ? Column(
                    children: [
                      IconButton(
                        onPressed: widget.onToggleTheme,
                        icon: Icon(
                          AppThemeController.isDark
                              ? Icons.light_mode
                              : Icons.dark_mode,
                        ),
                      ),
                      IconButton(
                        onPressed: widget.onLogout,
                        icon: const Icon(Icons.logout),
                      ),
                    ],
                  )
                : Card(
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              const CircleAvatar(
                                radius: 16,
                                child: Icon(Icons.person, size: 18),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      widget.profile.name.isEmpty
                                          ? 'User'
                                          : widget.profile.name,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    Text(
                                      widget.userEmail,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: widget.onToggleTheme,
                                  icon: Icon(
                                    AppThemeController.isDark
                                        ? Icons.light_mode
                                        : Icons.dark_mode,
                                  ),
                                  label: Text(
                                    AppThemeController.isDark
                                        ? 'Light'
                                        : 'Dark',
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: FilledButton.icon(
                                  onPressed: widget.onLogout,
                                  icon: const Icon(Icons.logout),
                                  label: const Text('Log Out'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

enum _DashboardRange { hour, day, week, month }

enum _DashboardSort { newest, az, za, highest, lowest }

class _DashboardTab extends StatefulWidget {
  const _DashboardTab({
    required this.activeOutlet,
    required this.profile,
    required this.firestore,
    required this.onOpenReports,
  });

  final OutletInfo activeOutlet;
  final UserProfile profile;
  final FirestoreService firestore;
  final VoidCallback onOpenReports;

  @override
  State<_DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<_DashboardTab> {
  _DashboardRange _range = _DashboardRange.day;
  _DashboardSort _txSort = _DashboardSort.newest;
  _DashboardSort _stockSort = _DashboardSort.lowest;
  final TextEditingController _txSearchController = TextEditingController();
  final TextEditingController _stockSearchController = TextEditingController();
  final Debouncer _txSearchDebouncer = Debouncer(
    delay: const Duration(milliseconds: 220),
  );
  final Debouncer _stockSearchDebouncer = Debouncer(
    delay: const Duration(milliseconds: 220),
  );
  String _txQuery = '';
  String _stockQuery = '';

  @override
  void dispose() {
    _txSearchDebouncer.dispose();
    _stockSearchDebouncer.dispose();
    _txSearchController.dispose();
    _stockSearchController.dispose();
    super.dispose();
  }

  DateTime _rangeStart(DateTime now) {
    switch (_range) {
      case _DashboardRange.hour:
        return DateTime(now.year, now.month, now.day, now.hour);
      case _DashboardRange.day:
        // Reset KPI harian tepat jam 00:00.
        return DateTime(now.year, now.month, now.day);
      case _DashboardRange.week:
        final dayStart = DateTime(now.year, now.month, now.day);
        return dayStart.subtract(Duration(days: dayStart.weekday - 1));
      case _DashboardRange.month:
        return DateTime(now.year, now.month, 1);
    }
  }

  String _rangeLabel() {
    switch (_range) {
      case _DashboardRange.hour:
        return 'Per Jam';
      case _DashboardRange.day:
        return 'Per Hari';
      case _DashboardRange.week:
        return 'Per Minggu';
      case _DashboardRange.month:
        return 'Per Bulan';
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<SalesTransaction>>(
      // Match Sales Report data source so KPI numbers stay consistent.
      stream: widget.firestore.streamRecentSales(
        widget.activeOutlet.id,
        limit: 500,
      ),
      builder: (context, salesSnapshot) {
        return StreamBuilder<List<RawMaterial>>(
          stream: widget.firestore.streamRawMaterials(widget.activeOutlet.id),
          builder: (context, materialSnapshot) {
            final isLoading =
                salesSnapshot.connectionState == ConnectionState.waiting ||
                materialSnapshot.connectionState == ConnectionState.waiting;

            final sales = salesSnapshot.data ?? const <SalesTransaction>[];
            final materials = materialSnapshot.data ?? const <RawMaterial>[];
            final now = DateTime.now();
            final filteredSales = sales
                .where((s) => s.createdAt.isAfter(_rangeStart(now)))
                .toList();

            final totalPenjualan = filteredSales.fold<double>(
              0,
              (sum, item) => sum + item.total,
            );
            final totalTransaksi = filteredSales.length;
            final totalQris = filteredSales
                .where((s) => s.paymentMethod.toLowerCase().contains('qris'))
                .fold<double>(0, (sum, s) => sum + s.total);
            final totalCash = filteredSales
                .where((s) => s.paymentMethod.toLowerCase().contains('cash'))
                .fold<double>(0, (sum, s) => sum + s.total);
            final totalCard = filteredSales
                .where((s) => s.paymentMethod.toLowerCase().contains('card'))
                .fold<double>(0, (sum, s) => sum + s.total);
            final activeNow = filteredSales
                .where((s) => now.difference(s.createdAt).inMinutes <= 15)
                .length;

            final txFilteredBySearch = filteredSales.where((s) {
              final q = _txQuery.trim().toLowerCase();
              if (q.isEmpty) return true;
              return s.invoice.toLowerCase().contains(q) ||
                  s.customerName.toLowerCase().contains(q) ||
                  s.paymentMethod.toLowerCase().contains(q);
            }).toList();
            txFilteredBySearch.sort((a, b) {
              switch (_txSort) {
                case _DashboardSort.newest:
                  return b.createdAt.compareTo(a.createdAt);
                case _DashboardSort.az:
                  return a.customerName.toLowerCase().compareTo(
                    b.customerName.toLowerCase(),
                  );
                case _DashboardSort.za:
                  return b.customerName.toLowerCase().compareTo(
                    a.customerName.toLowerCase(),
                  );
                case _DashboardSort.highest:
                  return b.total.compareTo(a.total);
                case _DashboardSort.lowest:
                  return a.total.compareTo(b.total);
              }
            });

            final lowStock = materials.where((m) => m.isLowStock).toList();
            final lowStockFiltered = lowStock.where((m) {
              final q = _stockQuery.trim().toLowerCase();
              if (q.isEmpty) return true;
              return m.name.toLowerCase().contains(q) ||
                  m.unit.toLowerCase().contains(q);
            }).toList();
            lowStockFiltered.sort((a, b) {
              switch (_stockSort) {
                case _DashboardSort.newest:
                case _DashboardSort.lowest:
                  return a.stock.compareTo(b.stock);
                case _DashboardSort.highest:
                  return b.stock.compareTo(a.stock);
                case _DashboardSort.az:
                  return a.name.toLowerCase().compareTo(b.name.toLowerCase());
                case _DashboardSort.za:
                  return b.name.toLowerCase().compareTo(a.name.toLowerCase());
              }
            });

            return LayoutBuilder(
              builder: (context, constraints) {
                final wide = constraints.maxWidth >= 1100;
                final rangeSelector = SegmentedButton<_DashboardRange>(
                  segments: const [
                    ButtonSegment(
                      value: _DashboardRange.hour,
                      label: Text('Jam'),
                    ),
                    ButtonSegment(
                      value: _DashboardRange.day,
                      label: Text('Hari'),
                    ),
                    ButtonSegment(
                      value: _DashboardRange.week,
                      label: Text('Minggu'),
                    ),
                    ButtonSegment(
                      value: _DashboardRange.month,
                      label: Text('Bulan'),
                    ),
                  ],
                  selected: <_DashboardRange>{_range},
                  onSelectionChanged: (v) => setState(() => _range = v.first),
                );
                final kpis = Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _MetricCard(
                      title: 'Revenue (${_rangeLabel()})',
                      value: formatCurrency(totalPenjualan),
                      icon: Icons.payments_outlined,
                      loading: isLoading,
                    ),
                    _MetricCard(
                      title: 'Total Transaksi',
                      value: '$totalTransaksi transaksi',
                      icon: Icons.shopping_cart_checkout_outlined,
                      loading: isLoading,
                    ),
                    _MetricCard(
                      title: 'Uang QRIS',
                      value: formatCurrency(totalQris),
                      icon: Icons.qr_code_2_outlined,
                      loading: isLoading,
                    ),
                    _MetricCard(
                      title: 'Uang Cash',
                      value: formatCurrency(totalCash),
                      icon: Icons.payments_outlined,
                      loading: isLoading,
                    ),
                    _MetricCard(
                      title: 'Uang Card',
                      value: formatCurrency(totalCard),
                      icon: Icons.credit_card,
                      loading: isLoading,
                    ),
                    _MetricCard(
                      title: 'Stok Menipis',
                      value: '${lowStock.length} item',
                      icon: Icons.warning_amber_rounded,
                      loading: isLoading,
                    ),
                    _MetricCard(
                      title: 'Active Now',
                      value: '$activeNow tx',
                      icon: Icons.flash_on_outlined,
                      loading: isLoading,
                    ),
                  ],
                );

                final txPanel = Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Transaksi Terkini',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 16,
                                ),
                              ),
                            ),
                            TextButton.icon(
                              onPressed: widget.onOpenReports,
                              icon: const Icon(Icons.open_in_new),
                              label: const Text('View All'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _txSearchController,
                          onChanged: (v) {
                            _txSearchDebouncer.run(() {
                              if (!mounted) return;
                              setState(() => _txQuery = v);
                            });
                          },
                          decoration: const InputDecoration(
                            labelText: 'Search transaksi',
                            prefixIcon: Icon(Icons.search),
                          ),
                        ),
                        const SizedBox(height: 8),
                        DropdownButtonFormField<_DashboardSort>(
                          initialValue: _txSort,
                          items: const [
                            DropdownMenuItem(
                              value: _DashboardSort.newest,
                              child: Text('Terbaru'),
                            ),
                            DropdownMenuItem(
                              value: _DashboardSort.az,
                              child: Text('A-Z'),
                            ),
                            DropdownMenuItem(
                              value: _DashboardSort.za,
                              child: Text('Z-A'),
                            ),
                            DropdownMenuItem(
                              value: _DashboardSort.highest,
                              child: Text('Terbanyak'),
                            ),
                            DropdownMenuItem(
                              value: _DashboardSort.lowest,
                              child: Text('Terkecil'),
                            ),
                          ],
                          onChanged: (v) {
                            if (v != null) setState(() => _txSort = v);
                          },
                          decoration: const InputDecoration(
                            labelText: 'Sort transaksi',
                          ),
                        ),
                        const SizedBox(height: 6),
                        if (isLoading)
                          const Center(child: CircularProgressIndicator())
                        else if (txFilteredBySearch.isEmpty)
                          const Text('Belum ada transaksi.')
                        else
                          ...txFilteredBySearch
                              .take(7)
                              .map(
                                (s) => ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(
                                    s.customerName.isEmpty
                                        ? 'Anonymous'
                                        : s.customerName,
                                  ),
                                  subtitle: Text(
                                    '${s.invoice} • ${formatDateTime(s.createdAt)} • ${s.paymentMethod}',
                                  ),
                                  trailing: Text(formatCurrency(s.total)),
                                ),
                              ),
                      ],
                    ),
                  ),
                );

                final lowPanel = Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Stok Menipis',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _stockSearchController,
                          onChanged: (v) {
                            _stockSearchDebouncer.run(() {
                              if (!mounted) return;
                              setState(() => _stockQuery = v);
                            });
                          },
                          decoration: const InputDecoration(
                            labelText: 'Search stok',
                            prefixIcon: Icon(Icons.search),
                          ),
                        ),
                        const SizedBox(height: 8),
                        DropdownButtonFormField<_DashboardSort>(
                          initialValue: _stockSort,
                          items: const [
                            DropdownMenuItem(
                              value: _DashboardSort.lowest,
                              child: Text('Terkecil'),
                            ),
                            DropdownMenuItem(
                              value: _DashboardSort.highest,
                              child: Text('Terbanyak'),
                            ),
                            DropdownMenuItem(
                              value: _DashboardSort.az,
                              child: Text('A-Z'),
                            ),
                            DropdownMenuItem(
                              value: _DashboardSort.za,
                              child: Text('Z-A'),
                            ),
                          ],
                          onChanged: (v) {
                            if (v != null) setState(() => _stockSort = v);
                          },
                          decoration: const InputDecoration(
                            labelText: 'Sort stok',
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (isLoading)
                          const Center(child: CircularProgressIndicator())
                        else if (lowStockFiltered.isEmpty)
                          const Text('Semua bahan baku dalam kondisi aman.')
                        else
                          ...lowStockFiltered
                              .take(8)
                              .map(
                                (item) => ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(item.name),
                                  subtitle: Text(
                                    '${item.stock.toStringAsFixed(0)} ${item.unit} / Min ${item.minimumStock.toStringAsFixed(0)}',
                                  ),
                                  trailing: const Chip(label: Text('Low')),
                                ),
                              ),
                      ],
                    ),
                  ),
                );

                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    rangeSelector,
                    const SizedBox(height: 12),
                    kpis,
                    const SizedBox(height: 16),
                    if (wide)
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(flex: 2, child: txPanel),
                          const SizedBox(width: 12),
                          Expanded(child: lowPanel),
                        ],
                      )
                    else ...[
                      txPanel,
                      const SizedBox(height: 12),
                      lowPanel,
                    ],
                    const SizedBox(height: 10),
                    Text(
                      'Role: ${widget.profile.role} • Akses outlet: ${widget.profile.outletAccess.length}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
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

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.loading,
  });

  final String title;
  final String value;
  final IconData icon;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 250,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (loading)
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
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

class _SettingsTab extends StatelessWidget {
  const _SettingsTab({
    required this.outlet,
    required this.profile,
    required this.onLogoUpdated,
  });

  final OutletInfo outlet;
  final UserProfile profile;
  final ValueChanged<String> onLogoUpdated;

  Future<void> _showEditLogoDialog(BuildContext context) async {
    final controller = TextEditingController(text: outlet.logoUrl ?? '');
    final firestore = FirestoreService.instance;
    var saving = false;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (dialogContext, setDialogState) {
            final value = controller.text.trim();
            return AlertDialog(
              scrollable: true,
              title: const Text('Upload / Ganti Logo SR'),
              content: SizedBox(
                width: 540,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Masukkan URL logo (PNG/JPG).',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: controller,
                        decoration: const InputDecoration(
                          labelText: 'Logo URL',
                          hintText: 'https://.../logo.png',
                        ),
                        onChanged: (_) => setDialogState(() {}),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Tip: Upload dulu file logo ke Firebase Storage atau CDN, lalu tempel URL publiknya di sini.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 14),
                      if (value.isNotEmpty)
                        ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: Container(
                            height: 120,
                            width: double.infinity,
                            color: Colors.black12,
                            child: Image.network(
                              value,
                              fit: BoxFit.contain,
                              errorBuilder: (_, _, _) => const Center(
                                child: Text('Preview gagal. Cek URL logo.'),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: saving
                      ? null
                      : () => Navigator.of(dialogContext).pop(),
                  child: const Text('Batal'),
                ),
                FilledButton.icon(
                  onPressed: saving
                      ? null
                      : () async {
                          final logoUrl = controller.text.trim();
                          if (logoUrl.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('URL logo tidak boleh kosong.'),
                                backgroundColor: Colors.red,
                              ),
                            );
                            return;
                          }
                          setDialogState(() => saving = true);
                          try {
                            await firestore.updateOutletLogoUrl(
                              outletId: outlet.id,
                              logoUrl: logoUrl,
                            );
                            if (!context.mounted) return;
                            onLogoUpdated(logoUrl);
                            Navigator.of(dialogContext).pop();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Logo outlet berhasil diperbarui.',
                                ),
                              ),
                            );
                          } catch (e) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Gagal simpan logo: $e'),
                                backgroundColor: Colors.red,
                              ),
                            );
                          } finally {
                            if (context.mounted) {
                              setDialogState(() => saving = false);
                            }
                          }
                        },
                  icon: const Icon(Icons.save_outlined),
                  label: const Text('Simpan'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'Pengaturan Outlet & Akses',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            title: const Text('Outlet Aktif'),
            subtitle: Text('${outlet.name} (${outlet.code})'),
          ),
        ),
        Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundImage: (outlet.logoUrl ?? '').trim().isNotEmpty
                  ? NetworkImage(outlet.logoUrl!.trim())
                  : null,
              child: (outlet.logoUrl ?? '').trim().isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(7),
                      child: SvgPicture.asset(
                        'assets/images/sr_logo.svg',
                        fit: BoxFit.contain,
                      ),
                    )
                  : null,
            ),
            title: const Text('Logo SR (Brand Outlet)'),
            subtitle: Text(
              (outlet.logoUrl ?? '').trim().isEmpty
                  ? 'Belum ada logo. Tambahkan URL logo agar tampil di sidebar.'
                  : outlet.logoUrl!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: FilledButton.icon(
              onPressed: () => _showEditLogoDialog(context),
              icon: const Icon(Icons.image_outlined),
              label: const Text('Upload Logo'),
            ),
          ),
        ),
        Card(
          child: ListTile(
            title: const Text('Role User'),
            subtitle: Text(profile.role),
          ),
        ),
        Card(
          child: ListTile(
            title: const Text('Kontrol Akses Outlet'),
            subtitle: Text(
              'User ini punya akses ke ${profile.outletAccess.length} outlet.',
            ),
          ),
        ),
        Card(
          child: ListTile(
            title: const Text('Thermal Printer (Android)'),
            subtitle: const Text(
              'Uji koneksi dan test print printer thermal Bluetooth.',
            ),
            trailing: PopupMenuButton<String>(
              tooltip: 'Aksi printer',
              onSelected: (value) async {
                if (value == 'test') {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const ThermalPrinterScreen(),
                    ),
                  );
                  return;
                }
                if (value == 'disconnect') {
                  try {
                    await ThermalPrinterService.instance.disconnect();
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Printer disconnected.')),
                    );
                  } catch (e) {
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Gagal disconnect printer: $e'),
                        backgroundColor: Colors.red,
                      ),
                    );
                  }
                }
              },
              itemBuilder: (context) => const [
                PopupMenuItem(
                  value: 'test',
                  child: Text('Test Print'),
                ),
                PopupMenuItem(
                  value: 'disconnect',
                  child: Text('Disconnect Printer'),
                ),
              ],
              icon: Icon(Icons.more_vert),
            ),
          ),
        ),
      ],
    );
  }
}

extension _IterableFirstOrNullExtension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
