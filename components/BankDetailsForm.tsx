
import React, { useState, useEffect } from 'react';
import { Building, User, CreditCard, Landmark, Globe, Save, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { getBankDetails, saveBankDetails, BankDetails, getBankStatus } from '../lib/bankDetailsService';

interface BankDetailsFormProps {
  providerId: string;
  providerType: 'driver' | 'guide' | 'fleet';
  onSave?: () => void;
}

export const BankDetailsForm: React.FC<BankDetailsFormProps> = ({ providerId, providerType, onSave }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [details, setDetails] = useState<BankDetails | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    account_type: 'Current',
    branch_code: '',
    country: 'South Africa',
    currency: 'ZAR'
  });

  useEffect(() => {
    loadBankDetails();
  }, [providerId]);

  const loadBankDetails = async () => {
    setLoading(true);
    try {
      const data = await getBankDetails(providerId);
      setDetails(data);
      if (data) {
        setFormData({
          account_holder_name: data.account_holder_name || '',
          bank_name: data.bank_name || '',
          account_number: data.account_number || '',
          account_type: data.account_type || 'Current',
          branch_code: data.branch_code || '',
          country: data.country || 'South Africa',
          currency: data.currency || 'ZAR'
        });
      }
    } catch (err) {
      console.error('Failed to load bank details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.account_holder_name || !formData.bank_name || !formData.account_number || !formData.branch_code) {
      setMessage({ type: 'error', text: 'All required fields must be filled.' });
      return;
    }

    if (formData.account_number.length < 6) {
      setMessage({ type: 'error', text: 'Account number seems too short.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await saveBankDetails({
        provider_id: providerId,
        provider_type: providerType,
        ...formData
      });
      
      setMessage({ type: 'success', text: 'Bank details saved successfully!' });
      await loadBankDetails();
      if (onSave) onSave();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save bank details.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-brand-teal" size={24} />
      </div>
    );
  }

  const status = getBankStatus(details);
  const statusColors = {
    'Missing': 'bg-red-100 text-red-700 border-red-200',
    'Incomplete': 'bg-amber-100 text-amber-700 border-amber-200',
    'Updated recently': 'bg-blue-100 text-blue-700 border-blue-200',
    'Complete': 'bg-green-100 text-green-700 border-green-200'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-brand-charcoal flex items-center gap-2">
          <Landmark size={20} className="text-brand-teal" />
          Bank Account Details
        </h3>
        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${statusColors[status as keyof typeof statusColors]}`}>
          {status}
        </span>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 flex items-center gap-1">
              <User size={12} /> Account Holder Name *
            </label>
            <input 
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none transition-all"
              value={formData.account_holder_name}
              onChange={e => setFormData({...formData, account_holder_name: e.target.value})}
              placeholder="Full legal name"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 flex items-center gap-1">
              <Building size={12} /> Bank Name *
            </label>
            <input 
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none transition-all"
              value={formData.bank_name}
              onChange={e => setFormData({...formData, bank_name: e.target.value})}
              placeholder="e.g. FNB, Standard Bank"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 flex items-center gap-1">
              <CreditCard size={12} /> Account Number *
            </label>
            <div className="relative">
              <input 
                type={showAccountNumber ? "text" : "password"}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none transition-all pr-10"
                value={formData.account_number}
                onChange={e => setFormData({...formData, account_number: e.target.value.replace(/\D/g, '')})}
                placeholder="Account number"
                required
              />
              <button 
                type="button"
                onClick={() => setShowAccountNumber(!showAccountNumber)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-teal transition-colors"
              >
                {showAccountNumber ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {!showAccountNumber && formData.account_number && (
              <p className="text-[10px] text-gray-400 mt-1">
                Currently: ****{formData.account_number.slice(-4)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 flex items-center gap-1">
              <Landmark size={12} /> Branch Code *
            </label>
            <input 
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none transition-all"
              value={formData.branch_code}
              onChange={e => setFormData({...formData, branch_code: e.target.value.replace(/\D/g, '')})}
              placeholder="6-digit code"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Account Type</label>
            <select 
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-teal outline-none transition-all"
              value={formData.account_type}
              onChange={e => setFormData({...formData, account_type: e.target.value})}
            >
              <option value="Current">Current / Cheque</option>
              <option value="Savings">Savings</option>
              <option value="Business">Business</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 flex items-center gap-1">
              <Globe size={12} /> Country
            </label>
            <input 
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 cursor-not-allowed"
              value={formData.country}
              disabled
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Currency</label>
            <input 
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 cursor-not-allowed"
              value={formData.currency}
              disabled
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button 
            type="submit"
            disabled={saving}
            className="bg-brand-teal text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-brand-teal/90 transition-all shadow-lg shadow-brand-teal/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Save Bank Details
          </button>
        </div>
      </form>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex gap-3">
          <AlertCircle className="text-amber-600 shrink-0" size={18} />
          <div>
            <h4 className="text-sm font-bold text-amber-800">Security Note</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              Your full account number is encrypted and never shown in full. 
              Changing bank details will reset your verification status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
