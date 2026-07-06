import { useState } from 'react';
import { Chip, Field, HudButton, HudInput, Modal } from '@/components/hud';
import { useAuthStore } from '@/store/useAuthStore';

type Mode = 'signin' | 'signup' | 'magic';

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { signIn, signUp, sendMagicLink } = useAuthStore();

  const reset = () => {
    setError(null);
    setNotice(null);
  };

  const submit = async () => {
    reset();
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'magic') {
        const { error } = await sendMagicLink(email.trim());
        if (error) setError(error);
        else setNotice('Check your email for a sign-in link.');
      } else if (mode === 'signup') {
        const { error, needsConfirm } = await signUp(email.trim(), password);
        if (error) setError(error);
        else if (needsConfirm) setNotice('Account created — confirm via the email we sent, then sign in.');
        else {
          setNotice('Account created and signed in.');
          setTimeout(onClose, 600);
        }
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) setError(error);
        else onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Cloud Sync — Account">
      <div className="mb-4 flex gap-2">
        <Chip active={mode === 'signin'} onClick={() => { setMode('signin'); reset(); }}>
          Sign In
        </Chip>
        <Chip active={mode === 'signup'} onClick={() => { setMode('signup'); reset(); }}>
          Sign Up
        </Chip>
        <Chip active={mode === 'magic'} onClick={() => { setMode('magic'); reset(); }} color="var(--violet)">
          Magic Link
        </Chip>
      </div>

      <div className="flex flex-col gap-3">
        <Field label="Email">
          <HudInput
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        {mode !== 'magic' && (
          <Field label="Password" hint={mode === 'signup' ? 'At least 6 characters.' : undefined}>
            <HudInput
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
          </Field>
        )}

        {error && (
          <div className="chamfer border border-[var(--down)] bg-[rgba(255,90,114,0.08)] p-2.5 text-[12px] text-[var(--down)]">
            {error}
          </div>
        )}
        {notice && (
          <div className="chamfer border border-[var(--up)] bg-[rgba(56,247,176,0.08)] p-2.5 text-[12px] text-[var(--up)]">
            {notice}
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-[var(--ink-faint)]">
          Your local data stays on this device. Signing in syncs workouts, programs, custom
          exercises, and your profile across your devices via Supabase.
        </p>

        <div className="mt-1 flex justify-end gap-2">
          <HudButton variant="ghost" onClick={onClose} sheen={false}>
            Cancel
          </HudButton>
          <HudButton onClick={submit} disabled={busy}>
            {busy ? 'Working…' : mode === 'magic' ? 'Send Link' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </HudButton>
        </div>
      </div>
    </Modal>
  );
}
