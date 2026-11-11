import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Home, Building2 } from 'lucide-react';
import { useOrg } from '../../context/OrgContext';
import { BrandLogo } from '../../components/common/BrandLogo';

export const UnauthorizedPage: React.FC = () => {
  const { currentOrg, currentRole } = useOrg();

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="mb-6">
        <Link to="/">
          <BrandLogo size="md" showText={true} showVersion={false} glow={true} />
        </Link>
      </div>

      <div className="max-w-md w-full p-8 rounded-3xl bg-[#0c1018] border border-rose-500/30 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold text-rose-400 uppercase tracking-widest font-mono">
            403 · Access Forbidden
          </span>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Tenant Boundary Protected
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your role (<strong className="text-white capitalize">{currentRole || 'guest'}</strong>) or organization membership does not permit accessing this resource. Under Document 1 §8 rules, resources across organizations or restricted projects are strictly inaccessible.
          </p>
        </div>

        {currentOrg && (
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 font-mono">
            Active Tenant: <span className="text-cyan-400 font-bold">{currentOrg.name}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/my-work"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-lg shadow-cyan-900/30"
          >
            <Home className="w-4 h-4" />
            <span>My Work Stream</span>
          </Link>

          <Link
            to="/workspaces"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 text-xs font-semibold transition"
          >
            <Building2 className="w-4 h-4 text-purple-400" />
            <span>Workspaces</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
