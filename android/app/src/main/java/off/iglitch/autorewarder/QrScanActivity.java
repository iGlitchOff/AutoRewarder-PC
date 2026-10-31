package off.iglitch.autorewarder;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.journeyapps.barcodescanner.BarcodeCallback;
import com.journeyapps.barcodescanner.DecoratedBarcodeView;
import com.journeyapps.barcodescanner.camera.CameraSettings;

/** Modernized ZXing QR camera preview with proper DP scaling and pill controls. */
public class QrScanActivity extends Activity {
    public static final String EXTRA_TEXT = "qr_text";
    public static final String EXTRA_ERROR = "qr_error";

    private DecoratedBarcodeView scanner;
    private boolean finished;

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        scanner = new DecoratedBarcodeView(this);
        CameraSettings settings = new CameraSettings();
        settings.setRequestedCameraId(0);
        scanner.getBarcodeView().setCameraSettings(settings);
        scanner.setStatusText("");

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.addView(scanner, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // Top bar container
        LinearLayout topBar = new LinearLayout(this);
        topBar.setOrientation(LinearLayout.HORIZONTAL);
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setPadding(dp(18), dp(16), dp(18), dp(16));
        GradientDrawable topBg = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{0xDD0B0F19, 0x000B0F19});
        topBar.setBackground(topBg);

        LinearLayout titleWrap = new LinearLayout(this);
        titleWrap.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams titleWrapLp = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        titleWrap.setLayoutParams(titleWrapLp);

        TextView title = new TextView(this);
        title.setText("Escanear código QR");
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        titleWrap.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("Apunta al QR de AutoRewarder en el PC");
        subtitle.setTextColor(0xFF94A3B8);
        subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        titleWrap.addView(subtitle);

        topBar.addView(titleWrap);

        TextView cancel = new TextView(this);
        cancel.setText("Cancelar");
        cancel.setTextColor(Color.WHITE);
        cancel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        cancel.setTypeface(Typeface.DEFAULT_BOLD);
        cancel.setGravity(Gravity.CENTER);
        cancel.setPadding(dp(18), dp(10), dp(18), dp(10));
        GradientDrawable pill = new GradientDrawable();
        pill.setColor(0xCC1E293B);
        pill.setCornerRadius(dp(999));
        pill.setStroke(dp(1), 0x44FFFFFF);
        cancel.setBackground(pill);
        cancel.setOnClickListener(v -> finishCanceled("Cámara cerrada. Escribe el código o vuelve a escanear."));
        topBar.addView(cancel);

        root.addView(topBar, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP));

        setContentView(root);

        BarcodeCallback callback = result -> {
            if (result == null || result.getText() == null || result.getText().isEmpty() || finished) return;
            finished = true;
            Intent out = new Intent();
            out.putExtra(EXTRA_TEXT, result.getText());
            setResult(RESULT_OK, out);
            finish();
        };
        scanner.decodeSingle(callback);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (scanner != null) scanner.resume();
    }

    @Override
    protected void onPause() {
        if (scanner != null) scanner.pause();
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        finishCanceled("Cámara cerrada. Escribe el código o vuelve a escanear.");
    }

    private void finishCanceled(String message) {
        if (finished) return;
        finished = true;
        Intent out = new Intent();
        out.putExtra(EXTRA_ERROR, message);
        setResult(RESULT_CANCELED, out);
        finish();
    }
}
