import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  ConnectionMethod,
  PressureUnit,
  SensorReading,
  ThresholdConfig
} from '../types/biogas';
import { InfoButton, FloatingAnchorBox } from './InfoPopover';
import { WeatherCard } from './WeatherCard';

interface DashboardViewProps {
  currentReading: SensorReading;
  history: SensorReading[];
  thresholds: ThresholdConfig;
  activeMethod: ConnectionMethod;
  isConnected: boolean;
  isEspOnline?: boolean;
  connectionStatusText: string;
  simAutoWalk: boolean;
  currentUser?: User | null;
  onToggleSimAutoWalk: () => void;
  onManualSimChange: (tempC: number, pressureKpa: number) => void;
  onClearHistory: () => void;
  onNavigateToConnect: () => void;
}

const METHOD_SHORT: Record<ConnectionMethod, string> = {
  simulation: 'Simulasi',
  bluetooth: 'Bluetooth',
  wifi_local: 'Wi-Fi Lokal',
  cloud_hotspot: 'Cloud',
  usb_serial: 'USB'
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentReading,
  history,
  thresholds,
  activeMethod,
  isConnected,
  isEspOnline = false,
  connectionStatusText,
  simAutoWalk,
  currentUser,
  onToggleSimAutoWalk,
  onManualSimChange,
  onClearHistory,
  onNavigateToConnect
}) => {
  const [pressureUnit, setPressureUnit] = useState<PressureUnit>('kPa');
  const [menuOpen, setMenuOpen] = useState(false);
  const [inspectIssue, setInspectIssue] = useState<{
    key: string;
    anchorEl: HTMLElement;
    tempReason?: string;
    presReason?: string;
    timestamp: string;
  } | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const convertPressure = (kpa: number, unit: PressureUnit): number => {
    if (unit === 'bar') return kpa / 100;
    if (unit === 'psi') return kpa * 0.145038;
    return kpa;
  };

  const formatPressure = (kpa: number, unit: PressureUnit): string => {
    const val = convertPressure(kpa, unit);
    if (unit === 'bar') return val.toFixed(2);
    if (unit === 'psi') return val.toFixed(1);
    return val.toFixed(1);
  };

  const temp = currentReading.temperatureC;
  const presKpa = currentReading.pressureKpa;
  const gaugeKpa = Math.max(0, presKpa - 101.3);

  const cyclePressureUnit = () => {
    setPressureUnit((prev) =>
      prev === 'kPa' ? 'bar' : prev === 'bar' ? 'psi' : 'kPa'
    );
  };

  const isCloudWithoutUser = activeMethod === 'cloud_hotspot' && !currentUser;
  const hasData =
    activeMethod === 'simulation'
      ? true
      : isCloudWithoutUser
      ? false
      : history.length > 0 || (currentReading.id !== 'awaiting' && (currentReading.temperatureC > 0 || currentReading.pressureKpa > 0));

  // Status Suhu: warna pada teks dan kotak kecil di pojok bawah
  const getTempStatus = () => {
    if (!hasData) {
      return {
        icon: <span className="w-2 h-2 rounded-[2.5px] bg-zinc-600 shrink-0" />,
        label: '-',
        tone: 'text-zinc-500'
      };
    }
    if (temp >= thresholds.tempCritical) {
      return {
        icon: <span className="w-2 h-2 rounded-[2.5px] bg-rose-500 shrink-0" />,
        label: 'Kritis',
        tone: 'text-rose-400'
      };
    }
    if (temp > thresholds.tempMaxOptimal) {
      return {
        icon: <span className="w-2 h-2 rounded-[2.5px] bg-amber-400 shrink-0" />,
        label: 'Tinggi',
        tone: 'text-amber-400'
      };
    }
    if (temp < thresholds.tempMinOptimal) {
      return {
        icon: <span className="w-2 h-2 rounded-[2.5px] bg-amber-400 shrink-0" />,
        label: 'Rendah',
        tone: 'text-amber-400'
      };
    }
    return {
      icon: <span className="w-2 h-2 rounded-[2.5px] bg-emerald-400 shrink-0" />,
      label: 'Optimal',
      tone: 'text-emerald-400'
    };
  };

  // Status Tekanan: warna pada teks dan kotak kecil di pojok bawah
  const getPressureStatus = () => {
    if (!hasData) {
      return {
        icon: <span className="w-2 h-2 rounded-[2.5px] bg-zinc-600 shrink-0" />,
        label: '-',
        tone: 'text-zinc-500'
      };
    }
    if (presKpa >= thresholds.pressureCritical) {
      return {
        icon: <span className="w-2 h-2 rounded-[2.5px] bg-rose-500 shrink-0" />,
        label: 'Berlebih',
        tone: 'text-rose-400'
      };
    }
    if (presKpa > thresholds.pressureMaxSafe) {
      return {
        icon: <span className="w-2 h-2 rounded-[2.5px] bg-amber-400 shrink-0" />,
        label: 'Penuh',
        tone: 'text-amber-400'
      };
    }
    if (presKpa < thresholds.pressureMinUse) {
      return {
        icon: <span className="w-2 h-2 rounded-[2.5px] bg-amber-400 shrink-0" />,
        label: 'Awal',
        tone: 'text-amber-400'
      };
    }
    return {
      icon: <span className="w-2 h-2 rounded-[2.5px] bg-emerald-400 shrink-0" />,
      label: 'Stabil',
      tone: 'text-emerald-400'
    };
  };

  const tempStatus = getTempStatus();
  const presStatus = getPressureStatus();

  // Nilai Ekstrem (Min & Max) dengan Waktu Pencapaian (Mengabaikan pembacaan 0 jika ada data riil)
  const allReadings = hasData && history.length > 0 ? history : (activeMethod === 'simulation' ? [currentReading] : []);
  const validTempReadings = allReadings.filter((r) => r.temperatureC > 0);
  const validPresReadings = allReadings.filter((r) => r.pressureKpa > 0);

  const minTempReading = validTempReadings.length > 0
    ? validTempReadings.reduce((min, cur) => (cur.temperatureC < min.temperatureC ? cur : min), validTempReadings[0])
    : (allReadings.length > 0 ? allReadings[0] : null);
  const maxTempReading = validTempReadings.length > 0
    ? validTempReadings.reduce((max, cur) => (cur.temperatureC > max.temperatureC ? cur : max), validTempReadings[0])
    : (allReadings.length > 0 ? allReadings[0] : null);
  const minPresReading = validPresReadings.length > 0
    ? validPresReadings.reduce((min, cur) => (cur.pressureKpa < min.pressureKpa ? cur : min), validPresReadings[0])
    : (allReadings.length > 0 ? allReadings[0] : null);
  const maxPresReading = validPresReadings.length > 0
    ? validPresReadings.reduce((max, cur) => (cur.pressureKpa > max.pressureKpa ? cur : max), validPresReadings[0])
    : (allReadings.length > 0 ? allReadings[0] : null);

  const handleDownloadCsv = () => {
    const headers = ['Waktu', 'Suhu_C', 'Tekanan_kPa', 'Tekanan_Relatif_kPa', 'Sumber'];
    const rows = history.map((row) => [
      row.timestamp,
      row.temperatureC.toFixed(1),
      row.pressureKpa.toFixed(1),
      Math.max(0, row.pressureKpa - 101.3).toFixed(1),
      row.source
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Biogas_ITERA_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3 sm:space-y-4 w-full">
      {/* Bar Status Koneksi Online & Status ESP32 Simpel (Responsif HP & Laptop) */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-1 text-[11px] text-zinc-400">
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Status Cloud */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`w-2 h-2 rounded-[2.5px] shrink-0 ${
                isConnected ? 'bg-emerald-400' : 'bg-zinc-500'
              }`}
            />
            <span className="text-zinc-200 font-medium whitespace-nowrap">
              {activeMethod === 'cloud_hotspot' ? (
                <>
                  <span className="hidden sm:inline">Terhubung Ke </span>
                  <span>Cloud</span>
                </>
              ) : (
                connectionStatusText
              )}
            </span>
          </div>

          {/* Status ESP32 (Mode Cloud) */}
          {activeMethod === 'cloud_hotspot' && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`w-2 h-2 rounded-[2.5px] shrink-0 ${
                  isEspOnline ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
              />
              <span className={`font-medium whitespace-nowrap ${isEspOnline ? 'text-zinc-200' : 'text-zinc-400'}`}>
                ESP32 {isEspOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          )}
        </div>

        {/* Pojok Kanan: Waktu Pembaruan (Adaptif di HP agar tidak bertabrakan) */}
        {hasData && currentReading && currentReading.timestamp && currentReading.timestamp !== '--:--:--' && (
          <span className="font-mono text-[10px] text-zinc-400 shrink-0 ml-auto whitespace-nowrap">
            <span className="hidden sm:inline">{isEspOnline ? 'Pembaruan: ' : 'Terakhir: '}</span>
            {currentReading.timestamp} WIB
          </span>
        )}
      </div>

      {/* ATAS: 2 Card Kanan-Kiri Berdampingan (Info Icon di luar card agar jelas & tidak terpotong) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 items-start w-full">
        {/* KOLOM KIRI: SUHU */}
        <div className="flex flex-col gap-1.5 w-full min-w-0">
          {/* Bar Luar Card: Label & Info Icon di Luar Card */}
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="text-[11px] font-normal tracking-wide text-zinc-400 uppercase">
              Suhu
            </span>
            <InfoButton topicId="temperature_indicator" align="left" />
          </div>

          {/* CARD SUHU (Glassmorphism Halus) */}
          <section className="relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-md p-3 sm:p-4 flex flex-col justify-between min-h-[135px] sm:min-h-[150px] shadow-lg shadow-black/40 hover:border-white/20 transition-all duration-300">
            {/* Garis kilau kaca atas */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none rounded-t-md" />

            {/* Pojok Kiri Atas: Icon */}
            <div className="flex items-center">
              <img
                src="https://cdn-icons-png.flaticon.com/128/11325/11325002.png"
                alt="Suhu"
                className="w-4 h-4 object-contain brightness-0 invert opacity-85 transition-opacity duration-300"
                draggable={false}
              />
            </div>

            {/* Tengah: Angka + Satuan */}
            <div className="my-1.5 sm:my-3 flex items-baseline justify-center text-center">
              <span className="text-2xl sm:text-4xl md:text-5xl font-mono font-medium tracking-tight text-white tabular-nums">
                {hasData ? temp.toFixed(1) : '-'}
              </span>
              {hasData && (
                <span className="text-xs sm:text-sm font-mono text-zinc-400 ml-1">
                  °C
                </span>
              )}
            </div>

            {/* Bawah: Status di kiri & Rentang Optimal di kanan */}
            <div className="flex items-center justify-between text-[11px] w-full pt-1">
              <span className={`flex items-center gap-1 font-medium ${tempStatus.tone}`}>
                {tempStatus.icon}
                <span>{tempStatus.label}</span>
              </span>
              <span className="text-zinc-500 font-mono text-[10px]">
                {thresholds.tempMinOptimal}–{thresholds.tempMaxOptimal}°C
              </span>
            </div>
          </section>
        </div>

        {/* KOLOM KANAN: TEKANAN */}
        <div className="flex flex-col gap-1.5 w-full min-w-0">
          {/* Bar Luar Card: Label, Pilihan Satuan & Info Icon di Luar Card */}
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="text-[11px] font-normal tracking-wide text-zinc-400 uppercase">
              Tekanan
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={cyclePressureUnit}
                title="Ganti satuan tekanan"
                className="text-[10px] font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-white/10"
              >
                [{pressureUnit}]
              </button>
              <InfoButton topicId="pressure_indicator" align="right" />
            </div>
          </div>

          {/* CARD TEKANAN (Glassmorphism Halus) */}
          <section className="relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-md p-3 sm:p-4 flex flex-col justify-between min-h-[135px] sm:min-h-[150px] shadow-lg shadow-black/40 hover:border-white/20 transition-all duration-300">
            {/* Garis kilau kaca atas */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none rounded-t-md" />

            {/* Pojok Kiri Atas: Icon */}
            <div className="flex items-center">
              <img
                src="https://cdn-icons-png.flaticon.com/128/752/752154.png"
                alt="Tekanan"
                className="w-4 h-4 object-contain brightness-0 invert opacity-85 transition-opacity duration-300"
                draggable={false}
              />
            </div>

            {/* Tengah: Angka + Satuan */}
            <div className="my-1.5 sm:my-3 flex items-baseline justify-center text-center">
              <span className="text-2xl sm:text-4xl md:text-5xl font-mono font-medium tracking-tight text-white tabular-nums">
                {hasData ? formatPressure(presKpa, pressureUnit) : '-'}
              </span>
              {hasData && (
                <span className="text-xs sm:text-sm font-mono text-zinc-400 ml-1">
                  {pressureUnit}
                </span>
              )}
            </div>

            {/* Bawah: Status di kiri & Tekanan Relatif ΔP di kanan */}
            <div className="flex items-center justify-between text-[11px] w-full pt-1">
              <span className={`flex items-center gap-1 font-medium ${presStatus.tone}`}>
                {presStatus.icon}
                <span>{presStatus.label}</span>
              </span>
              <span className="text-zinc-500 font-mono text-[10px]">
                {hasData ? `ΔP +${formatPressure(gaugeKpa, pressureUnit)}` : 'ΔP -'}
              </span>
            </div>
          </section>
        </div>
      </div>

      {/* BOX BARU: REKOR EKSTREM (MIN - MAX) DENGAN TEKS LABEL TETAP & HANYA ANGKA BERJALAN */}
      <div className="relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-md p-2.5 sm:p-3 shadow-md shadow-black/40 hover:border-white/20 transition-all duration-300">
        {/* Garis kilau kaca atas */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none rounded-t-md" />

        <div className="flex items-center justify-between gap-2 text-xs">
          {/* Sisi Kiri: Suhu (Icon Tetap, Label Huruf Min/Max Tetap, Angka Nilai Berjalan) */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img
              src="https://cdn-icons-png.flaticon.com/128/11325/11325002.png"
              alt="Suhu"
              className="w-4 h-4 object-contain brightness-0 invert opacity-80 shrink-0"
              draggable={false}
            />
            <div className="flex flex-col gap-1 min-w-0 flex-1 overflow-hidden">
              {/* Row Min: Suhu */}
              <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                <span className="text-zinc-500 font-sans text-[10px] font-semibold shrink-0 w-6">
                  Min:
                </span>
                {/* Desktop: Diam & Statis, Tanpa Gerakan */}
                <div className="hidden md:flex items-center font-mono text-[11px] text-zinc-300 min-w-0 whitespace-nowrap">
                  <span className="font-medium text-white mr-1">
                    {minTempReading && hasData ? `${minTempReading.temperatureC.toFixed(1)}°C` : '-'}
                  </span>
                  <span className="text-zinc-400 text-[10px]">
                    {minTempReading && hasData ? `(${minTempReading.timestamp})` : ''}
                  </span>
                </div>
                {/* Mobile HP: Animasi Ticker Meluncur */}
                <div className="md:hidden overflow-hidden whitespace-nowrap min-w-0 flex-1 relative [mask-image:linear-gradient(to_right,transparent,black_4px,black_calc(100%-4px),transparent)]">
                  <div className="animate-ticker font-mono text-[11px] leading-tight flex items-center">
                    <span className="inline-flex items-center pr-6 text-zinc-300">
                      <span className="font-medium text-white mr-1">
                        {minTempReading && hasData ? `${minTempReading.temperatureC.toFixed(1)}°C` : '-'}
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        {minTempReading && hasData ? `(${minTempReading.timestamp})` : ''}
                      </span>
                    </span>
                    <span className="inline-flex items-center pr-6 text-zinc-300" aria-hidden="true">
                      <span className="font-medium text-white mr-1">
                        {minTempReading && hasData ? `${minTempReading.temperatureC.toFixed(1)}°C` : '-'}
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        {minTempReading && hasData ? `(${minTempReading.timestamp})` : ''}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Row Max: Suhu */}
              <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                <span className="text-zinc-500 font-sans text-[10px] font-semibold shrink-0 w-6">
                  Max:
                </span>
                {/* Desktop: Diam & Statis, Tanpa Gerakan */}
                <div className="hidden md:flex items-center font-mono text-[11px] text-zinc-300 min-w-0 whitespace-nowrap">
                  <span className="font-medium text-white mr-1">
                    {maxTempReading && hasData ? `${maxTempReading.temperatureC.toFixed(1)}°C` : '-'}
                  </span>
                  <span className="text-zinc-400 text-[10px]">
                    {maxTempReading && hasData ? `(${maxTempReading.timestamp})` : ''}
                  </span>
                </div>
                {/* Mobile HP: Animasi Ticker Meluncur */}
                <div className="md:hidden overflow-hidden whitespace-nowrap min-w-0 flex-1 relative [mask-image:linear-gradient(to_right,transparent,black_4px,black_calc(100%-4px),transparent)]">
                  <div className="animate-ticker font-mono text-[11px] leading-tight flex items-center">
                    <span className="inline-flex items-center pr-6 text-zinc-300">
                      <span className="font-medium text-white mr-1">
                        {maxTempReading && hasData ? `${maxTempReading.temperatureC.toFixed(1)}°C` : '-'}
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        {maxTempReading && hasData ? `(${maxTempReading.timestamp})` : ''}
                      </span>
                    </span>
                    <span className="inline-flex items-center pr-6 text-zinc-300" aria-hidden="true">
                      <span className="font-medium text-white mr-1">
                        {maxTempReading && hasData ? `${maxTempReading.temperatureC.toFixed(1)}°C` : '-'}
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        {maxTempReading && hasData ? `(${maxTempReading.timestamp})` : ''}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pembatas Tengah Tetap */}
          <div className="h-8 w-px bg-white/10 shrink-0 mx-1 sm:mx-2 self-center" />

          {/* Sisi Kanan: Tekanan */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img
              src="https://cdn-icons-png.flaticon.com/128/752/752154.png"
              alt="Tekanan"
              className="w-4 h-4 object-contain brightness-0 invert opacity-80 shrink-0"
              draggable={false}
            />
            <div className="flex flex-col gap-1 min-w-0 flex-1 overflow-hidden">
              {/* Row Min: Tekanan */}
              <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                <span className="text-zinc-500 font-sans text-[10px] font-semibold shrink-0 w-6">
                  Min:
                </span>
                {/* Desktop: Diam & Statis, Tanpa Gerakan */}
                <div className="hidden md:flex items-center font-mono text-[11px] text-zinc-300 min-w-0 whitespace-nowrap">
                  <span className="font-medium text-white mr-1">
                    {minPresReading && hasData ? `${formatPressure(minPresReading.pressureKpa, pressureUnit)} ${pressureUnit}` : '-'}
                  </span>
                  <span className="text-zinc-400 text-[10px]">
                    {minPresReading && hasData ? `(${minPresReading.timestamp})` : ''}
                  </span>
                </div>
                {/* Mobile HP: Animasi Ticker Meluncur */}
                <div className="md:hidden overflow-hidden whitespace-nowrap min-w-0 flex-1 relative [mask-image:linear-gradient(to_right,transparent,black_4px,black_calc(100%-4px),transparent)]">
                  <div className="animate-ticker font-mono text-[11px] leading-tight flex items-center">
                    <span className="inline-flex items-center pr-6 text-zinc-300">
                      <span className="font-medium text-white mr-1">
                        {minPresReading && hasData ? `${formatPressure(minPresReading.pressureKpa, pressureUnit)} ${pressureUnit}` : '-'}
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        {minPresReading && hasData ? `(${minPresReading.timestamp})` : ''}
                      </span>
                    </span>
                    <span className="inline-flex items-center pr-6 text-zinc-300" aria-hidden="true">
                      <span className="font-medium text-white mr-1">
                        {minPresReading && hasData ? `${formatPressure(minPresReading.pressureKpa, pressureUnit)} ${pressureUnit}` : '-'}
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        {minPresReading && hasData ? `(${minPresReading.timestamp})` : ''}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Row Max: Tekanan */}
              <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                <span className="text-zinc-500 font-sans text-[10px] font-semibold shrink-0 w-6">
                  Max:
                </span>
                {/* Desktop: Diam & Statis, Tanpa Gerakan */}
                <div className="hidden md:flex items-center font-mono text-[11px] text-zinc-300 min-w-0 whitespace-nowrap">
                  <span className="font-medium text-white mr-1">
                    {maxPresReading && hasData ? `${formatPressure(maxPresReading.pressureKpa, pressureUnit)} ${pressureUnit}` : '-'}
                  </span>
                  <span className="text-zinc-400 text-[10px]">
                    {maxPresReading && hasData ? `(${maxPresReading.timestamp})` : ''}
                  </span>
                </div>
                {/* Mobile HP: Animasi Ticker Meluncur */}
                <div className="md:hidden overflow-hidden whitespace-nowrap min-w-0 flex-1 relative [mask-image:linear-gradient(to_right,transparent,black_4px,black_calc(100%-4px),transparent)]">
                  <div className="animate-ticker font-mono text-[11px] leading-tight flex items-center">
                    <span className="inline-flex items-center pr-6 text-zinc-300">
                      <span className="font-medium text-white mr-1">
                        {maxPresReading && hasData ? `${formatPressure(maxPresReading.pressureKpa, pressureUnit)} ${pressureUnit}` : '-'}
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        {maxPresReading && hasData ? `(${maxPresReading.timestamp})` : ''}
                      </span>
                    </span>
                    <span className="inline-flex items-center pr-6 text-zinc-300" aria-hidden="true">
                      <span className="font-medium text-white mr-1">
                        {maxPresReading && hasData ? `${formatPressure(maxPresReading.pressureKpa, pressureUnit)} ${pressureUnit}` : '-'}
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        {maxPresReading && hasData ? `(${maxPresReading.timestamp})` : ''}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Cuaca Lingkungan Reaktor (Open-Meteo) diletakkan di atas Riwayat */}
      <WeatherCard
        latitude={-5.3176}
        longitude={105.4097}
        locationName="SMAN 1 JATI AGUNG"
      />

      {/* BAWAH: 1 CARD PERSEGI PANJANG (Khusus Riwayat Pembacaan Sensor / Data Log) */}
      <section className="relative bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-md p-3 sm:p-4 space-y-3 w-full shadow-lg shadow-black/40 hover:border-white/20 transition-all duration-300">
        {/* Garis kilau kaca atas */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none rounded-t-md" />

        {/* Header Bar Riwayat */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10 text-xs">
          {/* Pojok Kiri: Hanya teks Riwayat */}
          <span className="text-xs font-semibold text-white tracking-wide">
            Riwayat
          </span>

          {/* Pojok Kanan: Jumlah log (maksimal 59 log) & Tombol Titik 3 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
              {Math.min(59, history.length)} log
            </span>

            {/* Menu Titik 3: Menempel pas di bawah ikon titik 3 */}
            <div className="relative inline-flex items-center" ref={menuContainerRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                aria-label="Opsi Riwayat"
                title="Opsi Riwayat (Unduh / Hapus)"
                className={`p-1 rounded transition-colors cursor-pointer ${
                  menuOpen
                    ? 'text-white bg-white/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Box Menu Kecil dengan Ujung Lancip yang tepat di bawah Titik 3 */}
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 z-50 w-36 bg-[#141414] border border-white/15 rounded-md shadow-2xl shadow-black/90 p-1 text-left animate-in fade-in zoom-in-95 duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Ujung Lancip (Arrow Pointer) mengarah tepat ke ikon titik 3 */}
                  <div
                    aria-hidden="true"
                    className="absolute -top-1.5 right-2 w-3 h-3 bg-[#141414] border-t border-l border-white/15 rotate-45 pointer-events-none"
                  />

                  <div className="flex flex-col space-y-0.5 relative z-10">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        handleDownloadCsv();
                      }}
                      className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-zinc-200 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer text-left"
                    >
                      <Download className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>Unduh CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onClearHistory();
                      }}
                      className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors cursor-pointer text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Hapus Riwayat</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabel Riwayat Sensor: Seimbang, Rata Tengah, Satuan di Bawah Teks & Tinggi Paten Sejak Awal */}
        <div className="overflow-x-auto w-full h-[275px] overflow-y-auto">
          <table className="w-full border-collapse text-xs font-mono tabular-nums">
            <thead className="sticky top-0 z-10 bg-[#0c0c0c]/95 backdrop-blur-xs">
              <tr className="border-b border-white/10 text-zinc-300 font-sans text-[11px]">
                <th className="py-2 px-1 text-center font-normal">
                  <span className="block text-zinc-200">Waktu</span>
                  <span className="block text-[10px] text-zinc-400 font-mono">WIB</span>
                </th>
                <th className="py-2 px-1 text-center font-normal">
                  <span className="block text-zinc-200">Suhu</span>
                  <span className="block text-[10px] text-zinc-400 font-mono">(°C)</span>
                </th>
                <th className="py-2 px-1 text-center font-normal">
                  <span className="block text-zinc-200">Tekanan</span>
                  <span className="block text-[10px] text-zinc-400 font-mono">({pressureUnit})</span>
                </th>
                <th className="py-2 px-1 text-center font-normal">
                  <span className="block text-zinc-200">ΔP Relatif</span>
                  <span className="block text-[10px] text-zinc-400 font-mono">({pressureUnit})</span>
                </th>
                <th className="py-2 px-1 text-center font-normal">
                  <span className="block text-zinc-200">Status</span>
                  <span className="block text-[10px] text-zinc-400 font-mono">Kondisi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-[11px]">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="h-[210px] text-center text-zinc-400 font-sans align-middle">
                    {isCloudWithoutUser
                      ? 'Silakan masuk akun Google untuk melihat sinkronisasi sensor online.'
                      : activeMethod === 'cloud_hotspot'
                      ? 'Menunggu data sensor ESP32 masuk dari Firebase Cloud Firestore...'
                      : 'Belum ada riwayat pembacaan sensor.'}
                  </td>
                </tr>
              ) : (
                history.map((item, idx) => {
                  const itemPres = convertPressure(item.pressureKpa, pressureUnit);
                  const itemGauge = convertPressure(
                    Math.max(0, item.pressureKpa - 101.3),
                    pressureUnit
                  );
                  const isOptTemp =
                    item.temperatureC >= thresholds.tempMinOptimal &&
                    item.temperatureC <= thresholds.tempMaxOptimal;
                  const isOptPres =
                    item.pressureKpa >= thresholds.pressureMinUse &&
                    item.pressureKpa <= thresholds.pressureMaxSafe;
                  const isOptimal = isOptTemp && isOptPres;

                  const itemKey = item.id || `${item.timestamp}-${idx}`;

                  // Analisis detail parameter jika melewati batas
                  let tempReason: string | undefined;
                  if (item.temperatureC >= thresholds.tempCritical) {
                    tempReason = `Suhu Kritis: ${item.temperatureC.toFixed(1)}°C (≥ ${thresholds.tempCritical}°C)`;
                  } else if (item.temperatureC > thresholds.tempMaxOptimal) {
                    tempReason = `Suhu Tinggi: ${item.temperatureC.toFixed(1)}°C (> ${thresholds.tempMaxOptimal}°C)`;
                  } else if (item.temperatureC < thresholds.tempMinOptimal) {
                    tempReason = `Suhu Rendah: ${item.temperatureC.toFixed(1)}°C (< ${thresholds.tempMinOptimal}°C)`;
                  }

                  let presReason: string | undefined;
                  const presFmt = itemPres.toFixed(pressureUnit === 'bar' ? 2 : 1);
                  const critPresFmt = convertPressure(thresholds.pressureCritical, pressureUnit).toFixed(
                    pressureUnit === 'bar' ? 2 : 1
                  );
                  const maxSafePresFmt = convertPressure(thresholds.pressureMaxSafe, pressureUnit).toFixed(
                    pressureUnit === 'bar' ? 2 : 1
                  );
                  const minUsePresFmt = convertPressure(thresholds.pressureMinUse, pressureUnit).toFixed(
                    pressureUnit === 'bar' ? 2 : 1
                  );

                  if (item.pressureKpa >= thresholds.pressureCritical) {
                    presReason = `Tekanan Berlebih: ${presFmt} ${pressureUnit} (≥ ${critPresFmt} ${pressureUnit})`;
                  } else if (item.pressureKpa > thresholds.pressureMaxSafe) {
                    presReason = `Tekanan Tinggi: ${presFmt} ${pressureUnit} (> ${maxSafePresFmt} ${pressureUnit})`;
                  } else if (item.pressureKpa < thresholds.pressureMinUse) {
                    presReason = `Tekanan Rendah: ${presFmt} ${pressureUnit} (< ${minUsePresFmt} ${pressureUnit})`;
                  }

                  return (
                    <tr
                      key={itemKey}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-2 px-1 text-center text-zinc-400 whitespace-nowrap">
                        {item.timestamp}
                      </td>
                      <td className="py-2 px-1 text-center whitespace-nowrap text-white font-medium">
                        {item.temperatureC.toFixed(1)}
                      </td>
                      <td className="py-2 px-1 text-center whitespace-nowrap text-white font-medium">
                        {itemPres.toFixed(pressureUnit === 'bar' ? 2 : 1)}
                      </td>
                      <td className="py-2 px-1 text-center whitespace-nowrap text-zinc-300 font-medium">
                        +{itemGauge.toFixed(pressureUnit === 'bar' ? 2 : 1)}
                      </td>
                      <td className="py-2 px-1 text-center whitespace-nowrap font-sans">
                        {isOptimal ? (
                          <span className="inline-flex items-center justify-center gap-1.5 mx-auto text-emerald-400">
                            <span className="w-2 h-2 rounded-[2.5px] bg-emerald-400 shrink-0" />
                            <span>Optimal</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentTarget = e.currentTarget;
                              setInspectIssue((prev) =>
                                prev?.key === itemKey
                                  ? null
                                  : {
                                      key: itemKey,
                                      anchorEl: currentTarget,
                                      tempReason,
                                      presReason,
                                      timestamp: item.timestamp
                                    }
                              );
                            }}
                            className={`inline-flex items-center justify-center gap-1.5 mx-auto px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                              inspectIssue?.key === itemKey
                                ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40'
                                : 'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10'
                            }`}
                            title="Klik untuk melihat parameter mana yang melewati batas"
                          >
                            <span className="w-2 h-2 rounded-[2.5px] bg-amber-400 shrink-0" />
                            <span className="underline decoration-dotted decoration-amber-400/60 underline-offset-2">
                              Pantau
                            </span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Box Popover Mengambang Penjelasan Parameter Melewati Batas */}
      <FloatingAnchorBox
        isOpen={!!inspectIssue}
        onClose={() => setInspectIssue(null)}
        anchorEl={inspectIssue?.anchorEl || null}
        maxWidth={290}
      >
        {inspectIssue && (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
              <span className="flex items-center gap-1.5 font-medium text-amber-400">
                <span className="w-2 h-2 rounded-[2.5px] bg-amber-400 shrink-0" />
                <span>Parameter Melewati Batas</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {inspectIssue.timestamp}
              </span>
            </div>

            <div className="space-y-1.5 pt-0.5">
              {inspectIssue.tempReason && (
                <div className="flex items-start gap-1.5 text-zinc-200">
                  <span className="text-amber-400 text-xs leading-4">•</span>
                  <span className="text-[11px] leading-relaxed">
                    {inspectIssue.tempReason}
                  </span>
                </div>
              )}
              {inspectIssue.presReason && (
                <div className="flex items-start gap-1.5 text-zinc-200">
                  <span className="text-amber-400 text-xs leading-4">•</span>
                  <span className="text-[11px] leading-relaxed">
                    {inspectIssue.presReason}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-1.5 border-t border-white/10 text-[10px] text-zinc-400 font-sans">
              Batas aman: Suhu {thresholds.tempMinOptimal}–{thresholds.tempMaxOptimal}°C &middot; Tekanan {thresholds.pressureMinUse}–{thresholds.pressureMaxSafe} kPa
            </div>
          </div>
        )}
      </FloatingAnchorBox>
    </div>
  );
};
