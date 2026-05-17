import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Mail, Shield, Calendar, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AdminUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  full_name?: string;
  company_name?: string;
  verification_status?: string;
}

export const AdminUserDirectory: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setUsers((data as AdminUser[]) || []);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      setError(err?.message || 'Failed to load user directory.');
    } finally {
      setLoading(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredUsers = users.filter(user => {
    const roleLabel = user.role.replace('_', ' ').toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      user.email.toLowerCase().includes(searchLower) ||
      user.full_name?.toLowerCase().includes(searchLower) ||
      user.company_name?.toLowerCase().includes(searchLower) ||
      user.role.toLowerCase().includes(searchLower) ||
      roleLabel.includes(searchLower);
      
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.verification_status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-charcoal">User Directory</h1>
        <p className="text-gray-500 mt-1">Browse and review all platform users.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text"
                placeholder="Search by name, company, email, role..."
                value={searchTerm}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-teal focus:border-transparent outline-none"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="operator">Operator</option>
              <option value="driver">Driver</option>
              <option value="guide">Guide</option>
              <option value="vehicle_owner">Vehicle Owner</option>
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <span className="text-xs font-bold text-gray-400 whitespace-nowrap">Showing {filteredUsers.length} users</span>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="p-20 text-center text-gray-400 flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-brand-teal" size={32} />
              <p className="font-medium">Loading user directory...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-20 text-center text-gray-400">
              <p className="italic">{users.length > 0 ? "No users match your criteria." : "No users found in the system."}</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">User / Company</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Profile Status</th>
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal shrink-0">
                          <Mail size={14} />
                        </div>
                        <div>
                          <div className="font-bold text-brand-charcoal text-sm">
                            {u.full_name || u.company_name || 'Unnamed User'}
                          </div>
                          {(u.company_name && u.full_name) && (
                            <div className="text-xs font-medium text-gray-600 mb-0.5">
                              {u.company_name}
                            </div>
                          )}
                          <div className="text-xs text-gray-500">
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold capitalize ${
                          u.role === 'admin'
                            ? 'bg-purple-50 text-purple-700'
                            : u.role === 'operator'
                            ? 'bg-brand-teal/10 text-brand-teal'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        <Shield size={12} />
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold capitalize ${
                        u.verification_status === 'verified' ? 'bg-green-100 text-green-700 border border-green-200' :
                        u.verification_status === 'rejected' ? 'bg-red-100 text-red-700 border border-red-200' :
                        'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}>
                        {u.verification_status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar size={14} />
                        {new Date(u.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/admin/verification/${u.id}`}
                        className="text-xs font-bold bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:border-brand-teal hover:text-brand-teal transition-colors shadow-sm"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
