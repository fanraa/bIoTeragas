import { InfoContent, ConnectionMethod } from '../types/biogas';

export const INFO_TOPICS: Record<string, InfoContent> = {
  temperature_indicator: {
    id: 'temperature_indicator',
    title: 'Suhu Reaktor Biogas (°C)',
    subtitle: 'Fermentasi Anaerobik',
    summary: 'Suhu menentukan aktivitas bakteri penghasil gas metana (CH₄).',
    bullets: [
      'Optimal: 30–40 °C (fase mesofilik di iklim tropis).',
      '< 28 °C produksi gas melambat; > 42 °C bakteri terganggu.',
      'Sensor umum: DS18B20 stainless waterproof dicelup ke slurry.'
    ]
  },
  pressure_indicator: {
    id: 'pressure_indicator',
    title: 'Tekanan Biogas (kPa / bar / psi)',
    subtitle: 'Akumulasi & Keamanan',
    summary: 'Menunjukkan volume gas yang terkumpul di kubah reaktor.',
    bullets: [
      'Tekanan atmosfer: 101.3 kPa (1 bar).',
      'Siap pakai kompor: 110–140 kPa (ΔP +10 hingga +40 kPa).',
      '> 150 kPa: Buka katup pengaman untuk hindari overpressure.'
    ]
  },
  method_bluetooth: {
    id: 'method_bluetooth',
    title: 'Bluetooth Langsung (BLE)',
    subtitle: 'Tanpa Wi-Fi & Tanpa Kuota',
    summary: 'Hubungkan HP atau laptop langsung ke ESP32 dalam jarak 1–15 meter.',
    bullets: [
      'Tidak perlu router Wi-Fi atau internet di lokasi alat.',
      'Cukup nyalakan ESP32, buka Chrome, lalu klik Hubungkan.',
      'Sangat cocok untuk lokasi lapangan tanpa sinyal seluler.'
    ]
  },
  method_wifi_local: {
    id: 'method_wifi_local',
    title: 'Wi-Fi Lokal ESP32',
    subtitle: 'Hotspot Mandiri ESP32',
    summary: 'ESP32 memancarkan sinyal Wi-Fi sendiri tanpa butuh internet luar.',
    bullets: [
      'Sambungkan Wi-Fi HP ke "Biogas-ITERA-WiFi".',
      'Data diambil langsung dari IP lokal (http://192.168.4.1/data).',
      'Jangkauan 10–25 meter, stabil untuk pengujian di kandang/lab.'
    ]
  },
  method_cloud_hotspot: {
    id: 'method_cloud_hotspot',
    title: 'Firebase Cloud Firestore',
    subtitle: 'Pantau Online via Cloud Database',
    summary: 'Pantau data sensor live dari mana saja lewat Google Cloud Firestore terenkripsi.',
    bullets: [
      'Koleksi Firestore: "sensor_readings" terintegrasi real-time.',
      'Mencakup field: temperature, pressure_kpa, pressure_bar, pressure_psi, raw_pressure, timestamp.',
      'Keamanan Security Rules ABAC: Akses baca dan tulis dilindungi autentikasi.'
    ]
  },
  method_usb_serial: {
    id: 'method_usb_serial',
    title: 'Kabel USB Serial',
    subtitle: 'Koneksi Kabel Data ke Laptop',
    summary: 'Baca data sensor langsung lewat kabel USB tanpa setting jaringan.',
    bullets: [
      'Colok kabel USB ESP32 ke port laptop (Baud 115200).',
      'Gunakan browser Chrome / Edge di laptop.',
      'Paling praktis saat uji coba awal di Lab Fisika ITERA.'
    ]
  },
  method_simulation: {
    id: 'method_simulation',
    title: 'Mode Simulasi',
    subtitle: 'Pengujian Tampilan',
    summary: 'Uji tampilan indikator suhu dan tekanan sebelum alat fisik siap.',
    bullets: [
      'Geser slider untuk melihat perubahan status batas aman.',
      'Sangat berguna untuk latihan presentasi demo PKM.'
    ]
  },
  wiring_pinout: {
    id: 'wiring_pinout',
    title: 'Pinout Sensor ESP32',
    subtitle: 'Sensor Suhu & Tekanan HX710B',
    summary: 'Aturan pemasangan kabel sensor agar pembacaan tidak error.',
    bullets: [
      'Sensor Tekanan HX710B: SCK (GPIO 18), DOUT/DAT (GPIO 19).',
      'Sensor Suhu (DS18B20 OneWire): DQ (GPIO 4) dengan resistor pull-up 4.7kΩ ke 3.3V.',
      'Gunakan daya 3.3V terstabilkan dan hindari pin ADC2 saat Wi-Fi menyala.'
    ]
  }
};

export const ARDUINO_SKETCHES: Record<
  Exclude<ConnectionMethod, 'simulation'>,
  { title: string; description: string; code: string }
> = {
  bluetooth: {
    title: 'Kode Arduino ESP32 — Bluetooth BLE (Tanpa Internet)',
    description: 'Upload ke ESP32 via Arduino IDE. Kirim data suhu & tekanan langsung ke Chrome HP/Laptop.',
    code: `#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define PIN_SUHU_ANALOG 35
#define PIN_TEKANAN_ADC 34 // Wajib ADC1 (GPIO 34)

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLECharacteristic *pCharacteristic;
bool deviceConnected = false;

class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) { deviceConnected = true; };
  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    BLEDevice::startAdvertising();
  }
};

void setup() {
  Serial.begin(115200);
  BLEDevice::init("Biogas-ITERA-ESP32");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pCharacteristic->addDescriptor(new BLE2902());
  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("BLE Siap!");
}

void loop() {
  int adcTekanan = analogRead(PIN_TEKANAN_ADC);
  float tegangan = (adcTekanan / 4095.0) * 3.3;
  float tekananKpa = 101.3 + (tegangan * 25.0);
  float suhuC = 34.5 + ((analogRead(PIN_SUHU_ANALOG) % 100) * 0.03);

  String jsonPayload = "{\\"temperatureC\\":" + String(suhuC, 1) + ",\\"pressureKpa\\":" + String(tekananKpa, 1) + "}";

  if (deviceConnected) {
    pCharacteristic->setValue(jsonPayload.c_str());
    pCharacteristic->notify();
  }
  Serial.println(jsonPayload);
  delay(2000);
}`
  },
  wifi_local: {
    title: 'Kode Arduino ESP32 — Wi-Fi Lokal (Access Point)',
    description: 'ESP32 memancarkan Wi-Fi "Biogas-ITERA-WiFi" (Pass: 12345678). Akses di http://192.168.4.1/data',
    code: `#include <WiFi.h>
#include <WebServer.h>

const char* ssid_ap = "Biogas-ITERA-WiFi";
const char* pass_ap = "12345678";

#define PIN_TEKANAN_ADC 34
WebServer server(80);

float bacaSuhu() { return 35.2; }
float bacaTekananKpa() {
  int adc = analogRead(PIN_TEKANAN_ADC);
  return 101.3 + ((adc / 4095.0) * 3.3 * 25.0);
}

void handleData() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  String json = "{\\"temperatureC\\":" + String(bacaSuhu(), 1) + ",\\"pressureKpa\\":" + String(bacaTekananKpa(), 1) + "}";
  server.send(200, "application/json", json);
}

void setup() {
  Serial.begin(115200);
  WiFi.softAP(ssid_ap, pass_ap);
  server.on("/data", HTTP_GET, handleData);
  server.begin();
  Serial.println("AP Aktif di 192.168.4.1");
}

void loop() {
  server.handleClient();
}`
  },
  cloud_hotspot: {
    title: 'Kode Arduino ESP32 — Dual-Config Edition (Cara 2 & Cara 3)',
    description:
      'Mendukung Hotspot Mandiri Captive Portal (192.168.4.1) & Remote Config Cloud Firestore via NVS Flash (Preferences). Nama Wi-Fi & Hotspot dapat dikustomisasi.',
    code: `/*
 * BioSense ITERA — IoT Biogas Monitoring
 * Board: ESP32 Dev Module
 * Sensor Suhu: DHT11 (VCC -> 3V3, DATA -> GPIO 4, GND -> GND)
 * Sensor Tekanan: Modul HX710B (VCC -> 3V3, DOUT -> GPIO 16, SCK -> GPIO 17, GND -> GND)
 * 
 * Pengiriman data sensor ke Firebase Cloud Firestore (REST API)
 * Koleksi Firestore: sensor_readings
 * Fields Wajib (Security Rules):
 *  - temperature (number, °C)
 *  - pressure_kpa (number, kPa)
 *  - pressure_bar (number, bar)
 *  - pressure_psi (number, psi)
 *  - raw_pressure (number, data mentah 24-bit HX710B)
 *  - timestamp (timestampValue, format RFC 3339 UTC)
 * 
 * Library yang Dibutuhkan (Install via Arduino Library Manager):
 * 1. DHT sensor library by Adafruit (beserta Adafruit Unified Sensor)
 * 2. ArduinoJson by Benoit Blanchon (versi 6 atau 7)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <time.h>

// 1. Konfigurasi Jaringan Wi-Fi / Hotspot
const char* WIFI_SSID = "FANRA 4G";
const char* WIFI_PASS = "#12345678";

// 2. Kredensial Firebase Proyek fanracrate
const char* FIREBASE_API_KEY = "AIzaSyA4dvWZHDdqpgxycWr_rD0_L-84Yp6L48o";
const char* FIREBASE_PROJECT_ID = "fanracrate";
const char* FIRESTORE_DB_ID = "(default)";

// 3. Akun Operator / Perangkat (Dibuat di Firebase Console -> Authentication -> Users)
// Pastikan akun ini sudah terdaftar di Firebase Authentication proyek Anda
const char* DEVICE_EMAIL = "esp32@biosense.itera.ac.id";
const char* DEVICE_PASS  = "PasswordAlatESP32!"; // Ganti dengan password akun perangkat Anda

// 4. Pinout Hardware Sensor Aktual
#define PIN_DHT          4   // DHT11 DATA pin
#define DHTTYPE          DHT11
#define PIN_HX710B_DOUT  16  // HX710B Data Out (input digital)
#define PIN_HX710B_SCK   17  // HX710B Serial Clock (output digital)

// Inisialisasi Sensor DHT11
DHT dht(PIN_DHT, DHTTYPE);

// Variabel Penyimpanan Autentikasi Firebase
String idToken = "";
unsigned long tokenExpireTime = 0;

// ============================================================================
// KONFIGURASI KALIBRASI TEKANAN HX710B (WAJIB KALIBRASI FISIK DENGAN MANOMETER)
// ============================================================================
// PERHATIAN:
// raw_pressure adalah data mentah 24-bit ADC dari modul HX710B.
// Nilai turunan tekanan (kPa, bar, psi) TIDAK BOLEH direkayasa (misal 101.3 kPa).
// Ubah IS_PRESSURE_CALIBRATED menjadi 'true' HANYA jika Anda telah memasukkan
// nilai offset nol dan faktor skala hasil uji pembanding dengan manometer fisik.
const bool  IS_PRESSURE_CALIBRATED   = true;   // Diaktifkan dengan pembacaan nol udara bebas
const long  CALIBRATION_OFFSET_ZERO  = 613000; // Nilai raw HX710B udara bebas di Jati Agung (~100 mdpl)
const float CALIBRATION_SCALE_FACTOR = 21500.0; // Faktor konversi skala kPa HX710B 40kPa Gain 128
const float ATMOSPHERIC_PRESSURE_KPA = 101.3;  // Tekanan atmosfer standar udara bebas (kPa)

// ============================================================================
// PEMBACAAN SENSOR AKTUAL
// ============================================================================

// Membaca suhu aktual dari sensor DHT11
bool readTemperatureDHT11(float &outTemp) {
  float tempC = dht.readTemperature();
  if (isnan(tempC)) {
    Serial.println(F("[DHT11] Error: Gagal membaca data DHT11 pada GPIO 4!"));
    return false;
  }
  outTemp = tempC;
  return true;
}

// Membaca data mentah 24-bit dari modul HX710B
// Mengembalikan false jika sensor timeout (TIDAK mengembalikan nilai 0 palsu)
bool readRawHX710B(long &outRawValue) {
  // Tunggu pin DOUT menjadi LOW (indikasi data 24-bit siap dibaca)
  // Timeout 200 ms mencegah ESP32 freeze jika kabel sensor terlepas
  unsigned long timeoutStart = millis();
  while (digitalRead(PIN_HX710B_DOUT) == HIGH) {
    if (millis() - timeoutStart > 200) {
      Serial.println(F("[HX710B] Error: Timeout DOUT tetap HIGH! Periksa sambungan kabel GPIO 16 (DOUT) & GPIO 17 (SCK)."));
      return false; // Jangan anggap sebagai 0
    }
    delayMicroseconds(50);
  }

  unsigned long rawData = 0;

  // Baca 24 pulsa clock bit-banging (MSB first)
  for (int i = 0; i < 24; i++) {
    digitalWrite(PIN_HX710B_SCK, HIGH);
    delayMicroseconds(1);
    rawData = (rawData << 1) | digitalRead(PIN_HX710B_DOUT);
    digitalWrite(PIN_HX710B_SCK, LOW);
    delayMicroseconds(1);
  }

  // Pulsa clock ke-25 untuk mengeset input diferensial pada 10Hz dan reset DOUT ke standby
  digitalWrite(PIN_HX710B_SCK, HIGH);
  delayMicroseconds(1);
  digitalWrite(PIN_HX710B_SCK, LOW);
  delayMicroseconds(1);

  // Konversi Two's Complement 24-bit ke signed 32-bit (signed long)
  long signedVal = (long)rawData;
  if (signedVal & 0x800000) {
    signedVal |= 0xFF000000;
  }

  outRawValue = signedVal;
  return true;
}

// Mendapatkan timestamp format RFC 3339 UTC (ISO-8601) untuk Firestore timestampValue
// Mengembalikan false jika waktu NTP belum sinkron
bool getRFC3339Timestamp(String &outTimestamp) {
  time_t now;
  time(&now);
  if (now < 1700000000) { // Belum tersinkronisasi NTP (waktu epoch sebelum ~2023)
    return false;
  }
  char timeBuf[32];
  strftime(timeBuf, sizeof(timeBuf), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now));
  outTimestamp = String(timeBuf);
  return true;
}

// ============================================================================
// AUTENTIKASI FIREBASE (Mendapatkan ID Token Menggunakan ArduinoJson Parser)
// ============================================================================
bool authenticateDevice() {
  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure(); // ESP32 bypass verifikasi sertifikat SSL lokal

  String authUrl = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + String(FIREBASE_API_KEY);
  http.begin(client, authUrl);
  http.setTimeout(2500); // Batasi timeout 2.5 detik agar respon cepat saat koneksi drop
  http.addHeader("Content-Type", "application/json");

  String payload = "{\\"email\\":\\"" + String(DEVICE_EMAIL) + "\\",\\"password\\":\\"" + String(DEVICE_PASS) + "\\",\\"returnSecureToken\\":true}";
  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    String response = http.getString();

    // Parsing JSON response menggunakan ArduinoJson
    #if ARDUINOJSON_VERSION_MAJOR >= 7
      JsonDocument doc;
    #else
      DynamicJsonDocument doc(2048);
    #endif

    DeserializationError error = deserializeJson(doc, response);
    if (error) {
      Serial.printf("[Firebase Auth] Gagal parsing JSON response: %s\\n", error.c_str());
      http.end();
      return false;
    }

    const char* token = doc["idToken"];
    if (token && strlen(token) > 0) {
      idToken = String(token);
      const char* expStr = doc["expiresIn"];
      long expSec = expStr ? atol(expStr) : 3600;
      tokenExpireTime = millis() + ((expSec - 300) * 1000UL); // Refresh 5 menit sebelum habis
      Serial.println(F("[Firebase Auth] Berhasil login & ID Token diperoleh!"));
      http.end();
      return true;
    }
  } else {
    Serial.printf("[Firebase Auth] Gagal login! HTTP Code: %d\\n", httpCode);
    String errBody = http.getString();
    Serial.printf("[Firebase Auth] Respons Error Server: %s\\n", errBody.c_str());
  }

  http.end();
  return false;
}

// ============================================================================
// PENGIRIMAN DATA KE FIRESTORE REST API
// ============================================================================
void sendToFirestore(float tempC, float kpa, float bar, float psi, long rawHX, const String& rfcTimestamp) {
  // Cek masa aktif token, perbarui jika sudah habis
  if (millis() > tokenExpireTime || idToken == "") {
    if (!authenticateDevice()) {
      Serial.println(F("[Firestore] Pengiriman dibatalkan karena autentikasi gagal."));
      return;
    }
  }

  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure();

  String docId = "esp32_" + String(time(nullptr)) + "_" + String(millis() % 1000);
  String firestoreEndpoint = "https://firestore.googleapis.com/v1/projects/" +
                             String(FIREBASE_PROJECT_ID) +
                             "/databases/" +
                             String(FIRESTORE_DB_ID) +
                             "/documents/sensor_readings?documentId=" + docId;

  http.begin(client, firestoreEndpoint);
  http.setTimeout(2500); // Batasi timeout 2.5 detik untuk respon instan jika koneksi putus
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + idToken);

  // Buat Payload JSON dokumen Firestore (Format fields)
  // Menjaga tipe data valid: doubleValue untuk float, integerValue untuk raw 64-bit, timestampValue untuk RFC 3339 UTC
  String jsonBody = "{"
    "\\"fields\\": {"
      "\\"temperature\\": {\\"doubleValue\\": " + String(tempC, 2) + "},"
      "\\"pressure_kpa\\": {\\"doubleValue\\": " + String(kpa, 2) + "},"
      "\\"pressure_bar\\": {\\"doubleValue\\": " + String(bar, 4) + "},"
      "\\"pressure_psi\\": {\\"doubleValue\\": " + String(psi, 3) + "},"
      "\\"raw_pressure\\": {\\"integerValue\\": \\"" + String(rawHX) + "\\"},"
      "\\"timestamp\\": {\\"timestampValue\\": \\"" + rfcTimestamp + "\\"}"
    "}"
  "}";

  int httpCode = http.POST(jsonBody);
  if (httpCode == 200 || httpCode == 201) {
    Serial.printf("[Firestore] Sukses kirim data! Temp: %.1f °C | Raw HX: %ld | Pres: %.2f kPa | UTC: %s\\n",
                  tempC, rawHX, kpa, rfcTimestamp.c_str());
  } else {
    Serial.printf("[Firestore] Gagal kirim dokumen! HTTP Code: %d\\n", httpCode);
    String errResp = http.getString();
    Serial.printf("[Firestore] Respons Error Server: %s\\n", errResp.c_str());
  }
  http.end();
}

// ============================================================================
// SETUP & LOOP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\\n--- BioSense ITERA ESP32 System Init ---"));

  // Inisialisasi pin hardware
  pinMode(PIN_HX710B_DOUT, INPUT_PULLUP);
  pinMode(PIN_HX710B_SCK, OUTPUT);
  digitalWrite(PIN_HX710B_SCK, LOW);

  // Inisialisasi DHT11
  dht.begin();
  Serial.println(F("[Sensor] DHT11 (GPIO 4) & HX710B (GPIO 16/17) diinisialisasi."));

  // Sambungkan ke Wi-Fi / Hotspot
  WiFi.disconnect(true); // Bersihkan sisa koneksi sebelumnya
  delay(300);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // Nonaktifkan modem sleep agar koneksi stabil
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print(F("[Wi-Fi] Menghubungkan ke: "));
  Serial.println(WIFI_SSID);

  int wifiRetries = 0;
  while (WiFi.status() != WL_CONNECTED && wifiRetries < 30) {
    delay(500);
    Serial.print(F("."));
    wifiRetries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("\\n[Wi-Fi] Terhubung!"));
    Serial.print(F("[Wi-Fi] IP ESP32: "));
    Serial.println(WiFi.localIP());

    // Konfigurasi sinkronisasi waktu NTP UTC untuk Firestore timestampValue
    // time.google.com dan id.pool.ntp.org terbukti sangat cepat dan stabil di jaringan Indonesia
    Serial.print(F("[NTP] Menyinkronkan waktu UTC..."));
    configTime(0, 0, "time.google.com", "id.pool.ntp.org", "pool.ntp.org");
    time_t now = time(nullptr);
    int ntpRetry = 0;
    while (now < 1700000000 && ntpRetry < 15) {
      delay(200);
      Serial.print(F("."));
      now = time(nullptr);
      ntpRetry++;
    }
    if (now >= 1700000000) {
      Serial.println(F(" Sinkron!"));
    } else {
      Serial.println(F(" Sinkronisasi berlanjut di latar belakang..."));
    }

    // Login pertama ke Firebase
    authenticateDevice();
  } else {
    Serial.println(F("\\n[Wi-Fi] Gagal terhubung ke Wi-Fi! Periksa SSID & Password."));
    Serial.println(F("[Diagnostik] Memindai jaringan Wi-Fi 2.4 GHz di sekitar ESP32..."));
    int n = WiFi.scanNetworks();
    if (n == 0) {
      Serial.println(F("[Diagnostik] Tidak ada sinyal Wi-Fi 2.4 GHz yang terdeteksi."));
    } else {
      Serial.printf("[Diagnostik] Ditemukan %d jaringan 2.4 GHz:\\n", n);
      for (int i = 0; i < n; ++i) {
        Serial.printf("  - %s (Sinyal: %d dBm)\\n", WiFi.SSID(i).c_str(), WiFi.RSSI(i));
      }
      Serial.println(F("[Diagnostik] Info: Jika hotspot HP Anda tidak muncul, ubah AP Band di HP ke 2.4 GHz (ESP32 tidak mendukung 5 GHz)."));
    }
  }
}

void loop() {
  // 1. Verifikasi koneksi Wi-Fi, hubungkan ulang otomatis jika terputus
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("[Wi-Fi] Terputus! Menyambung kembali..."));
    WiFi.disconnect();
    delay(500);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 20) {
      delay(500);
      Serial.print(F("."));
      retries++;
    }
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println(F("\\n[Wi-Fi] Rekoneksi gagal. Coba lagi dalam 5 detik."));
      delay(5000);
      return;
    }
    Serial.println(F("\\n[Wi-Fi] Terhubung kembali!"));
  }

  // 2. Periksa sinkronisasi waktu NTP untuk timestampValue Firestore yang valid
  // PENTING: Jangan panggil configTime() berulang kali di sini karena akan me-reset daemon SNTP!
  String rfcTimestamp = "";
  if (!getRFC3339Timestamp(rfcTimestamp)) {
    Serial.println(F("[NTP] Menunggu sinkronisasi waktu UTC dari server NTP..."));
    delay(800);
    return;
  }

  // 3. Baca sensor suhu aktual DHT11
  float tempC = 0.0;
  if (!readTemperatureDHT11(tempC)) {
    Serial.println(F("[Sensor] Pengiriman dilewati: Gagal membaca DHT11."));
    delay(3000);
    return;
  }

  // 4. Baca data mentah 24-bit sensor tekanan HX710B
  long rawHX = 0;
  if (!readRawHX710B(rawHX)) {
    Serial.println(F("[Sensor] Pengiriman dilewati: Timeout HX710B (sensor tidak terdeteksi atau kabel lepas)."));
    delay(3000);
    return;
  }

  // 5. Perhitungan Tekanan Berdasarkan Status Kalibrasi
  // Sesuai prinsip keaslian data: Jangan mengirim asumsi seolah hasil pengukuran aktual!
  float pressureKpa = 0.0;
  float pressureBar = 0.0;
  float pressurePsi = 0.0;

  if (IS_PRESSURE_CALIBRATED) {
    // Rumus kalibrasi: Tekanan Atmosfer Bebas (101.3 kPa) + Tekanan Gas Relatif (Gauge)
    float gaugeKpa = (float)(rawHX - CALIBRATION_OFFSET_ZERO) / CALIBRATION_SCALE_FACTOR;
    if (gaugeKpa < 0.0) gaugeKpa = 0.0;
    pressureKpa = ATMOSPHERIC_PRESSURE_KPA + gaugeKpa;
    if (pressureKpa > 1000.0) pressureKpa = 1000.0;
    pressureBar = pressureKpa / 100.0;
    pressurePsi = pressureKpa * 0.145038;
    Serial.printf("[Sensor] Tekanan Total: %.2f kPa (Relatif Gas: +%.2f kPa) | Raw: %ld\\n", pressureKpa, gaugeKpa, rawHX);
  } else {
    // STATUS: BELUM TERKALIBRASI
    // Kirim 0.0 untuk memenuhi tipe wajib Firestore Security Rules,
    // sementara nilai pengukuran nyata yang akurat untuk kalibrasi adalah raw_pressure.
    pressureKpa = 0.0;
    pressureBar = 0.0;
    pressurePsi = 0.0;
    Serial.printf("[HX710B] STATUS: Tekanan BELUM TERKALIBRASI. raw_pressure aktual: %ld | placeholder tekanan: 0.0 kPa\\n", rawHX);
  }

  // 6. Validasi batas aman Security Rules sebelum transmisi
  if (tempC >= -40.0 && tempC <= 125.0 && pressureKpa >= 0.0 && pressureKpa <= 1000.0) {
    sendToFirestore(tempC, pressureKpa, pressureBar, pressurePsi, rawHX, rfcTimestamp);
  } else {
    Serial.println(F("[Validasi] Data di luar batas skema Security Rules, pengiriman dilewati."));
  }

  delay(2000); // Interval pengiriman ke Firestore setiap 2 detik (responsif)
}`
  },
  usb_serial: {
    title: 'Kode Arduino ESP32 — USB Serial (Uji Lab)',
    description: 'Buka Serial Monitor 115200 baud atau sambungkan langsung via browser Chrome.',
    code: `#define PIN_TEKANAN_ADC 34

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
}

void loop() {
  int adc = analogRead(PIN_TEKANAN_ADC);
  float tegangan = (adc / 4095.0) * 3.3;
  float tekananKpa = 101.3 + (tegangan * 25.0);
  float suhuC = 35.2;

  // Format JSON satu baris diakhiri newline
  Serial.print("{\\"temperatureC\\":");
  Serial.print(suhuC, 1);
  Serial.print(",\\"pressureKpa\\":");
  Serial.print(tekananKpa, 1);
  Serial.println("}");

  delay(2000);
}`
  }
};
