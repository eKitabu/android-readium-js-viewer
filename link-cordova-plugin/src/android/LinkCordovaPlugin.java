package org.apache.cordova.plugin;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbManager;
import android.util.Base64;
import android.webkit.MimeTypeMap;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CordovaWebView;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.security.MessageDigest;
import java.security.spec.AlgorithmParameterSpec;
import java.util.Arrays;
import java.util.List;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

public class LinkCordovaPlugin extends CordovaPlugin {


    public static native byte[] readZipEntry(String epub, String entry);

    static  {
        System.loadLibrary("zip");
    }

    private final static int PICK_FOLDER = 1;
    private CallbackContext callbackContext;
    private CallbackContext broadcastCallback;

    private final static String[] ACTIONS = {"getResource", "digest", "browseDirectory", "importKey", "decrypt", "onDetach"};

    private final BroadcastReceiver deviceDetachedReciever = new BroadcastReceiver() {
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(action)) {
                if (broadcastCallback != null) {
                    PluginResult result = new PluginResult(PluginResult.Status.OK);
                    result.setKeepCallback(true);
                    broadcastCallback.sendPluginResult(result);
                }
            }
        }
    };

    private String convertJSAlgoName(JSONObject algo) throws JSONException {
        return algo.getString("name").replaceAll("-", "/");
    }

    private String copyFile(byte[] file, String path) {
        try {
            String fileName = new File(path).getName();

            File parent = cordova.getActivity().getExternalCacheDir();

            File outFile = File.createTempFile(fileName, null, parent);
            FileOutputStream fos = new FileOutputStream(outFile);
            fos.write(file, 0, file.length);
            fos.close();
            return outFile.getAbsolutePath();
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    private byte[] getResource(String epubPath, String path) throws Exception {
        try {
            byte[] file = readZipEntry("/" + epubPath, path);
            if (file == null) {
                return null;
            }
            String extension = MimeTypeMap.getFileExtensionFromUrl(path);
            if ("mp3".equals(extension)) {
                String filePath = copyFile(file, path);
                if (filePath != null) {
                    return filePath.getBytes();
                }
                return null;
            }
            return file;
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    private byte[] digest(JSONObject algo, byte[] buffer) throws Exception {
        MessageDigest md = MessageDigest.getInstance(algo.getString("name"));

        md.update(buffer);
        return md.digest();
    }

    private byte[] importKey(String format, byte[] keyData, JSONObject algo, boolean extractable, JSONArray usages) throws Exception {
        return keyData;
    }

    private byte[] decrypt(JSONObject algo, byte[] keyData, byte[] iv, byte[] cypherText) throws Exception {
        String jsAlog = convertJSAlgoName(algo);
        AlgorithmParameterSpec ivSpec = new IvParameterSpec(iv);
        SecretKeySpec newKey = new SecretKeySpec(keyData, jsAlog.split("/")[0]);
        Cipher cipher = Cipher.getInstance(jsAlog + "/PKCS5Padding");
        cipher.init(Cipher.DECRYPT_MODE, newKey, ivSpec);
        return cipher.doFinal(cypherText);
    }

    private void browseDirectory(final String suggestion, final CallbackContext callbackContext) {
        // Implicitly allow the user to select a particular kind of data
        // The MIME data type filter
        // Only return URIs that can be opened with ContentResolver
        final Context context = this.cordova.getActivity().getApplicationContext();
        final Intent intent = new Intent(context, AdvFileChooser.class);
        intent.putExtra("suggestedPath", suggestion);
        intent.putExtra("selectFolder", true);

        this.callbackContext = callbackContext;

        cordova.startActivityForResult(this, intent, PICK_FOLDER);

        PluginResult result = new PluginResult(PluginResult.Status.NO_RESULT);
        result.setKeepCallback(true);
        this.callbackContext.sendPluginResult(result);
    }

    @Override
    public void initialize(CordovaInterface cordova, CordovaWebView webView) {
        super.initialize(cordova, webView);
        Context ctx = cordova.getActivity();
        ctx.registerReceiver(deviceDetachedReciever, new IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED));
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent intent) {
        if (requestCode == PICK_FOLDER && this.callbackContext != null) {
            if (resultCode == Activity.RESULT_OK ) {
                final String selectedFolderPath = intent.getStringExtra("fileSelected");

                this.callbackContext.success(selectedFolderPath);
            } else {
                this.callbackContext.error("There has been an error selecting a folder");
            }
            this.callbackContext = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, intent);
    }

    @Override
    public boolean execute(final String action, final JSONArray data, final CallbackContext callbackContext) {
        cordova.getThreadPool().execute(new Runnable() {
            @Override
            public void run() {
                byte[] res = null;
                String error = null;
                try {
                    if ("getResource".equals(action)) {
                        res = getResource(data.getString(0), data.getString(1));
                    } else if ("digest".equals(action)) {
                        res = digest(data.getJSONObject(0), Base64.decode(data.getString(1), Base64.DEFAULT));
                    } else if ("importKey".equals(action)) {
                        res = importKey(data.getString(0), Base64.decode(data.getString(1), Base64.DEFAULT), data.getJSONObject(2), data.getBoolean(3), data.getJSONArray(4));
                    } else if ("decrypt".equals(action)) {
                        res = decrypt(data.getJSONObject(0),
                                Base64.decode(data.getString(1), Base64.DEFAULT),
                                Base64.decode(data.getString(2), Base64.DEFAULT),
                                Base64.decode(data.getString(3), Base64.DEFAULT));
                    } else if ("browseDirectory".equals(action)) {
                        browseDirectory(data.getString(0), callbackContext);
                        return;
                    } else if ("onDetach".equals(action)) {
                        broadcastCallback = callbackContext;
                        return;
                    } else {
                        error = "bad action";
                    }
                } catch (Exception e) {
                    error = e.getMessage();
                    e.printStackTrace();
                }
                if (res != null) {
                    callbackContext.success(res);
                } else {
                    callbackContext.error(error);
                }
            }
        });
        return Arrays.asList(ACTIONS).contains(action);
    }
}
