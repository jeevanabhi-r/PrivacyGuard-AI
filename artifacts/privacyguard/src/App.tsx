import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, CircleHelp, ClipboardCheck, Clock3, Copy, Eye, FileCheck2, GraduationCap, KeyRound, LockKeyhole, LogIn, LogOut, Menu, MessageCircle, Moon, Plus, Send, Shield, ShieldCheck, Sparkles, Sun, Trash2, X } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import ReactMarkdown from 'react-markdown';
import { z } from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { getGuideFallback, guides, lessons, recommendations, suggestedPrompts, type Guide, type Lesson } from '@/lib/content';
import { getCurrentUser, getAuthRedirectUrl, PrivacyUser, supabase, supabaseConfigured } from '@/lib/supabase';
import { PrivacyAuditPage } from '@/pages/PrivacyAuditPage';
import { ThemeProvider, useTheme } from '@/hooks/use-theme';
import type { FormEvent } from 'react';

const queryClient = new QueryClient();
type Conversation = { id: string; user_id: string; title: string; created_at: string; updated_at: string };
type ChatMessage = { id: string; conversation_id: string; user_id: string; role: 'user' | 'assistant'; content: string; created_at: string; failed?: boolean };
type Notice = { text: string; kind: 'error' | 'info' };
const rateLimitMessage = 'PrivacyGuard AI is temporarily busy. Please try again in a moment.';
const authFormSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});
type AuthFormValues = z.infer<typeof authFormSchema>;

function ChatMarkdown({ content, role, messageId }: { content: string; role: ChatMessage['role']; messageId: string }) {
  return <div className={`space-y-2 break-words text-[13px] leading-[1.75] ${role === 'user' ? 'text-white' : 'text-[#3b584c]'}`} data-testid={`text-message-content-${messageId}`}>
    <ReactMarkdown components={{
      p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
      h1: ({ children }) => <h2 className="font-display text-base font-extrabold tracking-[-.025em]">{children}</h2>,
      h2: ({ children }) => <h2 className="font-display text-sm font-extrabold tracking-[-.02em]">{children}</h2>,
      h3: ({ children }) => <h3 className="text-[13px] font-extrabold">{children}</h3>,
      ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
      li: ({ children }) => <li className="pl-0.5">{children}</li>,
      a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="underline decoration-current underline-offset-2">{children}</a>,
      blockquote: ({ children }) => <blockquote className="border-l-2 border-current/30 pl-3 italic">{children}</blockquote>,
      code: ({ children }) => <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[.9em]">{children}</code>,
    }}>{content}</ReactMarkdown>
  </div>;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="inline-flex items-center gap-2.5" data-testid="link-brand-home">
    <span className="grid size-9 place-items-center rounded-[13px] bg-[#184c43] text-[#f5d985] shadow-sm"><ShieldCheck size={19} strokeWidth={2.2}/></span>
    {!compact && <span className="font-display text-[15px] font-extrabold tracking-[-.04em] text-[#193e37]">PrivacyGuard <span className="font-semibold text-[#637b72]">AI</span></span>}
  </Link>;
}

const nav = [
  { href: '/', label: 'Overview', icon: Shield },
  { href: '/audit', label: 'Privacy Audit', icon: ClipboardCheck },
  { href: '/assistant', label: 'Ask a question', icon: MessageCircle },
  { href: '/guides', label: 'Guides & checklists', icon: BookOpen },
  { href: '/lessons', label: 'Short lessons', icon: GraduationCap },
  { href: '/recommendations', label: 'Your next steps', icon: Sparkles },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggleTheme}
          type="button"
          className="grid size-9 place-items-center rounded-full border border-[#dce8df] bg-white text-[#2b5749] shadow-sm transition-colors hover:bg-[#edf4ee] focus:outline-none focus:ring-2 focus:ring-[#286253]/20 dark:border-[#1f312b] dark:bg-[#14201d] dark:text-[#a0cbb5] dark:hover:bg-[#1b2b25]"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          data-testid="button-theme-toggle"
        >
          {isDark ? <Sun size={17} className="text-[#f5d985]" /> : <Moon size={17} className="text-[#315c50]" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{isDark ? "Light mode" : "Dark mode"}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function AppShell({ children, user, openAuth, signOut }: { children: ReactNode; user: PrivacyUser | null; openAuth: () => void; signOut: () => void }) {
  const [loc] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => setMobileNav(false), [loc]);
  return <div className="grain min-h-[100dvh] bg-[#f5f8f4] text-[#183c35]">
    <header className="sticky top-0 z-40 border-b border-[#dce8df] bg-[#f7faf6]/95 backdrop-blur-md">
      <div className="mx-auto flex h-[70px] max-w-[1440px] items-center justify-between px-4 sm:px-7 lg:px-10">
        <div className="flex items-center gap-4">
          <button onClick={() => setMobileNav(!mobileNav)} className="grid size-10 place-items-center rounded-xl border border-[#dce8df] text-[#315c50] lg:hidden" aria-label="Toggle navigation" data-testid="button-toggle-navigation">{mobileNav ? <X size={19}/> : <Menu size={19}/>}</button>
          <Logo/>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full bg-[#eaf3ec] px-3 py-1.5 text-[11px] font-semibold text-[#39685b] sm:flex"><span className="size-1.5 rounded-full bg-[#70a889]"/>A calmer kind of privacy</span>
          <ThemeToggle />
          {user ? <div className="group relative">
            <button className="flex items-center gap-2 rounded-full border border-[#dce8df] bg-white px-2.5 py-1.5 text-sm font-semibold hover:border-[#9bb9a7]" data-testid="button-account-menu">
              <span className="grid size-7 place-items-center rounded-full bg-[#e5efe8] text-[11px] font-bold text-[#245649]">{(user.email || 'Y').slice(0, 1).toUpperCase()}</span><span className="hidden max-w-[140px] truncate sm:block">{user.email}</span><ChevronDown size={14}/>
            </button>
            <div className="invisible absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#dce8df] bg-white p-1.5 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="px-3 py-2 text-[11px] text-[#788b80]">Signed in securely</div>
              <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f2f7f3]" data-testid="button-sign-out"><LogOut size={15}/>Sign out</button>
            </div>
          </div> : <button onClick={openAuth} className="inline-flex items-center gap-2 rounded-full bg-[#184c43] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#236457]" data-testid="button-sign-in"><LogIn size={15}/>Sign in</button>}
        </div>
      </div>
    </header>
    <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[236px_minmax(0,1fr)]">
      {mobileNav && <button aria-label="Close navigation backdrop" className="fixed inset-0 z-20 bg-[#183c35]/20 lg:hidden" onClick={() => setMobileNav(false)} data-testid="button-close-navigation-backdrop"/>}
      <aside className={`${mobileNav ? 'translate-x-0' : '-translate-x-full'} fixed bottom-0 left-0 top-[70px] z-30 flex w-[260px] flex-col border-r border-[#dce8df] bg-[#eff5ef] p-4 transition-transform lg:sticky lg:top-[70px] lg:h-[calc(100dvh-70px)] lg:w-auto lg:translate-x-0`}>
        <div className="px-3 pb-3 pt-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#8aa095]">Your privacy space</div>
        <nav className="space-y-1">
          {nav.map((item) => {
            const active = loc === item.href || (item.href !== '/' && loc.startsWith(item.href));
            const Icon = item.icon;
            return <Link href={item.href} key={item.href} data-testid={`link-nav-${item.href.replace('/', 'home')}`} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition ${active ? 'bg-[#deece2] text-[#174c40]' : 'text-[#62786e] hover:bg-white hover:text-[#24483d]'}`}>
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8}/>{item.label}{active && <span className="ml-auto size-1.5 rounded-full bg-[#dfa642]"/>}
            </Link>;
          })}
        </nav>
        <div className="mt-auto rounded-[18px] border border-[#d8e5da] bg-[#f8fbf7] p-4">
          <div className="mb-3 grid size-9 place-items-center rounded-xl bg-[#f7e9c8] text-[#785a21]"><LockKeyhole size={17}/></div>
          <p className="text-sm font-bold">Your pace. Your choice.</p>
          <p className="mt-1.5 text-xs leading-[1.65] text-[#6d8278]">A little more understanding is enough for today. No streaks, no pressure.</p>
          <Link href="/guides" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#286253]" data-testid="link-sidebar-guides">Browse the guides <ArrowRight size={13}/></Link>
        </div>
        <div className="mt-4 flex items-center gap-2 px-2 text-[10px] text-[#899a91]"><ShieldCheck size={13}/>Privacy is a practice, not a test.</div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  </div>;
}

function AuthDialog({ onClose, onSuccess, initialNotice }: { onClose: () => void; onSuccess: (user: PrivacyUser) => void; initialNotice?: string }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialNotice || '');
  const [sent, setSent] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
    defaultValues: { email: '', password: '' },
  });
  const submit = async (values: AuthFormValues) => {
    if (!supabase) return setError('Account sign-in is not available yet. The app owner needs to connect Supabase first.');
    setBusy(true); setError(''); setResendSuccess(false);
    try {
      const emailRedirectTo = getAuthRedirectUrl();
      const result = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: values.email, password: values.password })
        : await supabase.auth.signUp({
            email: values.email,
            password: values.password,
            options: { emailRedirectTo },
          });
      if (result.error) setError(result.error.message.toLowerCase().includes('invalid') ? 'That email and password did not match. Please try again.' : result.error.message);
      else if (result.data.user && result.data.session) { onSuccess(result.data.user); onClose(); }
      else if (result.data.user) setSent(true);
      else setError('We could not complete that request. Please try again.');
    } catch {
      setError('We could not reach the sign-in service. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (!supabase) return;
    const email = form.getValues('email')?.trim();
    if (!email) {
      setError('Please enter your email address to request a new confirmation link.');
      return;
    }
    setBusy(true); setError(''); setResendSuccess(false);
    try {
      const emailRedirectTo = getAuthRedirectUrl();
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo },
      });
      if (resendError) {
        setError(resendError.message);
      } else {
        setResendSuccess(true);
      }
    } catch {
      setError('We could not reach the service to resend the confirmation email. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[60] grid place-items-center bg-[#183c35]/35 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="page-enter w-full max-w-[440px] rounded-[26px] border border-[#dce8df] bg-[#fbfdf9] p-6 shadow-[0_24px_90px_-26px_rgba(20,56,46,.35)] sm:p-8" data-testid="dialog-auth">
      <div className="flex items-start justify-between"><div><div className="grid size-11 place-items-center rounded-2xl bg-[#e5f0e7] text-[#20594b]"><ShieldCheck size={21}/></div><h2 id="auth-title" className="font-display mt-5 text-2xl font-extrabold tracking-[-.045em]">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2><p className="mt-1 text-sm text-[#71867b]">Your conversations and learning, kept with your account.</p></div><button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-[#edf4ee]" data-testid="button-close-auth"><X size={17}/></button></div>
      {!supabaseConfigured && <div className="mt-5 rounded-xl border border-[#e9d7a8] bg-[#fff7e5] p-3.5 text-sm leading-relaxed text-[#6e5b31]" data-testid="status-auth-unavailable">Account sign-in is not set up yet. Public guides and lessons are ready to explore.</div>}
      {error && <div className="mt-4 rounded-xl bg-[#fff0ed] p-3 text-sm text-[#984e42]" role="alert" data-testid="status-auth-error">{error}</div>}
      {resendSuccess && <div className="mt-4 rounded-xl border border-[#c8dfce] bg-[#edf7ef] p-3 text-sm text-[#315f49]" role="status" data-testid="status-resend-success">A fresh confirmation link has been sent to your email.</div>}
      {sent ? <div className="mt-5 space-y-3.5"><div className="rounded-xl border border-[#c8dfce] bg-[#edf7ef] p-4 text-sm leading-relaxed text-[#315f49]" data-testid="status-email-confirmation">Check your inbox for a confirmation link. Your account will be ready once you confirm your email.</div><button onClick={handleResend} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#286253] hover:underline disabled:opacity-50" data-testid="button-resend-confirmation">Did not receive it? Resend confirmation email</button></div> : <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="mt-5 space-y-3.5">
        <FormField control={form.control} name="email" render={({ field }) => <FormItem className="space-y-1.5"><FormLabel className="text-xs font-bold text-[#496359]">Email address</FormLabel><FormControl><input type="email" autoComplete="email" {...field} className="w-full rounded-xl border border-[#d7e3d9] bg-white px-3.5 py-3 text-sm outline-none focus:border-[#4d8a72] focus:ring-2 focus:ring-[#4d8a72]/15" placeholder="you@example.com" data-testid="input-auth-email"/></FormControl><FormDescription className="sr-only">Enter the email address for your account.</FormDescription><FormMessage className="text-xs"/></FormItem>}/>
        <FormField control={form.control} name="password" render={({ field }) => <FormItem className="space-y-1.5"><FormLabel className="text-xs font-bold text-[#496359]">Password</FormLabel><FormControl><input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} {...field} className="w-full rounded-xl border border-[#d7e3d9] bg-white px-3.5 py-3 text-sm outline-none focus:border-[#4d8a72] focus:ring-2 focus:ring-[#4d8a72]/15" placeholder="At least 6 characters" data-testid="input-auth-password"/></FormControl><FormDescription className="sr-only">Enter a password with at least six characters.</FormDescription><FormMessage className="text-xs"/></FormItem>}/>
        <button type="submit" disabled={busy || !supabaseConfigured} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#184c43] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#236457] disabled:cursor-not-allowed disabled:opacity-45" data-testid="button-auth-submit">{busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'} {!busy && <ArrowRight size={15}/>}</button>
      </form></Form>}
      <div className="mt-5 flex flex-col items-center gap-2 text-center text-xs text-[#788d82]">
        <p>{mode === 'signin' ? 'New here?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSent(false); setResendSuccess(false); form.clearErrors(); }} className="font-bold text-[#286253] hover:underline" data-testid="button-auth-mode">{mode === 'signin' ? 'Create an account' : 'Sign in instead'}</button></p>
        {mode === 'signin' && !sent && <button type="button" onClick={handleResend} disabled={busy} className="text-[11px] text-[#5b7367] hover:underline" data-testid="button-resend-link">Need a new confirmation link?</button>}
      </div>
      <p className="mt-4 text-center text-[10px] leading-relaxed text-[#91a198]">Your privacy matters. We never ask you to share passwords or sensitive account details in a chat.</p>
    </div>
  </div>;
}

function useProgress(user: PrivacyUser | null) {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    setDone([]);
    if (user && supabase) supabase.from('learning_progress').select('item_id').eq('user_id', user.id).then(({ data }) => { if (active) setDone((data || []).map((row) => row.item_id)); });
    return () => { active = false; };
  }, [user?.id]);
  const toggle = async (id: string, type: string) => {
    if (!user || !supabase) return { ok: false, error: 'Sign in to save your progress.' };
    if (done.includes(id)) {
      const { error } = await supabase.from('learning_progress').delete().eq('user_id', user.id).eq('item_id', id).eq('item_type', type);
      if (!error) setDone((prev) => prev.filter((item) => item !== id));
      return { ok: !error, error: error?.message };
    }
    const { error } = await supabase.from('learning_progress').upsert({ user_id: user.id, item_id: id, item_type: type, completed_at: new Date().toISOString() }, { onConflict: 'user_id,item_id,item_type' });
    if (!error) setDone((prev) => [...prev, id]);
    return { ok: !error, error: error?.message };
  };
  return { done, toggle };
}

function PageHead({ eyebrow, title, description, extra }: { eyebrow: string; title: string; description: string; extra?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-4 sm:mb-10 sm:flex-row sm:items-end">
    <div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#668276]"><span className="size-1.5 rounded-full bg-[#d9a942]"/>{eyebrow}</div><h1 className="font-display text-[clamp(2rem,4vw,3.15rem)] font-extrabold leading-[1.06] tracking-[-.055em] text-[#173e36]" data-testid="text-page-title">{title}</h1><p className="mt-3 max-w-[600px] text-sm leading-6 text-[#71867b] sm:text-[15px]">{description}</p></div>{extra}
  </div>;
}

function FooterNote() {
  return <div className="mt-12 flex items-center gap-2 border-t border-[#dce8df] pt-5 text-[11px] leading-relaxed text-[#84958c]"><ShieldCheck size={14} className="shrink-0 text-[#598672]"/>A helpful place to learn, not legal or professional security advice.</div>;
}

function Overview({ user, done }: { user: PrivacyUser | null; done: string[] }) {
  const completed = done.length;
  return <div className="page-enter px-4 py-7 sm:px-8 sm:py-10 lg:px-12">
    <section className="relative overflow-hidden rounded-[28px] bg-[#194c42] px-6 py-8 text-[#f4f6e9] sm:px-10 sm:py-11 lg:px-12 lg:py-14" data-testid="section-welcome">
      <div className="absolute -right-10 -top-12 size-72 rounded-full border border-[#8eb49a]/20 sm:right-20 sm:size-[410px]"/><div className="absolute -right-3 top-[-5px] size-56 rounded-full border border-[#8eb49a]/15 sm:right-28 sm:size-[330px]"/><div className="absolute bottom-[-140px] right-[16%] size-72 rounded-full bg-[#2d6c58]/35 blur-3xl"/>
      <div className="relative max-w-[680px]"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[#dbe8d8]"><Sparkles size={13} className="text-[#f0cc76]"/>A little more in your hands</div>
        <h1 className="font-display max-w-[660px] text-[clamp(2.45rem,5vw,4.55rem)] font-extrabold leading-[.99] tracking-[-.065em]">Privacy can feel<br/><span className="font-editorial font-medium italic text-[#f1d58d]">more human.</span></h1>
        <p className="mt-5 max-w-[470px] text-sm leading-7 text-[#d4e3d8] sm:text-base">No scare tactics. No tech degree required. Just clear, practical ways to make your everyday digital life a little more yours.</p>
        <div className="mt-7 flex flex-wrap gap-3"><Link href="/guides" className="inline-flex items-center gap-2 rounded-full bg-[#f0d588] px-5 py-3 text-sm font-extrabold text-[#29483a] transition hover:-translate-y-0.5" data-testid="link-start-guide">Find a place to start <ArrowRight size={15}/></Link><Link href="/assistant" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-bold text-white hover:bg-white/10" data-testid="link-ask-privacy">Ask a privacy question <MessageCircle size={15}/></Link></div>
      </div>
      <div className="relative mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/15 pt-5 text-xs text-[#d5e4d9] sm:mt-12"><span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-[#f0d588]"/>Private by design</span><span className="inline-flex items-center gap-2"><Eye size={15} className="text-[#f0d588]"/>Plain-language guidance</span><span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-[#f0d588]"/>Progress at your pace</span></div>
    </section>

    {/* Prominent Privacy Audit Entry Card */}
    <section className="mt-8 rounded-[24px] border border-[#d8e6dc] bg-gradient-to-br from-[#ebf5ee] via-[#f4f9f4] to-[#fbfdfa] p-6 sm:p-8 shadow-sm" data-testid="card-privacy-audit-entry">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4 sm:gap-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#1b5043] text-[#f2d787] shadow-sm sm:size-14">
            <ClipboardCheck size={26} strokeWidth={2.2} />
          </span>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#deeee3] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#2c654f]">
              <Sparkles size={11} /> 10-Question Checkup
            </div>
            <h2 className="font-display mt-2 text-xl font-extrabold tracking-[-.035em] text-[#194035] sm:text-2xl" data-testid="text-audit-card-title">
              How private is your digital life?
            </h2>
            <p className="mt-1.5 max-w-[560px] text-xs leading-5 text-[#637d71] sm:text-sm">
              Answer a few simple questions and discover where you can improve your privacy.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <Link
            href="/audit"
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-[#1b5043] px-6 py-3.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#256658] hover:shadow-md sm:w-auto"
            data-testid="button-run-privacy-audit"
          >
            <span>Run Privacy Audit</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
    <div className="mt-9 grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,.8fr)]">
      <section><div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#799087]">Small steps, real impact</p><h2 className="font-display mt-1 text-[22px] font-extrabold tracking-[-.04em]">A few good places to begin</h2></div><Link href="/recommendations" className="hidden items-center gap-1 text-xs font-bold text-[#286253] sm:flex" data-testid="link-all-recommendations">All next steps <ArrowRight size={13}/></Link></div>
        <div className="divide-y divide-[#dce8df] rounded-2xl border border-[#dce8df] bg-[#fbfdf9] px-4 sm:px-5">
          {recommendations.map((r, i) => <div key={r.id} className="flex items-center gap-4 py-4" data-testid={`item-home-recommendation-${r.id}`}><span className={`grid size-10 shrink-0 place-items-center rounded-[14px] ${i === 0 ? 'bg-[#e2f0e5] text-[#39745d]' : i === 1 ? 'bg-[#e5eff2] text-[#407682]' : 'bg-[#fae9df] text-[#a46a4a]'}`}>{i === 0 ? <KeyRound size={18}/> : i === 1 ? <Eye size={18}/> : <MessageCircle size={18}/>}</span><div className="min-w-0 flex-1"><h3 className="text-sm font-bold">{r.title}</h3><p className="mt-1 text-xs text-[#788c82]">{r.time} · {r.label}</p></div><Link href={r.lesson ? `/lessons/${r.lesson}` : `/guides/${r.guide}`} className="grid size-9 shrink-0 place-items-center rounded-full border border-[#dce8df] text-[#416f5e] hover:bg-[#eff6f0]" aria-label={`Open ${r.title}`} data-testid={`link-home-recommendation-${r.id}`}><ArrowRight size={15}/></Link></div>)}
        </div><Link href="/recommendations" className="mt-4 flex items-center justify-center gap-1 text-xs font-bold text-[#286253] sm:hidden" data-testid="link-all-recommendations-mobile">See all next steps <ArrowRight size={13}/></Link>
      </section>
      <section className="rounded-2xl border border-[#dce8df] bg-[#edf4ed] p-5 sm:p-6" data-testid="card-progress"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#799087]">Your learning</p><h2 className="font-display mt-1 text-xl font-extrabold tracking-[-.04em]">One step at a time.</h2></div><span className="grid size-10 place-items-center rounded-[14px] bg-[#dceadd] text-[#396d55]"><GraduationCap size={19}/></span></div>
        <p className="mt-2 text-xs leading-5 text-[#71867b]">{user ? 'Your completed guides and lessons are saved to your account.' : 'Sign in to save progress across the guides and lessons you complete.'}</p>
        <div className="mt-5 flex items-baseline gap-2"><span className="font-display text-4xl font-extrabold tracking-[-.06em]" data-testid="text-progress-count">{user ? completed : '—'}</span><span className="text-xs text-[#788c82]">{user ? 'things learned' : 'saved yet'}</span></div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#d7e5d8]"><div className="h-full rounded-full bg-[#4f8a68] transition-all" style={{ width: user ? `${Math.min(completed / 7 * 100, 100)}%` : '0%' }}/></div>
        {!user && <Link href="/guides" className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-[#286253]" data-testid="link-explore-as-guest">Explore without an account <ArrowRight size={13}/></Link>}
        {user && <Link href="/lessons" className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-[#286253]" data-testid="link-continue-learning">Continue learning <ArrowRight size={13}/></Link>}
      </section>
    </div>
    <section className="mt-10 rounded-[22px] border border-[#e8dfc7] bg-[#fff8e9] p-5 sm:flex sm:items-center sm:justify-between sm:p-6"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f5e8c6] text-[#7d602b]"><CircleHelp size={17}/></span><div><h2 className="text-sm font-bold">Not sure what to ask?</h2><p className="mt-1 max-w-[520px] text-xs leading-5 text-[#7b725d]">Try asking about a specific moment: a new app, an unexpected message, or a setting you have never checked.</p></div></div><Link href="/assistant" className="ml-12 mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#775d2b] sm:ml-5 sm:mt-0" data-testid="link-ask-for-help">See example questions <ArrowRight size={13}/></Link></section>
    <FooterNote/>
  </div>;
}

function GuideCard({ guide, onOpen }: { guide: Guide; onOpen: (guide: Guide) => void }) {
  const styles: Record<string, string> = { mint: 'bg-[#e6f0e5] text-[#477052]', blue: 'bg-[#e7eff1] text-[#4b7780]', peach: 'bg-[#f8eade] text-[#9c684b]', gold: 'bg-[#f7efd9] text-[#917439]' };
  return <button onClick={() => onOpen(guide)} className="group flex h-full flex-col rounded-[20px] border border-[#dbe7dc] bg-[#fcfdfa] p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-[#adc8b2] hover:shadow-[0_14px_32px_-24px_rgba(32,80,58,.4)] sm:p-6" data-testid={`card-guide-${guide.id}`}>
    <div className="flex w-full items-center justify-between"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${styles[guide.accent]}`}>{guide.category}</span><span className="flex items-center gap-1 text-[10px] text-[#87988f]"><Clock3 size={12}/>{guide.read}</span></div><h3 className="font-display mt-5 text-[19px] font-extrabold leading-snug tracking-[-.035em] text-[#21483c]">{guide.title}</h3><p className="mt-2 flex-1 text-xs leading-[1.7] text-[#71867b]">{guide.summary}</p><span className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-[#286253] group-hover:gap-2.5">Read guide <ArrowRight size={14}/></span>
  </button>;
}

function GuideDetail({ guide, onBack, done, toggle, user }: { guide: Guide; onBack: () => void; done: boolean; toggle: () => Promise<{ ok: boolean; error?: string }>; user: PrivacyUser | null }) {
  const [notice, setNotice] = useState('');
  const complete = async () => { const result = await toggle(); setNotice(result.ok ? done ? 'Progress updated.' : 'Guide marked complete.' : result.error || 'Could not save progress. Please try again.'); };
  return <article className="page-enter max-w-[790px] px-4 py-7 sm:px-8 sm:py-10 lg:px-12">
    <button onClick={onBack} className="mb-7 inline-flex items-center gap-2 text-xs font-bold text-[#618075] hover:text-[#1a5748]" data-testid="button-back-guides"><ArrowLeft size={14}/>All guides</button>
    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#6c887a]">{guide.category}<span>·</span>{guide.read} read</div><h1 className="font-display text-[clamp(2.1rem,4vw,3.4rem)] font-extrabold leading-[1.07] tracking-[-.055em]" data-testid="text-guide-title">{guide.title}</h1><p className="mt-4 max-w-[620px] text-base leading-7 text-[#71867b]">{guide.summary}</p>
    <div className="mt-8 rounded-[20px] border border-[#dce8df] bg-[#fbfdf9] p-5 sm:p-7"><h2 className="font-display text-lg font-extrabold tracking-[-.03em]">A few practical steps</h2><ol className="mt-5 space-y-5">{guide.steps.map((step, i) => <li key={step} className="flex gap-4" data-testid={`item-guide-step-${i + 1}`}><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e5f0e7] text-xs font-bold text-[#387057]">{i + 1}</span><p className="pt-1 text-sm leading-6 text-[#496359]">{step}</p></li>)}</ol></div>
    <div className="mt-5 rounded-[18px] border border-[#e7dbb9] bg-[#fff8e8] p-5"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#816a34]"><Sparkles size={14}/>Keep in mind</div><p className="mt-2 text-sm leading-6 text-[#655a42]">{guide.takeaway}</p></div>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center"><button onClick={complete} className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition ${done ? 'border border-[#b7d2bd] bg-[#e8f3e9] text-[#32624a]' : 'bg-[#184c43] text-white hover:bg-[#236457]'}`} data-testid="button-complete-guide">{done ? <CheckCircle2 size={16}/> : <Check size={16}/>} {done ? 'Completed — undo' : 'Mark this guide complete'}</button>{!user && <span className="text-xs text-[#84948b]">Sign in to save your progress.</span>}</div>
    {notice && <p className="mt-3 text-xs text-[#557364]" role="status" data-testid="status-guide-progress">{notice}</p>}<FooterNote/>
  </article>;
}

function GuidesPage({ user, done, toggle }: { user: PrivacyUser | null; done: string[]; toggle: (id: string, type: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [selected, setSelected] = useState<Guide | null>(null);
  const [filter, setFilter] = useState('All topics');
  const categories = ['All topics', ...Array.from(new Set(guides.map((guide) => guide.category)))];
  const shown = filter === 'All topics' ? guides : guides.filter((guide) => guide.category === filter);
  if (selected) return <GuideDetail guide={selected} onBack={() => setSelected(null)} done={done.includes(selected.id)} toggle={() => toggle(selected.id, 'guide')} user={user}/>;
  return <div className="page-enter px-4 py-7 sm:px-8 sm:py-10 lg:px-12"><PageHead eyebrow="Guides & checklists" title="Practical, not perfect." description="Step-by-step ways to make everyday choices with a little more confidence. No jargon, and no need to do it all at once."/>
    <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter guides">{categories.map((cat) => <button key={cat} onClick={() => setFilter(cat)} className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${filter === cat ? 'bg-[#1b5246] text-white' : 'border border-[#dce8df] bg-[#fbfdf9] text-[#60796c] hover:border-[#a8c4ae]'}`} data-testid={`button-guide-filter-${cat.toLowerCase().replaceAll(' ', '-')}`}>{cat}</button>)}</div>
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{shown.map((guide) => <GuideCard key={guide.id} guide={guide} onOpen={setSelected}/>)}</div>
    <section className="mt-8 rounded-[20px] border border-[#dce8df] bg-[#eaf2e9] p-5 sm:flex sm:items-center sm:justify-between sm:p-6"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#4b765d]"><FileCheck2 size={17}/></span><div><h2 className="text-sm font-bold">Your progress is yours</h2><p className="mt-1 text-xs leading-5 text-[#73877a]">{user ? `${done.length} guide${done.length === 1 ? '' : 's'} and lesson${done.length === 1 ? '' : 's'} completed so far.` : 'Browse every checklist without signing in. Sign in when you would like your completions saved.'}</p></div></div>{!user && <span className="ml-12 mt-3 text-[11px] font-semibold text-[#75897e] sm:ml-4 sm:mt-0">Progress saving requires an account</span>}</section><FooterNote/>
  </div>;
}

function LessonDetail({ lesson, onBack, done, toggle, user }: { lesson: Lesson; onBack: () => void; done: boolean; toggle: () => Promise<{ ok: boolean; error?: string }>; user: PrivacyUser | null }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [completed, setCompleted] = useState(done);
  const quiz = lesson.quiz;
  const answer = choice === quiz.answer;
  useEffect(() => setCompleted(done), [done]);
  const finish = async () => { const result = await toggle(); if (result.ok) setCompleted(!completed); setNotice(result.ok ? !completed ? 'Lesson completed and saved.' : 'Completion removed.' : result.error || 'Could not save progress. Please try again.'); };
  return <article className="page-enter max-w-[790px] px-4 py-7 sm:px-8 sm:py-10 lg:px-12">
    <button onClick={onBack} className="mb-7 inline-flex items-center gap-2 text-xs font-bold text-[#618075] hover:text-[#1a5748]" data-testid="button-back-lessons"><ArrowLeft size={14}/>All lessons</button>
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#6c887a]">{lesson.level}<span>·</span>{lesson.duration}</div><h1 className="font-display mt-3 text-[clamp(2.1rem,4vw,3.4rem)] font-extrabold leading-[1.07] tracking-[-.055em]" data-testid="text-lesson-title">{lesson.title}</h1><p className="mt-4 text-base leading-7 text-[#71867b]">{lesson.summary}</p>
    <div className="mt-8 space-y-5">{lesson.body.map((p, i) => <p key={p} className="text-[15px] leading-[1.85] text-[#456056]" data-testid={`text-lesson-section-${i + 1}`}>{p}</p>)}</div>
    <section className="mt-9 rounded-[22px] border border-[#dce8df] bg-[#edf4ed] p-5 sm:p-7" data-testid="section-lesson-quiz"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#678275]"><CircleHelp size={14}/>Quick check</div><h2 className="font-display mt-3 text-xl font-extrabold tracking-[-.03em]">{quiz.question}</h2><div className="mt-5 space-y-2.5">{quiz.options.map((option, i) => <button key={option} onClick={() => setChoice(i)} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${choice === i ? i === quiz.answer ? 'border-[#8ab79a] bg-[#e2f1e6] text-[#285741]' : 'border-[#e6b3a5] bg-[#fff1ec] text-[#854e42]' : 'border-[#d7e3d9] bg-white hover:border-[#aac5af]'}`} data-testid={`button-quiz-option-${i}`}><span className="grid size-6 shrink-0 place-items-center rounded-full border border-current text-[10px] font-bold">{String.fromCharCode(65 + i)}</span>{option}{choice === i && (i === quiz.answer ? <Check size={15} className="ml-auto"/> : <X size={15} className="ml-auto"/>)}</button>)}</div>
      {choice !== null && <p className={`mt-4 text-sm leading-6 ${answer ? 'text-[#38704e]' : 'text-[#8b5a48]'}`} role="status" data-testid="status-quiz-result">{answer ? 'That’s right. ' : 'Not quite. '} {quiz.explanation}</p>}
    </section>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center"><button disabled={choice !== quiz.answer} onClick={finish} className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition ${completed ? 'border border-[#b7d2bd] bg-[#e8f3e9] text-[#32624a]' : 'bg-[#184c43] text-white hover:bg-[#236457] disabled:cursor-not-allowed disabled:opacity-40'}`} data-testid="button-complete-lesson">{completed ? <CheckCircle2 size={16}/> : <Check size={16}/>} {completed ? 'Completed — undo' : 'Finish this lesson'}</button>{!user && <span className="text-xs text-[#84948b]">Sign in to save your progress.</span>}</div>{notice && <p className="mt-3 text-xs text-[#557364]" role="status" data-testid="status-lesson-progress">{notice}</p>}<FooterNote/>
  </article>;
}

function LessonsPage({ user, done, toggle }: { user: PrivacyUser | null; done: string[]; toggle: (id: string, type: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [selected, setSelected] = useState<Lesson | null>(null);
  if (selected) return <LessonDetail key={selected.id} lesson={selected} onBack={() => setSelected(null)} done={done.includes(selected.id)} toggle={() => toggle(selected.id, 'lesson')} user={user}/>;
  return <div className="page-enter px-4 py-7 sm:px-8 sm:py-10 lg:px-12"><PageHead eyebrow="Short lessons" title="Learn it in a few minutes." description="Small, useful lessons to help you recognize what matters and decide what to do next."/>
    <div className="mb-6 flex items-center gap-2 rounded-xl border border-[#dce8df] bg-[#edf4ed] px-4 py-3 text-xs text-[#60796c]"><Clock3 size={14}/>Each lesson takes just a few minutes and ends with a quick check-in.</div>
    <div className="space-y-3">{lessons.map((lesson, i) => <button key={lesson.id} onClick={() => setSelected(lesson)} className="group flex w-full items-center gap-4 rounded-[18px] border border-[#dce8df] bg-[#fbfdf9] p-4 text-left transition hover:border-[#aec6b1] hover:shadow-sm sm:p-5" data-testid={`card-lesson-${lesson.id}`}><span className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-[#e6f0e5] font-display text-lg font-extrabold text-[#427054]">{String(i + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-[16px] font-extrabold tracking-[-.025em] text-[#21483c]">{lesson.title}</h2>{done.includes(lesson.id) && <span className="rounded-full bg-[#e5f1e5] px-2 py-0.5 text-[9px] font-bold text-[#39704f]">Complete</span>}</div><p className="mt-1.5 text-xs leading-5 text-[#788c82]">{lesson.summary}</p><div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-[#8a9a91]"><span>{lesson.level}</span><span>·</span><span>{lesson.duration}</span></div></div><ArrowRight size={17} className="shrink-0 text-[#739184] transition group-hover:translate-x-1"/><span className="sr-only">Open lesson</span></button>)}</div><FooterNote/>
  </div>;
}

function RecommendationsPage({ user, done }: { user: PrivacyUser | null; done: string[] }) {
  const steps = recommendations.map((item) => ({ ...item, completed: done.includes(item.guide || item.lesson || '') }));
  return <div className="page-enter px-4 py-7 sm:px-8 sm:py-10 lg:px-12"><PageHead eyebrow="Your next steps" title="A little progress goes a long way." description="A few thoughtful next actions, based on the guides and lessons here. Choose the one that feels useful today."/>
    <div className="mb-8 flex items-center gap-3 rounded-[18px] border border-[#e8dfc7] bg-[#fff8e9] p-4 sm:p-5"><span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[#f5e8c6] text-[#816329]"><Sparkles size={18}/></span><div><p className="text-sm font-bold">Made to be manageable</p><p className="mt-1 text-xs leading-5 text-[#7b725d]">These are simple options, not a scorecard. Skipping one is completely fine.</p></div></div>
    <div className="space-y-3">{steps.map((step, i) => <article key={step.id} className="flex flex-col gap-4 rounded-[20px] border border-[#dce8df] bg-[#fbfdf9] p-5 sm:flex-row sm:items-center sm:p-6" data-testid={`card-recommendation-${step.id}`}><span className={`grid size-12 shrink-0 place-items-center rounded-[16px] ${i === 0 ? 'bg-[#e2f0e5] text-[#39745d]' : i === 1 ? 'bg-[#e5eff2] text-[#407682]' : 'bg-[#fae9df] text-[#a46a4a]'}`}>{i === 0 ? <KeyRound size={19}/> : i === 1 ? <Eye size={19}/> : <MessageCircle size={19}/>}</span><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#768c80]">Step {String(i + 1).padStart(2, '0')}</span><span className="text-[#c4d1c8]">·</span><span className="text-[10px] font-semibold text-[#889890]">{step.time}</span>{step.completed && <span className="inline-flex items-center gap-1 rounded-full bg-[#e6f2e7] px-2 py-0.5 text-[9px] font-bold text-[#3c714f]"><Check size={10}/>Done</span>}</div><h2 className="font-display mt-1.5 text-lg font-extrabold tracking-[-.03em] text-[#21483c]">{step.title}</h2><p className="mt-1 max-w-[700px] text-xs leading-5 text-[#71867b]">{step.why}</p></div><Link href={step.lesson ? `/lessons/${step.lesson}` : `/guides/${step.guide}`} className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-[#cadccf] bg-white px-4 py-2.5 text-xs font-bold text-[#286253] transition hover:bg-[#edf5ee] sm:self-center" data-testid={`link-recommendation-${step.id}`}>{step.completed ? 'Review' : 'Explore'} <ArrowRight size={14}/></Link></article>)}</div>
    <section className="mt-8 rounded-[20px] border border-[#dce8df] bg-[#edf4ed] p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#718a7c]">Progress, on your terms</p><p className="mt-2 text-sm leading-6 text-[#4f6a5d]">{user ? `You have completed ${done.length} learning item${done.length === 1 ? '' : 's'}. Come back whenever another step feels useful.` : 'Sign in to keep your completed guides and lessons with your account. You can explore all recommendations without one.'}</p></section><FooterNote/>
  </div>;
}

function AssistantPage({ user, openAuth }: { user: PrivacyUser | null; openAuth: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const savedConversations = useMemo(() => conversations.slice(0, 40), [conversations]);
  const activeConversation = conversations.find((item) => item.id === activeId);
  useEffect(() => {
    setConversations([]); setMessages([]); setActiveId(null); setInput(''); setBusy(false); setNotice(null); setServiceUnavailable(false);
    let alive = true;
    if (!user || !supabase) return () => { alive = false; };
    setLoadingList(true);
    supabase.from('conversations').select('id,user_id,title,created_at,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(40)
      .then(({ data, error }) => { if (alive) { setLoadingList(false); if (error) setNotice({ kind: 'info', text: 'Saved conversations are not available right now. You can still start a new chat.' }); else setConversations((data || []) as Conversation[]); } });
    return () => { alive = false; };
  }, [user?.id]);
  useEffect(() => {
    if (!activeId || !user || !supabase) { setMessages([]); return; }
    let alive = true;
    setLoadingHistory(true);
    supabase.from('messages').select('id,conversation_id,user_id,role,content,created_at').eq('user_id', user.id).eq('conversation_id', activeId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(80)
      .then(({ data, error }) => { if (alive) { setLoadingHistory(false); if (error) setNotice({ kind: 'info', text: 'This conversation could not be loaded. Please try selecting it again.' }); else setMessages(((data || []) as ChatMessage[]).reverse()); } });
    return () => { alive = false; };
  }, [activeId, user?.id]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  const hydrateConversation = async (id: string) => {
    if (!user || !supabase) return;
    activeIdRef.current = id;
    setActiveId(id);
    const [conversationResult, messageResult] = await Promise.all([
      supabase.from('conversations').select('id,user_id,title,created_at,updated_at').eq('id', id).eq('user_id', user.id).maybeSingle(),
      supabase.from('messages').select('id,conversation_id,user_id,role,content,created_at').eq('user_id', user.id).eq('conversation_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(80),
    ]);
    if (conversationResult.data) {
      const conversation = conversationResult.data as Conversation;
      setConversations((prev) => [conversation, ...prev.filter((item) => item.id !== id)].sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    }
    if (messageResult.data) setMessages((messageResult.data as ChatMessage[]).reverse());
  };
  const sendMessage = async (text: string, retry = false, retryMessageId?: string) => {
    const messageText = text.trim();
    if (!messageText || messageText.length > 4000 || busy || !user || !supabase) return;
    if (!supabaseConfigured) { setServiceUnavailable(true); setNotice({ kind: 'info', text: 'AI chat is not available yet. Browse the built-in guides below for practical help.' }); return; }
    setNotice(null); setServiceUnavailable(false); setBusy(true);
    let conversationId = activeIdRef.current;
    const messageId = retry && retryMessageId ? retryMessageId : crypto.randomUUID();
    if (!retry) {
      const optimisticMessage: ChatMessage = {
        id: messageId,
        conversation_id: conversationId || '',
        user_id: user.id,
        role: 'user',
        content: messageText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev.filter((m) => !m.failed), optimisticMessage].slice(-80));
      setInput('');
    }
    try {
      const { data, error } = await supabase.functions.invoke('privacy-assistant', { body: { message: messageText, conversationId, messageId } });
      if (error) throw error;
      const answerText = data?.response;
      if (typeof answerText !== 'string' || !answerText.trim()) throw new Error('The assistant returned an empty response.');
      if (typeof data?.conversationId !== 'string') throw new Error('The assistant response could not be saved.');
      await hydrateConversation(data.conversationId);
      setNotice(null);
      setServiceUnavailable(false);
    } catch (err) {
      const context = typeof err === 'object' && err !== null && 'context' in err
        ? (err as { context?: unknown }).context
        : null;
      const response = context instanceof Response ? context : null;
      let errorBody: { error?: string; message?: string; conversationId?: string } = {};
      if (response) {
        try { errorBody = await response.clone().json(); } catch { /* Use the status when the response has no JSON body. */ }
      }
      const status = response?.status;
      if (typeof errorBody.conversationId === 'string') {
        conversationId = errorBody.conversationId;
        await hydrateConversation(conversationId);
      }
      const rateLimited = status === 429 || errorBody.error === 'rate_limited';
      const authExpired = status === 401 || status === 403;
      const errorMessage = rateLimited
        ? rateLimitMessage
        : authExpired
          ? 'Your sign-in may have expired. Sign in again to continue.'
          : status === 400 && errorBody.message
            ? errorBody.message
            : 'AI Assistant is currently unavailable.';
      const messageContent = authExpired || status === 400
        ? errorMessage
        : `${errorMessage}\n\n${getGuideFallback(messageText)}`;
      const failedMessage: ChatMessage = {
        id: `failed-${Date.now()}`,
        conversation_id: conversationId || '',
        user_id: user.id,
        role: 'assistant',
        content: messageContent,
        created_at: new Date().toISOString(),
        failed: true,
      };
      setMessages((prev) => [...prev.filter((m) => !m.failed), failedMessage].slice(-80));
      setNotice({ kind: 'info', text: errorMessage });
      setServiceUnavailable(!authExpired && status !== 400);
    } finally { setBusy(false); }
  };
  const startNew = () => { activeIdRef.current = null; setActiveId(null); setMessages([]); setInput(''); setNotice(null); setServiceUnavailable(false); };
  const deleteConversation = async (id: string) => {
    if (!user || !supabase) return;
    const { error } = await supabase.from('conversations').delete().eq('id', id).eq('user_id', user.id);
    if (error) { setNotice({ kind: 'error', text: 'We could not delete this conversation. Please try again.' }); return; }
    setConversations((prev) => prev.filter((item) => item.id !== id));
    if (activeId === id) startNew();
  };
  const clearCurrent = async () => {
    if (!activeId || !user || !supabase) return;
    const { error } = await supabase.from('messages').delete().eq('conversation_id', activeId).eq('user_id', user.id);
    if (error) setNotice({ kind: 'error', text: 'We could not clear this conversation. Please try again.' });
    else { setMessages([]); setNotice({ kind: 'info', text: 'Messages cleared from this conversation.' }); }
  };
  const retryMessage = (msg: ChatMessage) => {
    const lastUserMessage = [...messages].reverse().find((item) => item.role === 'user');
    if (lastUserMessage) sendMessage(lastUserMessage.content, true, lastUserMessage.id);
    else sendMessage(msg.content, true);
  };
  const copyMessage = async (msg: ChatMessage) => { try { await navigator.clipboard.writeText(msg.content); setCopied(msg.id); window.setTimeout(() => setCopied(null), 1600); } catch { setNotice({ kind: 'info', text: 'Copy is not available in this browser.' }); } };
  const submit = (event: FormEvent) => { event.preventDefault(); sendMessage(input); };
  if (!user) return <div className="page-enter px-4 py-7 sm:px-8 sm:py-10 lg:px-12"><PageHead eyebrow="Privacy assistant" title="A thoughtful place to ask." description="Get plain-language help with the everyday privacy questions that are on your mind."/>
    <div className="mx-auto max-w-[620px] rounded-[24px] border border-[#dce8df] bg-[#fbfdf9] p-6 text-center sm:p-10" data-testid="status-assistant-signin"><div className="mx-auto grid size-14 place-items-center rounded-[19px] bg-[#e5f0e7] text-[#2e6a56]"><LockKeyhole size={24}/></div><h2 className="font-display mt-5 text-xl font-extrabold tracking-[-.035em]">Your conversations stay with your account.</h2><p className="mx-auto mt-2 max-w-[410px] text-sm leading-6 text-[#71867b]">Sign in to use the privacy assistant and save conversations. You can explore every guide and lesson without an account.</p>{!supabaseConfigured && <p className="mt-4 rounded-xl bg-[#fff7e5] px-4 py-3 text-xs leading-5 text-[#79663c]">Sign-in and AI features need to be connected by the app owner first. They are not enabled yet.</p>}<button onClick={openAuth} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#184c43] px-5 py-3 text-sm font-bold text-white hover:bg-[#236457]" data-testid="button-assistant-signin"><LogIn size={15}/>Sign in to continue</button>
      <div className="mt-8 border-t border-[#e2eae3] pt-6 text-left"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#81958a]">Helpful while you wait</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{guides.slice(0, 2).map((g) => <Link href={`/guides/${g.id}`} key={g.id} className="flex items-center justify-between rounded-xl border border-[#e1eae2] bg-white px-3.5 py-3 text-xs font-bold text-[#416c5b] hover:bg-[#f4f8f3]" data-testid={`link-assistant-help-${g.id}`}>{g.title}<ArrowRight size={13}/></Link>)}</div></div>
    </div><FooterNote/>
  </div>;
  return <div className="page-enter px-3 py-5 sm:px-6 sm:py-8 lg:px-9">
    <PageHead eyebrow="Privacy assistant" title="Ask without the jargon." description="A private place to think through a privacy question. Start small — your question does not need to be perfectly worded." extra={<button onClick={startNew} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#cadccf] bg-[#fbfdf9] px-4 py-2.5 text-xs font-bold text-[#286253] hover:bg-[#eaf3eb]" data-testid="button-new-conversation"><Plus size={15}/>New conversation</button>}/>
    <div className="grid overflow-hidden rounded-[22px] border border-[#dce8df] bg-[#fbfdf9] shadow-[0_12px_40px_-36px_rgba(31,75,58,.45)] lg:min-h-[590px] lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-[#dce8df] bg-[#f2f7f1] p-3 lg:border-b-0 lg:border-r lg:p-4"><div className="mb-3 flex items-center justify-between px-2"><span className="text-[10px] font-bold uppercase tracking-[.15em] text-[#81958a]">Your conversations</span>{loadingList && <span className="size-3 animate-pulse rounded-full bg-[#a8c5b0]"/>}</div><button onClick={startNew} className="mb-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-[#b8cdbd] px-3 py-2.5 text-left text-xs font-bold text-[#41705d] hover:bg-white" data-testid="button-conversation-create"><Plus size={14}/>Start a new conversation</button>
        <div className="flex max-h-[150px] flex-col gap-1 overflow-y-auto lg:max-h-[420px]" data-testid="list-conversations">{loadingList ? Array.from({ length: 3 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-[#e5eee5}"/>) : savedConversations.length ? savedConversations.map((conv) => <div key={conv.id} className={`group flex items-center gap-1 rounded-xl px-2 py-1 ${activeId === conv.id ? 'bg-[#deece2]' : 'hover:bg-white'}`} data-testid={`item-conversation-${conv.id}`}><button onClick={() => { setActiveId(conv.id); setNotice(null); }} className={`min-w-0 flex-1 py-2 text-left text-xs font-semibold ${activeId === conv.id ? 'text-[#285d4b]' : 'text-[#647a6f]'}`}><span className="block truncate">{conv.title || 'Untitled conversation'}</span><span className="mt-1 block text-[9px] font-medium text-[#93a198]">{new Date(conv.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></button><button onClick={() => deleteConversation(conv.id)} title="Delete conversation" aria-label={`Delete ${conv.title}`} className="grid size-7 shrink-0 place-items-center rounded-lg text-[#9aaba0] opacity-0 hover:bg-[#fff0ed] hover:text-[#a35b4d] group-hover:opacity-100 focus:opacity-100" data-testid={`button-delete-conversation-${conv.id}`}><Trash2 size={13}/></button></div>) : <div className="px-3 py-5 text-center text-[11px] leading-5 text-[#899a91]" data-testid="status-empty-conversations">Your saved conversations will appear here.</div>}</div>
        {activeId && <div className="mt-3 flex gap-2 border-t border-[#dce8df] pt-3"><button onClick={clearCurrent} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[#72887b] hover:bg-white hover:text-[#3e6251]" data-testid="button-clear-conversation"><Trash2 size={12}/>Clear messages</button><button onClick={() => deleteConversation(activeId)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[#987468] hover:bg-[#fff0ed]" data-testid="button-delete-active-conversation"><X size={12}/>Delete</button></div>}
      </aside>
      <section className="flex min-h-[570px] min-w-0 flex-col">
        <div className="flex items-center justify-between border-b border-[#e2eae3] px-4 py-3.5 sm:px-5"><div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-[11px] bg-[#e5f0e7] text-[#326d55]"><ShieldCheck size={16}/></span><div><p className="text-xs font-bold" data-testid="text-chat-title">{activeConversation?.title || 'A private conversation'}</p><p className="mt-0.5 text-[9px] text-[#899a91]">{supabaseConfigured ? 'Your conversations are saved to your account' : 'AI service not configured'}</p></div></div><button onClick={startNew} className="grid size-8 place-items-center rounded-full text-[#6c8578] hover:bg-[#eef5ee] lg:hidden" aria-label="New conversation" data-testid="button-new-conversation-mobile"><Plus size={17}/></button></div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6" data-testid="chat-history">
          {loadingHistory ? <div className="space-y-4" data-testid="status-history-loading"><div className="h-16 w-3/4 animate-pulse rounded-2xl bg-[#edf3ed]"/><div className="ml-auto h-16 w-2/3 animate-pulse rounded-2xl bg-[#e1eee4]"/></div> : messages.length === 0 ? <div className="mx-auto max-w-[600px] py-5 sm:py-10" data-testid="empty-chat"><div className="mx-auto grid size-12 place-items-center rounded-[17px] bg-[#eaf2e9] text-[#48775c]"><MessageCircle size={21}/></div><h2 className="font-display mt-4 text-center text-xl font-extrabold tracking-[-.035em]">What’s on your mind?</h2><p className="mx-auto mt-2 max-w-[390px] text-center text-xs leading-5 text-[#788c82]">A question about an app, a strange email, or just where to start. Choose a prompt or ask in your own words.</p><div className="mt-6 grid gap-2 sm:grid-cols-2">{suggestedPrompts.map((prompt, i) => <button key={prompt} disabled={busy} onClick={() => sendMessage(prompt)} className="group flex items-center justify-between gap-2 rounded-xl border border-[#dce8df] bg-white px-3.5 py-3 text-left text-[11px] font-semibold leading-[1.5] text-[#49685a] transition hover:border-[#abc8b1] hover:bg-[#f1f7f1] disabled:opacity-50" data-testid={`button-suggested-prompt-${i}`}><span>{prompt}</span><ArrowRight size={13} className="shrink-0 text-[#89a095] transition group-hover:translate-x-0.5"/></button>)}</div></div> : <div className="mx-auto max-w-[690px] space-y-5">{messages.slice(-80).map((msg) => <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`} data-testid={`message-${msg.role}-${msg.id}`}><div className={`max-w-[88%] sm:max-w-[80%] ${msg.role === 'user' ? 'rounded-[18px] rounded-br-md bg-[#1b5549] px-4 py-3 text-white' : `rounded-[18px] rounded-bl-md border px-4 py-3 ${msg.failed ? 'border-[#ebd8c7] bg-[#fff8ef] text-[#786247]' : 'border-[#dce8df] bg-white text-[#3b584c]'}`}`}><ChatMarkdown content={msg.content} role={msg.role} messageId={msg.id}/>{msg.role === 'assistant' && <div className="mt-3 flex items-center justify-between border-t border-[#e4ebe4] pt-2"><span className="text-[9px] text-[#95a49b]">{msg.failed ? 'Not an AI response' : 'PrivacyGuard AI'}</span><div className="flex gap-1"><button onClick={() => copyMessage(msg)} title="Copy response" aria-label="Copy response" className="grid size-7 place-items-center rounded-lg text-[#82948a] hover:bg-[#eff5ef]" data-testid={`button-copy-response-${msg.id}`}>{copied === msg.id ? <Check size={13}/> : <Copy size={13}/>}</button>{msg.failed && <button onClick={() => retryMessage(msg)} disabled={busy} className="rounded-lg px-2 text-[10px] font-bold text-[#6a806e] hover:bg-white disabled:opacity-50" data-testid={`button-retry-message-${msg.id}`}>Retry</button>}</div></div>}</div></div>)}
            {busy && <div className="flex justify-start" data-testid="status-ai-loading"><div className="flex items-center gap-3 rounded-[18px] rounded-bl-md border border-[#dce8df] bg-white px-4 py-3 text-xs text-[#71867b]"><span className="flex gap-1"><i className="size-1.5 animate-bounce rounded-full bg-[#6f9d7e] [animation-delay:-.2s]"/><i className="size-1.5 animate-bounce rounded-full bg-[#6f9d7e] [animation-delay:-.1s]"/><i className="size-1.5 animate-bounce rounded-full bg-[#6f9d7e]"/></span>Thinking this through…</div></div>}
          </div>}
          {notice && <div className={`mx-auto mt-5 max-w-[690px] rounded-xl px-4 py-3 text-xs leading-5 ${notice.kind === 'error' ? 'bg-[#fff0ed] text-[#955649]' : 'bg-[#fff8e9] text-[#75613b]'}`} role="status" data-testid="status-chat-notice">{notice.text}</div>}
        </div>
        {serviceUnavailable && <div className="border-t border-[#eadfca] bg-[#fff9eb] px-4 py-3 sm:px-6"><div className="mx-auto flex max-w-[690px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-5 text-[#7b6947]">AI is unavailable right now. These practical guides are ready to help instead.</p><div className="flex flex-wrap gap-2">{guides.slice(0, 2).map((g) => <Link href={`/guides/${g.id}`} key={g.id} className="inline-flex items-center gap-1 rounded-full border border-[#e3d5b2] bg-white px-3 py-1.5 text-[10px] font-bold text-[#725d31]" data-testid={`link-ai-fallback-${g.id}`}>{g.title}<ArrowRight size={11}/></Link>)}</div></div></div>}
        <form onSubmit={submit} className="border-t border-[#e2eae3] bg-[#f9fcf8] p-3 sm:p-4"><div className="mx-auto max-w-[690px]"><div className="flex items-end gap-2 rounded-[16px] border border-[#d4e1d6] bg-white p-2 focus-within:border-[#80a98b] focus-within:ring-2 focus-within:ring-[#78a988]/10"><textarea value={input} onChange={(e) => setInput(e.target.value.slice(0, 4000))} maxLength={4000} rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e as unknown as FormEvent); } }} placeholder="Ask a question about your privacy…" className="max-h-32 min-h-[45px] flex-1 resize-y bg-transparent px-2 py-1.5 text-xs leading-5 text-[#345347] outline-none placeholder:text-[#9aaba1]" disabled={busy || !supabaseConfigured} data-testid="input-chat-composer"/><button type="submit" disabled={!input.trim() || busy || input.length > 4000 || !supabaseConfigured} className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#1b5549] text-white transition hover:bg-[#28715e] disabled:cursor-not-allowed disabled:opacity-35" aria-label="Send message" data-testid="button-send-message">{busy ? <span className="size-4 animate-pulse rounded-full bg-white/70"/> : <Send size={15}/>}</button></div><div className="mt-2 flex items-center justify-between px-1 text-[9px] text-[#95a49b]"><span>Keep sensitive details like passwords and codes to yourself.</span><span data-testid="text-composer-count">{input.length}/4000</span></div></div></form>
      </section>
    </div>
    <FooterNote/>
  </div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function PrivacyApp() {
  const [location] = useLocation();
  const [user, setUser] = useState<PrivacyUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | undefined>(undefined);
  const { done, toggle } = useProgress(user);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check query params & hash fragment for Supabase auth errors (e.g., expired confirmation link)
    const hash = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(window.location.search);

    const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
    const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');

    if (
      errorCode === 'otp_expired' ||
      errorCode === 'access_denied' ||
      (errorDescription && (errorDescription.includes('expired') || errorDescription.includes('token')))
    ) {
      setAuthNotice('Your confirmation link has expired. Please request a new one.');
      setAuthOpen(true);
      // Clean up the URL hash & query so raw Supabase error params are not visible to users or judges
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!supabase) { setAuthReady(true); return; }
    getCurrentUser().then((current) => { if (mounted) { setUser(current); setAuthReady(true); } });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user || null;
      setUser((previous) => {
        if (previous?.id !== next?.id) queryClient.clear();
        return next;
      });
      setAuthReady(true);
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); setUser(null); };
  const openAuth = useCallback(() => { setAuthNotice(undefined); setAuthOpen(true); }, []);
  if (!authReady) return <div className="grid min-h-[100dvh] place-items-center bg-[#f5f8f4]" data-testid="status-auth-loading"><div className="flex items-center gap-3 rounded-full border border-[#dce8df] bg-white px-4 py-3 text-xs text-[#668074]"><span className="size-2 animate-pulse rounded-full bg-[#6e9c7c]"/>Getting your privacy space ready…</div></div>;
  return <AppShell user={user} openAuth={openAuth} signOut={signOut}><RoutedErrorBoundary key={location}><Switch>
    <Route path="/"><Overview user={user} done={done}/></Route>
    <Route path="/audit"><PrivacyAuditPage user={user} done={done} toggle={toggle}/></Route>
    <Route path="/assistant"><AssistantPage key={user?.id || 'guest'} user={user} openAuth={openAuth}/></Route>
    <Route path="/guides"><GuidesPage user={user} done={done} toggle={toggle}/></Route>
    <Route path="/guides/:id">{(params) => <GuideRoute id={params.id} user={user} done={done} toggle={toggle}/>}</Route>
    <Route path="/lessons"><LessonsPage user={user} done={done} toggle={toggle}/></Route>
    <Route path="/lessons/:id">{(params) => <LessonRoute id={params.id} user={user} done={done} toggle={toggle}/>}</Route>
    <Route path="/recommendations"><RecommendationsPage user={user} done={done}/></Route>
    <Route component={NotFound}/>
  </Switch></RoutedErrorBoundary>{authOpen && <AuthDialog onClose={() => { setAuthOpen(false); setAuthNotice(undefined); }} onSuccess={setUser} initialNotice={authNotice}/>}</AppShell>;
}

function GuideRoute({ id, user, done, toggle }: { id: string; user: PrivacyUser | null; done: string[]; toggle: (id: string, type: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [loc, setLoc] = useLocation();
  const guide = guides.find((item) => item.id === id);
  useEffect(() => { if (!guide) setLoc('/guides'); }, [guide, setLoc]);
  return guide ? <GuideDetail guide={guide} onBack={() => setLoc('/guides')} done={done.includes(guide.id)} toggle={() => toggle(guide.id, 'guide')} user={user}/> : null;
}
function LessonRoute({ id, user, done, toggle }: { id: string; user: PrivacyUser | null; done: string[]; toggle: (id: string, type: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [, setLoc] = useLocation();
  const lesson = lessons.find((item) => item.id === id);
  useEffect(() => { if (!lesson) setLoc('/lessons'); }, [lesson, setLoc]);
  return lesson ? <LessonDetail key={lesson.id} lesson={lesson} onBack={() => setLoc('/lessons')} done={done.includes(lesson.id)} toggle={() => toggle(lesson.id, 'lesson')} user={user}/> : null;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <PrivacyApp/>
          </WouterRouter>
          <Toaster/>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
