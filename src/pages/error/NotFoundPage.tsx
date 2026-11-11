import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home, Kanban } from 'lucide-react';
import { BrandLogo } from '../../components/common/BrandLogo';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="mb-6">
        <Link to="/">
          <BrandLogo size="md" showText={true} showVersion={false} glow={true} />
        </Link>
      </div>

      <div className="max-w-md w-full p-8 rounded-3xl bg-[#0c1018] border border-slate-800 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
          <Compass className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest font-mono">
            404 · Page Not Found
          </span>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Destination Beyond Reach
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            The workspace view, project resource, or URL you requested does not exist or may have been archived.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/my-work"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-lg shadow-cyan-900/30"
          >
            <Home className="w-4 h-4" />
            <span>My Work</span>
          </Link>

          <Link
            to="/board"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 text-xs font-semibold transition"
          >
            <Kanban className="w-4 h-4 text-amber-400" />
            <span>Sprint Board</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
