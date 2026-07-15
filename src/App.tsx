import { Suspense, useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AuroraBg, Scanlines } from '@/components/hud';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import {
  IconCalendar,
  IconChart,
  IconChevronDown,
  IconDash,
  IconFuel,
  IconGauge,
  IconLibrary,
  IconLift,
  IconMenu,
  IconProgram,
  IconTrend,
  IconUser,
} from '@/components/icons';
import { WorkoutTimerBadge } from '@/components/WorkoutTimerBadge';
import { DockedRestTimer } from '@/components/RestTimer';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';

// Route-level code splitting keeps the initial bundle lean. lazyWithRetry
// recovers from stale chunks after a service-worker update (see the helper).
const Dashboard = lazyWithRetry(() => import('@/routes/Dashboard').then((m) => ({ default: m.Dashboard })));
const WorkoutPage = lazyWithRetry(() => import('@/routes/WorkoutPage').then((m) => ({ default: m.WorkoutPage })));
const LibraryPage = lazyWithRetry(() => import('@/routes/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const ProgressPage = lazyWithRetry(() => import('@/routes/ProgressPage').then((m) => ({ default: m.ProgressPage })));
const StrengthPage = lazyWithRetry(() => import('@/routes/StrengthPage').then((m) => ({ default: m.StrengthPage })));
const ProgramsPage = lazyWithRetry(() => import('@/routes/ProgramsPage').then((m) => ({ default: m.ProgramsPage })));
const HistoryPage = lazyWithRetry(() => import('@/routes/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const ProfilePage = lazyWithRetry(() => import('@/routes/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const FuelPage = lazyWithRetry(() => import('@/routes/FuelPage').then((m) => ({ default: m.FuelPage })));
const FuelTrendsPage = lazyWithRetry(() => import('@/routes/FuelTrendsPage').then((m) => ({ default: m.FuelTrendsPage })));

function RouteFallback() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <span className="font-head animate-pulse tracking-[0.3em] text-[var(--cyan)]">LOADING…</span>
    </div>
  );
}

interface NavItem {
  to: string;
  label: string;
  short: string;
  Icon: (p: { size?: number; className?: string }) => React.ReactNode;
  end?: boolean;
}

const NAV_DASH: NavItem = { to: '/', label: 'Dashboard', short: 'Deck', Icon: IconDash, end: true };
const NAV_PROFILE: NavItem = { to: '/profile', label: 'Profile', short: 'You', Icon: IconUser };

/** Expandable side-menu groups. */
const NAV_GROUPS: { id: string; label: string; color: string; items: NavItem[] }[] = [
  {
    id: 'training',
    label: 'TRAINING',
    color: 'var(--cyan)',
    items: [
      { to: '/workout', label: 'Workout', short: 'Lift', Icon: IconLift },
      { to: '/library', label: 'Library', short: 'Lib', Icon: IconLibrary },
      { to: '/progress', label: 'Progress', short: 'Prog', Icon: IconChart },
      { to: '/strength', label: 'Strength', short: 'Std', Icon: IconGauge },
      { to: '/programs', label: 'Programs', short: 'Plan', Icon: IconProgram },
      { to: '/history', label: 'Log', short: 'Log', Icon: IconCalendar },
    ],
  },
  {
    id: 'nutrition',
    label: 'NUTRITION',
    color: 'var(--amber)',
    items: [
      { to: '/fuel', label: 'Fuel', short: 'Fuel', Icon: IconFuel },
      { to: '/fuel-trends', label: 'Trends', short: 'Diet', Icon: IconTrend },
    ],
  },
];

/** The five thumb-reach destinations on the mobile bottom bar; everything
 * else lives in the slide-in menu. */
const MOBILE_TABS: NavItem[] = [
  NAV_DASH,
  NAV_GROUPS[0].items[0], // Workout
  NAV_GROUPS[1].items[0], // Fuel
  NAV_GROUPS[0].items[5], // Log
];

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col gap-[3px]">
        <span className="block h-[3px] w-6 bg-[var(--cyan)]" style={{ boxShadow: '0 0 8px var(--cyan)' }} />
        <span className="block h-[3px] w-5 bg-[var(--violet)]" style={{ boxShadow: '0 0 8px var(--violet)' }} />
        <span className="block h-[3px] w-4 bg-[var(--amber)]" style={{ boxShadow: '0 0 8px var(--amber)' }} />
      </div>
      <span
        className="font-head text-lg font-black tracking-[0.32em] text-[var(--ink)]"
        style={{ textShadow: '0 0 14px rgba(56,225,255,0.5)' }}
      >
        STRIDE
      </span>
    </div>
  );
}

function RailLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const { to, label, Icon, end } = item;
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `font-head group flex items-center gap-3 rounded-[3px] px-3 py-2.5 text-[11px] tracking-[0.16em] transition-all ${
          isActive ? 'text-[var(--cyan)]' : 'text-[var(--ink-faint)] hover:text-[var(--ink-dim)]'
        }`
      }
      style={({ isActive }: { isActive: boolean }) =>
        isActive
          ? {
              background: 'rgba(56,225,255,0.08)',
              boxShadow: 'inset 2px 0 0 var(--cyan), 0 0 16px rgba(56,225,255,0.12)',
            }
          : {}
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  );
}

const NAV_COLLAPSE_KEY = 'stride.nav.collapsed';

function loadCollapsed(): string[] {
  try {
    const raw = localStorage.getItem(NAV_COLLAPSE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Grouped, expandable navigation — shared by the desktop rail and the
 * mobile slide-in drawer. Group expansion persists across sessions. */
function NavGroups({ onNavigate }: { onNavigate?: () => void }) {
  const [collapsed, setCollapsed] = useState<string[]>(loadCollapsed);
  const location = useLocation();

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      localStorage.setItem(NAV_COLLAPSE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <nav className="flex flex-col gap-1">
      <RailLink item={NAV_DASH} onNavigate={onNavigate} />
      {NAV_GROUPS.map((group) => {
        // Never hide the page you're on — an active route forces its group open.
        const hasActive = group.items.some((i) => location.pathname === i.to);
        const open = hasActive || !collapsed.includes(group.id);
        return (
          <div key={group.id} className="mt-2">
            <button
              onClick={() => toggle(group.id)}
              aria-expanded={open}
              className="font-head flex w-full items-center justify-between px-3 py-1.5 text-[9px] tracking-[0.24em] text-[var(--ink-faint)] transition-colors hover:text-[var(--ink-dim)]"
            >
              <span className="flex items-center gap-2">
                <span
                  className="block h-[5px] w-[5px] rounded-full"
                  style={{ background: group.color, boxShadow: `0 0 6px ${group.color}` }}
                />
                {group.label}
              </span>
              <span
                className="transition-transform duration-200"
                style={{ transform: open ? 'none' : 'rotate(-90deg)' }}
              >
                <IconChevronDown size={12} />
              </span>
            </button>
            {open && (
              <div className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <RailLink key={item.to} item={item} onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="mt-2 border-t border-[var(--line)] pt-2">
        <RailLink item={NAV_PROFILE} onNavigate={onNavigate} />
      </div>
    </nav>
  );
}

/** Mobile slide-in side menu with the full grouped navigation. */
function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] md:hidden" role="dialog" aria-label="Menu">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(2,4,9,0.75)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />
      <aside
        className="absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto border-r border-[var(--line)] px-4 py-5"
        style={{ background: 'var(--space-1)', animation: 'drawer-in 0.2s ease-out' }}
      >
        <div className="mb-8 flex items-center justify-between">
          <Brand />
          <button
            onClick={onClose}
            className="mono flex h-8 w-8 items-center justify-center rounded-[3px] border border-[var(--line)] text-[var(--ink-dim)] hover:text-[var(--cyan)]"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <NavGroups onNavigate={onClose} />
      </aside>
    </div>
  );
}

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const init = useAppStore((s) => s.init);
  const authInit = useAuthStore((s) => s.init);
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    // Seed + load local data first, then bring up auth/sync (which reads the DB).
    void init().then(() => authInit());
  }, [init, authInit]);

  if (!ready) {
    return (
      <>
        <AuroraBg />
        <div className="flex h-full items-center justify-center">
          <span className="font-head animate-pulse tracking-[0.3em] text-[var(--cyan)]">
            INITIALISING…
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      <AuroraBg />
      <Scanlines />
      <div className="mx-auto flex min-h-full max-w-6xl flex-col md:flex-row">
        {/* Desktop side rail */}
        <aside className="sticky top-0 z-30 hidden h-screen w-52 shrink-0 flex-col overflow-y-auto border-r border-[var(--line)] px-4 py-6 md:flex">
          <Brand />
          <div className="mt-10">
            <NavGroups />
          </div>
          <div className="mt-auto pt-4">
            <DockedRestTimer />
            <WorkoutTimerBadge />
          </div>
        </aside>

        {/* Mobile header — the rest timer docks in here on scroll */}
        <header className="sticky top-0 z-30 flex flex-col border-b border-[var(--line)] bg-[rgba(5,7,15,0.7)] px-4 py-3 backdrop-blur-md md:hidden">
          <div className="flex items-center justify-between">
            <Brand />
            <WorkoutTimerBadge compact />
          </div>
          <DockedRestTimer />
        </header>

        {/* Main content */}
        <main className="min-w-0 flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
          <RouteErrorBoundary key={location.pathname}>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/workout" element={<WorkoutPage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/progress" element={<ProgressPage />} />
                <Route path="/strength" element={<StrengthPage />} />
                <Route path="/programs" element={<ProgramsPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/fuel" element={<FuelPage />} />
                <Route path="/fuel-trends" element={<FuelTrendsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Routes>
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>

      {/* Mobile slide-in menu */}
      <NavDrawer open={drawerOpen} onClose={closeDrawer} />

      {/* Mobile bottom tab bar: core destinations + the side menu */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-[var(--line)] bg-[rgba(5,7,15,0.82)] px-1 py-1.5 backdrop-blur-lg md:hidden"
        style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
      >
        {MOBILE_TABS.map(({ to, short, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[3px] py-1.5 transition-colors ${
                isActive ? 'text-[var(--cyan)]' : 'text-[var(--ink-faint)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span style={isActive ? { filter: 'drop-shadow(0 0 6px var(--cyan))' } : {}}>
                  <Icon size={20} />
                </span>
                <span className="font-head text-[8px] tracking-[0.12em]">{short}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[3px] py-1.5 text-[var(--ink-faint)] transition-colors"
        >
          <IconMenu size={20} />
          <span className="font-head text-[8px] tracking-[0.12em]">Menu</span>
        </button>
      </nav>
    </>
  );
}
