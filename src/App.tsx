import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bluetooth,
  Wifi,
  Globe,
  Usb,
  Sliders,
  X,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  ConnectionMethod,
  ConnectionSettings,
  SensorReading,
  ThresholdConfig
} from './types/biogas';
import { DashboardView } from './components/DashboardView';
import { ConnectionPage } from './components/ConnectionPage';
import { SplashScreen } from './components/SplashScreen';
import { InfoButton, FloatingAnchorBox } from './components/InfoPopover';
import {
  DynamicSkylineBackdrop,
  TimeOfDayMode
} from './components/DynamicSkylineBackdrop';
import { auth, loginWithGoogle, logoutFirebase, testConnection } from './services/firebase';
import {
  subscribeLatestSensorReadings,
  fetchLatestSensorReadingsOnce,
  pushSensorReadingToFirestore,
  subscribeThresholdSettings,
  updateThresholdSettings
} from './services/sensorFirestoreService';

const OWNER_EMAILS = [
  'irfanrizkiaditri@gmail.com',
  'irfanrizkiaditri01@gmail.com'
];

function isUserOwner(user: User | null): boolean {
  if (!user || !user.email) return false;
  return OWNER_EMAILS.includes(user.email.toLowerCase());
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  tempMinOptimal: 30.0,
  tempMaxOptimal: 40.0,
  tempCritical: 45.0,
  pressureMinUse: 110.0,
  pressureMaxSafe: 145.0,
  pressureCritical: 160.0
};

const DEFAULT_SETTINGS: ConnectionSettings = {
  activeMethod: 'cloud_hotspot', // Utamakan mode Firebase Cloud Firestore online
  localIpUrl: 'http://192.168.4.1/data',
  pollIntervalSec: 3,
  cloudEndpointUrl: 'https://firestore.googleapis.com/v1/projects/fanracrate/databases/(default)/documents/sensor_readings',
  bleDeviceName: 'Biogas-ITERA-ESP32',
  bleServiceUuid: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
  bleCharUuid: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
  serialBaudRate: 115200
};

// Batas toleransi heartbeat ESP32 (30 detik).
// Mengakomodasi interval pengiriman (2s, 5s, 10s) ditambah latensi HTTPS TLS (1-3s)
// dan siklus pengecekan konfigurasi remote ESP32 setiap 30 detik tanpa memicu status 'Terputus' palsu.
const ESP32_OFFLINE_TIMEOUT_MS = 30000;

function formatTimeNow(): string {
  return new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatDateNow(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function App() {
  const [activePage, setActivePage] = useState<'dashboard' | 'connect'>('dashboard');
  const [quickConnectOpen, setQuickConnectOpen] = useState(false);
  const [skyMode, setSkyMode] = useState<TimeOfDayMode>('auto');
  const [currentDate, setCurrentDate] = useState<string>(formatDateNow);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const userBtnRef = useRef<HTMLButtonElement | null>(null);

  // State dan referensi untuk fitur native "Geser sekali lagi untuk keluar"
  const [exitToastVisible, setExitToastVisible] = useState(false);
  const lastBackPressRef = useRef<number>(0);
  const exitToastTimerRef = useRef<any>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(formatDateNow());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Intersep Gesture Swipe Back / Tombol Kembali HP layaknya aplikasi Android native
  useEffect(() => {
    try {
      if (!window.history.state || !window.history.state.bioteragasApp) {
        window.history.pushState({ bioteragasApp: true }, '');
      }
    } catch {
      // ignore
    }

    const handlePopState = () => {
      // 1. Jika modal sambungkan cepat terbuka, tutup modal
      if (quickConnectOpen) {
        setQuickConnectOpen(false);
        try { window.history.pushState({ bioteragasApp: true }, ''); } catch {}
        return;
      }

      // 2. Jika popover profil terbuka, tutup profil
      if (userMenuOpen) {
        setUserMenuOpen(false);
        try { window.history.pushState({ bioteragasApp: true }, ''); } catch {}
        return;
      }

      // 3. Jika sedang di tab Pengaturan, kembali ke Dashboard
      if (activePage === 'connect') {
        setActivePage('dashboard');
        try { window.history.pushState({ bioteragasApp: true }, ''); } catch {}
        return;
      }

      // 4. Jika sudah di Dashboard (halaman utama):
      const now = Date.now();
      if (now - lastBackPressRef.current < 2200) {
        // Geseran kedua dalam 2.2 detik: izinkan keluar aplikasi
        if (exitToastTimerRef.current) clearTimeout(exitToastTimerRef.current);
        setExitToastVisible(false);
        window.history.back();
      } else {
        // Geseran pertama: tahan di aplikasi dan tampilkan notifikasi toast
        lastBackPressRef.current = now;
        try { window.history.pushState({ bioteragasApp: true }, ''); } catch {}
        setExitToastVisible(true);

        if (exitToastTimerRef.current) clearTimeout(exitToastTimerRef.current);
        exitToastTimerRef.current = setTimeout(() => {
          setExitToastVisible(false);
          lastBackPressRef.current = 0;
        }, 2200);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitToastTimerRef.current) clearTimeout(exitToastTimerRef.current);
    };
  }, [activePage, quickConnectOpen, userMenuOpen]);

  // Shortcut Keyboard 'F' untuk Toggle Fullscreen (hanya saat tidak sedang mengetik di input/textarea/editable)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (target) {
          const tagName = target.tagName?.toLowerCase();
          const isInputField =
            tagName === 'input' ||
            tagName === 'textarea' ||
            tagName === 'select' ||
            target.isContentEditable ||
            target.getAttribute('role') === 'textbox';

          // Jika user sedang mengetik di input/textarea, jangan lakukan fullscreen
          if (isInputField) {
            return;
          }
        }

        e.preventDefault();
        try {
          if (!document.fullscreenElement) {
            if (document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().catch(() => {});
            } else if ((document.documentElement as any).webkitRequestFullscreen) {
              (document.documentElement as any).webkitRequestFullscreen();
            }
          } else {
            if (document.exitFullscreen) {
              document.exitFullscreen().catch(() => {});
            } else if ((document as any).webkitExitFullscreen) {
              (document as any).webkitExitFullscreen();
            }
          }
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [thresholds, setThresholds] = useState<ThresholdConfig>(() => {
    try {
      const saved = localStorage.getItem('biosense_thresholds');
      return saved ? { ...DEFAULT_THRESHOLDS, ...JSON.parse(saved) } : DEFAULT_THRESHOLDS;
    } catch {
      return DEFAULT_THRESHOLDS;
    }
  });

  const [settings, setSettings] = useState<ConnectionSettings>(() => {
    try {
      const saved = localStorage.getItem('biosense_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Berlangganan batas optimal sensor (thresholds) secara realtime dari Firestore agar sinkron untuk semua pengguna
  useEffect(() => {
    const unsubThresholds = subscribeThresholdSettings((remote) => {
      if (remote) {
        setThresholds((prev) => ({
          ...prev,
          tempMinOptimal: typeof remote.tempMinOptimal === 'number' ? remote.tempMinOptimal : prev.tempMinOptimal,
          tempMaxOptimal: typeof remote.tempMaxOptimal === 'number' ? remote.tempMaxOptimal : prev.tempMaxOptimal,
          tempCritical: typeof remote.tempCritical === 'number' ? remote.tempCritical : prev.tempCritical,
          pressureMinUse: typeof remote.pressureMinUse === 'number' ? remote.pressureMinUse : prev.pressureMinUse,
          pressureMaxSafe: typeof remote.pressureMaxSafe === 'number' ? remote.pressureMaxSafe : prev.pressureMaxSafe,
          pressureCritical: typeof remote.pressureCritical === 'number' ? remote.pressureCritical : prev.pressureCritical,
        }));
      }
    });
    return () => unsubThresholds();
  }, []);

  // Uji koneksi awal Firebase dan pantau status otentikasi
  useEffect(() => {
    testConnection();
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        if (settings.activeMethod === 'cloud_hotspot') {
          setStatusMessage(`Terhubung ke Firebase Cloud Firestore (Live)`);
        }
      } else {
        // Mode Publik: Tidak perlu login untuk melihat suhu & tekanan
        if (settings.activeMethod === 'cloud_hotspot') {
          setStatusMessage('Terhubung ke Firebase Cloud Firestore (Live)');
        }
      }
    });
    return () => unsubAuth();
  }, [settings.activeMethod]);

  // Data sensor live: diawali kosong untuk mode cloud/hardware (tanpa data dummy)
  const [currentReading, setCurrentReading] = useState<SensorReading>(() => {
    if (settings.activeMethod === 'simulation') {
      return {
        id: 'init-sim',
        timestamp: formatTimeNow(),
        temperatureC: 35.4,
        pressureKpa: 121.8,
        source: 'simulation'
      };
    }
    return {
      id: 'awaiting',
      timestamp: '--:--:--',
      temperatureC: 0,
      pressureKpa: 0,
      source: settings.activeMethod
    };
  });

  const [history, setHistory] = useState<SensorReading[]>(() => {
    if (settings.activeMethod === 'simulation') {
      return [
        {
          id: 'h-1',
          timestamp: formatTimeNow(),
          temperatureC: 35.4,
          pressureKpa: 121.8,
          source: 'simulation'
        }
      ];
    }
    return [];
  });

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Menginisialisasi koneksi Firebase Cloud Firestore...'
  );
  const [simAutoWalk, setSimAutoWalk] = useState<boolean>(true);
  const [isEspOnline, setIsEspOnline] = useState<boolean>(false);
  const [isInitialSyncing, setIsInitialSyncing] = useState<boolean>(true);
  const lastPacketReceivedAtRef = useRef<number>(0);

  // Audio Alarm Suara Peringatan Kritis
  const [alarmSoundEnabled, setAlarmSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('biosense_alarm_sound') !== 'false';
    } catch {
      return true;
    }
  });

  const pollTimerRef = useRef<number | null>(null);
  const bleDeviceRef = useRef<any>(null);
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastBeepTimeRef = useRef<number>(0);

  useEffect(() => {
    try {
      localStorage.setItem('biosense_thresholds', JSON.stringify(thresholds));
    } catch {
      // ignore
    }
  }, [thresholds]);

  useEffect(() => {
    try {
      localStorage.setItem('biosense_settings', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem('biosense_alarm_sound', String(alarmSoundEnabled));
    } catch {
      // ignore
    }
  }, [alarmSoundEnabled]);

  // Inisialisasi dan unlock Web Audio API Context (Aman dari autoplay restrictions)
  const getAudioContext = useCallback((): AudioContext | null => {
    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContextClass();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  // Unlock AudioContext pada interaksi awal pengguna (click, touch, keydown)
  useEffect(() => {
    const handleUnlock = () => {
      getAudioContext();
    };
    window.addEventListener('click', handleUnlock, { passive: true });
    window.addEventListener('touchstart', handleUnlock, { passive: true });
    window.addEventListener('keydown', handleUnlock, { passive: true });
    return () => {
      window.removeEventListener('click', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
    };
  }, [getAudioContext]);

  // Bunyikan nada alarm peringatan kritis (Dua nada darurat industri berulang yang tegas & nyaring)
  const playCriticalAlertSound = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      // Sirine darurat 2-tahap (Tone A: 960Hz, Tone B: 770Hz, diulang berpasangan)
      const tones: { freq: number; start: number; dur: number }[] = [
        { freq: 960, start: 0, dur: 0.14 },
        { freq: 770, start: 0.16, dur: 0.14 },
        { freq: 960, start: 0.32, dur: 0.14 },
        { freq: 770, start: 0.48, dur: 0.18 }
      ];

      tones.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Menggunakan tipe 'triangle' agar tegas, berkarakter darurat, dan jelas terdengar
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.linearRampToValueAtTime(0.3, now + start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur + 0.02);
      });
    } catch {
      // Audio autoplay policy handled gracefully
    }
  }, [getAudioContext]);

  const handleTestAlarmSound = useCallback(() => {
    getAudioContext();
    playCriticalAlertSound();
  }, [getAudioContext, playCriticalAlertSound]);

  const handleToggleAlarmSound = useCallback(() => {
    setAlarmSoundEnabled((prev) => {
      const next = !prev;
      if (next) {
        getAudioContext();
        setTimeout(() => playCriticalAlertSound(), 50);
      }
      return next;
    });
  }, [getAudioContext, playCriticalAlertSound]);

  const isCriticalNow = Boolean(
    currentReading &&
    currentReading.temperatureC > 0 &&
    (currentReading.temperatureC >= thresholds.tempCritical ||
      currentReading.pressureKpa >= thresholds.pressureCritical)
  );

  // Alarm aktif berbunyi terus-menerus secara berulang (setiap 2.8 detik) selama kondisi kritis reaktor berlangsung
  useEffect(() => {
    if (!isCriticalNow || !alarmSoundEnabled) return;

    // Bunyikan langsung saat status kritis terjadi
    playCriticalAlertSound();

    // Ulangi alarm setiap 2.8 detik selama status masih kritis
    const alarmInterval = window.setInterval(() => {
      playCriticalAlertSound();
    }, 2800);

    return () => {
      window.clearInterval(alarmInterval);
    };
  }, [isCriticalNow, alarmSoundEnabled, playCriticalAlertSound]);

  const recordIncomingReading = useCallback(
    (tempC: number, presKpa: number, source: ConnectionMethod) => {
      const cleanTemp = Number.isFinite(tempC) ? tempC : 35.0;
      const cleanPres = Number.isFinite(presKpa) ? presKpa : 101.3;
      const newEntry: SensorReading = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: formatTimeNow(),
        temperatureC: cleanTemp,
        pressureKpa: cleanPres,
        source
      };
      setCurrentReading(newEntry);
      setHistory((prev) => [newEntry, ...prev.slice(0, 58)]);
    },
    []
  );

  const parsePayloadAndRecord = useCallback(
    (rawText: string, source: ConnectionMethod) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;
      try {
        const obj = JSON.parse(trimmed);
        const t = parseFloat(
          obj.temperatureC ?? obj.temperature ?? obj.suhu ?? obj.temp
        );
        const p = parseFloat(
          obj.pressureKpa ?? obj.pressure ?? obj.tekanan ?? obj.pres
        );
        if (Number.isFinite(t) && Number.isFinite(p)) {
          recordIncomingReading(t, p, source);
        }
      } catch {
        const parts = trimmed.split(',');
        if (parts.length >= 2) {
          const t = parseFloat(parts[0]);
          const p = parseFloat(parts[1]);
          if (Number.isFinite(t) && Number.isFinite(p)) {
            recordIncomingReading(t, p, source);
          }
        }
      }
    },
    [recordIncomingReading]
  );

  const disconnectHardware = useCallback(async () => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (bleDeviceRef.current?.gatt?.connected) {
      try {
        bleDeviceRef.current.gatt.disconnect();
      } catch {
        // ignore
      }
    }
    if (serialReaderRef.current) {
      try {
        await serialReaderRef.current.cancel();
      } catch {
        // ignore
      }
      serialReaderRef.current = null;
    }
    if (serialPortRef.current) {
      try {
        await serialPortRef.current.close();
      } catch {
        // ignore
      }
      serialPortRef.current = null;
    }
    setIsConnected(false);
    setStatusMessage('Sambungan ke perangkat ESP32 telah diputuskan.');
  }, []);

  // 1. Integrasi Listener Realtime Firebase Cloud Firestore
  useEffect(() => {
    if (settings.activeMethod !== 'cloud_hotspot') {
      setIsInitialSyncing(false);
      return;
    }

    setIsInitialSyncing(true);
    setStatusMessage('Menyinkronkan data sensor ke Cloud...');
    setIsConnected(true);

    const unsubscribe = subscribeLatestSensorReadings(
      (readings) => {
        setIsInitialSyncing(false);
        if (readings.length > 0) {
          const latest = readings[0];
          setCurrentReading(latest);
          setHistory(readings);
          setIsConnected(true);

          const now = Date.now();
          const docAgeMs = latest.epochMs ? Math.abs(now - latest.epochMs) : Infinity;
          // Anggap ESP32 aktif jika dokumen terbaru terkirim dalam rentang toleransi (30 detik)
          const isFresh = docAgeMs < ESP32_OFFLINE_TIMEOUT_MS;

          if (isFresh) {
            lastPacketReceivedAtRef.current = now;
            setIsEspOnline(true);
            setStatusMessage('Terhubung ke Firebase Cloud • ESP32 Aktif');
          } else {
            lastPacketReceivedAtRef.current = 0;
            setIsEspOnline(false);
            setStatusMessage('Terhubung ke Firebase Cloud • Menampilkan data rekaman terakhir');
          }
        } else {
          setCurrentReading({
            id: 'awaiting-esp32',
            timestamp: '--:--:--',
            temperatureC: 0,
            pressureKpa: 0,
            source: 'cloud_hotspot'
          });
          setHistory([]);
          setIsConnected(true);
          setIsEspOnline(false);
          setStatusMessage('Terhubung ke Firebase Cloud • Menunggu data ESP32...');
        }
      },
      (err) => {
        setIsInitialSyncing(false);
        console.error('Error membaca data Firestore:', err);
        setIsConnected(false);
        setIsEspOnline(false);
        setStatusMessage(`Gagal sinkronisasi Firestore: ${err?.message || 'Periksa koneksi internet.'}`);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [settings.activeMethod]);

  // Pantau heartbeat ESP32 secara realtime dengan toleransi 30 detik
  useEffect(() => {
    if (settings.activeMethod !== 'cloud_hotspot') {
      setIsEspOnline(settings.activeMethod === 'simulation');
      return;
    }

    const checkEspPulse = () => {
      const now = Date.now();
      const timeSinceLivePacket =
        lastPacketReceivedAtRef.current > 0
          ? now - lastPacketReceivedAtRef.current
          : Infinity;

      const timeSinceDocEpoch = currentReading?.epochMs
        ? Math.abs(now - currentReading.epochMs)
        : Infinity;

      // Online jika paket baru tiba dalam batas toleransi 30 detik,
      // atau saat web pertama dibuka dokumen terakhir berumur < 30 detik
      const online =
        lastPacketReceivedAtRef.current > 0
          ? timeSinceLivePacket < ESP32_OFFLINE_TIMEOUT_MS
          : timeSinceDocEpoch < ESP32_OFFLINE_TIMEOUT_MS;
      setIsEspOnline(online);
    };

    checkEspPulse();
    const pulseTimer = setInterval(checkEspPulse, 1000);
    return () => clearInterval(pulseTimer);
  }, [settings.activeMethod, currentReading]);

  // Handler refresh manual untuk tombol sinkronisasi di dashboard
  const handleRefreshFirestore = useCallback(async () => {
    if (settings.activeMethod !== 'cloud_hotspot') return;
    setIsInitialSyncing(true);
    setStatusMessage('Menyegarkan data sensor Cloud...');
    try {
      const readings = await fetchLatestSensorReadingsOnce();
      if (readings.length > 0) {
        const latest = readings[0];
        setCurrentReading(latest);
        setHistory(readings);
        setIsConnected(true);
        const now = Date.now();
        const docAgeMs = latest.epochMs ? Math.abs(now - latest.epochMs) : Infinity;
        const isFresh = docAgeMs < ESP32_OFFLINE_TIMEOUT_MS;

        if (isFresh) {
          lastPacketReceivedAtRef.current = now;
          setIsEspOnline(true);
          setStatusMessage('Terhubung ke Firebase Cloud • ESP32 Aktif');
        } else {
          lastPacketReceivedAtRef.current = 0;
          setIsEspOnline(false);
          setStatusMessage('Terhubung ke Firebase Cloud • Menampilkan data rekaman terakhir');
        }
      }
    } catch (err) {
      console.warn('Gagal refresh data sensor:', err);
    } finally {
      setTimeout(() => {
        setIsInitialSyncing(false);
      }, 400);
    }
  }, [settings.activeMethod]);

  // 2. Mode Simulasi: HANYA berjalan jika mode 'simulation' aktif
  // Menghilangkan data dummy dari live mode secara ketat
  useEffect(() => {
    if (settings.activeMethod !== 'simulation') return;
    if (!simAutoWalk) return;

    const interval = window.setInterval(() => {
      setCurrentReading((prev) => {
        const deltaT = (Math.random() - 0.49) * 0.28;
        let nextT = (prev.temperatureC > 0 ? prev.temperatureC : 35.0) + deltaT;
        if (nextT < 34.0) nextT = 34.0 + Math.random() * 0.4;
        if (nextT > 38.0) nextT = 38.0 - Math.random() * 0.4;

        const deltaP = (Math.random() - 0.48) * 0.65;
        let nextP = (prev.pressureKpa > 0 ? prev.pressureKpa : 121.0) + deltaP;
        if (nextP < 118.0) nextP = 118.0 + Math.random() * 0.6;
        if (nextP > 127.0) nextP = 127.0 - Math.random() * 0.6;

        const entry: SensorReading = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: formatTimeNow(),
          temperatureC: Number(nextT.toFixed(1)),
          pressureKpa: Number(nextP.toFixed(1)),
          source: 'simulation'
        };

        setHistory((h) => [entry, ...h.slice(0, 58)]);
        return entry;
      });
    }, 2500);

    return () => window.clearInterval(interval);
  }, [settings.activeMethod, simAutoWalk]);

  const handleUpdateSettings = (partial: Partial<ConnectionSettings>) => {
    if (partial.activeMethod && partial.activeMethod !== settings.activeMethod) {
      disconnectHardware();
      if (partial.activeMethod === 'simulation') {
        setIsConnected(true);
        setStatusMessage('Beralih ke Mode Simulasi.');
        setCurrentReading({
          id: 'sim-now',
          timestamp: formatTimeNow(),
          temperatureC: 35.4,
          pressureKpa: 121.8,
          source: 'simulation'
        });
      } else if (partial.activeMethod === 'cloud_hotspot') {
        setCurrentReading({
          id: 'awaiting',
          timestamp: '--:--:--',
          temperatureC: 0,
          pressureKpa: 0,
          source: 'cloud_hotspot'
        });
        setHistory([]);
        setIsConnected(true);
        setStatusMessage(
          currentUser
            ? `Beralih ke Firebase Cloud Firestore (${isUserOwner(currentUser) ? 'Admin PKM' : 'Anggota'})...`
            : 'Beralih ke Firebase Cloud Firestore (Mode Tamu / Publik)...'
        );
      } else {
        setIsConnected(false);
        setCurrentReading({
          id: `disconnected-${partial.activeMethod}`,
          timestamp: '--:--:--',
          temperatureC: 0,
          pressureKpa: 0,
          source: partial.activeMethod
        });
        setHistory([]);
        const methodNames: Record<string, string> = {
          bluetooth: 'Bluetooth BLE',
          wifi_local: 'Wi-Fi Lokal ESP32',
          usb_serial: 'USB Serial'
        };
        const name = methodNames[partial.activeMethod] || partial.activeMethod;
        setStatusMessage(`Beralih ke ${name}. Buka Pengaturan lalu klik Hubungkan.`);
      }
    }
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleUpdateThresholds = async (partial: Partial<ThresholdConfig>) => {
    const updated: ThresholdConfig = { ...thresholds, ...partial };
    setThresholds(updated);
    try {
      localStorage.setItem('biosense_thresholds', JSON.stringify(updated));
    } catch {
      // ignore
    }
    if (isUserOwner(currentUser) && currentUser?.email) {
      try {
        await updateThresholdSettings(updated, currentUser.email);
      } catch (err) {
        console.error('Gagal sinkronisasi batas optimal ke Firestore:', err);
      }
    }
  };

  const handleConnectBluetooth = async () => {
    await disconnectHardware();
    const nav = navigator as any;
    if (!nav.bluetooth) {
      setStatusMessage(
        'Browser ini belum mendukung Web Bluetooth (gunakan Chrome).'
      );
      return;
    }
    try {
      setStatusMessage('Mencari perangkat Bluetooth ESP32...');
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [settings.bleServiceUuid]
      });
      bleDeviceRef.current = device;
      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        setStatusMessage('Bluetooth ESP32 terputus.');
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(settings.bleServiceUuid);
      const characteristic = await service.getCharacteristic(settings.bleCharUuid);

      await characteristic.startNotifications();
      characteristic.addEventListener(
        'characteristicvaluechanged',
        (event: any) => {
          const value = event.target.value;
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(value);
          parsePayloadAndRecord(text, 'bluetooth');
        }
      );

      setIsConnected(true);
      setStatusMessage('Terhubung ke Bluetooth ESP32.');
      setQuickConnectOpen(false);
    } catch (err: any) {
      setIsConnected(false);
      setStatusMessage(
        `Koneksi Bluetooth dibatalkan: ${err?.message || 'Dibatalkan.'}`
      );
    }
  };

  const handleStartPollingUrl = async (method: 'wifi_local' | 'cloud_hotspot') => {
    await disconnectHardware();
    if (method === 'cloud_hotspot') {
      // Beralih ke Firebase Firestore
      handleUpdateSettings({ activeMethod: 'cloud_hotspot' });
      setQuickConnectOpen(false);
      return;
    }

    const targetUrl = settings.localIpUrl.trim();
    if (!targetUrl) {
      setStatusMessage('Masukkan URL endpoint terlebih dahulu.');
      return;
    }

    const fetchOnce = async () => {
      try {
        const res = await fetch(targetUrl, { method: 'GET' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        parsePayloadAndRecord(text, method);
        setIsConnected(true);
        setStatusMessage(`Terhubung ke endpoint (${settings.pollIntervalSec} dtk).`);
      } catch (err: any) {
        setIsConnected(false);
        setStatusMessage('Menunggu respons dari ESP32...');
      }
    };

    setStatusMessage(`Menghubungi endpoint IP lokal...`);
    await fetchOnce();
    pollTimerRef.current = window.setInterval(
      fetchOnce,
      Math.max(1, settings.pollIntervalSec) * 1000
    );
    setQuickConnectOpen(false);
  };

  // Uji Kirim Data Sensor langsung ke Firebase Firestore dengan skema 6 field
  const handleTestCloudPush = async () => {
    if (!currentUser) {
      try {
        setStatusMessage('Membuka login Google untuk otorisasi pengiriman...');
        await loginWithGoogle();
      } catch {
        setStatusMessage('Login Google dibatalkan. Diperlukan untuk mengirim ke Firestore.');
        return;
      }
    }

    try {
      const sampleTemp = Number((34.5 + Math.random() * 2.5).toFixed(2));
      const samplePres = Number((119.0 + Math.random() * 8.0).toFixed(2));
      const sampleBar = Number((samplePres / 100).toFixed(4));
      const samplePsi = Number((samplePres * 0.145038).toFixed(3));
      const sampleRaw = Math.round(samplePres * 8388);

      setStatusMessage('Mengirim data uji sensor ke koleksi sensor_readings...');
      await pushSensorReadingToFirestore({
        temperature: sampleTemp,
        pressure_kpa: samplePres,
        pressure_bar: sampleBar,
        pressure_psi: samplePsi,
        raw_pressure: sampleRaw,
        timestamp: new Date().toISOString()
      });

      setStatusMessage('Data sensor ESP32 terkirim ke Firestore & tersinkronisasi online!');
    } catch (err: any) {
      console.error('Gagal kirim ke Firestore:', err);
      setStatusMessage(`Gagal kirim: ${err?.message || 'Periksa aturan keamanan.'}`);
    }
  };

  const handleConnectUsbSerial = async () => {
    await disconnectHardware();
    const nav = navigator as any;
    if (!nav.serial) {
      setStatusMessage(
        'Gunakan Google Chrome atau Edge untuk Serial USB.'
      );
      return;
    }
    try {
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: settings.serialBaudRate });
      serialPortRef.current = port;
      setIsConnected(true);
      setStatusMessage(`Terhubung ke USB Serial ESP32.`);
      setQuickConnectOpen(false);

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      serialReaderRef.current = reader;

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            parsePayloadAndRecord(line, 'usb_serial');
          }
        }
      }
    } catch (err: any) {
      setIsConnected(false);
      setStatusMessage(
        `Koneksi USB dibatalkan: ${err?.message || 'Cek kabel.'}`
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-zinc-100 relative overflow-hidden">
      {/* Splash Screen Eksklusif saat Aplikasi Dibuka */}
      <SplashScreen />

      {/* Background Gambar Latar Langit Dinamis */}
      <DynamicSkylineBackdrop currentMode={skyMode} />

      {/* Header: Tanggal di kiri & Navigasi Ikon di kanan */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-1 flex items-center justify-between relative z-10">
        {/* Pojok Kiri Atas: Angka Tanggal Sinkron */}
        <span className="text-xs sm:text-[13px] font-mono text-white/35 select-none tracking-wider">
          {currentDate}
        </span>

        {/* Pojok Kanan: Ikon Navigasi & Status Akun */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          {/* Tombol Login / Profil Google (Login opsional untuk anggota, tamu tetap bisa lihat data) */}
          {currentUser ? (
            <button
              ref={userBtnRef}
              type="button"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              aria-label="Profil Akun Google Terhubung"
              title={`Akun: ${currentUser.email || 'Terautentikasi'}`}
              className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 p-0.5"
            >
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt="Avatar"
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                try {
                  await loginWithGoogle();
                } catch {
                  // silent
                }
              }}
              aria-label="Masuk dengan Akun Google"
              title="Masuk dengan Akun Google"
              className="w-[22px] h-[22px] rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer group p-0.5"
            >
              <svg
                className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_0_6px_rgba(255,255,255,0.2)] shrink-0"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </button>
          )}

          {/* Sinkronisasi Waktu / Cuaca Latar Langit */}
          <button
            type="button"
            onClick={() => {
              setSkyMode((prev) =>
                prev === 'auto'
                  ? 'day'
                  : prev === 'day'
                  ? 'sunset'
                  : prev === 'sunset'
                  ? 'night'
                  : 'auto'
              );
            }}
            aria-label="Mode Latar Langit"
            title={`Latar Waktu: ${
              skyMode === 'auto'
                ? 'Otomatis (Jam Perangkat)'
                : skyMode === 'day'
                ? 'Siang'
                : skyMode === 'sunset'
                ? 'Sore'
                : 'Malam'
            }`}
            className="p-1 rounded-full hover:bg-white/10 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center group"
          >
            {skyMode === 'day' ? (
              <img
                src="https://cdn-icons-png.flaticon.com/128/17356/17356780.png"
                alt="Siang"
                className="w-5 h-5 object-contain brightness-0 invert opacity-95 group-hover:opacity-100 drop-shadow-[0_0_6px_rgba(253,224,71,0.5)] transition-all duration-300"
                draggable={false}
              />
            ) : skyMode === 'sunset' ? (
              <img
                src="https://cdn-icons-png.flaticon.com/128/7087/7087912.png"
                alt="Sore"
                className="w-5 h-5 object-contain brightness-0 invert opacity-95 group-hover:opacity-100 drop-shadow-[0_0_6px_rgba(251,146,60,0.5)] transition-all duration-300"
                draggable={false}
              />
            ) : skyMode === 'night' ? (
              <img
                src="https://cdn-icons-png.flaticon.com/128/39/39857.png"
                alt="Malam"
                className="w-5 h-5 object-contain brightness-0 invert opacity-90 group-hover:opacity-100 drop-shadow-[0_0_6px_rgba(147,197,253,0.45)] transition-all duration-300"
                draggable={false}
              />
            ) : (
              <img
                src="https://cdn-icons-png.flaticon.com/128/5948/5948051.png"
                alt="Otomatis"
                className="w-5 h-5 object-contain brightness-0 invert opacity-75 group-hover:opacity-100 transition-all duration-300"
                draggable={false}
              />
            )}
          </button>

          {/* Tombol Sambung Cepat ESP32 - Hanya muncul untuk akun Admin / Irfan */}
          {isUserOwner(currentUser) && (
            <button
              type="button"
              onClick={() => setQuickConnectOpen(true)}
              aria-label="Sambungkan ke ESP32"
              title="Sambungkan ke ESP32 (Akses Admin)"
              className="p-1 rounded-full hover:bg-white/10 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center group"
            >
              <img
                src="https://cdn-icons-png.flaticon.com/128/453/453219.png"
                alt="Sambungkan"
                className={`w-5 h-5 object-contain brightness-0 invert transition-all duration-300 ${
                  isConnected
                    ? 'opacity-100 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                    : 'opacity-70 group-hover:opacity-100'
                }`}
                draggable={false}
              />
            </button>
          )}

          {/* Navigasi Utama: Ikon Dashboard Sensor */}
          <button
            type="button"
            onClick={() => setActivePage('dashboard')}
            aria-label="Tampilan Dashboard Sensor"
            title="Dashboard Sensor"
            className="p-1 rounded-full hover:bg-white/10 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center group"
          >
            <img
              src="https://cdn-icons-png.flaticon.com/128/15491/15491314.png"
              alt="Dashboard"
              className={`w-5 h-5 object-contain brightness-0 invert transition-all duration-300 ${
                activePage === 'dashboard'
                  ? 'opacity-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.45)]'
                  : 'opacity-70 group-hover:opacity-100'
              }`}
              draggable={false}
            />
          </button>

          {/* Navigasi Utama: Ikon Pengaturan & Konfigurasi ESP32 */}
          <button
            type="button"
            onClick={() => setActivePage('connect')}
            aria-label="Pengaturan & Konfigurasi ESP32"
            title="Pengaturan & Konfigurasi ESP32"
            className="p-1 rounded-full hover:bg-white/10 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center group"
          >
            <img
              src="https://cdn-icons-png.flaticon.com/128/3019/3019012.png"
              alt="Pengaturan"
              className={`w-5 h-5 object-contain brightness-0 invert transition-all duration-300 ${
                activePage === 'connect'
                  ? 'opacity-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.45)]'
                  : 'opacity-70 group-hover:opacity-100'
              }`}
              draggable={false}
            />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3.5 sm:px-6 py-3 sm:py-5 relative z-10">
        {activePage === 'dashboard' ? (
          <DashboardView
            currentReading={currentReading}
            history={history}
            thresholds={thresholds}
            activeMethod={settings.activeMethod}
            isConnected={isConnected}
            isEspOnline={isEspOnline}
            isSyncing={isInitialSyncing}
            connectionStatusText={statusMessage}
            simAutoWalk={simAutoWalk}
            currentUser={currentUser}
            onToggleSimAutoWalk={() => setSimAutoWalk((prev) => !prev)}
            onManualSimChange={(t, p) => {
              setSimAutoWalk(false);
              recordIncomingReading(t, p, 'simulation');
            }}
            onClearHistory={() => setHistory([])}
            onNavigateToConnect={() => setActivePage('connect')}
            onRefresh={handleRefreshFirestore}
          />
        ) : (
          <ConnectionPage
            currentUser={currentUser}
            settings={settings}
            thresholds={thresholds}
            isConnected={isConnected}
            statusMessage={statusMessage}
            alarmSoundEnabled={alarmSoundEnabled}
            onToggleAlarmSound={handleToggleAlarmSound}
            onTestAlarmSound={handleTestAlarmSound}
            onUpdateSettings={handleUpdateSettings}
            onUpdateThresholds={handleUpdateThresholds}
            onConnectBluetooth={handleConnectBluetooth}
            onConnectUsbSerial={handleConnectUsbSerial}
            onStartPollingUrl={handleStartPollingUrl}
            onDisconnect={disconnectHardware}
            onTestCloudPush={handleTestCloudPush}
            onBackToDashboard={() => setActivePage('dashboard')}
          />
        )}
      </main>

      {/* Modal Sambungkan Cepat ESP32 - Hanya untuk akun Admin / Irfan */}
      {quickConnectOpen && isUserOwner(currentUser) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setQuickConnectOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#121212] border border-white/10 rounded-md shadow-2xl p-4 sm:p-5 space-y-3.5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Sambungkan Alat ESP32
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Pilih cara menyambungkan sensor ke bIoTeragas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickConnectOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {/* 1. Firebase Cloud Firestore (Utama Online) */}
              <div className="flex items-center justify-between gap-2 bg-zinc-950 border border-white/5 rounded-sm p-2.5">
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateSettings({ activeMethod: 'cloud_hotspot' });
                    setQuickConnectOpen(false);
                  }}
                  className="flex-1 flex items-center gap-2.5 text-left cursor-pointer min-w-0"
                >
                  <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate flex items-center gap-1.5">
                      <span>Firebase Cloud Firestore</span>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-mono">
                        Online
                      </span>
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      Koleksi sensor_readings real-time
                    </p>
                  </div>
                </button>
                <InfoButton topicId="method_cloud_hotspot" />
              </div>

              {/* 2. Bluetooth BLE */}
              <div className="flex items-center justify-between gap-2 bg-zinc-950 border border-white/5 rounded-sm p-2.5">
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateSettings({ activeMethod: 'bluetooth' });
                    handleConnectBluetooth();
                  }}
                  className="flex-1 flex items-center gap-2.5 text-left cursor-pointer min-w-0"
                >
                  <Bluetooth className="w-4 h-4 text-white shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      Bluetooth Langsung (BLE)
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      Tanpa Wi-Fi & tanpa kuota (1–15m)
                    </p>
                  </div>
                </button>
                <InfoButton topicId="method_bluetooth" />
              </div>

              {/* 3. Wi-Fi Lokal */}
              <div className="flex items-center justify-between gap-2 bg-zinc-950 border border-white/5 rounded-sm p-2.5">
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateSettings({ activeMethod: 'wifi_local' });
                    handleStartPollingUrl('wifi_local');
                  }}
                  className="flex-1 flex items-center gap-2.5 text-left cursor-pointer min-w-0"
                >
                  <Wifi className="w-4 h-4 text-white shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      Wi-Fi Lokal ESP32
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      Hotspot mandiri ESP32 (192.168.4.1)
                    </p>
                  </div>
                </button>
                <InfoButton topicId="method_wifi_local" />
              </div>

              {/* 4. USB Serial */}
              <div className="flex items-center justify-between gap-2 bg-zinc-950 border border-white/5 rounded-sm p-2.5">
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateSettings({ activeMethod: 'usb_serial' });
                    handleConnectUsbSerial();
                  }}
                  className="flex-1 flex items-center gap-2.5 text-left cursor-pointer min-w-0"
                >
                  <Usb className="w-4 h-4 text-white shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      Kabel USB Serial
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      Colok kabel USB langsung ke laptop
                    </p>
                  </div>
                </button>
                <InfoButton topicId="method_usb_serial" />
              </div>

              {/* 5. Simulasi */}
              <div className="flex items-center justify-between gap-2 bg-zinc-950 border border-white/5 rounded-sm p-2.5">
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateSettings({ activeMethod: 'simulation' });
                    setQuickConnectOpen(false);
                  }}
                  className="flex-1 flex items-center gap-2.5 text-left cursor-pointer min-w-0"
                >
                  <Sliders className="w-4 h-4 text-white shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      Mode Simulasi
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      Uji indikator sebelum alat dirakit
                    </p>
                  </div>
                </button>
                <InfoButton topicId="method_simulation" />
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setQuickConnectOpen(false);
                  setActivePage('connect');
                }}
                className="text-xs text-white hover:underline cursor-pointer"
              >
                Pengaturan Lengkap →
              </button>
              <button
                type="button"
                onClick={() => setQuickConnectOpen(false)}
                className="px-3 py-1 text-xs font-medium text-black bg-white hover:bg-zinc-200 rounded-sm transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popover Akun Google Pengguna / Menu Keluar */}
      {currentUser && (
        <FloatingAnchorBox
          isOpen={userMenuOpen}
          onClose={() => setUserMenuOpen(false)}
          anchorEl={userBtnRef.current}
          maxWidth={280}
        >
          <div className="space-y-3 text-xs">
            {/* Header Profil */}
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full border border-emerald-400/50 object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-white truncate text-xs">
                    {currentUser.displayName || 'Pengguna BioSense'}
                  </p>
                  <p className="text-[11px] font-mono text-zinc-400 truncate">
                    {currentUser.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserMenuOpen(false)}
                className="text-zinc-400 hover:text-white p-0.5 transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tombol Keluar dari Akun */}
            <div className="pt-1">
              <button
                type="button"
                onClick={async () => {
                  setUserMenuOpen(false);
                  try {
                    await logoutFirebase();
                  } catch (err) {
                    console.error('Logout error:', err);
                  }
                  if (settings.activeMethod === 'cloud_hotspot') {
                    setStatusMessage('Terhubung ke Firebase Cloud Firestore (Live)');
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Keluar dari Akun</span>
              </button>
            </div>
          </div>
        </FloatingAnchorBox>
      )}

      {/* Toast Notifikasi Minimalis: Geser sekali lagi untuk keluar (Kotak, Sebaris, Pas di HP) */}
      <div
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[99990] transition-all duration-200 ease-out transform pointer-events-none ${
          exitToastVisible
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-2 scale-95'
        }`}
        aria-live="polite"
      >
        <div className="bg-[#121214]/95 border border-white/20 text-zinc-100 text-[11px] px-3 py-1.5 rounded shadow-xl backdrop-blur-md inline-flex items-center gap-1.5 select-none whitespace-nowrap">
          <span className="text-zinc-400 text-[10px]">↩</span>
          <span className="font-medium tracking-normal text-white">Geser sekali lagi untuk keluar</span>
        </div>
      </div>
    </div>
  );
}
