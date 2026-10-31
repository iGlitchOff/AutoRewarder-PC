package off.iglitch.autorewarder;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.content.FileProvider;

import java.io.File;

public class MainActivity extends Activity {
    private static final int REQ_CAMERA = 42;
    private static final int REQ_SCAN = 43;

    private WebView ui;
    private WebView bing;
    private LinearLayout bingWrap;
    private TextView bingStatus;
    private AndroidJs js;
    private BingTasks tasks;
    private File pendingApk;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        ui = findViewById(R.id.ui);
        bing = findViewById(R.id.bing);
        bingWrap = findViewById(R.id.bing_wrap);
        bingStatus = findViewById(R.id.bing_status);
        Button close = findViewById(R.id.bing_close);
        close.setOnClickListener(v -> closeBing());

        ui.setBackgroundColor(Color.parseColor("#101827"));
        ui.setOverScrollMode(View.OVER_SCROLL_NEVER);
        ui.setVerticalScrollBarEnabled(false);
        ui.setHorizontalScrollBarEnabled(false);
        bing.setBackgroundColor(Color.parseColor("#101827"));

        @SuppressLint("SetJavaScriptEnabled")
        WebSettings settings = ui.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);

        js = new AndroidJs(this, ui);
        ui.addJavascriptInterface(js, "Android");
        ui.setWebChromeClient(new WebChromeClient());
        ui.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript("window.onNativeReady && onNativeReady()", null);
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                try {
                    view.loadUrl("file:///android_asset/www/phone.html");
                } catch (Exception e) {
                    view.reload();
                }
                return true;
            }
        });
        ui.loadUrl("file:///android_asset/www/phone.html");

        tasks = new BingTasks(this, bing);
    }

    void startQrScan() {
        runOnUiThread(() -> {
            if (checkSelfPermission(Manifest.permission.CAMERA)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                return;
            }
            startActivityForResult(new Intent(this, QrScanActivity.class), REQ_SCAN);
        });
    }

    private void notifyQrFailed(String message) {
        if (ui == null) return;
        String safe = (message == null ? "" : message).replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ");
        ui.evaluateJavascript("window.onQrScanFailed && onQrScanFailed(\"" + safe + "\")", null);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_CAMERA) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startActivityForResult(new Intent(this, QrScanActivity.class), REQ_SCAN);
        } else {
            notifyQrFailed("Sin permiso de cámara. Escríbelo a mano o permite la cámara y vuelve a escanear.");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_SCAN || ui == null) return;
        if (resultCode == RESULT_OK && data != null) {
            String text = data.getStringExtra(QrScanActivity.EXTRA_TEXT);
            if (text != null && !text.isEmpty()) {
                String safe = text.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ");
                ui.evaluateJavascript("window.onQrScanned && onQrScanned(\"" + safe + "\")", null);
                return;
            }
        }
        String err = data != null ? data.getStringExtra(QrScanActivity.EXTRA_ERROR) : null;
        notifyQrFailed(err == null || err.isEmpty()
                ? "Cámara cerrada. Escribe el código o vuelve a escanear."
                : err);
    }

    void startBingTask(String kind) {
        runOnUiThread(() -> {
            if (tasks != null && tasks.isRunning()) {
                setBingStatus("Ya hay una tarea Bing en curso.");
                return;
            }
            bingWrap.setVisibility(View.VISIBLE);
            setBingStatus("Preparando Bing…");
            tasks.start(kind);
        });
    }

    void openRewardsLogin() {
        runOnUiThread(() -> {
            if (tasks == null) return;
            bingWrap.setVisibility(View.VISIBLE);
            setBingStatus("Inicia sesión con la cuenta Microsoft.");
            tasks.openLogin();
        });
    }

    void probeBingSession() {
        runOnUiThread(() -> {
            if (tasks == null) {
                deliverSession(false);
                return;
            }
            tasks.probeForUi();
        });
    }

    void deliverSession(boolean loggedIn) {
        runOnUiThread(() -> {
            if (ui == null) return;
            ui.evaluateJavascript(
                    "window.onBingSession && onBingSession(" + loggedIn + ")",
                    null);
        });
    }

    void hideBingPanel() {
        runOnUiThread(() -> {
            if (bingWrap != null) bingWrap.setVisibility(View.GONE);
        });
    }

    void closeBing() {
        runOnUiThread(() -> {
            if (tasks != null && tasks.isLoginMode()) {
                tasks.finishLogin();
                return;
            }
            hideBing(false, "Cerrado");
        });
    }

    void setBingStatus(String text) {
        runOnUiThread(() -> bingStatus.setText(text));
    }

    void onBingTaskDone(boolean ok, String detail) {
        hideBing(ok, detail);
    }

    void hideBing(boolean ok, String detail) {
        runOnUiThread(() -> {
            if (tasks != null) tasks.cancel();
            bingWrap.setVisibility(View.GONE);
            String safe = (detail == null ? "" : detail).replace("\\", "\\\\").replace("\"", "\\\"");
            ui.evaluateJavascript(
                    "window.onBingTask && onBingTask(" + ok + ",\"" + safe + "\")",
                    null);
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pendingApk != null && pendingApk.isFile()) {
            File apk = pendingApk;
            pendingApk = null;
            installApk(apk);
        }
        if (ui != null) {
            ui.evaluateJavascript("window.onAppResume && onAppResume()", null);
        }
    }

    void onUpdateFailed(String message) {
        runOnUiThread(() -> {
            if (ui == null) return;
            String safe = (message == null ? "" : message).replace("\\", "\\\\").replace("\"", "\\\"");
            ui.evaluateJavascript("window.onUpdateFailed && onUpdateFailed(\"" + safe + "\")", null);
        });
    }

    void installApk(File apk) {
        runOnUiThread(() -> {
            if (apk == null || !apk.isFile() || apk.length() < 100) {
                onUpdateFailed("APK no descargado.");
                return;
            }
            if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
                pendingApk = apk;
                try {
                    startActivity(new Intent(
                            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + getPackageName())));
                } catch (Exception e) {
                    onUpdateFailed("Activa instalar apps de esta fuente en Ajustes.");
                }
                return;
            }
            try {
                Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".files", apk);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                if (ui != null) {
                    ui.evaluateJavascript(
                            "window.onUpdateReady && onUpdateReady()",
                            null);
                }
            } catch (Exception e) {
                onUpdateFailed("No se pudo abrir el instalador.");
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (bingWrap.getVisibility() == View.VISIBLE) {
            closeBing();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (js != null) {
            boolean gone = false;
            try {
                getPackageManager().getPackageInfo(getPackageName(), 0);
            } catch (Exception e) {
                gone = true;
            }
            if (gone) js.sendUnlinkBestEffort();
            js.shutdown();
        }
        if (tasks != null) tasks.cancel();
        super.onDestroy();
    }
}
