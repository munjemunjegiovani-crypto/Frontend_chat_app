import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { Icon, Logo, Spinner } from '../components/ui.jsx';

export default function Welcome() {
  const { signIn, prefs, setPrefs } = useApp();
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ name: '', username: '', email: '', login: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const dark = document.documentElement.classList.contains('dark');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data =
        mode === 'register'
          ? await api('/auth/register', {
              method: 'POST',
              body: { name: form.name, username: form.username, email: form.email, password: form.password },
            })
          : await api('/auth/login', { method: 'POST', body: { login: form.login, password: form.password } });
      signIn(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-canvas lg:grid lg:grid-cols-2">
      {/* Decorative side panel on large screens */}
      <div className="hidden lg:flex relative flex-col justify-between p-12 bg-[#14213D] text-[#F2EFE9] overflow-hidden">
        <div className="absolute -right-32 -top-32 w-[520px] h-[520px] rounded-full border border-[#C9A86A]/15" />
        <div className="absolute -right-10 -top-10 w-[300px] h-[300px] rounded-full border border-[#C9A86A]/20" />
        <div className="flex items-center gap-3 relative">
          <Logo size={44} className="!shadow-none" />
          <span className="font-serif text-2xl tracking-[0.2em]">KOVA</span>
        </div>
        <div className="relative max-w-md">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[#C9A86A] mb-4">Correspondence, refined</p>
          <h2 className="font-serif text-5xl leading-[1.15] mb-6">Speak freely,<br /><span className="italic text-[#E5C281]">stay close.</span></h2>
          <ul className="space-y-3 text-[#C9C3B5] text-[15px]">
            {[
              ['chat_bubble', 'Private chats and groups in real time'],
              ['hub', 'Channels with posts, reactions and comments'],
              ['call', 'Voice and video calls, device to device'],
              ['auto_awesome', 'Moments that fade after 24 hours'],
            ].map(([i, t]) => (
              <li key={t} className="flex items-center gap-3">
                <Icon name={i} size={20} className="text-[#C9A86A]" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative font-serif italic text-[#C9A86A]/90 text-lg">“True conversation is an heirloom, treasured in deliberate silence.”</p>
      </div>

      <div className="flex flex-col min-h-[100dvh] px-5 sm:px-8 pt-safe pb-safe">
        <div className="flex items-center justify-between py-4">
          <span className="flex items-center gap-2 eyebrow">
            <Icon name="lock" size={16} /> Private by design
          </span>
          <button
            onClick={() => setPrefs({ theme: dark ? 'light' : 'dark' })}
            className="flex items-center gap-2 h-9 px-4 rounded-full bg-soft text-label-md text-ink/80 hover:bg-gold/15"
          >
            <Icon name={dark ? 'light_mode' : 'dark_mode'} size={18} />
            {prefs && (dark ? 'Ivory' : 'Midnight')}
          </button>
        </div>

        <div className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto py-6">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-full bg-gold/30 blur-xl" />
              <div className="relative w-20 h-20 rounded-full bg-[#14213D] flex items-center justify-center ring-1 ring-gold/40">
                <span className="font-serif text-4xl text-[#C9A86A]">K</span>
              </div>
            </div>
            <h1 className="font-serif text-[40px] leading-none tracking-[0.06em] text-ink">KOVA</h1>
            <p className="font-serif italic text-2xl text-gold-ink mt-3">Speak freely, stay close</p>
            <div className="gold-rule w-20 mt-5" />
          </div>

          <form onSubmit={submit} className="card p-6 sm:p-7">
            <div className="flex items-center justify-between mb-2">
              <span className="eyebrow">{mode === 'register' ? 'Step 01 / Registry' : 'Welcome back'}</span>
              <span className="text-label-md text-muted">Confidential</span>
            </div>
            <h2 className="font-serif text-[26px] text-ink">{mode === 'register' ? 'Create your account' : 'Sign in to Kova'}</h2>
            <p className="text-sm text-muted mt-1 mb-5 leading-6">
              {mode === 'register'
                ? 'Claim your name and start writing to the people who matter.'
                : 'Your conversations are waiting exactly where you left them.'}
            </p>

            <div className="grid grid-cols-2 p-1 rounded-xl bg-soft mb-5">
              {[['register', 'Create account'], ['login', 'Sign in']].map(([m, l]) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => { setMode(m); setError(''); }}
                  className={`h-10 rounded-lg text-sm font-medium transition ${mode === m ? 'bg-card shadow-lvl1 text-ink' : 'text-muted'}`}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {mode === 'register' ? (
                <>
                  <label className="block">
                    <span className="block text-label-md text-ink/80 mb-1.5">Full name</span>
                    <input className="field" value={form.name} onChange={set('name')} placeholder="e.g. Amina Ndze" autoComplete="name" required />
                  </label>
                  <label className="block">
                    <span className="block text-label-md text-ink/80 mb-1.5">Username</span>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
                      <input
                        className="field !pl-8"
                        value={form.username}
                        onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '') }))}
                        placeholder="amina"
                        autoComplete="username"
                        required
                      />
                    </div>
                    <span className="block text-xs text-muted mt-1">Friends find you by this name.</span>
                  </label>
                  <label className="block">
                    <span className="block text-label-md text-ink/80 mb-1.5">Email</span>
                    <input className="field" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" required />
                  </label>
                </>
              ) : (
                <label className="block">
                  <span className="block text-label-md text-ink/80 mb-1.5">Email or username</span>
                  <input className="field" value={form.login} onChange={set('login')} placeholder="you@example.com" autoComplete="username" required />
                </label>
              )}
              <label className="block">
                <span className="block text-label-md text-ink/80 mb-1.5">Password</span>
                <div className="relative">
                  <input
                    className="field !pr-12"
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    placeholder={mode === 'register' ? 'At least 6 characters' : 'Your password'}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    required
                  />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label="Show password">
                    <Icon name={showPw ? 'visibility_off' : 'visibility'} size={20} />
                  </button>
                </div>
              </label>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 text-sm text-danger bg-danger-soft rounded-lg px-3 py-2.5">
                <Icon name="error" size={18} /> <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full h-[52px] mt-6 !text-[15px] tracking-[0.12em] uppercase !text-[#E5C281] dark:!text-[#0E1420]">
              {busy ? <Spinner size={18} /> : <>{mode === 'register' ? 'Create account' : 'Sign in'} <Icon name="arrow_forward" size={20} /></>}
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-muted text-center">
            <Icon name="verified_user" size={16} className="text-gold-ink" />
            Passwords are stored hashed. No ads, no tracking.
          </div>
        </div>

        <div className="lg:hidden max-w-md mx-auto w-full mb-6 rounded-2xl bg-soft/70 px-6 py-5 flex gap-3">
          <Icon name="history_edu" className="text-gold-ink mt-1" />
          <div>
            <p className="font-serif italic text-xl leading-7 text-ink">“True conversation is an heirloom, treasured in deliberate silence.”</p>
            <p className="eyebrow mt-2">The Kova Companion</p>
          </div>
        </div>
      </div>
    </div>
  );
}
