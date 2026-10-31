import React, { useState, useRef } from 'react';
import { Check, Info, X, Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { FloatingAnchorBox } from './InfoPopover';

export const PWAInstallCard: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [showInfoPopover, setShowInfoPopover] = useState(false);
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);
  const infoBtnRef = useRef<HTMLButtonElement | null>(null);

  const handleInstallClick = async () => {
    setInstallFeedback(null);

    // 1. Langsung panggil prompt instalasi bawaan browser (Chrome Android / Desktop / Edge)
    const result = await install();

    if (result === 'accepted') {
      setInstallFeedback('Aplikasi berhasil dipasang ke Layar Utama!');
      setTimeout(() => setInstallFeedback(null), 3500);
      return;
    }

    if (result === 'dismissed') {
      // Pengguna menekan tombol Batal di popup bawaan browser
      return;
    }

    // 2. Jika browser tidak mendukung trigger programmatic (seperti Safari di iPhone)
    // atau jika dibuka di dalam webview/in-app browser (seperti link dari WA/Instagram)
    setShowGuide(true);
  };

  return (
    <div className="bg-[#121212] border border-white/10 rounded-md p-4 space-y-3 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded bg-white/5 border border-white/5 shrink-0 flex items-center justify-center">
            <img
              src="https://cdn-icons-png.flaticon.com/128/12603/12603181.png"
              alt="Pasang Aplikasi"
              className="w-5 h-5 object-contain brightness-0 invert"
              draggable={false}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-white truncate">
                Pasang Aplikasi ke Layar Utama
              </h3>
              <button
                ref={infoBtnRef}
                type="button"
                onClick={() => setShowInfoPopover((prev) => !prev)}
                title="Informasi Pemasangan Aplikasi di HP & Laptop"
                className={`transition-colors cursor-pointer p-0.5 shrink-0 ${
                  showInfoPopover ? 'text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Floating Anchor Box Info Popover: Kotak kecil, tidak nabrak, tidak kepotong layar */}
        <FloatingAnchorBox
          isOpen={showInfoPopover}
          onClose={() => setShowInfoPopover(false)}
          anchorEl={infoBtnRef.current}
          maxWidth={280}
        >
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10 font-semibold text-white">
              <span className="text-xs">Pasang ke Layar Utama</span>
              <button
                type="button"
                onClick={() => setShowInfoPopover(false)}
                className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1.5 text-[11px] text-zinc-300 leading-relaxed">
              <p className="text-zinc-300">
                Buka aplikasi layar penuh tanpa bilah browser di HP Android &amp; iPhone.
              </p>
              <p>
                <strong className="text-white">Android:</strong> Klik tombol <em>Pasang</em> lalu pilih <strong>Instal</strong>.
              </p>
              <p>
                <strong className="text-white">iPhone:</strong> Tekan tombol <strong>Share</strong> di Safari &gt; <strong>Tambah ke Layar Utama</strong>.
              </p>
              <p className="text-emerald-400 pt-1 border-t border-white/10 text-[10px]">
                ✓ Bebas bilah Chrome saat dibuka dari ikon Layar Utama.
              </p>
            </div>
          </div>
        </FloatingAnchorBox>

        <div className="shrink-0">
          {isInstalled ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Terpasang</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer active:scale-95 shadow-md shadow-black/30"
            >
              <img
                src="https://cdn-icons-png.flaticon.com/128/12603/12603181.png"
                alt=""
                className="w-3.5 h-3.5 object-contain"
                draggable={false}
              />
              <span>Pasang</span>
            </button>
          )}
        </div>
      </div>

      {installFeedback && (
        <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2.5 py-1.5">
          {installFeedback}
        </div>
      )}

      {/* Dialog Konfirmasi Instalasi (Jika perangkat memerlukan konfirmasi manual seperti di iOS Safari) */}
      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-[#141721] border border-white/20 p-5 shadow-2xl text-zinc-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <img
                  src="/logo.png"
                  alt="bIoTeragas"
                  className="w-6 h-6 object-contain"
                />
                <div>
                  <h4 className="text-sm font-semibold text-white">Instal bIoTeragas</h4>
                  <p className="text-[10px] text-zinc-400 font-mono">Monitoring Biogas Reaktor</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-2.5 text-xs leading-relaxed text-zinc-300">
                <p className="text-[11px] text-zinc-400">
                  Untuk memasang di iPhone / iPad (Safari):
                </p>
                <div className="bg-zinc-900/80 border border-white/10 rounded p-3 space-y-2 text-[11px]">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold shrink-0 text-[10px]">1</span>
                    <span>Tekan tombol <strong>Bagikan (Share)</strong> di bilah navigasi bawah Safari.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold shrink-0 text-[10px]">2</span>
                    <span>Pilih menu <strong>&quot;Tambah ke Layar Utama&quot;</strong> (Add to Home Screen).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold shrink-0 text-[10px]">3</span>
                    <span>Tekan <strong>Tambah</strong> di pojok kanan atas.</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs leading-relaxed text-zinc-300">
                <p className="text-[11px] text-zinc-400">
                  Pasang bIoTeragas langsung ke layar HP Anda agar dapat dibuka layar penuh tanpa bilah browser.
                </p>
                <div className="bg-zinc-900/80 border border-white/10 rounded p-3 space-y-1.5 text-[11px]">
                  <p className="text-zinc-300">
                    Jika Anda membuka via browser Chrome di HP, Anda dapat langsung mengklik tombol di bawah untuk memasang aplikasi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await install();
                    if (res === 'accepted') {
                      setShowGuide(false);
                      setInstallFeedback('Aplikasi berhasil dipasang!');
                    }
                  }}
                  className="w-full py-2.5 text-xs font-semibold rounded bg-cyan-500 text-black hover:bg-cyan-400 transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Pasang Sekarang ke HP</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2 text-xs font-medium rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
