import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import { RestAlarm } from './RestTimer';

const alert = vi.hoisted(() => vi.fn());
vi.mock('@/lib/alert', () => ({ playRestDoneAlert: alert, primeAlertAudio: vi.fn() }));

describe('RestAlarm', () => {
  beforeEach(() => {
    alert.mockClear();
    vi.useFakeTimers();
    useAppStore.setState({ restEndsAt: null });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires once when the rest reaches zero', () => {
    useAppStore.setState({ restEndsAt: Date.now() + 5000 });
    render(<RestAlarm />);
    expect(alert).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(alert).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('does not fire when the rest is skipped', () => {
    useAppStore.setState({ restEndsAt: Date.now() + 5000 });
    render(<RestAlarm />);
    act(() => useAppStore.setState({ restEndsAt: null }));
    vi.advanceTimersByTime(60_000);
    expect(alert).not.toHaveBeenCalled();
  });

  it('reschedules when time is added to the rest', () => {
    const base = Date.now();
    useAppStore.setState({ restEndsAt: base + 5000 });
    render(<RestAlarm />);
    act(() => useAppStore.setState({ restEndsAt: base + 20_000 }));
    vi.advanceTimersByTime(6000);
    expect(alert).not.toHaveBeenCalled();
    vi.advanceTimersByTime(15_000);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('stays quiet for a rest that ended long ago', () => {
    // Reopening the app an hour later must not beep about a finished rest.
    useAppStore.setState({ restEndsAt: Date.now() - 3_600_000 });
    render(<RestAlarm />);
    vi.advanceTimersByTime(60_000);
    expect(alert).not.toHaveBeenCalled();
  });

  it('still announces a rest that just ended', () => {
    useAppStore.setState({ restEndsAt: Date.now() - 500 });
    render(<RestAlarm />);
    vi.advanceTimersByTime(10);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the user turned the alert off', () => {
    useAppStore.setState({
      restEndsAt: Date.now() + 1000,
      profile: { ...useAppStore.getState().profile, restAlert: false },
    });
    render(<RestAlarm />);
    vi.advanceTimersByTime(5000);
    expect(alert).not.toHaveBeenCalled();
  });
});
