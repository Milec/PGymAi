import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { AuroraBg, Scanlines } from '@/components/hud';
import {
  IconChart,
  IconDash,
  IconGauge,
  IconLibrary,
  IconLift,
  IconProgram,
  IconUser,
} from '@/components/icons';
import { WorkoutTimerBadge } from '@/components/WorkoutTimerBadge';
import { useAppStore } from '@/store/useAppStore';

// Route-level code splitting keeps the initial bundle lean.
const Dashboard = lazy(() => import('@/routes/Dashboard').then((m) => ({ default: m.Dashboard })));
const WorkoutPage = lazy(() => import('@/routes/WorkoutPage').then((m) => ({ default: m.WorkoutPage })));
const LibraryPage = lazy(() => import('@/routes/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const ProgressPage = lazy(() => import('@/routes/ProgressPage').then((m) => ({ default: m.ProgressPage })));
const StrengthPage = lazy(() => import('@/routes/StrengthPage').then((m) => ({ default: m.StrengthPage })));
const ProgramsPage = lazy(() => import('@/routes/ProgramsPage').then((m) => ({ default: m.ProgramsPage })));
const ProfilePage = lazy(() => import('@/routes/ProfilePage').then((m) => ({ default: m.ProfilePage })));

function RouteFallback() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <span className="font-head animate-pulse tracking-[0.3em] text-[var(--cyan)]">LOADING…</span>
    </div>
  );
}

const NAV = [
  { to: '/', label: 'Dashboard', short: 'Deck', Icon: IconDash, end: true },
  { to: '/workout', label: 'Workout', short: 'Lift', Icon: IconLift },
  { to: '/library', label: 'Library', short: 'Lib', Icon: IconLibrary },
  { to: '/progress', label: 'Progress', short: 'Prog', Icon: IconChart },
  { to: '/strength', label: 'Strength', short: 'Std', Icon: IconGauge },
  { to: '/programs', label: 'Programs', short: 'Plan', Icon: IconProgram },
  { to: '/profile', label: 'Profile', short: 'You', Icon: IconUser },
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

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

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
        <aside className="sticky top-0 z-30 hidden h-screen w-52 shrink-0 flex-col border-r border-[var(--line)] px-4 py-6 md:flex">
          <Brand />
          <nav className="mt-10 flex flex-col gap-1">
            {NAV.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `font-head group flex items-center gap-3 rounded-[3px] px-3 py-2.5 text-[11px] tracking-[0.16em] transition-all ${
                    isActive
                      ? 'text-[var(--cyan)]'
                      : 'text-[var(--ink-faint)] hover:text-[var(--ink-dim)]'
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
            ))}
          </nav>
          <div className="mt-auto">
            <WorkoutTimerBadge />
          </div>
        </aside>

        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--line)] bg-[rgba(5,7,15,0.7)] px-4 py-3 backdrop-blur-md md:hidden">
          <Brand />
          <WorkoutTimerBadge compact />
        </header>

        {/* Main content */}
        <main className="min-w-0 flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/workout" element={<WorkoutPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/strength" element={<StrengthPage />} />
              <Route path="/programs" element={<ProgramsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-[var(--line)] bg-[rgba(5,7,15,0.82)] px-1 py-1.5 backdrop-blur-lg md:hidden"
        style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
      >
        {NAV.map(({ to, short, Icon, end }) => (
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
      </nav>
    </>
  );
}
