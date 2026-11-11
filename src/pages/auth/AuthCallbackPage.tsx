import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';
import { BrandLogo } from '../../components/common/BrandLogo';
import { Loader2, AlertCircle } from 'lucide-react';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // 1. Check for error parameters in URL (query string or hash)
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.startsWith('#') ? location.hash.substring(1) : location.hash);

    const error = searchParams.get('error') || hashParams.get('error');
    const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');

    if (error || errorDescription) {
      setErrorMsg(errorDescription || error || 'Authentication failed');
      const timer = setTimeout(() => {
        if (isMounted) {
          navigate('/login', { replace: true, state: { error: errorDescription || error } });
        }
      }, 3500);
      return () => clearTimeout(timer);
    }

    // 2. Process session
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        if (session && isMounted) {
          navigate('/dashboard', { replace: true });
          return;
        }
      } catch (err: any) {
        console.error('Auth callback getSession error:', err);
      }
    };

    checkSession();

    // 3. Listen for SIGNED_IN event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && isMounted) {
        navigate('/dashboard', { replace: true });
      }
    });

    // 4. Safety fallback timer (in case redirect takes a few seconds to exchange PKCE)
    const fallbackTimer = setTimeout(() => {
      if (isMounted) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            navigate('/dashboard', { replace: true });
          } else {
            navigate('/login', { replace: true });
          }
        });
      }
    }, 4500);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, [navigate, location]);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center font-mono selection:bg-amber-500 selection:text-black px-4">
      <div className="bg-[#0c1018] border border-slate-800 rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
        <BrandLogo size="md" showText={true} glow={true} className="justify-center mx-auto" />
        
        {errorMsg ? (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 pt-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            <p className="text-xs text-slate-300 font-sans font-medium">Completing secure authentication...</p>
            <p className="text-[11px] text-slate-500 font-mono">Redirecting to your TeamFlow workspace</p>
          </div>
        )}
      </div>
    </div>
  );
};
