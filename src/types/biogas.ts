export type ConnectionMethod =
  | 'simulation'
  | 'bluetooth'
  | 'wifi_local'
  | 'cloud_hotspot'
  | 'usb_serial';

export type PressureUnit = 'kPa' | 'bar' | 'psi';

export interface SensorReading {
  id: string;
  timestamp: string;
  temperatureC: number; // °C
  pressureKpa: number;  // kPa (base unit)
  source: ConnectionMethod;
  pressureBar?: number; // bar
  pressurePsi?: number; // psi
  rawPressure?: number; // data mentah HX710B
  epochMs?: number;     // waktu epoch ms untuk deteksi status ESP32 aktif/mati
}

export interface FirestoreSensorReadingDoc {
  temperature: number;
  pressure_kpa: number;
  pressure_bar: number;
  pressure_psi: number;
  raw_pressure: number;
  timestamp: string | { toDate?: () => Date; seconds?: number; nanoseconds?: number };
}

export interface ThresholdConfig {
  tempMinOptimal: number; // e.g. 30 °C
  tempMaxOptimal: number; // e.g. 40 °C
  tempCritical: number;   // e.g. 45 °C
  pressureMinUse: number; // e.g. 105 kPa (above 101.3 kPa atmospheric)
  pressureMaxSafe: number;// e.g. 140 kPa
  pressureCritical: number;// e.g. 160 kPa
}

export interface ConnectionSettings {
  activeMethod: ConnectionMethod;
  // Wi-Fi Lokal (ESP32 Access Point / Local IP)
  localIpUrl: string;
  pollIntervalSec: number;
  // Cloud / Hotspot HP (Firebase Cloud Firestore / Endpoint)
  cloudEndpointUrl: string;
  // Bluetooth BLE
  bleDeviceName: string;
  bleServiceUuid: string;
  bleCharUuid: string;
  // USB Serial
  serialBaudRate: number;
}

export interface InfoContent {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  bullets: string[];
  tip?: string;
}
