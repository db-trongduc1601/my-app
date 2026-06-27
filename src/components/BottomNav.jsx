/**
 * BottomNav — iOS-26 "Liquid Glass" tab bar
 *
 * ── Safari Bug Workaround #1: Wrapper/Child Split ──────────────────────────
 * The fixed/absolute WRAPPER (.tabbar-wrapper) has NO background and NO
 * backdrop-filter. All visual glass styling lives on the CHILD (.tabbar-glass).
 * If you put backdrop-filter on a fixed element directly, Safari's chrome
 * compositor incorrectly tints the browser toolbar to match the element's
 * sampled background color. The child-split avoids this bug.
 *
 * ── Safari Bug Workaround #2: display:none for modals ──────────────────────
 * Any overlay/modal in this app uses `display: none` when closed (via
 * AnimatePresence unmounting). Do NOT use opacity:0 + pointer-events:none
 * only — Safari can still sample that element's background color for toolbar
 * tinting even when visually invisible.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Utensils, Heart, Star, Music } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '/', icon: Home, label: 'Trang chủ' },
  { path: '/food', icon: Utensils, label: 'Ăn gì?' },
  { path: '/vault', icon: Heart, label: 'Đồ dùng' },
  { path: '/quests', icon: Star, label: 'Nhiệm vụ' },
  { path: '/entertainment', icon: Music, label: 'Giải trí' },
];

export default function BottomNav() {
  const location = useLocation();
  const glassRef = useRef(null);
  const rafRef = useRef(null);
  const gyroGranted = useRef(false);

  // ── Specular highlight updater (throttled via rAF) ──────────────────────
  const setHighlight = useCallback((lx, ly) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (glassRef.current) {
        glassRef.current.style.setProperty('--lx', `${lx}%`);
        glassRef.current.style.setProperty('--ly', `${ly}%`);
      }
    });
  }, []);

  // ── Gyroscope handler (iOS) ─────────────────────────────────────────────
  const handleOrientation = useCallback((e) => {
    // gamma = left-right tilt (-90..90), beta = front-back tilt (-180..180)
    const lx = Math.min(100, Math.max(0, ((e.gamma ?? 0) + 90) / 180 * 100));
    const ly = Math.min(100, Math.max(0, ((e.beta ?? 0) + 90) / 180 * 100));
    setHighlight(lx, ly);
  }, [setHighlight]);

  // ── Mouse fallback (desktop) ────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    if (gyroGranted.current) return; // gyro takes priority
    const lx = (e.clientX / window.innerWidth) * 100;
    const ly = (e.clientY / window.innerHeight) * 100;
    setHighlight(lx, ly);
  }, [setHighlight]);

  // ── Touch move fallback (Android / non-gyro) ────────────────────────────
  const handleTouchMove = useCallback((e) => {
    if (gyroGranted.current) return;
    const t = e.touches[0];
    if (!t) return;
    const lx = (t.clientX / window.innerWidth) * 100;
    const ly = (t.clientY / window.innerHeight) * 100;
    setHighlight(lx, ly);
  }, [setHighlight]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    // Auto-start gyro on Android (no permission API needed there)
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
      gyroGranted.current = true;
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('deviceorientation', handleOrientation);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseMove, handleTouchMove, handleOrientation]);

  // ── iOS permission tap handler ──────────────────────────────────────────
  const requestGyro = useCallback(async () => {
    if (gyroGranted.current) return;
    if (typeof DeviceOrientationEvent?.requestPermission !== 'function') return;
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result === 'granted') {
        gyroGranted.current = true;
        window.addEventListener('deviceorientation', handleOrientation, { passive: true });
      }
    } catch {
      // user denied or API not available — mouse fallback already active
    }
  }, [handleOrientation]);

  return (
    /**
     * WRAPPER — position: fixed only. NO background. NO backdrop-filter.
     * (Safari toolbar-tinting bug workaround #1)
     */
    <nav
      className="tabbar-wrapper"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        /* Rule #3: always account for safe-area on iPhone */
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none', // wrapper is click-through; glass div handles events
      }}
    >
      {/**
       * GLASS CHILD — all visual styling lives here, not on the wrapper.
       * (Safari toolbar-tinting bug workaround #1 — see comment at top)
       */}
      <div
        ref={glassRef}
        className="tabbar-glass"
        onClick={requestGyro}
        style={{ pointerEvents: 'auto' }}
      >
        {/* Tab items */}
        <div className="tabbar-items">
          {tabs.map(({ path, icon: Icon, label }) => {
            const active = path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className={cn('tabbar-item', active && 'tabbar-item--active')}
              >
                <span className="tabbar-icon">
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                </span>
                <span className={cn('tabbar-label', active && 'tabbar-label--visible')}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
