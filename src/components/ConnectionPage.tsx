import React, { useState, useEffect } from 'react';
import {
  Bluetooth,
  Wifi,
  Globe,
  Usb,
  Sliders,
  Copy,
  Check,
  Cpu,
  RefreshCw,
  PlugZap,
  Unplug,
  SlidersHorizontal,
  CircleDot,
  Volume2,
  VolumeX,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  Radio,
  Save,
  Download,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  ConnectionMethod,
  ConnectionSettings,
  ThresholdConfig
} from '../types/biogas';
import { ARDUINO_SKETCHES, INFO_TOPICS } from '../data/esp32Guides';
import { InfoButton } from './InfoPopover';
import { PWAInstallCard } from './PWAInstallCard';
import {
  subscribeDeviceSettings,
  updateDeviceInterval,
  updateDeviceWifiAndAp,
  DeviceConfig
} from '../services/sensorFirestoreService';

const OWNER_EMAILS = [
  'irfanrizkiaditri@gmail.com',
  'irfanrizkiaditri01@gmail.com'
];

interface ConnectionPageProps {
  currentUser?: User | null;
  settings: ConnectionSettings;
  thresholds: ThresholdConfig;
  isConnected: boolean;
  statusMessage: string;
  alarmSoundEnabled: boolean;
  onToggleAlarmSound: () => void;
  onTestAlarmSound?: () => void;
  onUpdateSettings: (partial: Partial<ConnectionSettings>) => void;
  onUpdateThresholds: (partial: Partial<ThresholdConfig>) => void;
  onConnectBluetooth: () => void;
  onConnectUsbSerial: () => void;
  onStartPollingUrl: (method: 'wifi_local' | 'cloud_hotspot') => void;
  onDisconnect: () => void;
  onTestCloudPush: () => void;
  onBackToDashboard?: () => void;
}

interface MethodCardItem {
  id: ConnectionMethod;
  title: string;
  shortDesc: string;
  tagText: string;
  infoTopic: keyof typeof INFO_TOPICS;
  icon: React.ReactNode;
}

export const ConnectionPage: React.FC<ConnectionPageProps> = ({
  currentUser,
  settings,
  thresholds,
  isConnected,
  statusMessage,
  alarmSoundEnabled,
  onToggleAlarmSound,
  onTestAlarmSound,
  onUpdateSettings,
  onUpdateThresholds,
  onConnectBluetooth,
  onConnectUsbSerial,
  onStartPollingUrl,
  onDisconnect,
  onTestCloudPush,
  onBackToDashboard
}) => {
  const isOwner = Boolean(
    currentUser?.email &&
      OWNER_EMAILS.includes(currentUser.email.toLowerCase().trim())
  );

  const [activeInterval, setActiveInterval] = useState<2 | 5 | 10>(5);
  const [deviceConfig, setDeviceConfig] = useState<DeviceConfig | null>(null);
  const [isSavingInterval, setIsSavingInterval] = useState(false);
  const [intervalFeedback, setIntervalFeedback] = useState<string | null>(null);

  // Berlangganan konfigurasi interval remote jika user adalah pemilik
  useEffect(() => {
    if (!isOwner) return;
    const unsub = subscribeDeviceSettings((cfg) => {
      setDeviceConfig(cfg);
      setActiveInterval(cfg.send_interval_sec);
    });
    return () => unsub();
  }, [isOwner]);

  const handleSelectInterval = async (sec: 2 | 5 | 10) => {
    if (!isOwner || !currentUser?.email) return;
    setIsSavingInterval(true);
    setIntervalFeedback(null);
    try {
      await updateDeviceInterval(sec, currentUser.email);
      setActiveInterval(sec);
      setIntervalFeedback(`Berhasil disimpan! ESP32 akan menyesuaikan interval ke ${sec} detik.`);
      setTimeout(() => setIntervalFeedback(null), 4000);
    } catch (err: any) {
      setIntervalFeedback(`Gagal menyimpan interval: ${err?.message || 'Periksa aturan izin.'}`);
    } finally {
      setIsSavingInterval(false);
    }
  };

  // Kredensial Wi-Fi Target & Hotspot Mandiri ESP32 (Cara 2 & Cara 3)
  const [wifiSsid, setWifiSsid] = useState('FANRA  4G');
  const [wifiPass, setWifiPass] = useState('#12345678');
  const [apSsid, setApSsid] = useState('BioSense-ESP32-AP');
  const [apPass, setApPass] = useState('12345678');
  const [showWifiPass, setShowWifiPass] = useState(false);
  const [showApPass, setShowApPass] = useState(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [credentialsFeedback, setCredentialsFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Sinkronisasi data awal dari Firestore jika tersedia
  useEffect(() => {
    if (deviceConfig) {
      if (deviceConfig.wifi_ssid) setWifiSsid(deviceConfig.wifi_ssid);
      if (deviceConfig.wifi_pass) setWifiPass(deviceConfig.wifi_pass);
      if (deviceConfig.ap_ssid) setApSsid(deviceConfig.ap_ssid);
      if (deviceConfig.ap_pass) setApPass(deviceConfig.ap_pass);
    }
  }, [deviceConfig]);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !currentUser?.email) return;

    if (!wifiSsid.trim()) {
      setCredentialsFeedback({
        type: 'error',
        message: 'Nama Wi-Fi Target (SSID) tidak boleh kosong.'
      });
      return;
    }

    if (apPass.length > 0 && apPass.length < 8) {
      setCredentialsFeedback({
        type: 'error',
        message: 'Password Hotspot ESP32 minimal 8 karakter (standar keamanan WPA2).'
      });
      return;
    }

    setIsSavingCredentials(true);
    setCredentialsFeedback(null);
    try {
      await updateDeviceWifiAndAp(
        {
          wifi_ssid: wifiSsid,
          wifi_pass: wifiPass,
          ap_ssid: apSsid.trim() || 'BioSense-ESP32-AP',
          ap_pass: apPass || '12345678'
        },
        currentUser.email
      );
      setCredentialsFeedback({
        type: 'success',
        message: 'Kredensial berhasil disimpan ke Cloud! ESP32 akan membaca dan menyerap Wi-Fi/Hotspot baru ini otomatis.'
      });
      setTimeout(() => setCredentialsFeedback(null), 6000);
    } catch (err: any) {
      setCredentialsFeedback({
        type: 'error',
        message: `Gagal menyimpan: ${err?.message || 'Periksa koneksi/aturan izin Firestore.'}`
      });
    } finally {
      setIsSavingCredentials(false);
    }
  };

  const [copiedCode, setCopiedCode] = useState(false);

  const methods: MethodCardItem[] = [
    {
      id: 'bluetooth',
      title: 'Bluetooth BLE',
      shortDesc: 'Tanpa Wi-Fi & tanpa kuota internet.',
      tagText: '1–15m',
      infoTopic: 'method_bluetooth',
      icon: <Bluetooth className="w-4 h-4 text-white shrink-0" />
    },
    {
      id: 'wifi_local',
      title: 'Wi-Fi Lokal ESP32',
      shortDesc: 'ESP32 pancarkan Wi-Fi sendiri.',
      tagText: 'IP 192.168.4.1',
      infoTopic: 'method_wifi_local',
      icon: <Wifi className="w-4 h-4 text-white shrink-0" />
    },
    {
      id: 'cloud_hotspot',
      title: 'Hotspot & Cloud',
      shortDesc: 'Jarak jauh via Hotspot & Firebase.',
      tagText: 'IoT Online',
      infoTopic: 'method_cloud_hotspot',
      icon: <Globe className="w-4 h-4 text-white shrink-0" />
    },
    {
      id: 'usb_serial',
      title: 'USB Serial',
      shortDesc: 'Colok kabel USB langsung ke laptop.',
      tagText: 'Uji Lab',
      infoTopic: 'method_usb_serial',
      icon: <Usb className="w-4 h-4 text-white shrink-0" />
    },
    {
      id: 'simulation',
      title: 'Simulasi',
      shortDesc: 'Uji indikator sebelum alat dirakit.',
      tagText: 'Demo',
      infoTopic: 'method_simulation',
      icon: <Sliders className="w-4 h-4 text-white shrink-0" />
    }
  ];

  const activeSketch =
    settings.activeMethod !== 'simulation'
      ? ARDUINO_SKETCHES[settings.activeMethod]
      : null;

  const handleCopyCode = () => {
    if (!activeSketch) return;
    navigator.clipboard.writeText(activeSketch.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-4 w-full text-zinc-100">
      {/* Header Row */}
      <div className="pb-1 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white truncate">
            Koneksi ESP32 & Pengaturan
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">
            {isOwner
              ? 'Pilih metode koneksi atau klik ikon info untuk panduan'
              : 'Status koneksi aktif & preferensi alarm audio'}
          </p>
        </div>
      </div>

      {/* 5 Method Cards Grid: Dikunci untuk non-admin kecuali yang sedang aktif */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {methods.map((m) => {
          const isSelected = settings.activeMethod === m.id;
          const isLocked = !isOwner && !isSelected;

          return (
            <div
              key={m.id}
              onClick={() => {
                if (isLocked) return;
                onUpdateSettings({ activeMethod: m.id });
              }}
              role="button"
              tabIndex={isLocked ? -1 : 0}
              aria-disabled={isLocked}
              title={
                isLocked
                  ? 'Terkunci: Hanya akun Admin yang dapat mengubah metode koneksi'
                  : m.title
              }
              onKeyDown={(e) => {
                if (isLocked) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  onUpdateSettings({ activeMethod: m.id });
                }
              }}
              className={`rounded-md p-3 border transition-all flex flex-col justify-between text-left overflow-hidden ${
                isSelected
                  ? 'bg-white/[0.1] backdrop-blur-md border-white shadow-lg shadow-black/40 cursor-pointer'
                  : isLocked
                  ? 'bg-white/[0.015] border-white/5 opacity-40 cursor-not-allowed select-none'
                  : 'bg-white/[0.04] backdrop-blur-md border-white/10 hover:border-white/20 cursor-pointer'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1.5">
                    {m.icon}
                    {isLocked && (
                      <Lock className="w-3 h-3 text-zinc-500 shrink-0" />
                    )}
                  </div>
                  <InfoButton topicId={m.infoTopic} />
                </div>

                <h2 className="text-xs sm:text-sm font-semibold text-white truncate">
                  {m.title}
                </h2>
                <p className="text-[11px] text-zinc-400 mt-1 leading-snug line-clamp-2">
                  {m.shortDesc}
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span className="truncate">{m.tagText}</span>
                {isSelected ? (
                  <span className={`font-sans font-medium flex items-center gap-1 shrink-0 ml-1 ${
                    isConnected ? 'text-emerald-400' : 'text-amber-300'
                  }`}>
                    <CircleDot className="w-2.5 h-2.5" />
                    <span>{isConnected ? 'Aktif' : 'Belum Konek'}</span>
                  </span>
                ) : isLocked ? (
                  <span className="font-sans text-[10px] text-zinc-500 flex items-center gap-1 shrink-0 ml-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Terkunci</span>
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Settings & Code Grid */}
      {isOwner ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-start">
          {/* Left Column: Konfigurasi Lengkap + Pinout Sensor ESP32 (Khusus Admin) */}
          <section className="lg:col-span-6 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-md p-4 space-y-4 overflow-hidden shadow-lg shadow-black/30">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-semibold text-white truncate">
                  Konfigurasi: {methods.find((m) => m.id === settings.activeMethod)?.title}
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                  {statusMessage}
                </p>
              </div>

              {settings.activeMethod !== 'simulation' && isConnected && (
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  <span>Putuskan</span>
                </button>
              )}
            </div>

            {/* 1. Bluetooth BLE */}
            {settings.activeMethod === 'bluetooth' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      BLE Service UUID
                    </label>
                    <input
                      type="text"
                      value={settings.bleServiceUuid}
                      onChange={(e) =>
                        onUpdateSettings({ bleServiceUuid: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-zinc-950 border border-white/10 rounded-sm text-zinc-100 focus:outline-none focus:border-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      BLE Characteristic UUID
                    </label>
                    <input
                      type="text"
                      value={settings.bleCharUuid}
                      onChange={(e) =>
                        onUpdateSettings({ bleCharUuid: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-zinc-950 border border-white/10 rounded-sm text-zinc-100 focus:outline-none focus:border-white"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onConnectBluetooth}
                  className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium text-black bg-white hover:bg-zinc-200 rounded-sm transition-colors cursor-pointer"
                >
                  <Bluetooth className="w-4 h-4" />
                  <span>Cari & Hubungkan Bluetooth ESP32</span>
                </button>
              </div>
            )}

            {/* 2. Wi-Fi Lokal */}
            {settings.activeMethod === 'wifi_local' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-zinc-400 mb-1">
                      URL IP Lokal ESP32
                    </label>
                    <input
                      type="text"
                      value={settings.localIpUrl}
                      onChange={(e) =>
                        onUpdateSettings({ localIpUrl: e.target.value })
                      }
                      placeholder="http://192.168.4.1/data"
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-zinc-950 border border-white/10 rounded-sm text-zinc-100 focus:outline-none focus:border-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Interval (Detik)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={settings.pollIntervalSec}
                      onChange={(e) =>
                        onUpdateSettings({
                          pollIntervalSec: Math.max(1, parseInt(e.target.value) || 2)
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-zinc-950 border border-white/10 rounded-sm text-zinc-100 focus:outline-none focus:border-white"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onStartPollingUrl('wifi_local')}
                  className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium text-black bg-white hover:bg-zinc-200 rounded-sm transition-colors cursor-pointer"
                >
                  <PlugZap className="w-4 h-4" />
                  <span>Hubungkan ke IP Lokal ESP32</span>
                </button>
              </div>
            )}

            {/* 3. Cloud / Hotspot HP & Firebase Firestore */}
            {settings.activeMethod === 'cloud_hotspot' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Koleksi Cloud Firestore
                  </label>
                  <div className="p-2.5 bg-zinc-950 border border-white/10 rounded-sm text-xs font-mono space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Koleksi:</span>
                      <span className="text-emerald-400 font-semibold">sensor_readings</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Status Rule:</span>
                      <span className="text-white text-[11px] bg-white/10 px-1.5 py-0.5 rounded">
                        Autentikasi Aktif (Non-Publik)
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 border-t border-white/5 pt-1.5">
                      Field: <span className="text-zinc-300">temperature, pressure_kpa, pressure_bar, pressure_psi, raw_pressure, timestamp</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onStartPollingUrl('cloud_hotspot')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-black bg-white hover:bg-zinc-200 rounded-sm transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sinkronkan Firestore</span>
                  </button>

                  <button
                    type="button"
                    onClick={onTestCloudPush}
                    title="Kirim 1 paket data sensor valid ke Firestore untuk menguji integrasi langsung"
                    className="px-3.5 py-2 text-xs font-medium text-emerald-400 bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-500/20 rounded-sm transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Uji Kirim Sensor
                  </button>
                </div>
              </div>
            )}

            {/* 4. USB Serial */}
            {settings.activeMethod === 'usb_serial' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Baud Rate Serial
                  </label>
                  <select
                    value={settings.serialBaudRate}
                    onChange={(e) =>
                      onUpdateSettings({
                        serialBaudRate: parseInt(e.target.value, 10)
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-zinc-950 border border-white/10 rounded-sm text-zinc-100 focus:outline-none focus:border-white"
                  >
                    <option value={115200}>115200 bps (Standar ESP32)</option>
                    <option value={9600}>9600 bps</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={onConnectUsbSerial}
                  className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium text-black bg-white hover:bg-zinc-200 rounded-sm transition-colors cursor-pointer"
                >
                  <Usb className="w-4 h-4" />
                  <span>Pilih Port USB ESP32</span>
                </button>
              </div>
            )}

            {/* 5. Simulation */}
            {settings.activeMethod === 'simulation' && (
              <div className="space-y-2">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Mode simulasi aktif. Pilih metode koneksi fisik di atas saat siap menghubungkan ESP32.
                </p>
              </div>
            )}

            {/* Pinout Reference (Khusus Admin) */}
            <div className="pt-3 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Cpu className="w-4 h-4 text-zinc-100" />
                  <span>Pinout Sensor ke ESP32</span>
                </div>
                <InfoButton topicId="wiring_pinout" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-zinc-950 border border-white/5 rounded-sm p-2.5">
                  <span className="text-zinc-400 font-sans block text-[11px]">
                    Sensor Suhu (DS18B20)
                  </span>
                  <span className="text-white font-medium mt-0.5 block">
                    3.3V · GPIO 4 · GND
                  </span>
                </div>
                <div className="bg-zinc-950 border border-white/5 rounded-sm p-2.5">
                  <span className="text-zinc-400 font-sans block text-[11px]">
                    Sensor Tekanan (ADC1)
                  </span>
                  <span className="text-white font-medium mt-0.5 block">
                    VCC · GPIO 34 · GND
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Arduino Code & Thresholds (Khusus Admin), serta Alarm Suara */}
          <section className="lg:col-span-6 space-y-3.5">
            {/* 1. Kode Arduino IDE: Hanya untuk Admin */}
            {activeSketch && (
              <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-md p-4 space-y-3 overflow-hidden shadow-lg shadow-black/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-white truncate">
                      {activeSketch.title}
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                      {activeSketch.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href="/BioSense_ESP32_Firestore.ino"
                      download="BioSense_ESP32_Firestore.ino"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-normal text-cyan-300 hover:text-cyan-200 bg-cyan-950/40 border border-cyan-800/50 rounded transition-colors cursor-pointer"
                      title="Unduh File Sketch Arduino (.ino) Lengkap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh .ino</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-normal text-zinc-200 hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span className="text-white">Disalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <pre className="bg-zinc-950 border border-white/10 text-zinc-300 p-3 rounded-sm text-[11px] font-mono overflow-x-auto max-h-56 leading-relaxed">
                  <code>{activeSketch.code}</code>
                </pre>
              </div>
            )}

            {/* 2. Interval Pengiriman ESP32: Hanya untuk Admin */}
            <div className="bg-[#121212] border border-white/15 rounded-md p-4 space-y-3.5 shadow-xl shadow-black/40 overflow-hidden">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-[2.5px] bg-emerald-400 shrink-0" />
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5">
                      <span>Interval Pengiriman ESP32</span>
                      <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30">
                        Khusus Akun Anda
                      </span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Ubah jeda kirim sensor dari jarak jauh tanpa perlu flash ulang ESP32
                    </p>
                  </div>
                </div>
                {isSavingInterval && (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                )}
              </div>

              {/* 3 Opsi Interval: 2s, 5s, 10s */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 2 Detik */}
                <button
                  type="button"
                  disabled={isSavingInterval}
                  onClick={() => handleSelectInterval(2)}
                  className={`p-2.5 rounded-sm border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    activeInterval === 2
                      ? 'bg-white/15 border-white text-white shadow-md'
                      : 'bg-zinc-950/70 border-white/10 text-zinc-300 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">⚡ 2 Detik</span>
                    {activeInterval === 2 && (
                      <span className="w-1.5 h-1.5 rounded-[2px] bg-emerald-400" />
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                    Mode Responsif Cepat
                  </p>
                  <span className="text-[9px] font-mono text-amber-300/80 mt-1.5 block">
                    ~1.800 writes/jam
                  </span>
                </button>

                {/* 5 Detik */}
                <button
                  type="button"
                  disabled={isSavingInterval}
                  onClick={() => handleSelectInterval(5)}
                  className={`p-2.5 rounded-sm border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    activeInterval === 5
                      ? 'bg-white/15 border-white text-white shadow-md'
                      : 'bg-zinc-950/70 border-white/10 text-zinc-300 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">⚖️ 5 Detik</span>
                    {activeInterval === 5 && (
                      <span className="w-1.5 h-1.5 rounded-[2px] bg-emerald-400" />
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                    Standar 24 Jam Nonstop
                  </p>
                  <span className="text-[9px] font-mono text-emerald-400 mt-1.5 block">
                    Aman Kuota Spark Free
                  </span>
                </button>

                {/* 10 Detik */}
                <button
                  type="button"
                  disabled={isSavingInterval}
                  onClick={() => handleSelectInterval(10)}
                  className={`p-2.5 rounded-sm border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    activeInterval === 10
                      ? 'bg-white/15 border-white text-white shadow-md'
                      : 'bg-zinc-950/70 border-white/10 text-zinc-300 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">🌙 10 Detik</span>
                    {activeInterval === 10 && (
                      <span className="w-1.5 h-1.5 rounded-[2px] bg-emerald-400" />
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                    Mode Hemat Daya & Kuota
                  </p>
                  <span className="text-[9px] font-mono text-zinc-400 mt-1.5 block">
                    ~360 writes/jam
                  </span>
                </button>
              </div>

              {/* Status & Feedback */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-[11px]">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <span className="text-zinc-500">Tersimpan di Cloud:</span>
                  <span className="text-emerald-400 font-mono font-medium">
                    {deviceConfig ? `${deviceConfig.send_interval_sec} Detik` : `${activeInterval} Detik`}
                  </span>
                </div>
                {intervalFeedback && (
                  <span className="text-emerald-300 font-medium text-[11px]">
                    {intervalFeedback}
                  </span>
                )}
              </div>
            </div>

            {/* 3. Kredensial Wi-Fi & Hotspot Mandiri ESP32 (Dual-Config: Cara 2 & Cara 3) */}
            <div className="bg-[#121212] border border-cyan-500/20 rounded-md p-4 space-y-3.5 shadow-xl shadow-black/40 overflow-hidden">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-[2.5px] bg-cyan-400 shrink-0" />
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5">
                      <span>Kredensial Wi-Fi & Hotspot ESP32</span>
                      <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-500/30">
                        Dual-Config
                      </span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Atur nama & password Wi-Fi target serta Hotspot ESP32 langsung tanpa buka Arduino IDE di laptop
                    </p>
                  </div>
                </div>
                {isSavingCredentials && (
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                )}
              </div>

              {/* Banner Panduan Singkat Cara 2 & Cara 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white/[0.03] border border-white/5 rounded p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-medium">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Cara 3: Cloud Sync (Online)</span>
                  </div>
                  <p className="text-zinc-400 text-[10px] leading-snug">
                    Jika ESP32 sedang online, setelan di bawah otomatis dibaca dalam ~30 detik dan disimpan ke memori Flash ESP32.
                  </p>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Cara 2: Captive Portal (Offline)</span>
                  </div>
                  <p className="text-zinc-400 text-[10px] leading-snug">
                    Jika Wi-Fi mati/di luar jangkauan, ESP32 menyalakan Hotspot bernama kustom di bawah. Konek HP ke IP <span className="font-mono text-zinc-300">192.168.4.1</span>.
                  </p>
                </div>
              </div>

              {/* Form Input Kredensial */}
              <form onSubmit={handleSaveCredentials} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Bagian 1: Wi-Fi Target */}
                  <div className="p-3 rounded bg-zinc-950/70 border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
                        <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                        <span>1. Wi-Fi Target (Internet)</span>
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">Station</span>
                    </div>

                    <div>
                      <label className="block text-zinc-400 text-[11px] mb-1">
                        Nama SSID Wi-Fi / Hotspot HP
                      </label>
                      <input
                        type="text"
                        value={wifiSsid}
                        onChange={(e) => setWifiSsid(e.target.value)}
                        placeholder="Contoh: FANRA  4G"
                        required
                        className="w-full px-2.5 py-1.5 font-mono text-xs bg-zinc-900 border border-white/15 rounded-sm text-zinc-100 focus:border-cyan-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 text-[11px] mb-1">
                        Password Wi-Fi Target
                      </label>
                      <div className="relative">
                        <input
                          type={showWifiPass ? 'text' : 'password'}
                          value={wifiPass}
                          onChange={(e) => setWifiPass(e.target.value)}
                          placeholder="Password Wi-Fi"
                          className="w-full px-2.5 py-1.5 pr-8 font-mono text-xs bg-zinc-900 border border-white/15 rounded-sm text-zinc-100 focus:border-cyan-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowWifiPass(!showWifiPass)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                        >
                          {showWifiPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bagian 2: Hotspot Mandiri ESP32 (AP Kustom) */}
                  <div className="p-3 rounded bg-zinc-950/70 border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
                        <Radio className="w-3.5 h-3.5 text-amber-400" />
                        <span>2. Hotspot ESP32 (AP Bawaan)</span>
                      </span>
                      <span className="text-[10px] font-mono text-amber-400/80">Bisa Kustom</span>
                    </div>

                    <div>
                      <label className="block text-zinc-400 text-[11px] mb-1">
                        Nama Hotspot ESP32 (AP SSID)
                      </label>
                      <input
                        type="text"
                        value={apSsid}
                        onChange={(e) => setApSsid(e.target.value)}
                        placeholder="Contoh: BioSense-ESP32-AP"
                        required
                        className="w-full px-2.5 py-1.5 font-mono text-xs bg-zinc-900 border border-white/15 rounded-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 text-[11px] mb-1">
                        Password Hotspot (Min. 8 Karakter)
                      </label>
                      <div className="relative">
                        <input
                          type={showApPass ? 'text' : 'password'}
                          value={apPass}
                          onChange={(e) => setApPass(e.target.value)}
                          placeholder="Minimal 8 karakter"
                          className="w-full px-2.5 py-1.5 pr-8 font-mono text-xs bg-zinc-900 border border-white/15 rounded-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApPass(!showApPass)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                        >
                          {showApPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Feedback Message */}
                {credentialsFeedback && (
                  <div
                    className={`p-2.5 rounded text-xs leading-relaxed border ${
                      credentialsFeedback.type === 'success'
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {credentialsFeedback.message}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>
                      {deviceConfig?.last_synced_from === 'esp32_hardware'
                        ? 'Tersinkron otomatis dari Alat ESP32'
                        : 'Disimpan permanen di Flash NVS ESP32'}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingCredentials}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium transition-colors cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isSavingCredentials ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan ke Cloud...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Kirim Kredensial Baru ke ESP32</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* 4. Batas Optimal Suhu & Tekanan: Hanya untuk Admin */}
            <div className="bg-[#121212] border border-white/10 rounded-md p-4 space-y-3 overflow-hidden">
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-white/10">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <SlidersHorizontal className="w-4 h-4 text-zinc-100" />
                  <span>Batas Optimal Suhu & Tekanan</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Sinkron Global
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Pengubahan nilai batas di sini akan langsung disinkronkan ke seluruh pengguna secara realtime.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1 text-[11px]">Suhu Min (°C)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={thresholds.tempMinOptimal}
                    onChange={(e) =>
                      onUpdateThresholds({
                        tempMinOptimal: parseFloat(e.target.value) || 30
                      })
                    }
                    className="w-full px-2 py-1 font-mono bg-zinc-950 border border-white/10 rounded-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 text-[11px]">Suhu Maks (°C)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={thresholds.tempMaxOptimal}
                    onChange={(e) =>
                      onUpdateThresholds({
                        tempMaxOptimal: parseFloat(e.target.value) || 40
                      })
                    }
                    className="w-full px-2 py-1 font-mono bg-zinc-950 border border-white/10 rounded-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 text-[11px]">Gas Siap (kPa)</label>
                  <input
                    type="number"
                    step="1"
                    value={thresholds.pressureMinUse}
                    onChange={(e) =>
                      onUpdateThresholds({
                        pressureMinUse: parseFloat(e.target.value) || 110
                      })
                    }
                    className="w-full px-2 py-1 font-mono bg-zinc-950 border border-white/10 rounded-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 text-[11px]">Batas Kritis (kPa)</label>
                  <input
                    type="number"
                    step="1"
                    value={thresholds.pressureCritical}
                    onChange={(e) =>
                      onUpdateThresholds({
                        pressureCritical: parseFloat(e.target.value) || 160
                      })
                    }
                    className="w-full px-2 py-1 font-mono bg-zinc-950 border border-white/10 rounded-sm text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* 4. Pengaturan Audio Alarm Kritis */}
            <div className="bg-[#121212] border border-white/10 rounded-md p-4 flex items-center justify-between gap-3 shadow-lg shadow-black/20">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-1.5 rounded bg-white/5 border border-white/5 shrink-0 flex items-center justify-center">
                  {alarmSoundEnabled ? (
                    <img
                      src="https://cdn-icons-png.flaticon.com/128/727/727269.png"
                      alt="Suara Aktif"
                      className="w-5 h-5 object-contain brightness-0 invert"
                      draggable={false}
                    />
                  ) : (
                    <img
                      src="https://cdn-icons-png.flaticon.com/128/727/727240.png"
                      alt="Suara Mati"
                      className="w-5 h-5 object-contain brightness-0 invert opacity-50"
                      draggable={false}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-white">
                    Suara Alarm Peringatan Kritis
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Membunyikan nada peringatan saat suhu atau tekanan melewati batas kritis.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onTestAlarmSound && (
                  <button
                    type="button"
                    onClick={onTestAlarmSound}
                    title="Uji coba bunyikan nada alarm peringatan kritis"
                    className="px-2.5 py-1.5 text-xs font-medium rounded bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Uji Suara
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleAlarmSound}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer shrink-0 ${
                    alarmSoundEnabled
                      ? 'bg-white text-black hover:bg-zinc-200'
                      : 'bg-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {alarmSoundEnabled ? 'Aktif' : 'Mati'}
                </button>
              </div>
            </div>

            {/* 5. Pasang Aplikasi ke Layar Utama (PWA) */}
            <PWAInstallCard />
          </section>
        </div>
      ) : (
        /* Preferensi Pengguna */
        <div className="w-full space-y-3">
          <div className="bg-[#121212] border border-white/10 rounded-md p-4 flex items-center justify-between gap-3 shadow-lg shadow-black/20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-1.5 rounded bg-white/5 border border-white/5 shrink-0 flex items-center justify-center">
                {alarmSoundEnabled ? (
                  <img
                    src="https://cdn-icons-png.flaticon.com/128/727/727269.png"
                    alt="Suara Aktif"
                    className="w-5 h-5 object-contain brightness-0 invert"
                    draggable={false}
                  />
                ) : (
                  <img
                    src="https://cdn-icons-png.flaticon.com/128/727/727240.png"
                    alt="Suara Mati"
                    className="w-5 h-5 object-contain brightness-0 invert opacity-50"
                    draggable={false}
                  />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold text-white">
                  Suara Alarm Peringatan Kritis
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Membunyikan nada peringatan saat suhu atau tekanan melewati batas kritis reaktor.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onTestAlarmSound && (
                <button
                  type="button"
                  onClick={onTestAlarmSound}
                  title="Uji coba bunyikan nada alarm peringatan kritis"
                  className="px-2.5 py-1.5 text-xs font-medium rounded bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  Uji Suara
                </button>
              )}
              <button
                type="button"
                onClick={onToggleAlarmSound}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer shrink-0 ${
                  alarmSoundEnabled
                    ? 'bg-white text-black hover:bg-zinc-200'
                    : 'bg-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                {alarmSoundEnabled ? 'Aktif' : 'Mati'}
              </button>
            </div>
          </div>

          {/* Pasang Aplikasi ke Layar Utama (PWA) */}
          <PWAInstallCard />
        </div>
      )}
    </div>
  );
};
