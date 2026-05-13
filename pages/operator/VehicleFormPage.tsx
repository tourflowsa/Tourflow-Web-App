
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Vehicle } from '../../types';
import { createVehicle, getVehicleById, updateVehicle, uploadVehiclePhotos } from '../../lib/fleetService';
import { VehicleForm } from '../../components/fleet/VehicleForm';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export const VehicleFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const backPath = profile?.role === 'vehicle_owner' ? '/owner/vehicles' : '/operator/vehicles';
  const isEditMode = !!id;
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditMode);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (isEditMode && id && user) {
      loadVehicle();
    }
  }, [id, user]);

  const loadVehicle = async () => {
    if (!user || !id) return;
    try {
      // Fix: getVehicleById expects 1 argument (vehicleId), not 2.
      const data = await getVehicleById(id);
      setVehicle(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load vehicle details.");
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (formData: Partial<Vehicle>, pendingFiles: File[]) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      let savedVehicle: Vehicle;
      let uploadWarning = '';

      if (isEditMode && id) {
        // Edit flow: Upload photos first (using existing ID) then update record
        let finalPhotos = formData.photos || [];
        
        if (pendingFiles.length > 0) {
          const { uploaded, failedCount } = await uploadVehiclePhotos(id, pendingFiles);
          finalPhotos = [...finalPhotos, ...uploaded];
          if (failedCount > 0) {
            uploadWarning = `Note: ${failedCount} photos failed to upload.`;
          }
        }
        
        savedVehicle = await updateVehicle(id, { ...formData, photos: finalPhotos });
      } else {
        // Create flow: Create vehicle record first to get a real ID
        const isOperator = profile?.role === 'operator';
        savedVehicle = await createVehicle({
          ...formData,
          owner_id: user.id,
          operator_id: isOperator ? user.id : null
        } as any);

        // Then upload photos using the new ID
        if (pendingFiles.length > 0) {
          const { uploaded, failedCount } = await uploadVehiclePhotos(savedVehicle.id, pendingFiles);
          
          if (uploaded.length > 0) {
            // Patch the vehicle with the new photo metadata
            const updatedPhotos = [...(savedVehicle.photos || []), ...uploaded];
            await updateVehicle(savedVehicle.id, { photos: updatedPhotos });
          }
          
          if (failedCount > 0) {
            uploadWarning = `Vehicle created, but ${failedCount} photos failed to upload. You can add them later in edit mode.`;
          }
        }
      }
      
      if (uploadWarning) {
        setWarning(uploadWarning);
        setLoading(false);
        // Delay redirect so user can see the warning
        setTimeout(() => {
          const redirectPath = profile?.role === 'vehicle_owner' ? '/owner/vehicles' : '/operator/vehicles';
          navigate(redirectPath);
        }, 4000);
      } else {
        const redirectPath = profile?.role === 'vehicle_owner' ? '/owner/vehicles' : '/operator/vehicles';
        navigate(redirectPath);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save vehicle.");
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-12 text-center text-gray-400">Loading vehicle data...</div>;

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-6">
        <button 
          onClick={() => navigate(backPath)} 
          className="flex items-center gap-2 text-gray-500 hover:text-brand-charcoal mb-4 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Fleet
        </button>
        <h1 className="text-2xl font-bold text-brand-charcoal">
          {isEditMode ? 'Edit Vehicle' : 'Add New Vehicle'}
        </h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {warning && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-amber-700">
          <AlertCircle size={20} />
          <span>{warning}</span>
        </div>
      )}

      <VehicleForm 
        mode={isEditMode ? 'edit' : 'create'}
        initialData={vehicle}
        onSubmit={handleSubmit}
        loading={loading}
      />
    </div>
  );
};
