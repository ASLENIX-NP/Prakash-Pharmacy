import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  ShieldCheck,
  Info
} from 'lucide-react';
import { usePharmacy } from '../context/PharmacyContext';

interface RacksManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RacksManagerModal: React.FC<RacksManagerModalProps> = ({ isOpen, onClose }) => {
  const { racks, addRack, deduceRack, medicines, isAdmin } = usePharmacy();

  const [newRackName, setNewRackName] = useState('');
  const [newRackDescription, setNewRackDescription] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!newRackName.trim()) return;

    const res = addRack(newRackName, newRackDescription);
    if (res.success) {
      setFeedback({ type: 'success', text: res.message });
      setNewRackName('');
      setNewRackDescription('');
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  const handleDeduce = (rackId: string, rackName: string) => {
    const count = medicines.filter(m => m.rackLocation.toLowerCase() === rackName.toLowerCase()).length;
    const confirmMsg = count > 0
      ? `Rack "${rackName}" currently contains ${count} medicines. Removing this rack will reassign them to "General Shelf". Are you sure?`
      : `Are you sure you want to deduce/remove rack "${rackName}"?`;

    if (confirm(confirmMsg)) {
      const res = deduceRack(rackId);
      if (res.success) {
        setFeedback({ type: 'success', text: res.message });
      } else {
        setFeedback({ type: 'error', text: res.message });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 overflow-y-auto">
      <div 
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-500/20 text-teal-300 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Inventory Racks &amp; Shelves Manager</h3>
              <p className="text-xs text-slate-300">
                Admin tool: Add new storage racks or deduce unused shelves from inventory
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Admin notice */}
          {!isAdmin && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Only Admin users are authorized to add or deduce racks from the pharmacy inventory.</span>
            </div>
          )}

          {feedback && (
            <div className={`p-3 rounded-xl flex items-center gap-2 text-xs border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Add Rack Form (Admin only) */}
          {isAdmin && (
            <form onSubmit={handleAdd} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-teal-600" />
                <span>Add New Shelf / Rack to Inventory</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Rack Code / Name: *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rack D-1, Syrup Bay 2, Cold Bay"
                    value={newRackName}
                    onChange={(e) => setNewRackName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Shelf Description / Drug Category:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Topical Creams, Injections, Pediatric"
                    value={newRackDescription}
                    onChange={(e) => setNewRackDescription(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Rack to Inventory</span>
                </button>
              </div>
            </form>
          )}

          {/* Active Racks Table */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-800">
                Active Storage Racks &amp; Shelves ({racks.length})
              </span>
              <span className="text-slate-500">
                Total medicines assigned across racks: <strong>{medicines.length}</strong>
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Rack Name</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-center">Medicines on Shelf</th>
                    {isAdmin && <th className="py-2.5 px-3 text-right">Deduce Rack</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {racks.map(rack => {
                    const count = medicines.filter(m => m.rackLocation.toLowerCase() === rack.name.toLowerCase()).length;

                    return (
                      <tr key={rack.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-bold text-slate-900 font-mono">
                          {rack.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {rack.description || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          <span className={`px-2 py-0.5 rounded text-[11px] ${
                            count > 0 ? 'bg-teal-50 text-teal-800 font-bold' : 'text-slate-400'
                          }`}>
                            {count} item{count !== 1 ? 's' : ''}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeduce(rack.id, rack.name)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 ml-auto"
                              title="Deduce / Remove this rack from inventory"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Deduce</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {racks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No storage racks defined. Add a rack above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
