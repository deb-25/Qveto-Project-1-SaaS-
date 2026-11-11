import React from 'react';
import { Kanban } from 'lucide-react';

export interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showVersion?: boolean;
  className?: string;
  glow?: boolean;
}

/**
 * Universal BrandLogo component for TeamFlow.
 * Enforces visual consistency across the entire application:
 * - Amber gradient rounded tile (from-amber-500 via-amber-400 to-amber-300)
 * - Contrast dark Kanban icon with stroke-[2.5]
 * - Luminous amber shadow glow
 * - Optional monospace brand text and v2.0 pill badge
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = true,
  showVersion = false,
  className = '',
  glow = true,
}) => {
  const iconSizes = {
    xs: 'w-6 h-6 rounded-md',
    sm: 'w-7 h-7 rounded-lg',
    md: 'w-9 h-9 rounded-xl',
    lg: 'w-11 h-11 rounded-2xl',
    xl: 'w-14 h-14 rounded-2xl',
  };

  const kanbanSizes = {
    xs: 'w-3.5 h-3.5 stroke-[2.5]',
    sm: 'w-4 h-4 stroke-[2.5]',
    md: 'w-5 h-5 stroke-[2.5]',
    lg: 'w-6 h-6 stroke-[2.5]',
    xl: 'w-7 h-7 stroke-[2.5]',
  };

  const textSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Canonical Logo Tile */}
      <div
        className={`${iconSizes[size]} bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 flex items-center justify-center text-slate-950 shrink-0 ${
          glow ? 'shadow-lg shadow-amber-500/25' : ''
        }`}
      >
        <Kanban className={kanbanSizes[size]} />
      </div>

      {/* Optional Typography */}
      {showText && (
        <div className="flex items-baseline gap-2">
          <span className={`font-black tracking-tight text-white font-mono ${textSizes[size]}`}>
            TeamFlow
          </span>
          {showVersion && (
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
              v2.0
            </span>
          )}
        </div>
      )}
    </div>
  );
};
