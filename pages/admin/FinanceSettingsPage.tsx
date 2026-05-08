
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, Save, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Building, User, CreditCard, Globe, ShieldCheck, ArrowRight, X } from 'lucide-react';
import { getPlatformBankDetails, savePlatformBankDetails, PlatformBankDetails, maskAccountNumber } from '../../lib/platformBankService';

export const FinanceSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isConfirmingSave, setIsConfirmingSave] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    account_type: 'Business',
    branch_code: '',
    country: 'South Africa',
    currency: 'ZAR',
    is_primary: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getPlatformBankDetails();
      if (data) {
        setFormData({
          account_holder_name: data.account_holder_name || '',
          bank_name: data.bank_name || '',
          account_number: data.account_number || '',
          account_type: data.account_type || 'Business',
          branch_code: data.branch_code || '',
          country: data.country || 'South Africa',
          currency: data.currency || 'ZAR',
          is_primary: data.is_primary ?? true
        });
      }
    } catch (err) {
      console.error('Failed to load platform bank details', err);
      setMessage({ type: 'error', text: 'Failed to load finance settings.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.account_holder_name || !formData.bank_name || !formData.account_number || !formData.branch_code) {
      setMessage({ type: 'error', text: 'All required fields must be filled.' });
      return;
    }

    setIsConfirmingSave(true);
  };

  const handleConfirmSave = async () => {
    setIsConfirmingSave(false);
    setSaving(true);
    setMessage(null);

    try {
      await savePlatformBankDetails(formData);
      setMessage({ type: 'success', text: 'Platform bank details updated successfully!' });
      setShowAccountNumber(false);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save bank details.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-brand-teal" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-brand-charcoal flex items-center gap-3">
          <Landmark className="text-brand-teal" size={32} />
          Finance Settings
        </h1>
        <p className="text-gray-500 mt-1">Manage platform-level bank accounts for TourFlow operations.</p>
      </div>

      <div className="mb-8 p-4 bg-brand-charcoal/5 border border-brand-charcoal/10 rounded-2xl flex items-start gap-3">
        <AlertCircle className="text-brand-charcoal mt-0.5" size={18} />
        <p className="text-sm text-brand-charcoal font-medium">
          These platform bank details are used for TourFlow finance operations. Review changes carefully before saving.
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold">{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-brand-charcoal">Platform bank account</h2>
            <p className="text-sm text-gray-500">
              This account is used as the platform finance account for settlements and operational finance tracking. Keep these details accurate and up to date.
            </p>
          </div>

          <form onSubmit={handlePreSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
                <ShieldCheck className="text-brand-teal" size={20} />
                <h3 className="font-bold text-brand-charcoal">Primary Disbursement Account</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                    <User size={14} /> Account Holder Name *
                  </label>
                  <input 
                    type="text"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                    value={formData.account_holder_name}
                    onChange={e => setFormData({...formData, account_holder_name: e.target.value})}
                    placeholder="e.g. TourFlow (Pty) Ltd"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                    <Building size={14} /> Bank Name *
                  </label>
                  <input 
                    type="text"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                    value={formData.bank_name}
                    onChange={e => setFormData({...formData, bank_name: e.target.value})}
                    placeholder="e.g. FNB, Standard Bank"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                    <CreditCard size={14} /> Account Number *
                  </label>
                  <div className="relative">
                    <input 
                      type={showAccountNumber ? "text" : "password"}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all pr-12"
                      value={formData.account_number}
                      onChange={e => setFormData({...formData, account_number: e.target.value.replace(/\D/g, '')})}
                      placeholder="Account number"
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => setShowAccountNumber(!showAccountNumber)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-teal transition-colors"
                    >
                      {showAccountNumber ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {!showAccountNumber && formData.account_number && (
                    <p className="text-[10px] text-gray-400 mt-1.5 font-mono">
                      Current: {maskAccountNumber(formData.account_number)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                    <Landmark size={14} /> Branch Code *
                  </label>
                  <input 
                    type="text"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                    value={formData.branch_code}
                    onChange={e => setFormData({...formData, branch_code: e.target.value.replace(/\D/g, '')})}
                    placeholder="6-digit code"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Account Type</label>
                  <select 
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                    value={formData.account_type}
                    onChange={e => setFormData({...formData, account_type: e.target.value})}
                  >
                    <option value="Business">Business</option>
                    <option value="Current">Current / Cheque</option>
                    <option value="Savings">Savings</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                    <Globe size={14} /> Country
                  </label>
                  <input 
                    type="text"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 bg-gray-50 cursor-not-allowed"
                    value={formData.country}
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Currency</label>
                  <input 
                    type="text"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 bg-gray-50 cursor-not-allowed"
                    value={formData.currency}
                    disabled
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                type="submit"
                disabled={saving}
                className="bg-brand-charcoal text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-lg shadow-brand-charcoal/20 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Update Finance Details
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-brand-teal/5 border border-brand-teal/20 rounded-2xl p-6">
            <h4 className="font-bold text-brand-charcoal mb-2 flex items-center gap-2">
              <ShieldCheck size={18} className="text-brand-teal" />
              Security Policy
            </h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              These bank details are used for platform-level disbursements and reconciliation. 
              Only authorized administrators can view or modify this information.
            </p>
            <div className="mt-4 pt-4 border-t border-brand-teal/10">
              <p className="text-[10px] text-gray-500 uppercase font-bold">Audit Trail</p>
              <p className="text-xs text-gray-500 mt-1">
                All changes are logged in the system audit trail with the actor ID and timestamp.
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h4 className="font-bold text-brand-charcoal mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-brand-teal" />
              Platform Fees
            </h4>
            <p className="text-sm text-gray-500 mb-4">
              Platform-wide commission rates and additional fee structures are managed separately.
            </p>
            <Link 
              to="/admin/fees" 
              className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl group transition-all"
            >
              <span className="text-sm font-bold text-brand-charcoal">Manage platform fees</span>
              <ArrowRight size={18} className="text-gray-400 group-hover:text-brand-teal transition-all group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-600" />
              Important
            </h4>
            <p className="text-sm text-amber-700 leading-relaxed">
              Ensure these details match your official business bank account. 
              Incorrect details may lead to failed payouts or reconciliation mismatches.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isConfirmingSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-charcoal/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <AlertCircle className="text-amber-600" size={32} />
              </div>
              
              <h3 className="text-2xl font-bold text-brand-charcoal text-center mb-3">
                Confirm bank detail update
              </h3>
              
              <p className="text-gray-500 text-center leading-relaxed">
                You are about to update the platform bank account details used for finance operations. Confirm that these details have been checked before saving.
              </p>
            </div>
            
            <div className="p-6 bg-gray-50 flex flex-col gap-3">
              <button 
                onClick={handleConfirmSave}
                className="w-full bg-brand-charcoal text-white py-4 rounded-2xl font-bold hover:bg-black transition-all"
              >
                Confirm update
              </button>
              <button 
                onClick={() => setIsConfirmingSave(false)}
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
