import React, { useState, useEffect } from 'react';
import { X, Tag, Plus, Trash2, Check, Loader2, Sparkles, Edit2 } from 'lucide-react';
import { supabase } from '../../api/supabaseClient';
import { useOrg } from '../../context/OrgContext';
import { Label, Project } from '../../types';

interface LabelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject?: Project | null;
  onLabelsChanged?: () => void;
}

const PRESET_COLORS = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Slate', hex: '#64748b' },
];

export const LabelManagerModal: React.FC<LabelManagerModalProps> = ({
  isOpen,
  onClose,
  activeProject,
  onLabelsChanged,
}) => {
  const { currentOrg, currentRole } = useOrg();
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);

  // New Label Form
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].hex);
  const [isProjectScoped, setIsProjectScoped] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editing Label state
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const fetchLabels = async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      let query = (supabase.from('labels') as any)
        .select('*')
        .eq('org_id', currentOrg.id);

      if (activeProject) {
        query = query.or(`project_id.is.null,project_id.eq.${activeProject.id}`);
      }

      const { data, error } = await query.order('name', { ascending: true });
      if (!error && data) {
        setLabels(data);
      }
    } catch (err) {
      console.error('Error fetching labels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentOrg) {
      fetchLabels();
      setName('');
      setErrorMsg(null);
    }
  }, [isOpen, currentOrg, activeProject]);

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currentOrg) return;

    // Check duplicate
    if (labels.some((l) => l.name.toLowerCase() === name.trim().toLowerCase())) {
      setErrorMsg(`Label "${name.trim()}" already exists.`);
      return;
    }

    setCreating(true);
    setErrorMsg(null);
    try {
      const payload = {
        org_id: currentOrg.id,
        project_id: isProjectScoped && activeProject ? activeProject.id : null,
        name: name.trim(),
        color: selectedColor,
      };

      const { data, error } = await (supabase.from('labels') as any)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setLabels((prev) => [...prev, data]);
        setName('');
        onLabelsChanged?.();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create label.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    try {
      const { error } = await (supabase.from('labels') as any)
        .delete()
        .eq('id', labelId);

      if (!error) {
        setLabels((prev) => prev.filter((l) => l.id !== labelId));
        onLabelsChanged?.();
      }
    } catch (err) {
      console.error('Failed to delete label:', err);
    }
  };

  const handleSaveEdit = async (labelId: string) => {
    if (!editName.trim()) return;
    try {
      const { error } = await (supabase.from('labels') as any)
        .update({
          name: editName.trim(),
          color: editColor,
        })
        .eq('id', labelId);

      if (!error) {
        setLabels((prev) =>
          prev.map((l) => (l.id === labelId ? { ...l, name: editName.trim(), color: editColor } : l))
        );
        setEditingLabelId(null);
        onLabelsChanged?.();
      }
    } catch (err) {
      console.error('Failed to update label:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans animate-in fade-in duration-150">
      <div className="bg-[#0c1018] border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Tag className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Organization & Project Labels
              </h3>
              <p className="text-xs text-slate-400">
                Categorize and filter tasks across your sprint pipeline
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

        {/* New Label Creator */}
        {currentRole !== 'employee' && (
          <form
            onSubmit={handleCreateLabel}
            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Create New Label
              </span>
              {activeProject && (
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={isProjectScoped}
                    onChange={(e) => setIsProjectScoped(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
                  />
                  <span>Scope to {activeProject.key} only</span>
                </label>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Label name (e.g. Bug, Frontend, Backend, UI/UX)..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400 font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition disabled:opacity-50 shrink-0 font-mono shadow-md shadow-amber-500/20"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Add Label</span>
              </button>
            </div>

            {/* Color Swatches */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 font-mono">
                Badge Color:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setSelectedColor(c.hex)}
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 relative"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {selectedColor === c.hex && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                ))}
                {/* Live Preview Pill */}
                <div
                  className="ml-auto px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 font-mono"
                  style={{
                    backgroundColor: `${selectedColor}18`,
                    color: selectedColor,
                    borderColor: `${selectedColor}40`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: selectedColor }}
                  />
                  <span>{name.trim() || 'Preview Badge'}</span>
                </div>
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-400 font-mono mt-1">{errorMsg}</p>
            )}
          </form>
        )}

        {/* Existing Labels List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800/80 pb-2">
            <span>AVAILABLE LABELS ({labels.length})</span>
            <span>SCOPE & ACTIONS</span>
          </div>

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-xs text-slate-500 font-mono gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>Loading labels...</span>
            </div>
          ) : labels.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 font-mono">
              No labels defined yet. Add standard labels like "Bug", "Feature", or "Security" above.
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {labels.map((lbl) => (
                <div
                  key={lbl.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition"
                >
                  {editingLabelId === lbl.id ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-white font-mono w-36"
                      />
                      <div className="flex items-center gap-1">
                        {PRESET_COLORS.slice(0, 6).map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setEditColor(c.hex)}
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => handleSaveEdit(lbl.id)}
                        className="px-2 py-1 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-mono hover:bg-emerald-500/30"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingLabelId(null)}
                        className="px-2 py-1 text-[10px] text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <div
                        className="px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 font-mono shadow-sm"
                        style={{
                          backgroundColor: `${lbl.color}15`,
                          color: lbl.color,
                          borderColor: `${lbl.color}35`,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: lbl.color }}
                        />
                        <span>{lbl.name}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {lbl.project_id ? 'Project Scoped' : 'Org-Wide'}
                    </span>

                    {currentRole !== 'employee' && editingLabelId !== lbl.id && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingLabelId(lbl.id);
                            setEditName(lbl.name);
                            setEditColor(lbl.color);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-slate-300 transition"
                          title="Edit label"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLabel(lbl.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                          title="Delete label"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
