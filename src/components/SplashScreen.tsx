import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  // Hanya aktif saat aplikasi dijalankan sebagai PWA di HP (Layar Utama / Standalone Mobile)
  // Di browser biasa, desktop, maupun laptop, splash screen ini TIDAK AKAN MUNCUL sama sekali.
  const [shouldShow] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.location.search.includes('pwa=1');

    const isMobile =
      /android|iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (window.innerWidth <= 768 && 'ontouchstart' in window);

    return isStandalone && isMobile;
  });

  const [stage, setStage] = useState<'visible' | 'exiting' | 'done'>('visible');

  useEffect(() => {
    if (!shouldShow) return;

    // Kunci scroll, swipe pull-to-refresh, dan interaksi pada halaman selama splash screen aktif
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';

    // 1. Durasi tampil loading saat PWA dibuka di HP (1.8 detik)
    const exitTimer = setTimeout(() => {
      setStage('exiting');
    }, 1800);

    // 2. Unmount setelah transisi fade-out selesai
    const doneTimer = setTimeout(() => {
      setStage('done');
      if (onComplete) onComplete();
    }, 2400);

    // Mencegah pull-to-refresh dan gesture scroll via touchmove
    const preventDefaultTouch = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };
    window.addEventListener('touchmove', preventDefaultTouch, { passive: false });

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
      window.removeEventListener('touchmove', preventDefaultTouch);
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      document.body.style.overscrollBehavior = originalOverscroll;
      document.documentElement.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';
    };
  }, [shouldShow, onComplete]);

  // Jika bukan PWA di HP atau animasi sudah selesai, jangan render apapun
  if (!shouldShow || stage === 'done') return null;

  const isExiting = stage === 'exiting';

  return (
    <div
      className={`fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-black select-none pointer-events-auto touch-none overscroll-none transition-opacity duration-600 ease-out overflow-hidden ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#000000', touchAction: 'none', overscrollBehavior: 'none' }}
      onClick={(e) => e.stopPropagation()}
      onTouchMove={(e) => {
        if (e.cancelable) e.preventDefault();
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-hidden="true"
    >
      {/* BAGIAN ATAS: Gambar lokal yang dioptimalkan & di-preload sehingga muncul instan tanpa jeda */}
      <div className="absolute top-0 inset-x-0 h-[48vh] overflow-hidden pointer-events-none">
        <img
          src="/splash-bg.jpg"
          alt="Suasana Reaktor Biogas"
          className="w-full h-full object-cover object-center"
          loading="eager"
          fetchPriority="high"
          decoding="sync"
          draggable={false}
        />
        {/* Lapisan gradasi halus: memudar dari foto ke warna hitam pekat */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black via-black/90 to-transparent" />
      </div>

      {/* TENGAH: Ikon Bersih dan Nama Aplikasi Berada Persis di Tengah Layar */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6">
        <img
          src="/logo.png"
          alt="bIoTeragas Logo"
          className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
          loading="eager"
          fetchPriority="high"
          decoding="sync"
          draggable={false}
        />

        <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-widest text-white font-mono uppercase">
          bIoTeragas
        </h1>
      </div>
    </div>
  );
};
