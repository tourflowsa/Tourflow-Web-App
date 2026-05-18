import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CalendarDays, Plus, Trash2, Loader2, AlertTriangle, Info } from 'lucide-react';
import { 
  ProviderAvailabilityBlock, 
  listPersonalAvailabilityBlocks, 
  createPersonalAvailabilityBlock, 
  deletePersonalAvailabilityBlock 
} from '../../lib/availabilityService';
import { formatDate } from '../../lib/formatUtils';

export const PersonalAvailabilityManager: React.FC = () => {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<ProviderAvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user) loadBlocks();
  }, [user]);

  const loadBlocks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await listPersonalAvailabilityBlocks(user.id);
      setBlocks(data);
    } catch (err: any) {
      console.error('Failed to load blocks', err);
      setError('Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!user || !newStartDate || !newEndDate) return;
    if (newStartDate > newEndDate) {
      setError('Start date must be before end date.');
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      await createPersonalAvailabilityBlock(user.id, newStartDate, newEndDate);
      setIsAdding(false);
      setNewStartDate('');
      setNewEndDate('');
      await loadBlocks();
    } catch (err: any) {
      setError(err.message || 'Failed to add block');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePersonalAvailabilityBlock(id);
      await loadBlocks();
    } catch (err: any) {
      setError(err.message || 'Failed to remove block');
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center min-h-[200px]">
        <Loader2 className="animate-spin text-brand-teal w-6 h-6" />
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const activeBlocks = blocks.filter(b => b.date_end >= today);

  const currentlyBlocked = activeBlocks.some(b => b.date_start <= today && b.date_end >= today);
  const nextBlock = activeBlocks.find(b => b.date_start > today);

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-brand-teal" />
            My Availability
          </h2>
          <p className="text-sm text-gray-500">Manage dates when you are unavailable.</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="text-sm font-bold bg-brand-teal text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-teal-700 transition-colors"
          >
            <Plus size={16} /> Add Block
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm font-bold flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {isAdding && (
        <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Add Unavailable Dates</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={newStartDate}
                min={today}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={newEndDate}
                min={newStartDate || today}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-900"
              disabled={processing}
            >
              Cancel
            </button>
            <button 
              onClick={handleAdd}
              disabled={processing || !newStartDate || !newEndDate}
              className="px-4 py-2 text-sm font-bold bg-brand-charcoal text-white rounded-lg disabled:opacity-50"
            >
              {processing ? 'Saving...' : 'Save Block'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {currentlyBlocked && (
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center gap-3">
            <Info className="text-amber-500 shrink-0" size={20} />
            <div>
              <p className="text-sm font-bold text-amber-800">You are marked as unavailable today.</p>
            </div>
          </div>
        )}

        {activeBlocks.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No upcoming unavailable blocks.</p>
        ) : (
          <div className="space-y-2">
            {activeBlocks.map(block => (
              <div key={block.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {formatDate(block.date_start)} — {formatDate(block.date_end)}
                  </p>
                  {block.reason && <p className="text-xs text-gray-500 mt-0.5">{block.reason}</p>}
                </div>
                <button
                  onClick={() => handleDelete(block.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors bg-white rounded-lg border border-gray-200 hover:border-red-200"
                  aria-label="Remove block"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
