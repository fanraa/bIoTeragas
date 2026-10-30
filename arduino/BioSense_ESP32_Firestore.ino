/*
 * ============================================================================
 * BioSense ITERA — IoT Biogas Monitoring (ESP32 Dual-Config v2.0)
 * ============================================================================
 * Fitur Sinkronisasi Sempurna Dua Arah (Web Cloud & Hotspot Captive Portal):
 *   1. CARA 2 (Captive Portal On-Device):
 *      - Jika Wi-Fi gagal konek dalam 25 detik, ESP32 menyalakan Hotspot mandiri (SoftAP).
 *      - Nama & password hotspot bisa di-kustomisasi bebas (misal: bIoTeragas).
 *      - UI Captive Portal modern & responsif di 192.168.4.1 (desain senada Web BioSense).
 *      - Tersimpan permanen di memori Flash ESP32 (Preferences NVS).
 *      - Saat ESP32 tersambung internet, setelan lokal ini otomatis disinkronkan ke Web Firestore!
 *
 *   2. CARA 3 (Remote Config Cloud via Web):
 *      - ESP32 mengecek Firestore setiap 30 detik menggunakan sistem Versioning (credentials_version).
 *      - Hanya menerapkan perubahan jika ada perintah baru dari Web, sehingga TIDAK terjadi
 *        loop disconnect atau menimpa setelan yang baru saja Anda ubah di portal.
 *
 * Hardware Pinout:
 *   - Sensor Suhu: DHT11 (VCC -> 3V3, DATA -> GPIO 4, GND -> GND)
 *   - Sensor Tekanan: Modul HX710B 24-bit (VCC -> 3V3, DOUT -> GPIO 16, SCK -> GPIO 17, GND -> GND)
 * ============================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <time.h>

// ============================================================================
// 1. DEFAULT KREDENSIAL AWAL (Akan ditimpa jika ada di memori Flash NVS)
// ============================================================================
const char* DEFAULT_WIFI_SSID = "FANRA  4G";
const char* DEFAULT_WIFI_PASS = "#12345678";

// Kredensial Hotspot Mandiri ESP32 (Bisa Anda Kustom Bebas)
const char* DEFAULT_AP_SSID   = "BioSense-ESP32-AP";
const char* DEFAULT_AP_PASS   = "12345678"; // Minimal 8 karakter

// ============================================================================
// 2. KONFIGURASI FIREBASE PROYEK fanracrate
// ============================================================================
const char* FIREBASE_API_KEY    = "AIzaSyA4dvWZHDdqpgxycWr_rD0_L-84Yp6L48o";
const char* FIREBASE_PROJECT_ID = "fanracrate";
const char* FIRESTORE_DB_ID     = "(default)";

// Akun perangkat terdaftar di Firebase Authentication
const char* DEVICE_EMAIL = "esp32@biosense.itera.ac.id";
const char* DEVICE_PASS  = "BiogasItera2026!";

// ============================================================================
// 3. PINOUT SENSOR & KALIBRASI TEKANAN (Jati Agung, Lampung Selatan ~100 mdpl)
// ============================================================================
constexpr uint8_t PIN_DHT          = 4;
constexpr uint8_t PIN_HX710B_DOUT  = 16;
constexpr uint8_t PIN_HX710B_SCK   = 17;
#define DHTTYPE DHT11

DHT dht(PIN_DHT, DHTTYPE);

constexpr bool  IS_PRESSURE_CALIBRATED   = true;
constexpr long  CALIBRATION_OFFSET_ZERO  = 613000;
constexpr float CALIBRATION_COUNTS_KPA   = 21500.0f;
constexpr float ATMOSPHERIC_PRESSURE_KPA = 101.3f;

// ============================================================================
// 4. MEMORI NON-VOLATIL (NVS) & VARIABEL GLOBAL DINAMIS
// ============================================================================
Preferences prefs;

String currentWifiSSID = "";
String currentWifiPass = "";
String currentApSSID   = "";
String currentApPass   = "";
unsigned long localCredVersion = 0;

unsigned long sendIntervalMs = 5000;
unsigned long lastSendTime = 0;
unsigned long lastConfigCheckTime = 0;
constexpr unsigned long CONFIG_CHECK_INTERVAL_MS = 30000; // Cek Cloud tiap 30 detik

String firebaseIdToken = "";
unsigned long tokenExpiresAtMs = 0;

// State Server Captive Portal (Cara 2)
bool isAPMode = false;
WebServer server(80);
DNSServer dnsServer;
const byte DNS_PORT = 53;

// Cache pembacaan sensor terakhir
float lastTempC = 0.0f;
float lastPresKpa = 101.3f;
long  lastRawPres = 613000;

// ============================================================================
// PROTOTYPE FUNGSI
// ============================================================================
void loadCredentialsFromNVS();
void saveCredentialsToNVS(const String& ssid, const String& pass, const String& apSsid, const String& apPass, unsigned long newVersion);
bool connectToWiFi(unsigned long timeoutMs = 20000);
void startCaptivePortal();
void handlePortalRoot();
void handlePortalSave();
void handlePortalScan();
void handlePortalData();
bool refreshFirebaseAuthToken();
void checkRemoteDeviceConfig();
void syncLocalConfigToFirestore();
bool sendDataToFirestore(float tempC, long rawPressure, float pKpa, float pBar, float pPsi, const char* rfcTime);
bool readHX710B(long &rawValue);
bool getRFC3339Timestamp(char* buffer, size_t maxLen);

// ============================================================================
// BACA & SIMPAN KE MEMORI FLASH NVS (Preferences)
// ============================================================================
void loadCredentialsFromNVS() {
  prefs.begin("biosense", false);

  currentWifiSSID  = prefs.getString("wifi_ssid", DEFAULT_WIFI_SSID);
  currentWifiPass  = prefs.getString("wifi_pass", DEFAULT_WIFI_PASS);
  currentApSSID    = prefs.getString("ap_ssid", DEFAULT_AP_SSID);
  currentApPass    = prefs.getString("ap_pass", DEFAULT_AP_PASS);
  localCredVersion = prefs.getULong("cred_ver", 0);
  uint32_t savedSec = prefs.getUInt("interval_sec", 5);

  if (savedSec >= 1 && savedSec <= 60) {
    sendIntervalMs = savedSec * 1000UL;
  }

  prefs.end();

  Serial.println(F("[NVS] Kredensial aktif di memori Flash ESP32:"));
  Serial.printf("      - Target Wi-Fi SSID : '%s'\n", currentWifiSSID.c_str());
  Serial.printf("      - Hotspot ESP32 (AP): '%s'\n", currentApSSID.c_str());
  Serial.printf("      - Password AP       : '%s'\n", currentApPass.c_str());
  Serial.printf("      - Versi Kredensial  : %lu\n", localCredVersion);
}

void saveCredentialsToNVS(const String& ssid, const String& pass, const String& apSsid, const String& apPass, unsigned long newVersion) {
  prefs.begin("biosense", false);
  if (ssid.length() > 0) prefs.putString("wifi_ssid", ssid);
  if (pass.length() > 0) prefs.putString("wifi_pass", pass);
  if (apSsid.length() > 0) prefs.putString("ap_ssid", apSsid);
  if (apPass.length() > 0) prefs.putString("ap_pass", apPass);
  if (newVersion > 0) prefs.putULong("cred_ver", newVersion);
  prefs.end();

  if (ssid.length() > 0) currentWifiSSID = ssid;
  if (pass.length() > 0) currentWifiPass = pass;
  if (apSsid.length() > 0) currentApSSID = apSsid;
  if (apPass.length() > 0) currentApPass = apPass;
  if (newVersion > 0) localCredVersion = newVersion;

  Serial.println(F("[NVS] Kredensial baru berhasil disimpan permanen ke Flash ESP32!"));
}

// ============================================================================
// KONEKSI WI-FI DENGAN AUTO-RECONNECT
// ============================================================================
bool connectToWiFi(unsigned long timeoutMs) {
  Serial.printf("[Wi-Fi] Menghubungkan ke SSID: '%s' ...\n", currentWifiSSID.c_str());

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.begin(currentWifiSSID.c_str(), currentWifiPass.c_str());

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start < timeoutMs)) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[Wi-Fi] BERHASIL TERHUBUNG! IP ESP32: %s\n", WiFi.localIP().toString().c_str());
    return true;
  }

  Serial.println(F("[Wi-Fi] Gagal terhubung ke Wi-Fi target."));
  return false;
}

// ============================================================================
// CARA 2: AKTIFKAN CAPTIVE PORTAL (HOTSPOT MANDIRI DENGAN UI MODERN)
// ============================================================================
void startCaptivePortal() {
  isAPMode = true;
  WiFi.disconnect();
  delay(150);

  WiFi.mode(WIFI_AP);
  if (currentApPass.length() >= 8) {
    WiFi.softAP(currentApSSID.c_str(), currentApPass.c_str());
  } else {
    WiFi.softAP(currentApSSID.c_str()); // Open jika password kosong/<8 char
  }

  delay(400);
  IPAddress apIP = WiFi.softAPIP();

  Serial.println(F("\n=================================================="));
  Serial.println(F(" [CARA 2: HOTSPOT CAPTIVE PORTAL DIAKTIFKAN]"));
  Serial.printf(" Nama Hotspot (SSID): %s\n", currentApSSID.c_str());
  Serial.printf(" Password Hotspot   : %s\n", currentApPass.length() >= 8 ? currentApPass.c_str() : "(Tanpa Password)");
  Serial.printf(" Alamat Web Portal  : http://%s (atau 192.168.4.1)\n", apIP.toString().c_str());
  Serial.println(F(" Buka Wi-Fi di HP/Laptop, hubungkan ke Hotspot di atas!"));
  Serial.println(F("==================================================\n"));

  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(DNS_PORT, "*", apIP);

  server.on("/", HTTP_GET, handlePortalRoot);
  server.on("/save", HTTP_POST, handlePortalSave);
  server.on("/scan", HTTP_GET, handlePortalScan);
  server.on("/data", HTTP_GET, handlePortalData);
  server.on("/status", HTTP_GET, handlePortalData);

  // Captive Portal OS redirection
  server.on("/hotspot-detect.html", HTTP_GET, handlePortalRoot);
  server.on("/generate_204", HTTP_GET, handlePortalRoot);
  server.on("/gen_204", HTTP_GET, handlePortalRoot);
  server.on("/connecttest.txt", HTTP_GET, handlePortalRoot);
  server.onNotFound(handlePortalRoot);

  server.begin();
  Serial.println(F("[Portal] Web Server Captive Portal siap melayani permintaan."));
}

void handlePortalRoot() {
  String html = F("<!DOCTYPE html><html lang='id'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1.0'>");
  html += F("<title>BioSense ITERA — Setup ESP32</title>");
  html += F("<style>");
  html += F("*{box-sizing:border-box;margin:0;padding:0;}");
  html += F("body{font-family:-apple-system,BlinkMacSystemFont,'Plus Jakarta Sans',Roboto,sans-serif;background:#090B10;color:#f4f4f5;padding:16px;line-height:1.5;}");
  html += F(".container{max-width:440px;margin:12px auto;background:#12151E;border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:22px;box-shadow:0 12px 36px rgba(0,0,0,0.6);}");
  html += F(".header{display:flex;align-items:center;gap:10px;margin-bottom:14px;}");
  html += F(".dot{width:10px;height:10px;background:#06b6d4;border-radius:50%;box-shadow:0 0 10px #06b6d4;}");
  html += F("h1{font-size:17px;font-weight:700;color:#fff;}");
  html += F(".sub{font-size:11px;color:#94a3b8;margin-bottom:16px;}");
  html += F(".badge{display:inline-block;padding:3px 9px;background:rgba(6,182,212,0.15);color:#38bdf8;border:1px solid rgba(6,182,212,0.3);border-radius:6px;font-size:10px;font-family:monospace;margin-bottom:14px;}");
  
  // Sensor live preview
  html += F(".sensor-box{background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;margin-bottom:18px;display:grid;grid-template-cols:1fr 1fr;grid-template-columns:1fr 1fr;gap:10px;}");
  html += F(".s-item{text-align:center;}");
  html += F(".s-label{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;}");
  html += F(".s-val{font-size:18px;font-weight:700;color:#38bdf8;font-family:monospace;margin-top:2px;}");
  html += F(".s-val-p{color:#10b981;}");

  // Form styles
  html += F(".sec-title{font-size:12px;font-weight:700;color:#e2e8f0;margin:14px 0 8px;display:flex;align-items:center;gap:6px;}");
  html += F(".sec-badge{font-size:9px;background:#334155;color:#94a3b8;padding:2px 6px;border-radius:4px;font-weight:normal;}");
  html += F("label{display:block;font-size:11px;font-weight:600;color:#cbd5e1;margin-bottom:5px;}");
  html += F("input,select{width:100%;padding:10px 12px;background:#090B10;border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;font-size:13px;font-family:inherit;margin-bottom:12px;transition:0.2s;}");
  html += F("input:focus,select:focus{border-color:#06b6d4;outline:none;box-shadow:0 0 0 2px rgba(6,182,212,0.2);}");
  html += F(".btn{width:100%;padding:12px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:0.2s;display:flex;align-items:center;justify-content:center;gap:6px;}");
  html += F(".btn-primary{background:linear-gradient(135deg,#0284c7,#06b6d4);color:#fff;box-shadow:0 4px 12px rgba(6,182,212,0.3);margin-top:8px;}");
  html += F(".btn-primary:active{transform:scale(0.98);}");
  html += F(".btn-scan{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#38bdf8;padding:9px;font-size:12px;margin-bottom:12px;}");
  html += F(".footer{font-size:10px;text-align:center;color:#64748b;margin-top:16px;}");
  html += F("</style></head><body>");

  html += F("<div class='container'>");
  html += F("<div class='header'><div class='dot'></div><h1>BioSense ITERA — Setup</h1></div>");
  html += F("<div class='badge'>📡 Hotspot Mandiri ESP32 (Cara 2)</div>");
  html += F("<p class='sub'>Atur nama Wi-Fi target serta ganti nama/password hotspot alat ini secara instan.</p>");

  // Live sensor box
  html += F("<div class='sensor-box'>");
  html += F("<div class='s-item'><div class='s-label'>Suhu Reaktor</div><div class='s-val'>");
  html += String(lastTempC, 1);
  html += F(" °C</div></div>");
  html += F("<div class='s-item'><div class='s-label'>Tekanan Gas</div><div class='s-val s-val-p'>");
  html += String(lastPresKpa, 1);
  html += F(" kPa</div></div>");
  html += F("</div>");

  html += F("<button class='btn btn-scan' type='button' onclick='scanWifi()'>🔍 Pindai Jaringan Wi-Fi Sekitar</button>");
  html += F("<div id='scanResults' style='margin-bottom:10px;'></div>");

  html += F("<form action='/save' method='POST'>");

  html += F("<div class='sec-title'>1. Wi-Fi Target (Untuk Internet) <span class='sec-badge'>Station</span></div>");
  html += F("<label>Nama Wi-Fi / Hotspot HP (SSID)</label>");
  html += "<input type='text' id='ssid' name='ssid' value='" + currentWifiSSID + "' required placeholder='Nama Hotspot HP Anda'>";

  html += F("<label>Password Wi-Fi Target</label>");
  html += "<input type='password' id='pass' name='pass' value='" + currentWifiPass + "' placeholder='Kosongkan jika tanpa password'>";

  html += F("<div class='sec-title' style='margin-top:16px;'>2. Hotspot Mandiri ESP32 <span class='sec-badge' style='background:rgba(245,158,11,0.2);color:#fbbf24;'>Bisa Kustom</span></div>");
  html += F("<label>Nama Hotspot ESP32 (AP SSID)</label>");
  html += "<input type='text' name='ap_ssid' value='" + currentApSSID + "' required placeholder='Contoh: bIoTeragas atau BioSense-AP'>";

  html += F("<label>Password Hotspot (Min. 8 Karakter)</label>");
  html += "<input type='text' name='ap_pass' value='" + currentApPass + "' placeholder='Minimal 8 karakter'>";

  html += F("<button type='submit' class='btn btn-primary'>💾 Simpan & Sambungkan ESP32</button>");
  html += F("</form>");

  html += F("<div class='footer'>BioSense ITERA PKM Fisika • ESP32 Flash NVS</div>");

  html += F("<script>");
  html += F("function scanWifi(){");
  html += F("  const el = document.getElementById('scanResults');");
  html += F("  el.innerHTML = '<span style=\"color:#38bdf8;font-size:11px;\">Memindai sinyal 2.4 GHz...</span>';");
  html += F("  fetch('/scan').then(r=>r.json()).then(data=>{");
  html += F("    if(!data.length){ el.innerHTML = '<span style=\"color:#ef4444;font-size:11px;\">Tidak ada sinyal Wi-Fi ditemukan.</span>'; return; }");
  html += F("    let s = '<select onchange=\"document.getElementById(\\'ssid\\').value=this.value;\"><option value=\"\">-- Pilih Wi-Fi Terdeteksi --</option>';");
  html += F("    data.forEach(w=>{ s += `<option value=\"${w.ssid}\">${w.ssid} (${w.rssi} dBm)</option>`; });");
  html += F("    s += '</select>';");
  html += F("    el.innerHTML = s;");
  html += F("  }).catch(()=>{ el.innerHTML = '<span style=\"color:#ef4444;font-size:11px;\">Gagal memindai.</span>'; });");
  html += F("}");
  html += F("</script>");

  html += F("</div></body></html>");

  server.send(200, "text/html", html);
}

void handlePortalScan() {
  int n = WiFi.scanNetworks();
  DynamicJsonDocument doc(2048);
  JsonArray arr = doc.to<JsonArray>();

  for (int i = 0; i < n; ++i) {
    JsonObject obj = arr.createNestedObject();
    obj["ssid"] = WiFi.SSID(i);
    obj["rssi"] = WiFi.RSSI(i);
  }

  String json;
  serializeJson(doc, json);
  server.send(200, "application/json", json);
}

void handlePortalSave() {
  String newSsid   = server.hasArg("ssid") ? server.arg("ssid") : "";
  String newPass   = server.hasArg("pass") ? server.arg("pass") : "";
  String newApSsid = server.hasArg("ap_ssid") ? server.arg("ap_ssid") : "";
  String newApPass = server.hasArg("ap_pass") ? server.arg("ap_pass") : "";

  // JANGAN trim sembarangan jika SSID mengandung spasi ganda seperti "FANRA  4G"
  if (newSsid.length() == 0) {
    server.send(400, "text/plain", "Error: SSID Wi-Fi tidak boleh kosong!");
    return;
  }

  // Buat versi kredensial baru berbasis timestamp / millis
  unsigned long newVer = (unsigned long)time(nullptr);
  if (newVer < 1000) newVer = millis();

  saveCredentialsToNVS(newSsid, newPass, newApSsid, newApPass, newVer);

  String html = F("<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1.0'>");
  html += F("<title>Tersimpan</title><style>body{background:#090B10;color:#fff;font-family:sans-serif;text-align:center;padding:40px 20px;}h2{color:#38bdf8;margin-bottom:10px;}p{color:#94a3b8;font-size:13px;line-height:1.6;}</style></head><body>");
  html += F("<h2>✅ Berhasil Disimpan ke Flash ESP32!</h2>");
  html += "<p>Hotspot <b>" + newApSsid + "</b> & Wi-Fi <b>" + newSsid + "</b> telah disimpan permanen.</p>";
  html += F("<p>ESP32 sedang melakukan restart untuk menyambung ke Wi-Fi baru...</p>");
  html += F("</body></html>");

  server.send(200, "text/html", html);
  delay(1500);
  ESP.restart();
}

void handlePortalData() {
  DynamicJsonDocument doc(512);
  doc["temperatureC"] = lastTempC;
  doc["pressureKpa"]  = lastPresKpa;
  doc["rawPressure"]  = lastRawPres;
  doc["wifi_ssid"]    = currentWifiSSID;
  doc["ap_ssid"]      = currentApSSID;
  doc["mode"]         = isAPMode ? "ap_portal" : "station";

  String json;
  serializeJson(doc, json);
  server.send(200, "application/json", json);
}

// ============================================================================
// CARA 3: PENGECEKAN REMOTE CONFIG CLOUD DARI FIRESTORE (DENGAN VERSIONING)
// ============================================================================
void checkRemoteDeviceConfig() {
  if (!refreshFirebaseAuthToken()) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;

  String url = String("https://firestore.googleapis.com/v1/projects/") +
               FIREBASE_PROJECT_ID +
               "/databases/" +
               FIRESTORE_DB_ID +
               "/documents/device_settings/esp32_config";

  if (!https.begin(client, url)) return;

  https.addHeader("Authorization", String("Bearer ") + firebaseIdToken);

  int httpCode = https.GET();
  if (httpCode == 200) {
    String resBody = https.getString();
    DynamicJsonDocument doc(2048);
    DeserializationError err = deserializeJson(doc, resBody);
    if (!err && doc.containsKey("fields")) {
      JsonObject fields = doc["fields"];

      // 1. Cek Interval Pengiriman
      if (fields.containsKey("send_interval_sec")) {
        long sec = 0;
        if (fields["send_interval_sec"].containsKey("integerValue")) {
          sec = atol(fields["send_interval_sec"]["integerValue"]);
        } else if (fields["send_interval_sec"].containsKey("doubleValue")) {
          sec = (long)fields["send_interval_sec"]["doubleValue"];
        }
        if (sec >= 1 && sec <= 60) {
          unsigned long newMs = (unsigned long)sec * 1000UL;
          if (newMs != sendIntervalMs) {
            sendIntervalMs = newMs;
            prefs.begin("biosense", false);
            prefs.putUInt("interval_sec", (uint32_t)sec);
            prefs.end();
            Serial.printf("[Cloud Config] Interval diperbarui dari Web: %ld detik\n", sec);
          }
        }
      }

      // 2. Cek Kredensial Wi-Fi & AP dengan VERSIONING
      // Hanya terapkan jika ada update baru yang dikirim dari Web (credentials_version > localCredVersion)
      unsigned long cloudVer = 0;
      if (fields.containsKey("credentials_version")) {
        if (fields["credentials_version"].containsKey("integerValue")) {
          cloudVer = strtoul(fields["credentials_version"]["integerValue"], nullptr, 10);
        } else if (fields["credentials_version"].containsKey("doubleValue")) {
          cloudVer = (unsigned long)fields["credentials_version"]["doubleValue"];
        }
      }

      if (cloudVer > 0 && cloudVer > localCredVersion) {
        String newWifiSsid = currentWifiSSID;
        String newWifiPass = currentWifiPass;
        String newApSsid   = currentApSSID;
        String newApPass   = currentApPass;

        if (fields.containsKey("wifi_ssid") && fields["wifi_ssid"].containsKey("stringValue")) {
          newWifiSsid = String((const char*)fields["wifi_ssid"]["stringValue"]);
        }
        if (fields.containsKey("wifi_pass") && fields["wifi_pass"].containsKey("stringValue")) {
          newWifiPass = String((const char*)fields["wifi_pass"]["stringValue"]);
        }
        if (fields.containsKey("ap_ssid") && fields["ap_ssid"].containsKey("stringValue")) {
          newApSsid = String((const char*)fields["ap_ssid"]["stringValue"]);
        }
        if (fields.containsKey("ap_pass") && fields["ap_pass"].containsKey("stringValue")) {
          newApPass = String((const char*)fields["ap_pass"]["stringValue"]);
        }

        Serial.println(F("[Cloud Config] Perintah Kredensial Baru Diterima dari Web!"));
        saveCredentialsToNVS(newWifiSsid, newWifiPass, newApSsid, newApPass, cloudVer);
        Serial.println(F("[Cloud Config] Me-restart ESP32 untuk menerapkan koneksi baru..."));
        delay(1000);
        ESP.restart();
      }
    }
  }
  https.end();
}

// Sinkronkan Nama Hotspot & Wi-Fi lokal ke Firestore saat pertama kali online
void syncLocalConfigToFirestore() {
  if (!refreshFirebaseAuthToken()) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;

  String url = String("https://firestore.googleapis.com/v1/projects/") +
               FIREBASE_PROJECT_ID +
               "/databases/" +
               FIRESTORE_DB_ID +
               "/documents/device_settings/esp32_config?updateMask.fieldPaths=wifi_ssid&updateMask.fieldPaths=ap_ssid&updateMask.fieldPaths=last_synced_from&updateMask.fieldPaths=updated_at";

  if (!https.begin(client, url)) return;

  https.addHeader("Content-Type", "application/json");
  https.addHeader("Authorization", String("Bearer ") + firebaseIdToken);

  DynamicJsonDocument doc(1024);
  JsonObject fields = doc.createNestedObject("fields");

  JsonObject fWifi = fields.createNestedObject("wifi_ssid");
  fWifi["stringValue"] = currentWifiSSID;

  JsonObject fAp = fields.createNestedObject("ap_ssid");
  fAp["stringValue"] = currentApSSID;

  JsonObject fFrom = fields.createNestedObject("last_synced_from");
  fFrom["stringValue"] = "esp32_hardware";

  JsonObject fUp = fields.createNestedObject("updated_at");
  char rfc[32];
  if (getRFC3339Timestamp(rfc, sizeof(rfc))) {
    fUp["timestampValue"] = rfc;
  } else {
    fUp["stringValue"] = "online";
  }

  String reqBody;
  serializeJson(doc, reqBody);

  int httpCode = https.PATCH(reqBody);
  https.end();

  if (httpCode == 200) {
    Serial.printf("[Cloud Sync] Nama Hotspot '%s' & Wi-Fi '%s' berhasil sinkron ke Web!\n",
                  currentApSSID.c_str(), currentWifiSSID.c_str());
  }
}

// ============================================================================
// PEMBACAAN RAW SENSOR HX710B (24-bit ADC)
// ============================================================================
bool readHX710B(long &rawValue) {
  unsigned long start = millis();
  while (digitalRead(PIN_HX710B_DOUT) == HIGH) {
    if (millis() - start > 250) {
      return false; // Timeout
    }
    delayMicroseconds(10);
  }

  unsigned long data = 0;
  for (uint8_t i = 0; i < 24; ++i) {
    digitalWrite(PIN_HX710B_SCK, HIGH);
    delayMicroseconds(1);
    data = (data << 1) | (digitalRead(PIN_HX710B_DOUT) & 0x01);
    digitalWrite(PIN_HX710B_SCK, LOW);
    delayMicroseconds(1);
  }

  // Pulsa ke-25 untuk set mode gain 128 / 10Hz
  digitalWrite(PIN_HX710B_SCK, HIGH);
  delayMicroseconds(1);
  digitalWrite(PIN_HX710B_SCK, LOW);
  delayMicroseconds(1);

  if (data & 0x800000) {
    rawValue = (long)(data | 0xFF000000);
  } else {
    rawValue = (long)data;
  }

  return true;
}

// ============================================================================
// WAKTU RFC 3339 UTC DARI NTP
// ============================================================================
bool getRFC3339Timestamp(char* buffer, size_t maxLen) {
  time_t now = time(nullptr);
  if (now < 1704067200) {
    return false;
  }
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  strftime(buffer, maxLen, "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return true;
}

// ============================================================================
// AUTENTIKASI KE FIREBASE AUTH (REST API)
// ============================================================================
bool refreshFirebaseAuthToken() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  if (firebaseIdToken.length() > 0 && millis() < tokenExpiresAtMs) {
    return true;
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;

  String url = String("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=") + FIREBASE_API_KEY;

  if (!https.begin(client, url)) return false;

  https.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> reqDoc;
  reqDoc["email"] = DEVICE_EMAIL;
  reqDoc["password"] = DEVICE_PASS;
  reqDoc["returnSecureToken"] = true;

  String reqBody;
  serializeJson(reqDoc, reqBody);

  int httpCode = https.POST(reqBody);
  String resBody = https.getString();
  https.end();

  if (httpCode != 200) {
    Serial.printf("[Auth] Gagal login! HTTP: %d\n", httpCode);
    return false;
  }

  DynamicJsonDocument resDoc(2048);
  DeserializationError err = deserializeJson(resDoc, resBody);
  if (err) return false;

  const char* idToken = resDoc["idToken"];
  const char* expiresIn = resDoc["expiresIn"];

  if (!idToken) return false;

  firebaseIdToken = String(idToken);
  unsigned long ttlSeconds = expiresIn ? atol(expiresIn) : 3600;
  tokenExpiresAtMs = millis() + ((ttlSeconds > 60 ? ttlSeconds - 60 : 30) * 1000UL);

  return true;
}

// ============================================================================
// PENGIRIMAN DATA KE FIRESTORE
// ============================================================================
bool sendDataToFirestore(float tempC, long rawPressure, float pKpa, float pBar, float pPsi, const char* rfcTime) {
  if (!refreshFirebaseAuthToken()) {
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;

  String docId = "esp32_" + String(time(nullptr)) + "_" + String(millis() % 1000);
  String url = String("https://firestore.googleapis.com/v1/projects/") +
               FIREBASE_PROJECT_ID +
               "/databases/" +
               FIRESTORE_DB_ID +
               "/documents/sensor_readings?documentId=" + docId;

  if (!https.begin(client, url)) return false;

  https.addHeader("Content-Type", "application/json");
  https.addHeader("Authorization", String("Bearer ") + firebaseIdToken);

  DynamicJsonDocument doc(1536);
  JsonObject fields = doc.createNestedObject("fields");

  JsonObject fTemp = fields.createNestedObject("temperature");
  fTemp["doubleValue"] = tempC;

  JsonObject fPkpa = fields.createNestedObject("pressure_kpa");
  fPkpa["doubleValue"] = pKpa;

  JsonObject fPbar = fields.createNestedObject("pressure_bar");
  fPbar["doubleValue"] = pBar;

  JsonObject fPpsi = fields.createNestedObject("pressure_psi");
  fPpsi["doubleValue"] = pPsi;

  JsonObject fRaw = fields.createNestedObject("raw_pressure");
  fRaw["integerValue"] = String(rawPressure);

  JsonObject fTime = fields.createNestedObject("timestamp");
  fTime["timestampValue"] = rfcTime;

  String reqBody;
  serializeJson(doc, reqBody);

  int httpCode = https.POST(reqBody);
  https.end();

  if (httpCode == 200 || httpCode == 201) {
    Serial.println(F("[Firestore] Data sensor BERHASIL tersimpan!"));
    return true;
  } else {
    Serial.printf("[Firestore] GAGAL kirim! HTTP Code: %d\n", httpCode);
    return false;
  }
}

// ============================================================================
// ARDUINO SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\n=================================================="));
  Serial.println(F(" BioSense ITERA — ESP32 Dual-Config Edition v2.0"));
  Serial.println(F("=================================================="));

  pinMode(PIN_HX710B_DOUT, INPUT_PULLUP);
  pinMode(PIN_HX710B_SCK, OUTPUT);
  digitalWrite(PIN_HX710B_SCK, LOW);
  dht.begin();

  // 1. Muat Kredensial dari NVS Flash
  loadCredentialsFromNVS();

  // 2. Coba konek ke Wi-Fi Target (Timeout 18 detik)
  bool wifiOk = connectToWiFi(18000);

  if (!wifiOk) {
    // CARA 2: Jika gagal konek, nyalakan Hotspot Captive Portal otomatis
    Serial.println(F("[Setup] Wi-Fi tidak ditemukan. Mengaktifkan Hotspot Mandiri (Cara 2)..."));
    startCaptivePortal();
  } else {
    isAPMode = false;
    configTime(0, 0, "time.google.com", "id.pool.ntp.org", "pool.ntp.org");
    Serial.print(F("[NTP] Menunggu sinkronisasi waktu"));
    time_t now = time(nullptr);
    uint8_t ntpRetries = 0;
    while (now < 1704067200 && ntpRetries < 25) {
      delay(500);
      Serial.print('.');
      now = time(nullptr);
      ntpRetries++;
    }
    Serial.println();

    // Sinkronkan Nama Hotspot dan Wi-Fi lokal ke Cloud agar Web ikut terupdate
    syncLocalConfigToFirestore();
  }
}

// ============================================================================
// ARDUINO LOOP
// ============================================================================
void loop() {
  // A. JIKA SEDANG DI MODE HOTSPOT CAPTIVE PORTAL (CARA 2)
  if (isAPMode) {
    dnsServer.processNextRequest();
    server.handleClient();

    // Baca sensor berkala agar live preview di portal http://192.168.4.1 selalu akurat
    static unsigned long lastLocalSensorRead = 0;
    if (millis() - lastLocalSensorRead > 2000) {
      lastLocalSensorRead = millis();
      float temp = dht.readTemperature();
      if (!isnan(temp)) lastTempC = temp;
      long rawP = 0;
      if (readHX710B(rawP)) {
        lastRawPres = rawP;
        float gaugeKpa = (float)(rawP - CALIBRATION_OFFSET_ZERO) / CALIBRATION_COUNTS_KPA;
        if (gaugeKpa < 0.0f) gaugeKpa = 0.0f;
        lastPresKpa = ATMOSPHERIC_PRESSURE_KPA + gaugeKpa;
      }
    }
    return;
  }

  // B. JIKA SEDANG DI MODE ONLINE STATION (CARA 3)
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long disconnectStart = 0;
    if (disconnectStart == 0) {
      disconnectStart = millis();
      Serial.println(F("[Wi-Fi] Terputus. Menunggu auto-reconnect..."));
    }

    // Jika terputus lebih dari 25 detik, otomatis aktifkan Hotspot Mandiri
    if (millis() - disconnectStart > 25000) {
      Serial.println(F("[Wi-Fi] Terputus > 25 detik. Beralih ke Hotspot Mandiri (Cara 2)..."));
      startCaptivePortal();
      disconnectStart = 0;
      return;
    }

    delay(1000);
    return;
  }

  // Cek waktu NTP
  char rfcTimestamp[32];
  if (!getRFC3339Timestamp(rfcTimestamp, sizeof(rfcTimestamp))) {
    delay(2000);
    return;
  }

  // Cek Remote Config Cloud dari Web (Cara 3) tiap 30 detik
  if (millis() - lastConfigCheckTime >= CONFIG_CHECK_INTERVAL_MS || lastConfigCheckTime == 0) {
    lastConfigCheckTime = millis();
    checkRemoteDeviceConfig();
  }

  // Eksekusi pengiriman data sesuai interval
  unsigned long currentMs = millis();
  if (currentMs - lastSendTime >= sendIntervalMs) {
    lastSendTime = currentMs;

    float temperature = dht.readTemperature();
    if (isnan(temperature)) temperature = 0.0f;
    lastTempC = temperature;

    long rawPressure = 0;
    bool hxReady = readHX710B(rawPressure);
    float pressureKpa = 0.0f;
    float pressureBar = 0.0f;
    float pressurePsi = 0.0f;

    if (hxReady) {
      lastRawPres = rawPressure;
      if (IS_PRESSURE_CALIBRATED) {
        float gaugeKpa = (float)(rawPressure - CALIBRATION_OFFSET_ZERO) / CALIBRATION_COUNTS_KPA;
        if (gaugeKpa < 0.0f) gaugeKpa = 0.0f;
        pressureKpa = ATMOSPHERIC_PRESSURE_KPA + gaugeKpa;
        pressureBar = pressureKpa / 100.0f;
        pressurePsi = pressureKpa * 0.145038f;
        lastPresKpa = pressureKpa;
      }
    }

    Serial.println(F("-------------------------------------------"));
    Serial.printf("[Sensor] Suhu: %.1f C | Tekanan: %.2f kPa | Raw: %ld\n", temperature, pressureKpa, rawPressure);

    sendDataToFirestore(temperature, rawPressure, pressureKpa, pressureBar, pressurePsi, rfcTimestamp);
  }
}
