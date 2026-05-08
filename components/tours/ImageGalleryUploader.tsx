import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';

interface Props {
  images: string[];
  onImagesChange: (urls: string[]) => void;
  folderPath: string; // e.g., 'tours/{tourId}'
}

export const ImageGalleryUploader: React.FC<Props> = ({ images, onImagesChange, folderPath }) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);

    const newUrls: string[] = [];
    
    try {
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${folderPath}/${Date.now()}_${i}.${fileExt}`;

        // Upload to 'public-assets' bucket
        const { error: uploadError } = await supabase.storage
          .from('public-assets')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('public-assets')
          .getPublicUrl(fileName);

        newUrls.push(publicUrl);
      }

      onImagesChange([...images, ...newUrls]);
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Failed to upload some images');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (indexToRemove: number) => {
    onImagesChange(images.filter((_, i) => i !== indexToRemove));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {images.map((url, idx) => (
          <div key={idx} className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
            <img src={url} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(idx)}
              className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        
        <label className="border-2 border-dashed border-gray-300 rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-brand-teal hover:bg-brand-teal/5 transition-colors">
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            className="hidden" 
            onChange={handleUpload}
            disabled={uploading}
          />
          {uploading ? (
            <Loader2 className="animate-spin text-brand-teal" size={24} />
          ) : (
            <>
              <Upload className="text-gray-400 mb-2" size={24} />
              <span className="text-sm text-gray-500 font-bold">Add Photos</span>
            </>
          )}
        </label>
      </div>
      {images.length === 0 && (
        <p className="text-sm text-gray-400 flex items-center gap-2">
          <ImageIcon size={16} /> No images uploaded yet.
        </p>
      )}
    </div>
  );
};
