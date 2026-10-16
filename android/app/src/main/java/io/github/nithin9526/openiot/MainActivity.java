package io.github.nithin9526.openiot;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.*;
import android.widget.*;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int FOREST = Color.rgb(36, 86, 63), PAPER = Color.rgb(247, 249, 245);
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private LinearLayout root;
    private WebView web;
    private ServerAddress server;
    private int generation;
    private boolean pageFailed;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0, this::goBack);
        String stored = getPreferences(MODE_PRIVATE).getString("server", "");
        try { server = ServerAddress.parse(stored, BuildConfig.ALLOW_LOCAL_HTTP); openDashboard(); }
        catch (IllegalArgumentException e) { showSetup(); }
    }
    private int dp(int n) { return (int)(getResources().getDisplayMetrics().density * n); }
    private LinearLayout column() { LinearLayout v = new LinearLayout(this); v.setOrientation(LinearLayout.VERTICAL); return v; }
    private void resetScreen() {
        generation++;
        if (web != null) { web.stopLoading(); web.destroy(); web = null; }
        root = column(); root.setBackgroundColor(PAPER); setContentView(root);
        // API 36 uses edge-to-edge: keep controls clear of system bars and keyboard.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                v.setPadding(i.left, i.top, i.right, i.bottom);
            } else { v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); }
            return insets;
        });
    }
    private TextView text(String value, int size, boolean bold) {
        TextView v = new TextView(this); v.setText(value); v.setTextSize(size); v.setTextColor(FOREST);
        v.setPadding(0, dp(8), 0, dp(8));
        if (bold) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return v;
    }
    private Button button(String title, Runnable action) {
        Button b = new Button(this); b.setText(title); b.setAllCaps(false); b.setMinHeight(dp(48));
        b.setOnClickListener(v -> action.run()); return b;
    }
    private LinearLayout card() {
        LinearLayout c = column(); c.setPadding(dp(20), dp(16), dp(20), dp(16));
        GradientDrawable background = new GradientDrawable(); background.setColor(Color.WHITE); background.setCornerRadius(dp(20));
        background.setStroke(dp(1), Color.rgb(220, 230, 216)); c.setBackground(background); return c;
    }
    private void showSetup() {
        resetScreen();
        ScrollView scroll = new ScrollView(this); root.addView(scroll);
        LinearLayout body = column(); body.setPadding(dp(24), dp(24), dp(24), dp(24)); scroll.addView(body);
        body.addView(text("openiot.", 28, true));
        body.addView(text("Your home.\nYour server.", 34, true));
        body.addView(text("Connect to an Open IoT server to control devices, view readings and run your scenes.", 16, false));
        LinearLayout form = card(); body.addView(form);
        TextView label = text("Server address", 16, true); form.addView(label);
        EditText address = new EditText(this); address.setSingleLine(true); address.setTextSize(16);
        address.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        address.setHint("https://iot.example.com"); address.setContentDescription("Server address");
        address.setText(getPreferences(MODE_PRIVATE).getString("server", "")); form.addView(address);
        TextView status = text("Use the same address configured as your server's Dashboard address (APP_ORIGIN).", 14, false); form.addView(status);
        CheckBox consent = new CheckBox(this);
        consent.setText("Allow unencrypted HTTP on my trusted local network for testing");
        if (BuildConfig.ALLOW_LOCAL_HTTP) form.addView(consent);
        Button connect = button("Check and connect", () -> {}); form.addView(connect);
        connect.setOnClickListener(v -> {
            final ServerAddress chosen;
            try {
                chosen = ServerAddress.parse(address.getText().toString(), BuildConfig.ALLOW_LOCAL_HTTP);
                if (chosen.localHttp && !consent.isChecked()) throw new IllegalArgumentException("Check the local-network option to acknowledge that HTTP sends passwords and controls without encryption.");
            } catch (IllegalArgumentException e) { status.setText(e.getMessage()); return; }
            connect.setEnabled(false); status.setText("Checking server connection…");
            int request = generation;
            worker.execute(() -> {
                String error = checkServer(chosen);
                runOnUiThread(() -> {
                    if (isDestroyed() || request != generation) return;
                    connect.setEnabled(true);
                    if (error != null) { status.setText(error); return; }
                    // Clear the previous server's session before accepting another origin.
                    if (server == null || !server.origin.equals(chosen.origin)) {
                        connect.setEnabled(false);
                        CookieManager.getInstance().removeAllCookies(done -> {
                            if (!isDestroyed() && request == generation) {
                                WebStorage.getInstance().deleteAllData(); saveAndOpen(chosen);
                            }
                        });
                    } else saveAndOpen(chosen);
                });
            });
        });
        body.addView(text("Your server stays in charge", 20, true));
        body.addView(text("Keep the server running. For local access, use the same Wi-Fi and enable LAN access. This app does not host a server or configure your ESP32.", 15, false));
        if (server != null) body.addView(button("Back to dashboard", this::openDashboard));
        body.addView(button("Privacy & app information", this::showPrivacy));
        body.addView(button("Forget server and clear session", () -> new AlertDialog.Builder(this)
            .setTitle("Forget this server?").setMessage("This clears this app's saved address and local browser session. Your server account and devices remain unchanged.")
            .setNegativeButton("Cancel", null).setPositiveButton("Clear", (d,w) -> clearSession()).show()));
        body.addView(text("Android app " + BuildConfig.VERSION_NAME + (BuildConfig.DEBUG ? " · test build" : ""), 12, false));
    }
    private void saveAndOpen(ServerAddress chosen) {
        server = chosen; getPreferences(MODE_PRIVATE).edit().putString("server", chosen.origin).apply(); openDashboard();
    }
    private String checkServer(ServerAddress chosen) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection)new URL(chosen.origin + "/api/health").openConnection();
            c.setConnectTimeout(7000); c.setReadTimeout(7000); c.setInstanceFollowRedirects(false);
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) return "This address redirects. Enter the final server address directly.";
            if (code != 200) return "Server check returned HTTP " + code + ". Check server and database status.";
            try (InputStream input = c.getInputStream()) {
                // Bounded response, compatible with Android 8+.
                byte[] bytes = new byte[4097]; int used = 0, count;
                while (used < bytes.length && (count = input.read(bytes, used, bytes.length - used)) != -1) used += count;
                if (used > 4096 || !new JSONObject(new String(bytes, 0, used, StandardCharsets.UTF_8)).optBoolean("ok"))
                    return "This address did not return an Open IoT health response. Check the address and port.";
            }
            return null;
        } catch (javax.net.ssl.SSLException e) { return "Secure connection failed. Use a valid HTTPS certificate; certificate errors cannot be bypassed."; }
        catch (Exception e) { return "Cannot reach the server. Check the address, Wi-Fi, LAN access and firewall, then try again."; }
        finally { if (c != null) c.disconnect(); }
    }
    @SuppressLint("SetJavaScriptEnabled")
    private void openDashboard() {
        if (server == null) { showSetup(); return; }
        resetScreen(); pageFailed = false;
        LinearLayout bar = new LinearLayout(this); bar.setGravity(android.view.Gravity.CENTER_VERTICAL); bar.setPadding(dp(12), 0, dp(8), 0);
        TextView brand = text("openiot.", 21, true); bar.addView(brand, new LinearLayout.LayoutParams(0, dp(56), 1));
        bar.addView(button("Reload", this::openDashboard)); bar.addView(button("Server", this::showSetup)); root.addView(bar);
        TextView origin = text(server.origin + (server.localHttp ? " · HTTP test connection" : ""), 12, false);
        origin.setPadding(dp(16), 0, dp(16), dp(8)); root.addView(origin);
        ProgressBar progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal); root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        LinearLayout errorPanel = column(); errorPanel.setPadding(dp(24), dp(24), dp(24), dp(24)); errorPanel.setVisibility(View.GONE);
        TextView errorText = text("", 17, false); errorPanel.addView(errorText);
        errorPanel.addView(button("Reconnect", this::openDashboard)); errorPanel.addView(button("Connection settings", this::showSetup)); root.addView(errorPanel);
        web = new WebView(this); root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        final WebView view = web; final ServerAddress selected = server;
        WebSettings settings = view.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false); settings.setSupportMultipleWindows(false);
        settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true); CookieManager.getInstance().setAcceptThirdPartyCookies(view, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        view.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView v, int value) { progress.setProgress(value); progress.setVisibility(value == 100 ? View.GONE : View.VISIBLE); }
        });
        view.setWebViewClient(new WebViewClient() {
            private void fail(String message) {
                if (web != view) return;
                pageFailed = true; view.setVisibility(View.GONE); progress.setVisibility(View.GONE); errorText.setText(message); errorPanel.setVisibility(View.VISIBLE);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (selected.contains(url)) return false;
                if (request.isForMainFrame() && request.hasGesture() && "https".equals(request.getUrl().getScheme())) {
                    new AlertDialog.Builder(MainActivity.this).setTitle("Open external link?")
                        .setMessage("This link leaves your Open IoT server and opens in your browser.")
                        .setNegativeButton("Cancel", null).setPositiveButton("Open browser", (d,w) -> {
                            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
                            catch (Exception e) { Toast.makeText(MainActivity.this,"No browser is available.",Toast.LENGTH_SHORT).show(); }
                        }).show();
                } else if (request.isForMainFrame()) fail("Navigation left the configured server. Check the server address in connection settings.");
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest request) {
                if (selected.contains(request.getUrl().toString())) return null;
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) fail("The dashboard could not load. Check your network and that the Open IoT server is running.");
            }
            @Override public void onReceivedHttpError(WebView v, WebResourceRequest r, WebResourceResponse response) {
                if (r.isForMainFrame()) fail("The server returned HTTP " + response.getStatusCode() + ". Check the server logs or try reconnecting.");
            }
            @Override public void onReceivedSslError(WebView v, SslErrorHandler handler, SslError error) {
                handler.cancel(); fail("The server's HTTPS certificate could not be verified. Fix the certificate before reconnecting.");
            }
            @Override public void onPageFinished(WebView v, String url) {
                if (!pageFailed && web == view) CookieManager.getInstance().flush();
            }
        });
        view.setDownloadListener((url, agent, disposition, type, length) -> Toast.makeText(this,"File downloads are not available in this preview. Use your server in a browser.",Toast.LENGTH_LONG).show());
        view.loadUrl(selected.origin + "/dashboard");
    }
    private void clearSession() {
        resetScreen(); server = null; getPreferences(MODE_PRIVATE).edit().clear().apply();
        CookieManager.getInstance().removeAllCookies(done -> {
            CookieManager.getInstance().flush(); WebStorage.getInstance().deleteAllData();
            if (!isDestroyed()) { WebView temporary = new WebView(this); temporary.clearCache(true); temporary.destroy(); showSetup(); }
        });
    }
    private void showPrivacy() {
        new AlertDialog.Builder(this).setTitle("Your connection and data")
            .setMessage("Open IoT stores your selected server address and browser session on this phone. Your login, device commands and readings are handled by the server you choose. Only connect to a server you trust.\n\nThis Android app includes no advertising or analytics SDK. The connected server controls its own data handling. Use Forget server to clear the local session. Manage or delete your account in the dashboard's My account page.\n\nThe app requires a running Open IoT server. File downloads and native notifications are not included in this preview.")
            .setPositiveButton("Close", null).show();
    }
    private void goBack() { if (web != null && web.canGoBack()) web.goBack(); else if (web != null) showSetup(); else finish(); }
    @Override public void onBackPressed() { goBack(); }
    @Override protected void onPause() { if (web != null) { web.onPause(); CookieManager.getInstance().flush(); } super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() { generation++; worker.shutdownNow(); if (web != null) { web.destroy(); web = null; } super.onDestroy(); }
}
