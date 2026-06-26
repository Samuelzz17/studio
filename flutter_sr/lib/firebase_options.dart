import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      case TargetPlatform.windows:
        return windows;
      case TargetPlatform.linux:
        return linux;
      default:
        throw UnsupportedError('Firebase belum dikonfigurasi untuk platform ini.');
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyCK3qr9egXaeHPkPMwyZsu54giyrN8qj10',
    appId: '1:213542699769:web:811479893b521409c11828',
    messagingSenderId: '213542699769',
    projectId: 'studio-2575278413-19a95',
    authDomain: 'studio-2575278413-19a95.firebaseapp.com',
    storageBucket: 'studio-2575278413-19a95.appspot.com',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDKqDsSTfqGaCE7AlwhV1ro3W09J_7Xlww',
    appId: '1:213542699769:android:101ab75361370a6ec11828',
    messagingSenderId: '213542699769',
    projectId: 'studio-2575278413-19a95',
    storageBucket: 'studio-2575278413-19a95.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyCK3qr9egXaeHPkPMwyZsu54giyrN8qj10',
    appId: '1:213542699769:web:811479893b521409c11828',
    messagingSenderId: '213542699769',
    projectId: 'studio-2575278413-19a95',
    iosBundleId: 'com.sr.app',
    storageBucket: 'studio-2575278413-19a95.appspot.com',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'AIzaSyCK3qr9egXaeHPkPMwyZsu54giyrN8qj10',
    appId: '1:213542699769:web:811479893b521409c11828',
    messagingSenderId: '213542699769',
    projectId: 'studio-2575278413-19a95',
    iosBundleId: 'com.sr.app',
    storageBucket: 'studio-2575278413-19a95.appspot.com',
  );

  static const FirebaseOptions windows = FirebaseOptions(
    apiKey: 'AIzaSyCK3qr9egXaeHPkPMwyZsu54giyrN8qj10',
    appId: '1:213542699769:web:811479893b521409c11828',
    messagingSenderId: '213542699769',
    projectId: 'studio-2575278413-19a95',
    storageBucket: 'studio-2575278413-19a95.appspot.com',
  );

  static const FirebaseOptions linux = FirebaseOptions(
    apiKey: 'AIzaSyCK3qr9egXaeHPkPMwyZsu54giyrN8qj10',
    appId: '1:213542699769:web:811479893b521409c11828',
    messagingSenderId: '213542699769',
    projectId: 'studio-2575278413-19a95',
    storageBucket: 'studio-2575278413-19a95.appspot.com',
  );
}
