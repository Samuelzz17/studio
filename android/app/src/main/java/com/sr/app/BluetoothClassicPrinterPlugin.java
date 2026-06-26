package com.sr.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
        name = "BluetoothClassicPrinter",
        permissions = {
                @Permission(alias = "bluetoothConnect", strings = {Manifest.permission.BLUETOOTH_CONNECT}),
                @Permission(alias = "bluetoothScan", strings = {Manifest.permission.BLUETOOTH_SCAN}),
                @Permission(alias = "location", strings = {Manifest.permission.ACCESS_FINE_LOCATION})
        }
)
public class BluetoothClassicPrinterPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothAdapter adapter;
    private BluetoothSocket socket;
    private OutputStream outputStream;
    private BroadcastReceiver discoveryReceiver;

    @Override
    public void load() {
        adapter = BluetoothAdapter.getDefaultAdapter();
    }

    private boolean isPermissionGranted(String alias) {
        PermissionState state = getPermissionState(alias);
        return state == PermissionState.GRANTED;
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        boolean needsBluetoothPerms = Build.VERSION.SDK_INT >= 31
                && (!isPermissionGranted("bluetoothConnect") || !isPermissionGranted("bluetoothScan"));
        boolean needsLocationPerm = Build.VERSION.SDK_INT < 31
                && getActivity().checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED;

        if (needsBluetoothPerms || needsLocationPerm) {
            requestAllPermissions(call, "permissionsCallback");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PermissionCallback
    @SuppressWarnings("unused")
    private void permissionsCallback(PluginCall call) {
        boolean locationGranted = Build.VERSION.SDK_INT >= 31
                || getActivity().checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        boolean bluetoothGranted = Build.VERSION.SDK_INT < 31
                || (isPermissionGranted("bluetoothConnect") && isPermissionGranted("bluetoothScan"));
        JSObject ret = new JSObject();
        ret.put("granted", bluetoothGranted && locationGranted);
        call.resolve(ret);
    }

    @PluginMethod
    @SuppressWarnings("unused")
    public void listPairedDevices(PluginCall call) {
        if (adapter == null) {
            call.reject("Bluetooth not supported on this device");
            return;
        }
        if (Build.VERSION.SDK_INT >= 31 && !isPermissionGranted("bluetoothConnect")) {
            call.reject("Missing BLUETOOTH_CONNECT permission");
            return;
        }

        JSArray devices = new JSArray();
        try {
            Set<BluetoothDevice> bondedDevices = adapter.getBondedDevices();
            for (BluetoothDevice device : bondedDevices) {
                JSObject obj = new JSObject();
                try {
                    obj.put("name", device.getName());
                    obj.put("address", device.getAddress());
                } catch (SecurityException se) {
                    call.reject("Missing Bluetooth permission: " + se.getMessage());
                    return;
                }
                devices.put(obj);
            }
        } catch (SecurityException se) {
            call.reject("Missing Bluetooth permission: " + se.getMessage());
            return;
        } catch (Exception e) {
            call.reject("Failed to list paired devices: " + e.getMessage());
            return;
        }

        JSObject ret = new JSObject();
        ret.put("devices", devices);
        call.resolve(ret);
    }

    @PluginMethod
    @SuppressWarnings("unused")
    public void scanDevices(PluginCall call) {
        if (adapter == null) {
            call.reject("Bluetooth not supported on this device");
            return;
        }
        if (Build.VERSION.SDK_INT >= 31 && !isPermissionGranted("bluetoothScan")) {
            call.reject("Missing BLUETOOTH_SCAN permission");
            return;
        }
        if (Build.VERSION.SDK_INT < 31 && getActivity().checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            call.reject("Missing ACCESS_FINE_LOCATION permission");
            return;
        }

        JSArray devices = new JSArray();
        HashSet<String> seen = new HashSet<>();
        call.setKeepAlive(true);

        if (discoveryReceiver != null) {
            try {
                getContext().unregisterReceiver(discoveryReceiver);
            } catch (Exception ignored) {
            }
            discoveryReceiver = null;
        }

        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothDevice.ACTION_FOUND);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);

        discoveryReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                    BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    if (device != null && device.getAddress() != null) {
                        if (seen.contains(device.getAddress())) {
                            return;
                        }
                        seen.add(device.getAddress());
                        JSObject obj = new JSObject();
                        try {
                            obj.put("name", device.getName());
                            obj.put("address", device.getAddress());
                        } catch (SecurityException se) {
                            call.reject("Missing Bluetooth permission: " + se.getMessage());
                            call.setKeepAlive(false);
                            try {
                                getContext().unregisterReceiver(this);
                            } catch (Exception ignored) {
                            }
                            discoveryReceiver = null;
                            return;
                        }
                        devices.put(obj);
                    }
                } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                    JSObject ret = new JSObject();
                    ret.put("devices", devices);
                    call.resolve(ret);
                    call.setKeepAlive(false);
                    try {
                        getContext().unregisterReceiver(this);
                    } catch (Exception ignored) {
                    }
                    discoveryReceiver = null;
                }
            }
        };

        try {
            getContext().registerReceiver(discoveryReceiver, filter);
            adapter.cancelDiscovery();
            adapter.startDiscovery();
        } catch (SecurityException se) {
            call.reject("Missing Bluetooth permission: " + se.getMessage());
            call.setKeepAlive(false);
        } catch (Exception e) {
            call.reject("Failed to start discovery: " + e.getMessage());
            call.setKeepAlive(false);
        }
    }

    @PluginMethod
    @SuppressWarnings("unused")
    public void connect(PluginCall call) {
        if (adapter == null) {
            call.reject("Bluetooth not supported on this device");
            return;
        }
        if (Build.VERSION.SDK_INT >= 31 && !isPermissionGranted("bluetoothConnect")) {
            call.reject("Missing BLUETOOTH_CONNECT permission");
            return;
        }

        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("Missing device address");
            return;
        }

        getBridge().execute(() -> {
            try {
                closeConnection();
                BluetoothDevice device = adapter.getRemoteDevice(address);
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                adapter.cancelDiscovery();
                socket.connect();
                outputStream = socket.getOutputStream();
                call.resolve();
            } catch (SecurityException se) {
                closeConnection();
                call.reject("Missing Bluetooth permission: " + se.getMessage());
            } catch (Exception e) {
                closeConnection();
                call.reject("Failed to connect: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    @SuppressWarnings("unused")
    public void print(PluginCall call) {
        if (socket == null || outputStream == null || !socket.isConnected()) {
            call.reject("Not connected to printer");
            return;
        }

        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("Missing print data");
            return;
        }

        byte[] bytes = Base64.decode(data, Base64.DEFAULT);
        getBridge().execute(() -> {
            try {
                outputStream.write(bytes);
                outputStream.flush();
                call.resolve();
            } catch (Exception e) {
                call.reject("Print failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    @SuppressWarnings("unused")
    public void disconnect(PluginCall call) {
        closeConnection();
        call.resolve();
    }

    private void closeConnection() {
        try {
            if (outputStream != null) {
                outputStream.close();
            }
        } catch (Exception ignored) {
        }
        outputStream = null;

        try {
            if (socket != null) {
                socket.close();
            }
        } catch (Exception ignored) {
        }
        socket = null;
    }
}
