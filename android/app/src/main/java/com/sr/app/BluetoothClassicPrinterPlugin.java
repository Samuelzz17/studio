package com.sr.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
        name = "BluetoothClassicPrinter",
        permissions = {
                @Permission(alias = "bluetoothConnect", strings = {Manifest.permission.BLUETOOTH_CONNECT}),
                @Permission(alias = "bluetoothScan", strings = {Manifest.permission.BLUETOOTH_SCAN})
        }
)
public class BluetoothClassicPrinterPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothAdapter adapter;
    private BluetoothSocket socket;
    private OutputStream outputStream;

    @Override
    public void load() {
        adapter = BluetoothAdapter.getDefaultAdapter();
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31 && !hasPermission("bluetoothConnect")) {
            requestPermissionForAlias("bluetoothConnect", call, "permissionsCallback");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasPermission("bluetoothConnect"));
        call.resolve(ret);
    }

    @PluginMethod
    public void listPairedDevices(PluginCall call) {
        if (adapter == null) {
            call.reject("Bluetooth not supported on this device");
            return;
        }
        if (Build.VERSION.SDK_INT >= 31 && !hasPermission("bluetoothConnect")) {
            call.reject("Missing BLUETOOTH_CONNECT permission");
            return;
        }

        JSArray devices = new JSArray();
        try {
            Set<BluetoothDevice> bondedDevices = adapter.getBondedDevices();
            for (BluetoothDevice device : bondedDevices) {
                JSObject obj = new JSObject();
                obj.put("name", device.getName());
                obj.put("address", device.getAddress());
                devices.put(obj);
            }
        } catch (SecurityException se) {
            call.reject("Missing Bluetooth permission: " + se.getMessage());
            return;
        }

        JSObject ret = new JSObject();
        ret.put("devices", devices);
        call.resolve(ret);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (adapter == null) {
            call.reject("Bluetooth not supported on this device");
            return;
        }
        if (Build.VERSION.SDK_INT >= 31 && !hasPermission("bluetoothConnect")) {
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
