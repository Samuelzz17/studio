import { registerPlugin } from '@capacitor/core';

export interface PairedDevice {
  name: string;
  address: string;
}

export interface BluetoothClassicPrinterPlugin {
  requestPermissions(): Promise<{ granted: boolean }>;
  listPairedDevices(): Promise<{ devices: PairedDevice[] }>;
  connect(options: { address: string }): Promise<void>;
  print(options: { data: string }): Promise<void>;
  disconnect(): Promise<void>;
}

export const BluetoothClassicPrinter = registerPlugin<BluetoothClassicPrinterPlugin>(
  'BluetoothClassicPrinter'
);
