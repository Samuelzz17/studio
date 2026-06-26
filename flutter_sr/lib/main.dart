import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'firebase_options.dart';
import 'screens/login_screen.dart';
import 'utils/app_theme_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('id_ID');

  var firebaseReady = true;
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    // Enable offline persistence to speed up repeat reads and improve UX on flaky networks.
    // On web (and some environments), enabling persistence can throw; ignore and continue.
    try {
      FirebaseFirestore.instance.settings = const Settings(
        persistenceEnabled: true,
        cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
      );
    } catch (_) {
      if (kDebugMode) {
        // ignore
      }
    }
  } catch (_) {
    firebaseReady = false;
  }

  runApp(SrFlutterApp(firebaseReady: firebaseReady));
}

class SrFlutterApp extends StatelessWidget {
  const SrFlutterApp({super.key, required this.firebaseReady});

  final bool firebaseReady;

  @override
  Widget build(BuildContext context) {
    final darkBg = const HSLColor.fromAHSL(1, 147, 0.70, 0.10).toColor();
    final darkPrimary = const HSLColor.fromAHSL(1, 147, 0.55, 0.45).toColor();
    final highContrastText = const HSLColor.fromAHSL(
      1,
      210,
      0.20,
      0.98,
    ).toColor();
    final darkSurface = const HSLColor.fromAHSL(1, 147, 0.32, 0.13).toColor();
    final darkSurfaceVariant = const HSLColor.fromAHSL(
      1,
      147,
      0.20,
      0.18,
    ).toColor();
    final darkBorder = darkPrimary.withValues(alpha: 0.22);
    final lightBg = const Color(0xFFF6F8F8);
    final lightSurface = Colors.white;

    final baseLight = ColorScheme.fromSeed(
      brightness: Brightness.light,
      seedColor: darkPrimary,
    );
    final baseDark = ColorScheme(
      brightness: Brightness.dark,
      primary: darkPrimary,
      onPrimary: highContrastText,
      secondary: darkPrimary.withValues(alpha: 0.9),
      onSecondary: highContrastText,
      error: const Color(0xFFEF4444),
      onError: Colors.white,
      surface: darkSurface,
      onSurface: highContrastText,
      surfaceContainerHighest: darkSurfaceVariant,
      onSurfaceVariant: highContrastText.withValues(alpha: 0.86),
      outline: darkPrimary.withValues(alpha: 0.35),
      shadow: Colors.black,
      inverseSurface: highContrastText,
      onInverseSurface: darkBg,
      inversePrimary: darkPrimary.withValues(alpha: 0.85),
    );

    return ValueListenableBuilder<ThemeMode>(
      valueListenable: AppThemeController.mode,
      builder: (context, mode, _) {
        return MaterialApp(
          title: 'Sumber Redjeki',
          debugShowCheckedModeBanner: false,
          themeAnimationDuration: Duration.zero,
          themeAnimationCurve: Curves.linear,
          themeMode: mode,
          theme: ThemeData(
            useMaterial3: true,
            colorScheme: baseLight,
            splashFactory: NoSplash.splashFactory,
            pageTransitionsTheme: const PageTransitionsTheme(
              builders: <TargetPlatform, PageTransitionsBuilder>{
                TargetPlatform.android: _NoAnimationPageTransitionsBuilder(),
                TargetPlatform.iOS: _NoAnimationPageTransitionsBuilder(),
                TargetPlatform.macOS: _NoAnimationPageTransitionsBuilder(),
                TargetPlatform.windows: _NoAnimationPageTransitionsBuilder(),
                TargetPlatform.linux: _NoAnimationPageTransitionsBuilder(),
              },
            ),
            scaffoldBackgroundColor: lightBg,
            appBarTheme: const AppBarTheme(elevation: 0, centerTitle: false),
            dialogTheme: DialogThemeData(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
            cardTheme: CardThemeData(
              color: lightSurface,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: Color(0x11000000)),
              ),
            ),
            filledButtonTheme: FilledButtonThemeData(
              style: FilledButton.styleFrom(
                backgroundColor: darkPrimary,
                foregroundColor: highContrastText,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            outlinedButtonTheme: OutlinedButtonThemeData(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: const Color(0xFFF1F4F4),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 14,
              ),
              floatingLabelBehavior: FloatingLabelBehavior.auto,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0x26000000)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0x26000000)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: darkPrimary, width: 1.4),
              ),
            ),
          ),
          darkTheme: ThemeData(
            useMaterial3: true,
            colorScheme: baseDark,
            splashFactory: NoSplash.splashFactory,
            pageTransitionsTheme: const PageTransitionsTheme(
              builders: <TargetPlatform, PageTransitionsBuilder>{
                TargetPlatform.android: _NoAnimationPageTransitionsBuilder(),
                TargetPlatform.iOS: _NoAnimationPageTransitionsBuilder(),
                TargetPlatform.macOS: _NoAnimationPageTransitionsBuilder(),
                TargetPlatform.windows: _NoAnimationPageTransitionsBuilder(),
                TargetPlatform.linux: _NoAnimationPageTransitionsBuilder(),
              },
            ),
            scaffoldBackgroundColor: darkBg,
            canvasColor: darkBg,
            appBarTheme: AppBarTheme(
              backgroundColor: darkBg,
              foregroundColor: highContrastText,
              elevation: 0,
              centerTitle: false,
            ),
            dialogTheme: DialogThemeData(
              backgroundColor: darkSurface,
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
            cardTheme: CardThemeData(
              color: darkSurface,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: darkBorder),
              ),
            ),
            drawerTheme: DrawerThemeData(backgroundColor: darkBg),
            dividerColor: darkBorder,
            filledButtonTheme: FilledButtonThemeData(
              style: FilledButton.styleFrom(
                backgroundColor: darkPrimary,
                foregroundColor: highContrastText,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            outlinedButtonTheme: OutlinedButtonThemeData(
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: darkBorder),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: darkSurfaceVariant.withValues(alpha: 0.55),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 14,
              ),
              floatingLabelBehavior: FloatingLabelBehavior.auto,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: darkBorder),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: darkBorder),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: darkPrimary, width: 1.4),
              ),
            ),
          ),
          home: firebaseReady
              ? const LoginScreen()
              : const FirebaseSetupMissingScreen(),
        );
      },
    );
  }
}

class _NoAnimationPageTransitionsBuilder extends PageTransitionsBuilder {
  const _NoAnimationPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    return child;
  }
}

class FirebaseSetupMissingScreen extends StatelessWidget {
  const FirebaseSetupMissingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Setup Firebase Dulu')),
      body: const Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Firebase belum terinisialisasi.',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
            ),
            SizedBox(height: 12),
            Text(
              'Tambahkan konfigurasi Android Firebase (google-services.json) lalu jalankan ulang.',
            ),
          ],
        ),
      ),
    );
  }
}
