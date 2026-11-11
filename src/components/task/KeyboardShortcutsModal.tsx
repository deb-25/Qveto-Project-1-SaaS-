import React from 'react';
import { X, Command, Keyboard, Lightbulb, Zap } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'C / N', desc: 'Quickly open Create Task modal', category: 'Actions' },
    { key: '1', desc: 'Switch to Kanban Board View', category: 'Views' },
    { key: '2', desc: 'Switch to Structured Task List / Table View', category: 'Views' },
    { key: '/', desc: 'Focus task search & filter bar', category: 'Navigation' },
    { key: 'L', desc: 'Open Labels & Tags Manager modal', category: 'Actions' },
    { key: 'P', desc: 'Jump to Project Overview & Milestones', category: 'Navigation' },
    { key: '?', desc: 'Toggle this Keyboard Shortcuts guide', category: 'Help' },
    { key: 'Esc', desc: 'Close any active modal or reset focus', category: 'Navigation' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans animate-in fade-in duration-150">
      <div className="bg-[#0c1018] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 font-mono">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Keyboard Shortcuts & Pro Tips
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Accelerate sprint management with instantaneous hotkeys
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="space-y-2">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition"
            >
              <span className="text-xs text-slate-300 font-sans">{s.desc}</span>
              <kbd className="px-2.5 py-1 text-xs font-mono font-bold text-amber-400 bg-slate-950 border border-slate-700 rounded-lg shadow-inner">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Pro Tips Banner */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 text-xs font-sans text-slate-300 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-400 font-mono text-[11px] uppercase">
            <Zap className="w-3.5 h-3.5" />
            <span>Workflow Intelligence (Section 10)</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Status moves between Backlog, To Do, In Progress, In Review, and Done follow strict sprint rules. Parent tasks cannot be completed while subtasks remain unresolved.
          </p>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition"
          >
            Got it (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
