import { PressureUnit, SensorReading, ThresholdConfig } from '../types/biogas';
import { ChartMetric, ChartRangePreset, RANGE_OPTIONS } from '../components/SensorHistoryChart';

interface ExportChartOptions {
  history: SensorReading[];
  thresholds: ThresholdConfig;
  pressureUnit: PressureUnit;
  metric: ChartMetric;
  rangePreset: ChartRangePreset;
  convertPressure: (kpa: number, unit: PressureUnit) => number;
}

export function filterReadingsByRange(
  history: SensorReading[],
  rangePreset: ChartRangePreset
): SensorReading[] {
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
}

export function exportSensorChartPng(options: ExportChartOptions): void {
  const {
    history,
    thresholds,
    pressureUnit,
    metric,
    rangePreset,
    convertPressure
  } = options;

  const dataPoints = filterReadingsByRange(history, rangePreset);
  if (dataPoints.length === 0) return;

  const rangeObj =
    RANGE_OPTIONS.find((r) => r.id === rangePreset) || RANGE_OPTIONS[0];
  const presDecimals = pressureUnit === 'bar' ? 2 : 1;

  const tempValues = dataPoints.map((d) => d.temperatureC);
  const presValues = dataPoints.map((d) =>
    convertPressure(d.pressureKpa, pressureUnit)
  );
  const gaugeValues = dataPoints.map((d) =>
    convertPressure(Math.max(0, d.pressureKpa - 101.3), pressureUnit)
  );

  const minTemp = Math.min(...tempValues);
  const maxTemp = Math.max(...tempValues);
  const avgTemp =
    tempValues.reduce((a, b) => a + b, 0) / Math.max(1, tempValues.length);

  const minPres = Math.min(...presValues);
  const maxPres = Math.max(...presValues);
  const avgPres =
    presValues.reduce((a, b) => a + b, 0) / Math.max(1, presValues.length);
  const avgGauge =
    gaugeValues.reduce((a, b) => a + b, 0) / Math.max(1, gaugeValues.length);

  const tempOptMin = thresholds.tempMinOptimal;
  const tempOptMax = thresholds.tempMaxOptimal;
  const presOptMin = convertPressure(thresholds.pressureMinUse, pressureUnit);
  const presOptMax = convertPressure(thresholds.pressureMaxSafe, pressureUnit);

  const isAllMode = metric === 'both';

  // Kanvas resolusi tinggi (Retina 2x kualitas laporan PKM)
  const W = 1400;
  const H = isAllMode ? 1320 : 760;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background gelap elegan khas bIoTeragas
  ctx.fillStyle = '#090B10';
  ctx.fillRect(0, 0, W, H);

  // Bingkai luar tipis
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, W - 32, H - 32);

  // Header Laporan Grafik
  const startTime = dataPoints[0]?.timestamp || '-';
  const endTime = dataPoints[dataPoints.length - 1]?.timestamp || '-';
  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const metricTitle =
    metric === 'both'
      ? 'LENGKAP (GABUNGAN, SUHU & TEKANAN)'
      : metric === 'temp'
        ? 'INDIKATOR SUHU REAKTOR (°C)'
        : `INDIKATOR TEKANAN REAKTOR (${pressureUnit.toUpperCase()})`;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    'bIoTeragas — Laporan Grafik Monitoring Reaktor Biogas',
    48,
    64
  );

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `Kolaborasi Riset Fisika ITERA & SMAN 1 Jati Agung  •  Tanggal Unduh: ${dateStr}`,
    48,
    92
  );

  // Badge Info Rentang & Kategori di Kanan Atas
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.fillText(`MODE: ${metricTitle}`, W - 48, 62);

  ctx.fillStyle = '#d4d4d8';
  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillText(
    `Rentang: ${rangeObj.label} (${dataPoints.length} Titik Data  |  ${startTime} – ${endTime} WIB)`,
    W - 48,
    88
  );
  ctx.textAlign = 'left';

  // Garis pemisah header
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 112);
  ctx.lineTo(W - 48, 112);
  ctx.stroke();

  // Kotak Ringkasan Statistik (Suhu & Tekanan)
  const statY = 128;
  const statH = 74;
  const boxW = (W - 96 - 20) / 2;

  // Box Kiri: Ringkasan Suhu
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fillRect(48, statY, boxW, statH);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.28)';
  ctx.strokeRect(48, statY, boxW, statH);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('RINGKASAN SUHU REAKTOR (°C)', 66, statY + 26);

  ctx.fillStyle = '#f4f4f5';
  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillText(
    `Rata-rata: ${avgTemp.toFixed(1)}°C   |   Min: ${minTemp.toFixed(1)}°C   |   Max: ${maxTemp.toFixed(1)}°C   |   Optimal: ${tempOptMin}–${tempOptMax}°C`,
    66,
    statY + 52
  );

  // Box Kanan: Ringkasan Tekanan
  const rightBoxX = 48 + boxW + 20;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fillRect(rightBoxX, statY, boxW, statH);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  ctx.strokeRect(rightBoxX, statY, boxW, statH);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `RINGKASAN TEKANAN REAKTOR (${pressureUnit})`,
    rightBoxX + 18,
    statY + 26
  );

  ctx.fillStyle = '#f4f4f5';
  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillText(
    `Rata-rata: ${avgPres.toFixed(presDecimals)} ${pressureUnit} (ΔP +${avgGauge.toFixed(presDecimals)})   |   Min: ${minPres.toFixed(presDecimals)}   |   Max: ${maxPres.toFixed(presDecimals)}`,
    rightBoxX + 18,
    statY + 52
  );

  // Helper menggambar satu panel grafik
  const drawSinglePanel = (
    panelTitle: string,
    panelSubtitle: string,
    vals: number[],
    optLow: number,
    optHigh: number,
    unit: string,
    dec: number,
    colorHex: string,
    rgbaFillTop: string,
    topY: number,
    panelH: number
  ) => {
    const padL = 100;
    const padR = 64;
    const padT = 52;
    const padB = 42;
    const pW = W - padL - padR;
    const pH = panelH - padT - padB;
    const originX = padL;
    const originY = topY + padT;

    // Background Card Panel
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(48, topY, W - 96, panelH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 1;
    ctx.strokeRect(48, topY, W - 96, panelH);

    // Judul Panel
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(panelTitle, 68, topY + 30);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(panelSubtitle, W - 68, topY + 30);
    ctx.textAlign = 'left';

    const minV = Math.min(...vals, optLow);
    const maxV = Math.max(...vals, optHigh);
    const span = Math.max(dec === 2 ? 0.06 : 4.0, maxV - minV);
    const yMin = Math.max(0, minV - span * 0.22);
    const yMax = maxV + span * 0.22;

    const getX = (idx: number) =>
      vals.length <= 1
        ? originX + pW / 2
        : originX + (idx / (vals.length - 1)) * pW;
    const getY = (v: number) => {
      const ratio = (v - yMin) / Math.max(0.0001, yMax - yMin);
      return originY + pH - Math.min(1, Math.max(0, ratio)) * pH;
    };

    // Pita Zona Optimal
    const optTop = getY(optHigh);
    const optBot = getY(optLow);
    ctx.fillStyle = 'rgba(52, 211, 153, 0.065)';
    ctx.fillRect(originX, optTop, pW, Math.max(2, optBot - optTop));

    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
    ctx.beginPath();
    ctx.moveTo(originX, optTop);
    ctx.lineTo(originX + pW, optTop);
    ctx.moveTo(originX, optBot);
    ctx.lineTo(originX + pW, optBot);
    ctx.stroke();
    ctx.restore();

    // Grid Horizontal & Label Y
    const ticks = [0, 0.25, 0.5, 0.75, 1];
    ticks.forEach((t) => {
      const gy = originY + t * pH;
      const gVal = yMax - t * (yMax - yMin);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.moveTo(originX, gy);
      ctx.lineTo(originX + pW, gy);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(`${gVal.toFixed(dec)} ${unit}`, originX - 10, gy + 4);
      ctx.textAlign = 'left';
    });

    const pts = vals.map((v, i) => ({ x: getX(i), y: getY(v), v }));

    // Gradasi Bawah Kurva
    const grad = ctx.createLinearGradient(0, originY, 0, originY + pH);
    grad.addColorStop(0, rgbaFillTop);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    if (pts.length === 1) {
      ctx.moveTo(originX, pts[0].y);
      ctx.lineTo(originX + pW, pts[0].y);
      ctx.lineTo(originX + pW, originY + pH);
      ctx.lineTo(originX, originY + pH);
    } else {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const cpx1 = p0.x + (p1.x - p0.x) * 0.42;
        const cpx2 = p0.x + (p1.x - p0.x) * 0.58;
        ctx.bezierCurveTo(cpx1, p0.y, cpx2, p1.y, p1.x, p1.y);
      }
      ctx.lineTo(pts[pts.length - 1].x, originY + pH);
      ctx.lineTo(pts[0].x, originY + pH);
    }
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Garis Kurva Utama
    ctx.beginPath();
    if (pts.length === 1) {
      ctx.moveTo(originX, pts[0].y);
      ctx.lineTo(originX + pW, pts[0].y);
    } else {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const cpx1 = p0.x + (p1.x - p0.x) * 0.42;
        const cpx2 = p0.x + (p1.x - p0.x) * 0.58;
        ctx.bezierCurveTo(cpx1, p0.y, cpx2, p1.y, p1.x, p1.y);
      }
    }
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Titik Data & Label Nilai Penting
    const labelStep = Math.max(1, Math.ceil(pts.length / 10));
    pts.forEach((pt, idx) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#090B10';
      ctx.fill();
      ctx.strokeStyle = colorHex;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      if (idx % labelStep === 0 || idx === pts.length - 1) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e4e4e7';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(pt.v.toFixed(dec), pt.x, pt.y - 10);
      }
    });

    // Label Waktu Sumbu X
    const xLabelCount = Math.min(6, dataPoints.length);
    for (let i = 0; i < xLabelCount; i++) {
      const idx =
        xLabelCount === 1
          ? 0
          : Math.round((i / (xLabelCount - 1)) * (dataPoints.length - 1));
      const px = getX(idx);
      ctx.textAlign =
        i === 0 ? 'left' : i === xLabelCount - 1 ? 'right' : 'center';
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(dataPoints[idx].timestamp, px, originY + pH + 24);
    }
    ctx.textAlign = 'left';
  };

  // Gambar Panel Gabungan (Suhu & Tekanan Sejajar)
  const drawCombinedDualLanePanel = (topY: number, panelH: number) => {
    const padL = 100;
    const padR = 64;
    const padT = 50;
    const padB = 38;
    const pW = W - padL - padR;
    const pH = panelH - padT - padB;
    const gap = 22;
    const laneH = (pH - gap) / 2;
    const topLaneY0 = topY + padT;
    const topLaneY1 = topLaneY0 + laneH;
    const botLaneY0 = topLaneY1 + gap;
    const botLaneY1 = botLaneY0 + laneH;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(48, topY, W - 96, panelH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 1;
    ctx.strokeRect(48, topY, W - 96, panelH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      '1. Grafik Gabungan Sinkronisasi Waktu (Atas: Suhu °C  •  Bawah: Tekanan)',
      68,
      topY + 28
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(
      `Perbandingan langsung pola Suhu & Tekanan (${dataPoints.length} titik)`,
      W - 68,
      topY + 28
    );
    ctx.textAlign = 'left';

    const tMin = Math.min(...tempValues) - 1.2;
    const tMax = Math.max(...tempValues) + 1.2;
    const pMin = Math.min(...presValues) - (pressureUnit === 'bar' ? 0.03 : 2.5);
    const pMax = Math.max(...presValues) + (pressureUnit === 'bar' ? 0.03 : 2.5);

    const getX = (idx: number) =>
      dataPoints.length <= 1
        ? padL + pW / 2
        : padL + (idx / (dataPoints.length - 1)) * pW;
    const mapY = (v: number, min: number, max: number, y0: number, y1: number) =>
      y1 - ((v - min) / Math.max(0.0001, max - min)) * (y1 - y0);

    // Label & Garis Jalur Suhu
    [0, 1].forEach((t) => {
      const y = topLaneY0 + t * laneH;
      const v = tMax - t * (tMax - tMin);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + pW, y);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillStyle = '#fbbf24';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(`${v.toFixed(1)}°C`, padL - 10, y + 4);
    });

    // Pemisah Tengah
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(padL, topLaneY1 + gap / 2);
    ctx.lineTo(padL + pW, topLaneY1 + gap / 2);
    ctx.stroke();

    // Label & Garis Jalur Tekanan
    [0, 1].forEach((t) => {
      const y = botLaneY0 + t * laneH;
      const v = pMax - t * (pMax - pMin);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + pW, y);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillStyle = '#38bdf8';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(`${v.toFixed(presDecimals)} ${pressureUnit}`, padL - 10, y + 4);
    });
    ctx.textAlign = 'left';

    const tPts = tempValues.map((v, i) => ({
      x: getX(i),
      y: mapY(v, tMin, tMax, topLaneY0, topLaneY1)
    }));
    const pPts = presValues.map((v, i) => ({
      x: getX(i),
      y: mapY(v, pMin, pMax, botLaneY0, botLaneY1)
    }));

    const strokeCurve = (pts: { x: number; y: number }[], color: string) => {
      ctx.beginPath();
      if (pts.length === 1) {
        ctx.moveTo(padL, pts[0].y);
        ctx.lineTo(padL + pW, pts[0].y);
      } else {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i];
          const p1 = pts[i + 1];
          const cpx1 = p0.x + (p1.x - p0.x) * 0.42;
          const cpx2 = p0.x + (p1.x - p0.x) * 0.58;
          ctx.bezierCurveTo(cpx1, p0.y, cpx2, p1.y, p1.x, p1.y);
        }
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.6;
      ctx.stroke();
    };

    strokeCurve(tPts, '#fbbf24');
    strokeCurve(pPts, '#38bdf8');
  };

  if (isAllMode) {
    // Tampilkan Lengkap Ketiganya: 1. Gabungan, 2. Detail Suhu, 3. Detail Tekanan
    drawCombinedDualLanePanel(220, 310);

    drawSinglePanel(
      '2. Grafik Detail Suhu Reaktor (°C)',
      `Zona Optimal: ${tempOptMin}–${tempOptMax}°C  |  Rata-rata: ${avgTemp.toFixed(1)}°C`,
      tempValues,
      tempOptMin,
      tempOptMax,
      '°C',
      1,
      '#fbbf24',
      'rgba(251, 191, 36, 0.25)',
      550,
      340
    );

    drawSinglePanel(
      `3. Grafik Detail Tekanan Reaktor (${pressureUnit})`,
      `Zona Optimal: ${presOptMin.toFixed(presDecimals)}–${presOptMax.toFixed(presDecimals)} ${pressureUnit}  |  Rata-rata: ${avgPres.toFixed(presDecimals)} ${pressureUnit}`,
      presValues,
      presOptMin,
      presOptMax,
      pressureUnit,
      presDecimals,
      '#38bdf8',
      'rgba(56, 189, 248, 0.25)',
      910,
      340
    );
  } else if (metric === 'temp') {
    drawSinglePanel(
      'Grafik Detail Suhu Reaktor Biogas (°C)',
      `Zona Optimal: ${tempOptMin}–${tempOptMax}°C  |  Rentang: ${rangeObj.label}`,
      tempValues,
      tempOptMin,
      tempOptMax,
      '°C',
      1,
      '#fbbf24',
      'rgba(251, 191, 36, 0.26)',
      225,
      465
    );
  } else {
    drawSinglePanel(
      `Grafik Detail Tekanan Reaktor Biogas (${pressureUnit})`,
      `Zona Optimal: ${presOptMin.toFixed(presDecimals)}–${presOptMax.toFixed(presDecimals)} ${pressureUnit}  |  Rentang: ${rangeObj.label}`,
      presValues,
      presOptMin,
      presOptMax,
      pressureUnit,
      presDecimals,
      '#38bdf8',
      'rgba(56, 189, 248, 0.26)',
      225,
      465
    );
  }

  // Footer Watermark Resmi di Bawah Gambar
  ctx.fillStyle = '#71717a';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    'bIoTeragas — Sistem Monitoring Reaktor Biogas IoT ESP32 • Program Studi Fisika ITERA & SMAN 1 Jati Agung',
    W / 2,
    H - 30
  );
  ctx.textAlign = 'left';

  // Nama File Sesuai Pilihan Grafik & Rentang Waktu
  const metricSlug =
    metric === 'both'
      ? 'Semua-Lengkap'
      : metric === 'temp'
        ? 'Suhu-C'
        : `Tekanan-${pressureUnit}`;
  const rangeSlug = rangeObj.shortLabel.replace(/\s+/g, '-');
  const isoDate = new Date().toISOString().slice(0, 10);
  const fileName = `Grafik_bIoTeragas_${metricSlug}_${rangeSlug}_${isoDate}.png`;

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
