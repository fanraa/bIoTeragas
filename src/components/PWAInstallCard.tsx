import React, { useState } from 'react';
import { Smartphone, Download, Check, Info, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallCard: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [showInfoPopover, setShowInfoPopover] = useState(false);

  return (
    <div className="bg-[#121212] border border-white/10 rounded-md p-4 space-y-3 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded bg-white/5 border border-white/5 shrink-0">
            <Smartphone className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-white">
                Pasang Aplikasi ke Layar Utama
              </h3>
              <div className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => setShowInfoPopover((prev) => !prev)}
                  title="Informasi Aplikasi PWA"
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-0.5"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                {showInfoPopover && (
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-zinc-900 border border-white/15 rounded-md shadow-2xl text-[11px] text-zinc-300 z-50 leading-relaxed">
                    <div className="flex items-center justify-between mb-1 pb-1 border-b border-white/10 font-semibold text-white">
                      <span>Tentang PWA (Layar Utama)</span>
                      <button
                        type="button"
                        onClick={() => setShowInfoPopover(false)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    Menjalankan bIoTeragas sebagai aplikasi mandiri (standalone fullscreen) tanpa bilah URL browser, lebih cepat dibuka, dan hemat memori HP.
                  </div>
                )}
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Buka aplikasi layar penuh tanpa bilah browser di HP Android & iPhone.
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {isInstalled ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Terpasang</span>
            </span>
          ) : isInstallable ? (
            <button
              type="button"
              onClick={install}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer active:scale-95 shadow-md shadow-black/30"
            >
              <Download className="w-3.5 h-3.5 text-black" />
              <span>Pasang</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Cara Pasang</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal Panduan Pemasangan Manual (Android Chrome / iPhone Safari) */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-lg bg-[#141721] border border-white/20 p-5 shadow-2xl text-zinc-200 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Pasang bIoTeragas ke HP</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-2 text-xs leading-relaxed text-zinc-300">
                <p className="font-medium text-white">Panduan Safari iPhone / iPad:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-400">
                  <li>
                    Tekan tombol <strong className="text-zinc-200">Bagikan (Share)</strong> di bilah bawah Safari.
                  </li>
                  <li>
                    Geser ke bawah lalu pilih menu <strong className="text-cyan-300">Tambah ke Layar Utama (Add to Home Screen)</strong>.
                  </li>
                  <li>
                    Tekan <strong className="text-white">Tambah</strong> di pojok kanan atas.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2 text-xs leading-relaxed text-zinc-300">
                <p className="font-medium text-white">Panduan Chrome Android / Browser:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-400">
                  <li>
                    Buka menu titik tiga <strong className="text-zinc-200">(⋮)</strong> di pojok kanan atas Chrome.
                  </li>
                  <li>
                    Pilih menu <strong className="text-cyan-300">Tambahkan ke Layar Utama</strong> atau <strong className="text-cyan-300">Instal Aplikasi</strong>.
                  </li>
                  <li>
                    Tekan <strong className="text-white">Instal</strong> untuk memasang icon di menu HP.
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2 text-xs font-medium rounded bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer mt-2"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
