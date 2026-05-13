import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserProfile, VerificationStatus } from '../../types';
import { CheckCircle2, AlertCircle, XCircle, Search, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

export const UserVerification: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<VerificationStatus | 'all'>('pending');

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  const fetchUsers = async () => {
    setLoading(true);
    let query = supabase.from('profiles').select('*').neq('role', 'admin'); // Don't show admins
    
    if (filter !== 'all') {
      query = query.eq('verification_status', filter);
    }
    
    const { data } = await query;
    if (data) setUsers(data as UserProfile[]);
    setLoading(false);
  };

  const getStatusBadge = (status: VerificationStatus) => {
    switch(status) {
      case 'verified': return <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold uppercase"><CheckCircle2 size={12}/> Account Verified</span>;
      case 'pending': return <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold uppercase"><AlertCircle size={12}/> Account Pending</span>;
      case 'rejected': return <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold uppercase"><XCircle size={12}/> Account Rejected</span>;
      default: return <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-xs font-bold uppercase">Account Unverified</span>;
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-charcoal">User Verification</h1>
          <p className="text-sm text-gray-500 mt-1">
            Profile verification approves the account. Document compliance is reviewed separately.
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'verified', 'rejected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-colors ${
                filter === f ? 'bg-brand-teal text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-bold text-gray-500 text-sm">User / Company</th>
              <th className="px-6 py-4 font-bold text-gray-500 text-sm">Role</th>
              <th className="px-6 py-4 font-bold text-gray-500 text-sm">Status</th>
              <th className="px-6 py-4 font-bold text-gray-500 text-sm">Joined</th>
              <th className="px-6 py-4 font-bold text-gray-500 text-sm">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading users...</td></tr>
            ) : users.length === 0 ? (
               <tr>
                 <td colSpan={5} className="p-16 text-center text-gray-500">
                   {filter === 'pending' ? (
                     <div className="flex flex-col items-center justify-center gap-2">
                        <p className="text-lg font-medium text-gray-600">No pending users to review.</p>
                        <p className="text-sm">Verified and rejected users are still available in the other tabs.</p>
                     </div>
                   ) : (
                     "No users found for this filter."
                   )}
                 </td>
               </tr>
            ) : (
              users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-bold text-brand-charcoal">{u.full_name || 'No Name'}</div>
                      <div className="text-xs text-gray-400">{u.company_name}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="capitalize bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(u.verification_status)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <Link 
                      to={`/admin/verification/${u.id}`}
                      className="inline-flex items-center gap-2 text-brand-teal font-bold text-sm hover:underline"
                    >
                      <Eye size={16} /> Review
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};