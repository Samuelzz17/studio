import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/domain_models.dart';
import '../services/firestore_service.dart';

class EmployeeScheduleTab extends StatefulWidget {
  const EmployeeScheduleTab({super.key, required this.outlet});

  final OutletInfo outlet;

  @override
  State<EmployeeScheduleTab> createState() => _EmployeeScheduleTabState();
}

class _EmployeeScheduleTabState extends State<EmployeeScheduleTab> {
  final _firestore = FirestoreService.instance;
  late DateTime _weekStart;
  bool _bootstrapping = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _weekStart = _monday(DateTime(now.year, now.month, now.day));
    _bootstrapDefaults();
  }

  Future<void> _bootstrapDefaults() async {
    try {
      await _firestore.ensureDefaultStaffMembers(widget.outlet.id);
    } finally {
      if (mounted) setState(() => _bootstrapping = false);
    }
  }

  DateTime _monday(DateTime d) => d.subtract(Duration(days: d.weekday - 1));
  String _dateKey(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  List<DateTime> get _weekDays => List.generate(
    7,
    (i) => DateTime(_weekStart.year, _weekStart.month, _weekStart.day + i),
  );

  String _weekNumberLabel() => 'Minggu ke-${DateFormat('w').format(_weekStart)}';
  String _weekRangeLabel() {
    final end = _weekStart.add(const Duration(days: 6));
    return '${DateFormat('d MMM yyyy', 'id_ID').format(_weekStart)} - ${DateFormat('d MMM yyyy', 'id_ID').format(end)}';
  }

  String _dayHeadLabel(DateTime d) {
    const names = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    return '${names[d.weekday - 1]} ${d.day}';
  }

  List<String> _patternFor(StaffMember staff) {
    final p = staff.position.toLowerCase();
    if (p.contains('barista')) {
      return const ['OPEN', 'MIDDLE', 'CLOSING', 'KITCHEN', 'OFF'];
    }
    return const ['OPEN', 'CLOSING', 'OFF'];
  }

  int _offsetFor(StaffMember staff) {
    final key = staff.name.trim().toLowerCase();
    const map = <String, int>{
      'meika': 0,
      'indri': 1,
      'freelance': 2,
      'freelancer': 2,
      'sila': 0,
      'marhaen': 1,
      'eka': 2,
      'wiri': 3,
      'krisna': 4,
    };
    return map[key] ?? 0;
  }

  String? _webDefaultEmployeeId(StaffMember staff) {
    final key = staff.name.trim().toLowerCase();
    const ids = <String, String>{
      'meika': 'cashier-1',
      'indri': 'cashier-2',
      'freelance': 'cashier-3',
      'freelancer': 'cashier-3',
      'sila': 'barista-1',
      'marhaen': 'barista-2',
      'eka': 'barista-3',
      'wiri': 'barista-4',
      'krisna': 'barista-5',
    };
    return ids[key];
  }

  String _autoShift(StaffMember staff, DateTime date) {
    final pattern = _patternFor(staff);
    final anchor = DateTime(2026, 3, 2);
    final raw = (date.difference(anchor).inDays + _offsetFor(staff)) %
        pattern.length;
    final idx = raw < 0 ? raw + pattern.length : raw;
    return pattern[idx];
  }

  Color _shiftColor(String shift) {
    switch (shift.toUpperCase()) {
      case 'OPEN':
        return Colors.green;
      case 'MIDDLE':
        return Colors.blue;
      case 'CLOSING':
        return Colors.deepPurple;
      case 'KITCHEN':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  bool _isToday(DateTime d) {
    final now = DateTime.now();
    return d.year == now.year && d.month == now.month && d.day == now.day;
  }

  Future<void> _showAddEmployeeDialog() async {
    final name = TextEditingController();
    var position = 'Cashier';
    await showDialog<void>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialog) {
            return AlertDialog(
              title: const Text('Add Employee'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: name,
                    decoration: const InputDecoration(labelText: 'Nama'),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: position,
                    items: const [
                      DropdownMenuItem(value: 'Cashier', child: Text('Kasir')),
                      DropdownMenuItem(value: 'Barista', child: Text('Barista')),
                    ],
                    onChanged: (v) => setDialog(() => position = v ?? position),
                    decoration: const InputDecoration(labelText: 'Posisi'),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: _busy ? null : () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () async {
                          if (name.text.trim().isEmpty) return;
                          _busy = true;
                          try {
                            await _firestore.addStaffMember(
                              outletId: widget.outlet.id,
                              name: name.text.trim(),
                              position: position,
                            );
                            if (!context.mounted) return;
                            Navigator.of(context).pop();
                          } finally {
                            _busy = false;
                          }
                        },
                  child: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _showEditEmployeeDialog(StaffMember staff) async {
    final name = TextEditingController(text: staff.name);
    var position = staff.position;
    await showDialog<void>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialog) {
            return AlertDialog(
              title: const Text('Edit Employee'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: name,
                    decoration: const InputDecoration(labelText: 'Nama'),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: position,
                    items: const [
                      DropdownMenuItem(value: 'Cashier', child: Text('Kasir')),
                      DropdownMenuItem(value: 'Barista', child: Text('Barista')),
                    ],
                    onChanged: (v) => setDialog(() => position = v ?? position),
                    decoration: const InputDecoration(labelText: 'Posisi'),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: _busy ? null : () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () async {
                          if (name.text.trim().isEmpty) return;
                          _busy = true;
                          try {
                            await _firestore.updateStaffMember(
                              outletId: widget.outlet.id,
                              staffId: staff.id,
                              name: name.text.trim(),
                              position: position,
                            );
                            if (!context.mounted) return;
                            Navigator.of(context).pop();
                          } finally {
                            _busy = false;
                          }
                        },
                  child: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _confirmDeleteEmployee(StaffMember staff) async {
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Employee?'),
        content: Text('Hapus ${staff.name} dari jadwal?'),
        actions: [
          TextButton(
            onPressed: _busy ? null : () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: _busy
                ? null
                : () async {
                    _busy = true;
                    try {
                      await _firestore.deleteStaffMember(
                        outletId: widget.outlet.id,
                        staffId: staff.id,
                      );
                      if (!context.mounted) return;
                      Navigator.of(context).pop();
                    } finally {
                      _busy = false;
                    }
                  },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  Future<void> _checkIn(StaffMember staff, DateTime day, String shift) async {
    await _firestore.checkInAttendance(
      outletId: widget.outlet.id,
      staffId: staff.id,
      employeeName: staff.name,
      dateKey: _dateKey(day),
      shift: shift,
    );
  }

  Future<void> _checkOut(StaffSchedule attendance) async {
    await _firestore.checkOutAttendance(
      outletId: widget.outlet.id,
      attendanceId: attendance.id,
      staffId: attendance.staffId,
      dateKey: attendance.dateKey,
    );
  }

  Widget _scheduleSection({
    required String title,
    required List<StaffMember> staffs,
    required Map<String, StaffSchedule> attendanceMap,
    required Map<String, Map<String, String>> overrideMap,
  }) {
    if (staffs.isEmpty) return const SizedBox.shrink();
    final days = _weekDays;
    final headStyle = Theme.of(
      context,
    ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 14),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 980),
                child: Column(
                  children: [
                    Row(
                      children: [
                        SizedBox(width: 170, child: Text('Name', style: headStyle)),
                        ...days.map(
                          (d) => SizedBox(
                            width: 120,
                            child: Text(_dayHeadLabel(d), style: headStyle),
                          ),
                        ),
                        const SizedBox(width: 44),
                      ],
                    ),
                    const Divider(height: 18),
                    ...staffs.map((staff) {
                      return Column(
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SizedBox(
                                width: 170,
                                child: Padding(
                                  padding: const EdgeInsets.only(top: 6),
                                  child: Text(staff.name),
                                ),
                              ),
                              ...days.map((day) {
                                final dayKey = _dateKey(day);
                                final key = '${staff.id}_$dayKey';
                                final webDefaultId = _webDefaultEmployeeId(
                                  staff,
                                );
                                final legacyKey = webDefaultId == null
                                    ? null
                                    : '${webDefaultId}_$dayKey';
                                final attendance =
                                    attendanceMap[key] ??
                                    (legacyKey == null
                                        ? null
                                        : attendanceMap[legacyKey]);
                                final overrideShift =
                                    overrideMap[dayKey]?[staff.id] ??
                                    (webDefaultId == null
                                        ? null
                                        : overrideMap[dayKey]?[webDefaultId]);
                                final shift = overrideShift ??
                                    attendance?.shift ??
                                    _autoShift(staff, day);
                                final color = _shiftColor(shift);
                                final isToday = _isToday(day);

                                return SizedBox(
                                  width: 120,
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 4),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 10,
                                            vertical: 4,
                                          ),
                                          decoration: BoxDecoration(
                                            color: color.withValues(alpha: 0.24),
                                            borderRadius:
                                                BorderRadius.circular(999),
                                          ),
                                          child: Text(
                                            shift,
                                            style: TextStyle(
                                              color: color,
                                              fontWeight: FontWeight.w700,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ),
                                        if ((attendance?.checkIn ?? '').isNotEmpty)
                                          Padding(
                                            padding: const EdgeInsets.only(top: 4),
                                            child: Text(
                                              'In: ${attendance!.checkIn}',
                                              style: Theme.of(
                                                context,
                                              ).textTheme.bodySmall,
                                            ),
                                          )
                                        else if (isToday && shift != 'OFF')
                                          Padding(
                                            padding: const EdgeInsets.only(top: 4),
                                            child: OutlinedButton(
                                              onPressed: () =>
                                                  _checkIn(staff, day, shift),
                                              style: OutlinedButton.styleFrom(
                                                minimumSize: const Size(0, 24),
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 8,
                                                      vertical: 2,
                                                    ),
                                                visualDensity:
                                                    VisualDensity.compact,
                                              ),
                                              child: const Text('Check In'),
                                            ),
                                          ),
                                        if ((attendance?.checkOut ?? '').isNotEmpty)
                                          Text(
                                            'Out: ${attendance!.checkOut}',
                                            style: Theme.of(
                                              context,
                                            ).textTheme.bodySmall,
                                          )
                                        else if (isToday &&
                                            (attendance?.checkIn ?? '').isNotEmpty)
                                          Padding(
                                            padding: const EdgeInsets.only(top: 4),
                                            child: FilledButton(
                                              onPressed: () =>
                                                  _checkOut(attendance!),
                                              style: FilledButton.styleFrom(
                                                backgroundColor:
                                                    Theme.of(context)
                                                        .colorScheme
                                                        .error,
                                                minimumSize: const Size(0, 24),
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 8,
                                                      vertical: 2,
                                                    ),
                                                visualDensity:
                                                    VisualDensity.compact,
                                              ),
                                              child: const Text('Check Out'),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                );
                              }),
                              SizedBox(
                                width: 44,
                                child: PopupMenuButton<String>(
                                  onSelected: (value) async {
                                    if (value == 'edit') {
                                      await _showEditEmployeeDialog(staff);
                                    } else if (value == 'delete') {
                                      await _confirmDeleteEmployee(staff);
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
                                ),
                              ),
                            ],
                          ),
                          const Divider(height: 18),
                        ],
                      );
                    }),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_bootstrapping) {
      return const Center(child: CircularProgressIndicator());
    }

    final dateKeys = _weekDays.map(_dateKey).toList();
    return StreamBuilder<List<StaffMember>>(
      stream: _firestore.streamStaffMembers(widget.outlet.id),
      builder: (context, staffSnapshot) {
        return StreamBuilder<List<StaffSchedule>>(
          stream: _firestore.streamStaffSchedulesInRange(
            widget.outlet.id,
            dateKeys,
          ),
          builder: (context, attendanceSnapshot) {
            return StreamBuilder<Map<String, Map<String, String>>>(
              stream: _firestore.streamShiftOverridesInRange(
                widget.outlet.id,
                dateKeys,
              ),
              builder: (context, overrideSnapshot) {
                if (staffSnapshot.connectionState == ConnectionState.waiting ||
                    attendanceSnapshot.connectionState ==
                        ConnectionState.waiting ||
                    overrideSnapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                final staffs = (staffSnapshot.data ?? const <StaffMember>[])
                    .where((e) => e.active)
                    .toList();
                final cashiers = staffs
                    .where((s) => s.position.toLowerCase().contains('cashier'))
                    .toList()
                  ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
                final baristas = staffs
                    .where((s) => s.position.toLowerCase().contains('barista'))
                    .toList()
                  ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));

                final attendanceMap = <String, StaffSchedule>{};
                for (final a
                    in (attendanceSnapshot.data ?? const <StaffSchedule>[])) {
                  final key = '${a.staffId}_${a.dateKey}';
                  final existing = attendanceMap[key];
                  if (existing == null) {
                    attendanceMap[key] = a;
                    continue;
                  }
                  // Prefer row that already has check-out, then check-in.
                  final existingScore =
                      ((existing.checkIn ?? '').isNotEmpty ? 1 : 0) +
                      ((existing.checkOut ?? '').isNotEmpty ? 2 : 0);
                  final nextScore =
                      ((a.checkIn ?? '').isNotEmpty ? 1 : 0) +
                      ((a.checkOut ?? '').isNotEmpty ? 2 : 0);
                  if (nextScore >= existingScore) {
                    attendanceMap[key] = a;
                  }
                }
                final overrideMap =
                    overrideSnapshot.data ??
                    const <String, Map<String, String>>{};

                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Employee Schedule',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        FilledButton.icon(
                          onPressed: _showAddEmployeeDialog,
                          icon: const Icon(Icons.add),
                          label: const Text('Add Employee'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            OutlinedButton(
                              onPressed: () {
                                setState(() {
                                  _weekStart = _weekStart.subtract(
                                    const Duration(days: 7),
                                  );
                                });
                              },
                              child: const Text('Previous Week'),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                children: [
                                  Text(
                                    _weekNumberLabel(),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 22,
                                    ),
                                  ),
                                  Text(
                                    _weekRangeLabel(),
                                    style: Theme.of(context).textTheme.bodyMedium,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            OutlinedButton(
                              onPressed: () {
                                setState(() {
                                  _weekStart = _weekStart.add(
                                    const Duration(days: 7),
                                  );
                                });
                              },
                              child: const Text('Next Week'),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    _scheduleSection(
                      title: 'Cashier Schedule',
                      staffs: cashiers,
                      attendanceMap: attendanceMap,
                      overrideMap: overrideMap,
                    ),
                    const SizedBox(height: 12),
                    _scheduleSection(
                      title: 'Barista Schedule',
                      staffs: baristas,
                      attendanceMap: attendanceMap,
                      overrideMap: overrideMap,
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
