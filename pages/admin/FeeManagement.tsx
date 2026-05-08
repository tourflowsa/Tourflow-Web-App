
import React, { useEffect, useState } from 'react';
import { UserProfile } from '../../types';
import { 
  AdminFeeTier, 
  searchOperators, 
  getActiveFeeTiers, 
  getAllFeeTiers,
  getOperatorAssignment, 
  assignOperatorTier,
  upsertFeeTier
} from '../../lib/adminFeeService';
import { supabase } from '../../lib/supabase';
import { Percent, Save, User, Search, Loader2, CheckCircle2, AlertCircle, Edit2, X, Plus } from 'lucide-react';

export const FeeManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tiers' | 'assignments'>('tiers');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-brand-charcoal flex items-center gap-3">
          <Percent className="text-brand-teal" size={32} />
          Platform Fees
        </h1>
        <p className="text-gray-500 mt-1">Manage fee tiers and operator assignments.</p>
      </div>

      <div className="mb-8 space-y-4">
        <div className="p-4 bg-brand-charcoal/5 border border-brand-charcoal/10 rounded-2xl flex items-start gap-3">
          <AlertCircle className="text-brand-charcoal mt-0.5" size={18} />
          <p className="text-sm text-brand-charcoal font-medium">
            Fee tiers define the platform fee used for operator bookings. Review changes carefully before saving.
          </p>
        </div>
        
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
          <AlertCircle className="text-amber-600 mt-0.5" size={18} />
          <p className="text-sm text-amber-800 font-medium">
            Fee changes may affect new bookings or future recalculations. Existing finalized bookings should be reviewed before making changes.
          </p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 mb-6">
        <button 
          onClick={() => setActiveTab('tiers')}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'tiers' ? 'border-brand-teal text-brand-teal' : 'border-transparent text-gray-500 hover:text-brand-charcoal'}`}
        >
          Fee Tiers
        </button>
        <button 
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'assignments' ? 'border-brand-teal text-brand-teal' : 'border-transparent text-gray-500 hover:text-brand-charcoal'}`}
        >
          Operator Assignments
        </button>
      </div>

      {activeTab === 'tiers' ? <TiersTab /> : <AssignmentsTab />}
    </div>
  );
};

// --- Tiers Tab ---
const TiersTab: React.FC = () => {
  const [tiers, setTiers] = useState<AdminFeeTier[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit State
  const [editingTier, setEditingTier] = useState<Partial<AdminFeeTier> | null>(null);
  const [isConfirmingTierSave, setIsConfirmingTierSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadTiers();
  }, []);

  const loadTiers = async () => {
    setLoading(true);
    try {
      const data = await getAllFeeTiers();
      setTiers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (tier: AdminFeeTier) => {
    setEditingTier(tier);
  };

  const startCreate = () => {
    setEditingTier({
      tier_code: '',
      fee_percent: 15,
      is_active: true
    });
  };

  const handlePreSave = () => {
    if (!editingTier) return;
    if (!editingTier.tier_code || !editingTier.fee_percent) {
      setMessage({ type: 'error', text: "Please fill in all fields" });
      return;
    }
    setIsConfirmingTierSave(true);
  };

  const handleSave = async () => {
    if (!editingTier) return;
    setIsConfirmingTierSave(false);
    setSaving(true);
    setMessage(null);
    try {
      await upsertFeeTier(editingTier);
      await loadTiers();
      setEditingTier(null);
      setMessage({ type: 'success', text: "Fee tier saved successfully" });
    } catch (e: any) {
      setMessage({ type: 'error', text: "Save failed: " + e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading tiers...</div>;

  return (
    <>
      {message && (
        <div className={`mb-4 p-4 rounded-xl flex items-center gap-2 border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-bold text-brand-charcoal">{message.text}</span>
        </div>
      )}
      <div className="flex justify-end mb-4">
        <button 
          onClick={startCreate}
          className="bg-brand-teal text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-teal/90 text-sm"
        >
          <Plus size={16} /> New Tier
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase">Tier Code / Name</th>
              <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase">Fee Percent</th>
              <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase">Status</th>
              <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tiers.map(tier => (
              <tr key={tier.id}>
                <td className="px-6 py-4 font-bold text-brand-charcoal capitalize flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${
                    tier.tier_code.toLowerCase().includes('gold') ? 'bg-yellow-400' :
                    tier.tier_code.toLowerCase().includes('silver') ? 'bg-gray-300' : 
                    tier.tier_code.toLowerCase().includes('bronze') ? 'bg-orange-400' : 'bg-brand-teal'
                  }`}></span>
                  {tier.tier_code}
                </td>
                <td className="px-6 py-4 font-mono">
                  {tier.fee_percent}%
                </td>
                <td className="px-6 py-4">
                   <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${tier.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                     {tier.is_active ? 'Active' : 'Inactive'}
                   </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => startEdit(tier)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-teal hover:bg-brand-teal/10 px-2 py-1 rounded transition-colors"
                  >
                    <Edit2 size={12} /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit/Create Modal */}
      {editingTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-brand-charcoal">{editingTier.id ? 'Edit Tier' : 'New Fee Tier'}</h3>
              <button onClick={() => setEditingTier(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tier Code / Name</label>
                <input 
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-3"
                  value={editingTier.tier_code}
                  onChange={e => setEditingTier({...editingTier, tier_code: e.target.value})}
                  placeholder="e.g. Gold"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fee Percentage (%)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0.01" 
                  max="100"
                  className="w-full border border-gray-300 rounded-lg p-3 font-mono"
                  value={editingTier.fee_percent}
                  onChange={e => setEditingTier({...editingTier, fee_percent: parseFloat(e.target.value)})}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    className="w-5 h-5 text-brand-teal rounded"
                    checked={editingTier.is_active}
                    onChange={e => setEditingTier({...editingTier, is_active: e.target.checked})}
                  />
                  <span className="text-sm font-bold text-gray-700">Active Status</span>
                </label>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => setEditingTier(null)}
                disabled={saving}
                className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handlePreSave}
                disabled={saving}
                className="px-6 py-2 bg-brand-teal text-white font-bold rounded-lg hover:bg-brand-teal/90 transition-colors flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Tier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmingTierSave && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-charcoal/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <AlertCircle className="text-amber-600" size={32} />
              </div>
              
              <h3 className="text-2xl font-bold text-brand-charcoal text-center mb-3">
                Confirm fee tier update
              </h3>
              
              <p className="text-gray-500 text-center leading-relaxed">
                You are about to update a platform fee tier. Confirm that the rate and effective settings have been reviewed before saving.
              </p>
            </div>
            
            <div className="p-6 bg-gray-50 flex flex-col gap-3">
              <button 
                onClick={handleSave}
                className="w-full bg-brand-charcoal text-white py-4 rounded-2xl font-bold hover:bg-black transition-all"
              >
                Confirm update
              </button>
              <button 
                onClick={() => setIsConfirmingTierSave(false)}
                className="w-full bg-white text-gray-500 border border-gray-200 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all"
              >
                Review details
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// --- Assignments Tab ---
const AssignmentsTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [foundOperators, setFoundOperators] = useState<UserProfile[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<UserProfile | null>(null);
  
  const [activeTiers, setActiveTiers] = useState<AdminFeeTier[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [isConfirmingAssignmentSave, setIsConfirmingAssignmentSave] = useState(false);
  const [currentAssignmentId, setCurrentAssignmentId] = useState<string | null>(null);
  
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load active tiers on mount
  useEffect(() => {
    getActiveFeeTiers().then(setActiveTiers).catch(console.error);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    
    setLoadingSearch(true);
    setSelectedOperator(null);
    setFoundOperators([]);
    setToastMessage(null);
    
    try {
      const results = await searchOperators(searchTerm);
      if (results.length === 0) {
        setToastMessage('No operators found matching your search.');
      }
      setFoundOperators(results);
    } catch (err) {
      console.error(err);
      setToastMessage('Search failed. Please try again.');
    } finally {
      setLoadingSearch(false);
    }
  };

  const selectOperator = async (op: UserProfile) => {
    setSelectedOperator(op);
    setFoundOperators([]); // Clear results
    setSearchTerm(op.email);
    setToastMessage(null);
    
    // Fetch current assignment
    try {
      const assignment = await getOperatorAssignment(op.id);
      if (assignment) {
        setCurrentAssignmentId(assignment.fee_tier_id);
        setSelectedTierId(assignment.fee_tier_id);
      } else {
        setCurrentAssignmentId(null);
        setSelectedTierId(null);
      }
    } catch (e) {
      console.error("Failed to load assignment", e);
    }
  };

  const handlePreSaveAssignment = () => {
    if (!selectedOperator || !selectedTierId) return;
    setIsConfirmingAssignmentSave(true);
  };

  const handleSaveAssignment = async () => {
    if (!selectedOperator || !selectedTierId) return;
    setIsConfirmingAssignmentSave(false);
    setSaving(true);
    try {
      await assignOperatorTier(selectedOperator.id, selectedTierId);
      
      // Update UI state
      setCurrentAssignmentId(selectedTierId);
      
      // Show Toast
      setToastMessage("Assignment updated successfully");
      setTimeout(() => setToastMessage(null), 3000);
      
    } catch (e: any) {
      setToastMessage("Assignment failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      {/* Search Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="font-bold text-gray-700 mb-4">Find Operator</h3>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input 
            type="text" 
            placeholder="Search by email..." 
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-teal outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <button type="submit" disabled={loadingSearch} className="bg-brand-teal text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
            {loadingSearch ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            Search
          </button>
        </form>

        {/* Results */}
        {foundOperators.length > 0 && (
          <div className="mt-4 border border-gray-100 rounded-lg divide-y divide-gray-100">
            {foundOperators.map(op => (
              <button 
                key={op.id} 
                onClick={() => selectOperator(op)}
                className="w-full text-left p-3 hover:bg-gray-50 flex justify-between items-center transition-colors"
              >
                <div>
                  <div className="font-bold text-brand-charcoal">{op.full_name || 'No Name'}</div>
                  <div className="text-sm text-gray-500">{op.email}</div>
                </div>
                <div className="text-brand-teal text-sm font-bold">Select</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Operator & Assignment Interface */}
      {selectedOperator && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-in fade-in slide-in-from-bottom-2">
           <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
             <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
               <User size={24} />
             </div>
             <div>
               <h3 className="font-bold text-lg text-brand-charcoal">{selectedOperator.full_name || 'Unnamed Operator'}</h3>
               <p className="text-gray-500">{selectedOperator.company_name}</p>
               <p className="text-sm text-gray-400">{selectedOperator.email}</p>
             </div>
           </div>

           {toastMessage && (
             <div className="mb-6 p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2 text-sm font-bold animate-in fade-in slide-in-from-top-1">
               <CheckCircle2 size={18} /> {toastMessage}
             </div>
           )}

           <div>
             <div className="flex justify-between items-center mb-4">
               <label className="text-sm font-bold text-gray-700">Select Fee Tier</label>
               {currentAssignmentId === null && (
                 <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded flex items-center gap-1 font-bold">
                   <AlertCircle size={12} /> Using Default
                 </span>
               )}
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
               {activeTiers.map(tier => {
                 const isSelected = selectedTierId === tier.id;
                 const isCurrent = currentAssignmentId === tier.id;
                 
                 return (
                   <button
                     key={tier.id}
                     onClick={() => setSelectedTierId(tier.id)}
                     className={`p-4 rounded-2xl border-2 text-left transition-all relative ${
                       isSelected 
                         ? 'border-brand-teal bg-brand-teal/5 ring-1 ring-brand-teal' 
                         : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                     }`}
                   >
                     {isCurrent && (
                       <div className="absolute -top-2 -right-2 bg-brand-charcoal text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shadow-sm">
                         Current
                       </div>
                     )}
                     <div className="flex justify-between items-center mb-1">
                       <span className="font-bold capitalize text-brand-charcoal">{tier.tier_code}</span>
                       {isSelected && <CheckCircle2 size={18} className="text-brand-teal" />}
                     </div>
                     <div className="text-2xl font-mono text-brand-charcoal font-bold">
                       {tier.fee_percent}%
                     </div>
                   </button>
                 );
               })}
             </div>

             <div className="flex justify-end">
               <button 
                 onClick={handlePreSaveAssignment}
                 disabled={saving || !selectedTierId || selectedTierId === currentAssignmentId}
                 className="bg-brand-teal text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                 Save Assignment
               </button>
             </div>
           </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmingAssignmentSave && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-charcoal/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <AlertCircle className="text-amber-600" size={32} />
              </div>
              
              <h3 className="text-2xl font-bold text-brand-charcoal text-center mb-3">
                Confirm operator fee assignment
              </h3>
              
              <p className="text-gray-500 text-center leading-relaxed">
                You are about to change the fee tier assigned to this operator. Future booking calculations may use the new assignment.
              </p>
            </div>
            
            <div className="p-6 bg-gray-50 flex flex-col gap-3">
              <button 
                onClick={handleSaveAssignment}
                className="w-full bg-brand-charcoal text-white py-4 rounded-2xl font-bold hover:bg-black transition-all"
              >
                Confirm assignment
              </button>
              <button 
                onClick={() => setIsConfirmingAssignmentSave(false)}
                className="w-full bg-white text-gray-500 border border-gray-200 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all"
              >
                Review details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
