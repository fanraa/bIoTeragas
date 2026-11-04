import React, { useState, useMemo, useRef } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import {
  ConnectionMethod,
  PressureUnit,
  SensorReading,
  ThresholdConfig
} from '../types/biogas';
import { FloatingAnchorBox } from './InfoPopover';

export type ChartMetric = 'both' | 'temp' | 'pressure';
export type ChartRangePreset = '15_logs' | '30_logs' | '24_hours' | '7_days' | 'all';

export const RANGE_OPTIONS: {
  id: ChartRangePreset;
  shortLabel: string;
  label: string;
  sublabel: string;
}[] = [
  {
    id: '15_logs',
    shortLabel: '15 Data',
    label: '15 Data Terbaru',
    sublabel: 'Detail titik terbaru'
  },
  {
    id: '30_logs',
    shortLabel: '30 Data',
    label: '30 Data Terbaru',
    sublabel: 'Tren menengah'
  },
  {
    id: '24_hours',
    shortLabel: '24 Jam',
    label: '24 Jam Terakhir',
    sublabel: 'Rentang 1 hari'
  },
  {
    id: '7_days',
    shortLabel: '7 Hari',
    label: '7 Hari (Seminggu)',
    sublabel: 'Rentang 1 minggu'
  },
  {
    id: 'all',
    shortLabel: 'Semua',
    label: 'Semua Data',
    sublabel: 'Keseluruhan riwayat'
  }
];

interface SensorHistoryChartProps {
  history: SensorReading[];
  thresholds: ThresholdConfig;
  pressureUnit: PressureUnit;
  activeMethod: ConnectionMethod;
  metric: ChartMetric;
  onChangeMetric: (m: ChartMetric) => void;
  rangePreset: ChartRangePreset;
  onChangeRangePreset: (r: ChartRangePreset) => void;
  convertPressure: (kpa: number, unit: PressureUnit) => number;
}

export const SensorHistoryChart: React.FC<SensorHistoryChartProps> = ({
  history,
  thresholds,
  pressureUnit,
  activeMethod,
  metric,
  onChangeMetric,
  rangePreset,
  onChangeRangePreset,
  convertPressure
}) => {
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const rangeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Filter data sesuai pilihan dropdown rentang dan urutkan dari kiri (lama) ke kanan (terbaru)
  const dataPoints = useMemo(() => {
    const valid = history.filter((r) => r.temperatureC > 0 || r.pressureKpa > 0);
    if (valid.length === 0) return [];

    const now = Date.now();
    let filtered = valid;

    if (rangePreset === '15_logs') {
      filtered = valid.slice(0, 15);
    } else if (rangePreset === '30_logs') {
      filtered = valid.slice(0, 30);
    } else if (rangePreset === '24_hours') {
      const cutoff = now - 24 * 60 * 60 * 1000;
      const inWindow = valid.filter((r) => !r.epochMs || r.epochMs >= cutoff);
      filtered = inWindow.length > 0 ? inWindow : valid;
    } else if (rangePreset === '7_days') {
      const cutoff = now - 7 * 24 * 60 * 60 * 1000;
      const inWindow = valid.filter((r) => !r.epochMs || r.epochMs >= cutoff);
      filtered = inWindow.length > 0 ? inWindow : valid;
    } else {
      filtered = valid;
    }

    return [...filtered].reverse();
  }, [history, rangePreset]);

  const currentRangeOption =
    RANGE_OPTIONS.find((o) => o.id === rangePreset) || RANGE_OPTIONS[0];

  const presDecimals = pressureUnit === 'bar' ? 2 : 1;

  const tempValues = useMemo(
    () => dataPoints.map((d) => d.temperatureC),
    [dataPoints]
  );
  const presValues = useMemo(
    () => dataPoints.map((d) => convertPressure(d.pressureKpa, pressureUnit)),
    [dataPoints, pressureUnit, convertPressure]
  );

  // Batas optimal Suhu & Tekanan
  const tempOptMin = thresholds.tempMinOptimal;
  const tempOptMax = thresholds.tempMaxOptimal;
  const presOptMin = convertPressure(thresholds.pressureMinUse, pressureUnit);
  const presOptMax = convertPressure(thresholds.pressureMaxSafe, pressureUnit);

  // Skala sumbu Y untuk Suhu & Tekanan
  const bounds = useMemo(() => {
    if (dataPoints.length === 0) {
      return {
        tempMin: tempOptMin - 4,
        tempMax: tempOptMax + 4,
        presMin: presOptMin - 10,
        presMax: presOptMax + 10
      };
    }

    const tMinRaw = Math.min(...tempValues, metric === 'temp' ? tempOptMin : Infinity);
    const tMaxRaw = Math.max(...tempValues, metric === 'temp' ? tempOptMax : -Infinity);
    const tSpan = Math.max(3.0, tMaxRaw - tMinRaw);
    const tPad = tSpan * 0.24;

    const pMinRaw = Math.min(...presValues, metric === 'pressure' ? presOptMin : Infinity);
    const pMaxRaw = Math.max(...presValues, metric === 'pressure' ? presOptMax : -Infinity);
    const pSpan = Math.max(pressureUnit === 'bar' ? 0.06 : 6.0, pMaxRaw - pMinRaw);
    const pPad = pSpan * 0.24;

    return {
      tempMin: Math.max(0, tMinRaw - tPad),
      tempMax: tMaxRaw + tPad,
      presMin: Math.max(0, pMinRaw - pPad),
      presMax: pMaxRaw + pPad
    };
  }, [
    dataPoints.length,
    tempValues,
    presValues,
    metric,
    tempOptMin,
    tempOptMax,
    presOptMin,
    presOptMax,
    pressureUnit
  ]);

  // Rata-rata dari rentang aktif
  const avgTemp = useMemo(() => {
    if (tempValues.length === 0) return 0;
    return tempValues.reduce((a, b) => a + b, 0) / tempValues.length;
  }, [tempValues]);

  const avgPres = useMemo(() => {
    if (presValues.length === 0) return 0;
    return presValues.reduce((a, b) => a + b, 0) / presValues.length;
  }, [presValues]);

  // Dimensi Kanvas SVG
  const width = 580;
  const height = 166;
  const padLeft = 42;
  const padRight = 14;
  const padTop = 10;
  const padBottom = 20;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Untuk mode 'both' (Semua): Bagi kanvas menjadi 2 jalur sejajar (Atas: Suhu, Bawah: Tekanan)
  const laneGap = 14;
  const laneH = (plotH - laneGap) / 2;
  const topLaneY0 = padTop;
  const topLaneY1 = padTop + laneH;
  const bottomLaneY0 = topLaneY1 + laneGap;
  const bottomLaneY1 = padTop + plotH;

  const getX = (index: number) => {
    if (dataPoints.length <= 1) return padLeft + plotW / 2;
    return padLeft + (index / (dataPoints.length - 1)) * plotW;
  };

  const mapToRange = (val: number, min: number, max: number, yTop: number, yBottom: number) => {
    const range = Math.max(0.0001, max - min);
    const ratio = Math.min(1, Math.max(0, (val - min) / range));
    return yBottom - ratio * (yBottom - yTop);
  };

  const tempCoords = useMemo(() => {
    const yTop = metric === 'both' ? topLaneY0 : padTop;
    const yBottom = metric === 'both' ? topLaneY1 : padTop + plotH;
    return tempValues.map((v, i) => ({
      x: getX(i),
      y: mapToRange(v, bounds.tempMin, bounds.tempMax, yTop, yBottom),
      val: v
    }));
  }, [tempValues, bounds, metric]);

  const presCoords = useMemo(() => {
    const yTop = metric === 'both' ? bottomLaneY0 : padTop;
    const yBottom = metric === 'both' ? bottomLaneY1 : padTop + plotH;
    return presValues.map((v, i) => ({
      x: getX(i),
      y: mapToRange(v, bounds.presMin, bounds.presMax, yTop, yBottom),
      val: v
    }));
  }, [presValues, bounds, metric]);

  // Kurva halus Cubic Bezier
  const buildSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) {
      return `M ${padLeft} ${pts[0].y.toFixed(1)} L ${(padLeft + plotW).toFixed(1)} ${pts[0].y.toFixed(1)}`;
    }
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpx1 = p0.x + (p1.x - p0.x) * 0.42;
      const cpy1 = p0.y;
      const cpx2 = p0.x + (p1.x - p0.x) * 0.58;
      const cpy2 = p1.y;
      d += ` C ${cpx1.toFixed(1)} ${cpy1.toFixed(1)}, ${cpx2.toFixed(1)} ${cpy2.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  };

  const buildAreaPath = (pts: { x: number; y: number }[], baselineY: number) => {
    if (pts.length === 0) return '';
    const linePath = buildSmoothPath(pts);
    const base = baselineY.toFixed(1);
    if (pts.length === 1) {
      return `${linePath} L ${(padLeft + plotW).toFixed(1)} ${base} L ${padLeft.toFixed(1)} ${base} Z`;
    }
    return `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${base} L ${pts[0].x.toFixed(1)} ${base} Z`;
  };

  // Sentuh / geser untuk memilih titik waktu
  const handlePointerMove = (
    e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>
  ) => {
    if (!svgRef.current || dataPoints.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
    if (clientX === undefined) return;

    const relX = ((clientX - rect.left) / rect.width) * width;
    if (dataPoints.length === 1) {
      setActiveIndex(0);
      return;
    }
    const clampedX = Math.max(padLeft, Math.min(padLeft + plotW, relX));
    const ratio = (clampedX - padLeft) / plotW;
    const idx = Math.round(ratio * (dataPoints.length - 1));
    setActiveIndex(Math.max(0, Math.min(dataPoints.length - 1, idx)));
  };

  if (dataPoints.length === 0) {
    return (
      <div className="h-[275px] flex items-center justify-center text-center text-xs text-zinc-400 font-sans px-4">
        {activeMethod === 'cloud_hotspot'
          ? 'Menunggu data sensor ESP32 masuk dari Firebase Cloud Firestore...'
          : 'Belum ada riwayat pembacaan sensor untuk ditampilkan pada grafik.'}
      </div>
    );
  }

  const inspectedIndex =
    activeIndex !== null && dataPoints[activeIndex]
      ? activeIndex
      : dataPoints.length - 1;
  const inspectedItem = dataPoints[inspectedIndex];
  const inspectedTemp = tempValues[inspectedIndex] ?? 0;
  const inspectedPres = presValues[inspectedIndex] ?? 0;

  // Tampilkan titik (dots) individual jika jumlah titik <= 22 agar tidak terlalu rapat saat melihat Semua Data
  const showAllDots = dataPoints.length <= 22;

  return (
    <div className="h-[275px] flex flex-col justify-between select-none w-full">
      {/* Bar Atas Responsif HP & Desktop: Kiri = Tab [Semua | Suhu | Tekanan], Kanan = Dropdown Rentang */}
      <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-white/5">
        {/* Segmented Parameter Tabs */}
        <div className="inline-flex items-center gap-0.5 bg-white/[0.03] border border-white/10 rounded p-0.5 min-w-0">
          <button
            type="button"
            onClick={() => onChangeMetric('both')}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer ${
              metric === 'both'
                ? 'bg-white/10 text-white border border-white/15 font-medium'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            <span className="flex items-center gap-0.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-[2px] bg-amber-400" />
              <span className="w-1.5 h-1.5 rounded-[2px] bg-sky-400" />
            </span>
            <span>Semua</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeMetric('temp')}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer ${
              metric === 'temp'
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30 font-medium'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            <img
              src="https://cdn-icons-png.flaticon.com/128/11325/11325002.png"
              alt="Suhu"
              className="w-3 h-3 object-contain brightness-0 invert opacity-85 shrink-0"
              draggable={false}
            />
            <span>Suhu</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeMetric('pressure')}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer ${
              metric === 'pressure'
                ? 'bg-sky-400/15 text-sky-300 border border-sky-400/30 font-medium'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            <img
              src="https://cdn-icons-png.flaticon.com/128/752/752154.png"
              alt="Tekanan"
              className="w-3 h-3 object-contain brightness-0 invert opacity-85 shrink-0"
              draggable={false}
            />
            <span>Tekanan</span>
          </button>
        </div>

        {/* Tombol Dropdown Rentang (Menggunakan FloatingAnchorBox Portal supaya 100% pas & tidak pernah terpotong di HP) */}
        <div className="relative inline-flex items-center shrink-0">
          <button
            ref={rangeBtnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRangeMenuOpen((prev) => !prev);
            }}
            title="Pilih rentang data grafik"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border transition-colors cursor-pointer ${
              rangeMenuOpen
                ? 'bg-white/10 text-white border-white/20'
                : 'bg-white/[0.03] text-zinc-300 border-white/10 hover:text-white hover:border-white/20'
            }`}
          >
            <span>{currentRangeOption.shortLabel}</span>
            <ChevronDown
              className={`w-3 h-3 text-zinc-400 transition-transform duration-150 ${
                rangeMenuOpen ? 'rotate-180 text-white' : ''
              }`}
            />
          </button>

          <FloatingAnchorBox
            isOpen={rangeMenuOpen}
            onClose={() => setRangeMenuOpen(false)}
            anchorEl={rangeBtnRef.current}
            maxWidth={215}
          >
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                <span className="text-[11px] font-medium text-zinc-300">
                  Rentang Grafik
                </span>
                <button
                  type="button"
                  onClick={() => setRangeMenuOpen(false)}
                  className="text-zinc-400 hover:text-white p-0.5 transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-0.5 pt-0.5">
                {RANGE_OPTIONS.map((opt) => {
                  const isSelected = opt.id === rangePreset;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onChangeRangePreset(opt.id);
                        setActiveIndex(null);
                        setRangeMenuOpen(false);
                      }}
                      className={`flex items-center justify-between w-full px-2 py-1.5 rounded text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-white/10 text-white font-medium'
                          : 'text-zinc-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-1">
                        <span className="text-[11px] leading-tight truncate">
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-zinc-400 leading-tight truncate">
                          {opt.sublabel}
                        </span>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </FloatingAnchorBox>
        </div>
      </div>

      {/* Kanvas SVG Grafik */}
      <div className="relative flex-1 w-full min-h-0 pt-0.5">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible touch-pan-y cursor-crosshair"
          onMouseMove={handlePointerMove}
          onMouseLeave={() => setActiveIndex(null)}
          onTouchStart={handlePointerMove}
          onTouchMove={handlePointerMove}
          onTouchEnd={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id="chartWarmTempGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.25" />
              <stop offset="90%" stopColor="#fbbf24" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="chartCalmPresGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
              <stop offset="90%" stopColor="#38bdf8" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {metric === 'both' ? (
            <>
              {[0, 1].map((t, i) => {
                const y = topLaneY0 + t * laneH;
                const val = bounds.tempMax - t * (bounds.tempMax - bounds.tempMin);
                return (
                  <g key={`t-${i}`}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={padLeft + plotW}
                      y2={y}
                      stroke="rgba(255,255,255,0.05)"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 6}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-amber-300/80 font-mono text-[9.5px]"
                    >
                      {val.toFixed(0)}°C
                    </text>
                  </g>
                );
              })}

              <line
                x1={padLeft}
                y1={topLaneY1 + laneGap / 2}
                x2={padLeft + plotW}
                y2={topLaneY1 + laneGap / 2}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />

              {[0, 1].map((t, i) => {
                const y = bottomLaneY0 + t * laneH;
                const val = bounds.presMax - t * (bounds.presMax - bounds.presMin);
                return (
                  <g key={`p-${i}`}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={padLeft + plotW}
                      y2={y}
                      stroke="rgba(255,255,255,0.05)"
                      strokeDasharray={i === 1 ? undefined : '3 3'}
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 6}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-sky-300/80 font-mono text-[9.5px]"
                    >
                      {val.toFixed(presDecimals)}
                    </text>
                  </g>
                );
              })}

              <path
                d={buildAreaPath(tempCoords, topLaneY1)}
                fill="url(#chartWarmTempGrad)"
              />
              <path
                d={buildSmoothPath(tempCoords)}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d={buildAreaPath(presCoords, bottomLaneY1)}
                fill="url(#chartCalmPresGrad)"
              />
              <path
                d={buildSmoothPath(presCoords)}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {tempCoords.map((pt, idx) => {
                const isSelected = idx === inspectedIndex;
                if (!showAllDots && !isSelected) return null;
                return (
                  <circle
                    key={`td-${idx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 3.8 : 2}
                    fill={isSelected ? '#090B10' : '#fbbf24'}
                    stroke={isSelected ? '#fbbf24' : '#090B10'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                );
              })}

              {presCoords.map((pt, idx) => {
                const isSelected = idx === inspectedIndex;
                if (!showAllDots && !isSelected) return null;
                return (
                  <circle
                    key={`pd-${idx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 3.8 : 2}
                    fill={isSelected ? '#090B10' : '#38bdf8'}
                    stroke={isSelected ? '#38bdf8' : '#090B10'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                );
              })}
            </>
          ) : (
            (() => {
              const isTemp = metric === 'temp';
              const activeCoords = isTemp ? tempCoords : presCoords;
              const strokeColor = isTemp ? '#fbbf24' : '#38bdf8';
              const gradId = isTemp ? 'chartWarmTempGrad' : 'chartCalmPresGrad';
              const yMin = isTemp ? bounds.tempMin : bounds.presMin;
              const yMax = isTemp ? bounds.tempMax : bounds.presMax;
              const optMin = isTemp ? tempOptMin : presOptMin;
              const optMax = isTemp ? tempOptMax : presOptMax;

              const optTopY = mapToRange(optMax, yMin, yMax, padTop, padTop + plotH);
              const optBottomY = mapToRange(optMin, yMin, yMax, padTop, padTop + plotH);
              const optBandHeight = Math.max(2, optBottomY - optTopY);

              return (
                <>
                  <rect
                    x={padLeft}
                    y={optTopY}
                    width={plotW}
                    height={optBandHeight}
                    fill="rgba(52, 211, 153, 0.06)"
                  />
                  <line
                    x1={padLeft}
                    y1={optTopY}
                    x2={padLeft + plotW}
                    y2={optTopY}
                    stroke="rgba(52, 211, 153, 0.25)"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <line
                    x1={padLeft}
                    y1={optBottomY}
                    x2={padLeft + plotW}
                    y2={optBottomY}
                    stroke="rgba(52, 211, 153, 0.25)"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />

                  {[0, 0.33, 0.67, 1].map((t, i) => {
                    const y = padTop + t * plotH;
                    const val = yMax - t * (yMax - yMin);
                    return (
                      <g key={i}>
                        <line
                          x1={padLeft}
                          y1={y}
                          x2={padLeft + plotW}
                          y2={y}
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth="1"
                        />
                        <text
                          x={padLeft - 7}
                          y={y + 3}
                          textAnchor="end"
                          className="fill-zinc-400 font-mono text-[10px]"
                        >
                          {val.toFixed(isTemp ? 0 : presDecimals)}
                        </text>
                      </g>
                    );
                  })}

                  <path
                    d={buildAreaPath(activeCoords, padTop + plotH)}
                    fill={`url(#${gradId})`}
                  />
                  <path
                    d={buildSmoothPath(activeCoords)}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {activeCoords.map((pt, idx) => {
                    const isSelected = idx === inspectedIndex;
                    if (!showAllDots && !isSelected) return null;
                    return (
                      <circle
                        key={idx}
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 4.2 : 2.3}
                        fill={isSelected ? '#090B10' : strokeColor}
                        stroke={isSelected ? strokeColor : '#090B10'}
                        strokeWidth={isSelected ? 2.2 : 1}
                      />
                    );
                  })}
                </>
              );
            })()
          )}

          {tempCoords[inspectedIndex] && (
            <line
              x1={tempCoords[inspectedIndex].x}
              y1={padTop}
              x2={tempCoords[inspectedIndex].x}
              y2={padTop + plotH}
              stroke="rgba(255,255,255,0.22)"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
          )}

          {dataPoints.length > 0 && (
            <g className="fill-zinc-400 font-mono text-[10px]">
              <text x={padLeft} y={height - 2} textAnchor="start">
                {dataPoints[0].timestamp}
              </text>
              {dataPoints.length > 2 && (
                <text
                  x={padLeft + plotW / 2}
                  y={height - 2}
                  textAnchor="middle"
                >
                  {dataPoints[Math.floor(dataPoints.length / 2)].timestamp}
                </text>
              )}
              {dataPoints.length > 1 && (
                <text x={padLeft + plotW} y={height - 2} textAnchor="end">
                  {dataPoints[dataPoints.length - 1].timestamp}
                </text>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Footer Info: Menampilkan Titik Waktu yang Disentuh & Rata-rata secara Rapi di HP maupun Desktop */}
      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/5 text-[10px] font-mono tabular-nums text-zinc-400">
        <div className="flex items-center gap-2 min-w-0 truncate">
          <span className="text-zinc-400">{inspectedItem.timestamp}</span>
          {(metric === 'both' || metric === 'temp') && (
            <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-[2px] bg-amber-400 shrink-0" />
              {inspectedTemp.toFixed(1)}°C
            </span>
          )}
          {(metric === 'both' || metric === 'pressure') && (
            <span className="inline-flex items-center gap-1 text-sky-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-[2px] bg-sky-400 shrink-0" />
              {inspectedPres.toFixed(presDecimals)} {pressureUnit}
            </span>
          )}
        </div>

        <div className="shrink-0 text-zinc-400">
          <span className="font-sans">Rata-rata: </span>
          {metric === 'both' ? (
            <span className="text-zinc-200">
              {avgTemp.toFixed(1)}°C &middot; {avgPres.toFixed(presDecimals)} {pressureUnit}
            </span>
          ) : metric === 'temp' ? (
            <span className="text-zinc-200">{avgTemp.toFixed(1)}°C</span>
          ) : (
            <span className="text-zinc-200">
              {avgPres.toFixed(presDecimals)} {pressureUnit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
