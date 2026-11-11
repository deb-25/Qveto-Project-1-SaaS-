import React from 'react';
import { X, HelpCircle, CheckCircle2, Calculator, ShieldCheck, Clock, Layers, Scale } from 'lucide-react';

interface CalculationRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CalculationRulesModal: React.FC<CalculationRulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#0c1018] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Audit & KPI Calculation Rules</h2>
              <p className="text-xs text-slate-400">Official mathematical formulas from Document 1 §9</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Core Foundation Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Eligible Task Rule</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                <code className="text-cyan-300 bg-cyan-950/50 px-1 py-0.5 rounded">archived_at IS NULL</code> and <code className="text-cyan-300 bg-cyan-950/50 px-1 py-0.5 rounded">status != Cancelled</code>.
                Archived and cancelled tasks are excluded from all rate denominators.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs">
                <Clock className="w-4 h-4" />
                <span>Timezone & Now Rule</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                All timestamps are strictly evaluated in UTC. A task is overdue when <code className="text-purple-300 bg-purple-950/50 px-1 py-0.5 rounded">due_date &lt; now()</code> in UTC and status is not Done or Cancelled.
              </p>
            </div>
          </div>

          {/* Metric Formulas Table */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>KPI Formula Definitions</span>
            </h3>

            <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-2xl bg-slate-900/40 overflow-hidden">
              {/* Formula 1 */}
              <div className="p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">1. Task Completion Rate</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                    Done ÷ Eligible
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Calculates the percentage of eligible tasks in the active scope that are in <strong>Done</strong> status. If eligible tasks = 0, displays <em>"No data"</em> to prevent division by zero (Doc 1 §9).
                </p>
              </div>

              {/* Formula 2 */}
              <div className="p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">2. On-Time Completion Rate</span>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono">
                    On-Time Done ÷ Done With Due Date
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Evaluates completed tasks where <code className="text-cyan-300 bg-slate-800 px-1 py-0.5 rounded">completed_at &lt;= due_date</code> divided by completed tasks that had an assigned deadline. Tasks without due dates are omitted from this benchmark.
                </p>
              </div>

              {/* Formula 3 */}
              <div className="p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">3. Overdue Task Count</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-mono">
                    due_date &lt; now AND status != Done
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Count of active, non-archived tasks whose due date has passed. Also displays the percentage of total open workload that is currently overdue.
                </p>
              </div>

              {/* Formula 4 */}
              <div className="p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">4. Project Progress</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono">
                    Done Top-Level ÷ All Top-Level
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Measures macroscopic milestone delivery by evaluating top-level tasks (<code className="text-blue-300 bg-slate-800 px-1 py-0.5 rounded">parent_task_id IS NULL</code>). Subtasks roll up to their respective parents.
                </p>
              </div>

              {/* Formula 5 */}
              <div className="p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">5. Assignment Coverage</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono">
                    Assigned Active ÷ Total Active
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Calculates ownership coverage. Represents the proportion of active (non-Done) tasks that have an explicit project member assigned.
                </p>
              </div>

              {/* Formula 6 */}
              <div className="p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">6. Cognitive Workload Weighting</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono">
                    Σ(Task Count × Priority Weight)
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Active tasks are weighted according to operational complexity: 
                  <span className="text-rose-400 font-bold ml-1">Urgent = 4 pts</span>, 
                  <span className="text-amber-400 font-bold ml-1">High = 3 pts</span>, 
                  <span className="text-blue-400 font-bold ml-1">Medium = 2 pts</span>, and 
                  <span className="text-slate-400 font-bold ml-1">Low = 1 pt</span>.
                </p>
              </div>
            </div>
          </div>

          {/* Zero Denominator Note */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-300">
            <Scale className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-[11px]">
              <span className="font-bold">Zero Denominator Handling (Doc 1 §9):</span>
              <p className="text-amber-200/80">
                If any rate denominator is zero, the system displays <strong>"No data"</strong> instead of 0% or NaN to maintain mathematical truthfulness across small or newly initialized teams.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition"
          >
            Close Rules
          </button>
        </div>
      </div>
    </div>
  );
};
