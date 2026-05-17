import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Vehicle } from '../../types';
import { getOperatorOwnedVehicles, getFleetOwnerVehicles, deleteVehicle, setVehicleStatus, listVehiclesAvailabilityBlocks } from '../../lib/fleetService';
import { Plus, Search, Truck, Eye, Edit2, Filter, Info, Fuel, Users, Archive, Trash2, CheckCircle2, AlertCircle, Wrench, PlayCircle, MapPin, AlertTriangle } from 'lucide-react';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

export const FleetList: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const basePath = profile?.role === 'vehicle_owner' ? '/owner/vehicles' : '/operator/vehicles';

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allVehicleAvailability, setAllVehicleAvailability] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');

  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [vehicleToArchive, setVehicleToArchive] = useState<Vehicle | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadData();
  }, [user, profile, statusFilter]);

  const loadData = async () => {
    if (!user || !profile) return;
    setLoading(true);

    try {
      let data: Vehicle[] = [];

      if (profile.role === 'operator') {
        data = await getOperatorOwnedVehicles(user.id);
      } else {
        data = await getFleetOwnerVehicles(user.id);
      }

      const normalized = (data || []).map(v => ({
        ...v,
        status: (v.status ?? 'active') as any
      }));

      const filtered =
        statusFilter === 'All statuses'
          ? normalized
          : normalized.filter(v => {
              const s = String(v.status ?? 'active').toLowerCase().trim();
              if (statusFilter === 'Active') return s !== 'inactive';
              if (statusFilter === 'Maintenance') return s === 'maintenance';
              if (statusFilter === 'Inactive') return s === 'inactive';
              return true;
            });

      setVehicles(filtered);

      if (filtered.length > 0) {
        const vIds = filtered.map((v: any) => v.id);
        const availabilityData = await listVehiclesAvailabilityBlocks(vIds);
        const availabilityMap: Record<string, any[]> = {};
        availabilityData.forEach((a: any) => {
          if (!availabilityMap[a.vehicle_id]) {
            availabilityMap[a.vehicle_id] = [];
          }
          availabilityMap[a.vehicle_id].push(a);
        });
        setAllVehicleAvailability(availabilityMap);
      }
    } catch (err: any) {
      console.error('Fleet List Load Error:', err?.message || err);
      setToast({ message: 'Failed to load fleet', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (vId: string, status: 'Active' | 'Maintenance' | 'Inactive') => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await setVehicleStatus(vId, user.id, status);
      setToast({ message: `Vehicle marked as ${status}`, type: 'success' });
      await loadData();
      setVehicleToArchive(null);
    } catch (err: any) {
      console.error('Status update failed', err);
      setToast({ message: 'Update failed', type: 'error' });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!user || !vehicleToDelete) return;

    setIsProcessing(true);
    try {
      await deleteVehicle(vehicleToDelete.id, user.id);
      setToast({ message: 'Vehicle deleted', type: 'success' });
      setVehicleToDelete(null);
      await loadData();
    } catch (err: any) {
      console.error('Delete failed', err);
      setToast({ message: 'Delete failed', type: 'error' });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const q = searchText.toLowerCase();
    if (!q) return true;
    return (
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.license_plate.toLowerCase().includes(q)
    );
  });

  const normalizeStatus = (status?: string | null) => (status ?? 'active').toLowerCase().trim();

  const getStatusColor = (status?: string | null) => {
    const s = normalizeStatus(status);
    switch (s) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'maintenance':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-500 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  const getStatusLabel = (status?: string | null) => {
    const s = normalizeStatus(status);
    if (s === 'inactive') return 'Archived';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const getThumbnail = (vehicle: Vehicle) => {
    if (!vehicle.photos || vehicle.photos.length === 0) return null;
    const primary = vehicle.photos.find(p => p.is_primary);
    return primary ? primary.url : vehicle.photos[0].url;
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-brand-charcoal text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          {toast.type === 'success' ? <CheckCircle2 size={20} className="text-green-400" /> : <AlertCircle size={20} className="text-red-400" />}
          {toast.message}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!vehicleToDelete}
        title="Archive vehicle?"
        body="This will hide the vehicle from active fleet views. Existing records, bookings, documents, and history will be preserved."
        confirmLabel="Archive Vehicle"
        isDestructive={true}
        isProcessing={isProcessing}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setVehicleToDelete(null)}
      />

      <ConfirmationModal
        isOpen={!!vehicleToArchive}
        title="Archive vehicle?"
        body="This will hide the vehicle from active fleet views. Existing records, bookings, documents, and history will be preserved."
        confirmLabel="Archive Vehicle"
        isDestructive={false}
        isProcessing={isProcessing}
        onConfirm={() => vehicleToArchive && handleStatusChange(vehicleToArchive.id, 'Inactive')}
        onCancel={() => setVehicleToArchive(null)}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-brand-charcoal">Fleet Management</h1>
          <p className="text-gray-500 mt-1">Manage your vehicles and logistics</p>
        </div>
        <Link
          to={`${basePath}/new`}
          className="bg-brand-teal text-white px-4 py-2 rounded-2xl font-bold flex items-center gap-2 hover:bg-brand-teal/90 transition-colors shadow-sm"
        >
          <Plus size={18} /> Add Vehicle
        </Link>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search make, model, or plate..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-teal"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <select
            className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-brand-teal cursor-pointer hover:bg-gray-50"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="Active">Active only</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Inactive">Inactive / Archived</option>
            <option value="All statuses">All statuses</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading fleet...</div>
        ) : vehicles.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Truck size={32} />
            </div>
            <h3 className="text-lg font-bold text-brand-charcoal">No vehicles found</h3>
            <p className="text-gray-500 mb-6">
              {statusFilter === 'Active' ? 'No active vehicles in your fleet.' : 'Try adjusting your filters.'}
            </p>
            {statusFilter === 'Active' && (
              <Link to={`${basePath}/new`} className="text-brand-teal font-bold hover:underline">
                Add Vehicle
              </Link>
            )}
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No vehicles match your search.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredVehicles.map(v => {
              const thumb = getThumbnail(v);
              const s = normalizeStatus(v.status as any);
              const isInactive = s === 'inactive';
              
              const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              
              const vAvailability = allVehicleAvailability[v.id] || [];
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const currentUnavailable = vAvailability.find(a => {
                const start = new Date(a.date_start);
                const end = new Date(a.date_end);
                return today >= start && today <= end;
              });

              const nextUnavailable = vAvailability
                .filter(a => new Date(a.date_start) > today)
                .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())[0];

              let availabilityReminder = null;
              if (currentUnavailable) {
                availabilityReminder = 'Unavailable today';
              } else if (nextUnavailable) {
                availabilityReminder = `Next unavailable: ${formatDate(nextUnavailable.date_start)} to ${formatDate(nextUnavailable.date_end)}`;
              }

              return (
                <div
                  key={v.id}
                  className={`p-5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isInactive ? 'bg-gray-50 hover:bg-gray-100 opacity-75' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 shrink-0 border border-gray-200 overflow-hidden relative">
                      {thumb ? (
                        <img src={thumb} alt={v.model} className={`w-full h-full object-cover ${isInactive ? 'grayscale' : ''}`} />
                      ) : (
                        <Truck size={24} />
                      )}
                      {isInactive && (
                        <div className="absolute inset-0 bg-gray-200/50 flex items-center justify-center">
                          <Archive size={20} className="text-gray-600" />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-bold text-lg ${isInactive ? 'text-gray-500' : 'text-brand-charcoal'}`}>
                          {v.make} {v.model}
                        </h3>
                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                          {v.year_model}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span className={`font-mono font-medium ${isInactive ? 'text-gray-400' : 'text-brand-charcoal'}`}>{v.license_plate}</span>
                        <span className="flex items-center gap-1">
                          <MapPin size={14} className="text-brand-teal" /> {v.city ? `${v.city}, ` : ''}{v.province || 'No Region'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={14} /> {v.seat_count} Seats
                        </span>
                        <span className="flex items-center gap-1">
                          <Fuel size={14} /> {v.fuel_type}
                        </span>
                      </div>
                      {availabilityReminder && (
                        <div className="mt-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 flex items-center gap-1.5 max-w-fit">
                          <AlertTriangle size={12} />
                          {availabilityReminder}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 self-start sm:self-center ml-16 sm:ml-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusColor(v.status as any)}`}>
                      {getStatusLabel(v.status as any)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`${basePath}/${v.id}`)}
                        className="p-2 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/5 rounded transition-colors"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>

                      <button
                        onClick={() => navigate(`${basePath}/${v.id}/edit`)}
                        className="p-2 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/5 rounded transition-colors"
                        title="Edit Vehicle"
                      >
                        <Edit2 size={18} />
                      </button>

                      {s !== 'active' && (
                        <button
                          onClick={() => handleStatusChange(v.id, 'Active')}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Activate Vehicle"
                          disabled={isProcessing}
                        >
                          <PlayCircle size={18} />
                        </button>
                      )}

                      {s !== 'maintenance' && (
                        <button
                          onClick={() => handleStatusChange(v.id, 'Maintenance')}
                          className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                          title="Set to Maintenance"
                          disabled={isProcessing}
                        >
                          <Wrench size={18} />
                        </button>
                      )}

                      {s !== 'inactive' && (
                        <button
                          onClick={() => setVehicleToArchive(v)}
                          className="p-2 text-gray-400 hover:text-brand-charcoal hover:bg-gray-100 rounded transition-colors"
                          title="Archive Vehicle"
                          disabled={isProcessing}
                        >
                          <Archive size={18} />
                        </button>
                      )}

                      <button
                        onClick={() => setVehicleToDelete(v)}
                        className="p-2 text-gray-400 hover:text-brand-charcoal hover:bg-gray-100 rounded transition-colors"
                        title="Archive Vehicle"
                        disabled={isProcessing}
                      >
                        <Archive size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
