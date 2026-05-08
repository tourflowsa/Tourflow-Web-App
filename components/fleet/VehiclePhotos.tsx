
import React, { useRef } from 'react';
import { VehiclePhoto } from '../../types';
import { Upload, X, Star, Image as ImageIcon } from 'lucide-react';

interface Props {
  photos: VehiclePhoto[]; // Existing saved photos
  pendingFiles: File[];   // Newly selected files waiting for save
  onPhotosChange: (updatedPhotos: VehiclePhoto[]) => void;
  onPendingFilesChange: (files: File[]) => void;
}

/**
 * VehiclePhotos Component
 * 
 * High-level logic:
 * 1. Displays a grid of existing photos and pending uploads.
 * 2. Allows marking an existing photo as "Primary" (star icon).
 * 3. Allows deleting existing photos (via callback) or removing pending files.
 * 4. Enforces a limit of 10 photos total.
 */
export const VehiclePhotos: React.FC<Props> = ({ 
  photos, 
  pendingFiles, 
  onPhotosChange, 
  onPendingFilesChange 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const totalCount = photos.length + pendingFiles.length;
  const maxPhotos = 10;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      
      // Calculate how many we can actually add
      const remainingSlots = maxPhotos - totalCount;
      const allowedFiles = selected.slice(0, remainingSlots);
      
      if (allowedFiles.length < selected.length) {
        alert(`Limit reached. Only ${allowedFiles.length} photo(s) were added.`);
      }

      onPendingFilesChange([...pendingFiles, ...allowedFiles]);
      
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePendingFile = (index: number) => {
    const newFiles = [...pendingFiles];
    newFiles.splice(index, 1);
    onPendingFilesChange(newFiles);
  };

  const removeExistingPhoto = (photo: VehiclePhoto) => {
    if (!confirm('Remove this photo? It will be deleted permanently when you save.')) return;
    onPhotosChange(photos.filter(p => p.id !== photo.id));
  };

  const setPrimaryPhoto = (photoId: string) => {
    const updated = photos.map(p => ({
      ...p,
      is_primary: p.id === photoId
    }));
    onPhotosChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        {/* Existing Photos */}
        {photos.map((photo) => (
          <div key={photo.id} className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
            <img src={photo.url} alt="Vehicle" className="w-full h-full object-cover" />
            
            {/* Overlay Actions */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPrimaryPhoto(photo.id)}
                className={`p-1.5 rounded-full ${photo.is_primary ? 'bg-yellow-400 text-white' : 'bg-white text-gray-400 hover:text-yellow-400'}`}
                title="Set as Main Photo"
              >
                <Star size={16} fill={photo.is_primary ? "currentColor" : "none"} />
              </button>
              <button
                type="button"
                onClick={() => removeExistingPhoto(photo)}
                className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                title="Remove Photo"
              >
                <X size={16} />
              </button>
            </div>
            
            {photo.is_primary && (
               <div className="absolute top-2 left-2 bg-yellow-400 text-xs font-bold px-2 py-0.5 rounded shadow-sm">
                 Main
               </div>
            )}
          </div>
        ))}

        {/* Pending Photos (Previews) */}
        {pendingFiles.map((file, idx) => (
          <div key={`pending-${idx}`} className="relative aspect-square bg-gray-50 rounded-lg overflow-hidden border-2 border-brand-teal border-dashed">
            <img 
              src={URL.createObjectURL(file)} 
              alt="Preview" 
              className="w-full h-full object-cover opacity-75" 
              onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)} // Cleanup memory
            />
            <div className="absolute top-2 right-2">
               <button
                type="button"
                onClick={() => removePendingFile(idx)}
                className="p-1 bg-gray-600 text-white rounded-full hover:bg-gray-700"
              >
                <X size={12} />
              </button>
            </div>
            <div className="absolute bottom-0 w-full bg-brand-teal text-white text-[10px] text-center py-1">
              Pending Save
            </div>
          </div>
        ))}

        {/* Upload Button */}
        {totalCount < maxPhotos && (
          <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-brand-teal hover:bg-brand-teal/5 transition-colors">
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              multiple 
              className="hidden" 
              onChange={handleFileSelect}
            />
            <Upload className="text-gray-400 mb-2" size={24} />
            <span className="text-sm text-gray-500 font-bold">Add Photo</span>
            <span className="text-xs text-gray-400 mt-1">{totalCount}/{maxPhotos}</span>
          </label>
        )}
      </div>

      {totalCount === 0 && (
        <div className="text-sm text-gray-400 flex items-center gap-2 italic">
          <ImageIcon size={16} /> No photos added yet.
        </div>
      )}
    </div>
  );
};
