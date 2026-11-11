import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Kanban, Lock, Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';

import { BrandLogo } from '../../components/common/BrandLogo';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  // Automatically redirect if user already has an active session
  useEffect(() => {
    if (!authLoading && session) {
      navigate(from, { replace: true });
    }
  }, [session, authLoading, navigate, from]);

  // Read error message from redirect state or URL parameters if any
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.startsWith('#') ? location.hash.substring(1) : location.hash);
    const urlError =
      searchParams.get('error_description') ||
      hashParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error');

    if (urlError) {
      setErrorMsg(decodeURIComponent(urlError.replace(/\+/g, ' ')));
    } else if (location.state?.error) {
      setErrorMsg(location.state.error);
    }
  }, [location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else if (data.session) {
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setGoogleLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setGoogleLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google authentication failed.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-amber-500 selection:text-black">
      {/* Background grid */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <Link to="/" className="inline-flex items-center justify-center mb-6 group">
          <BrandLogo size="lg" showText={true} showVersion={false} glow={true} />
        </Link>
        <h2 className="text-2xl font-extrabold text-white tracking-tight font-mono">
          Sign In to Your Workspace
        </h2>
        <p className="mt-1.5 text-xs text-slate-400 font-sans">
          Enter your organization credentials or authenticate with Google.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-[#0c1018] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
              {errorMsg.toLowerCase().includes('exchange') && (
                <div className="text-[11px] text-rose-200/90 bg-rose-950/40 p-2.5 rounded-lg border border-rose-500/20 font-mono space-y-1.5 mt-2">
                  <p className="font-bold text-amber-400">Google OAuth Setup Checklist in Supabase &amp; GCP:</p>
                  <p className="text-slate-300">1. In Google Cloud Console &gt; Credentials, Authorized Redirect URI must be:</p>
                  <code className="text-amber-300 select-all block bg-black/60 p-1.5 rounded break-all">https://xfnxuttlegomafxyazqh.supabase.co/auth/v1/callback</code>
                  <p className="text-slate-300">2. Verify the Google Client Secret matches in Supabase Auth &gt; Providers &gt; Google.</p>
                  <p className="text-slate-300">3. In Google OAuth Consent Screen, set status to &quot;In Production&quot; or add your email under &quot;Test Users&quot;.</p>
                </div>
              )}
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            type="button"
            disabled={googleLoading || loading}
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-750 text-slate-200 text-xs font-mono font-medium transition active:scale-95 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          {/* Centered Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-center">
              <span className="bg-[#0c1018] px-3 text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                Or login with email
              </span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-mono text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold shadow-md shadow-amber-500/20 transition active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <>
                  <span>Sign In to TeamFlow</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-slate-800 text-center text-xs font-sans text-slate-400">
            Don't have an organization account?{' '}
            <Link to="/register" className="text-amber-400 hover:text-amber-300 font-medium font-mono">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
