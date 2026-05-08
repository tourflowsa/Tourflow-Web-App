
import React, { useState } from 'react';
import { Document, DocumentType } from '../../types';
import { Upload, Eye, RefreshCw, Loader2, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { openDocument as openDocService } from '../../lib/documentService';

interface Props {
  title: string;
  description: string;
  documentType: DocumentType;
  existingDoc?: Document; // The Supabase row, if it exists
  onUpload: (file: File, type: DocumentType) => Promise<void>;
}

export const DocumentCard: React.FC<Props> = ({ 
  title, 
  description, 
  documentType, 
  existingDoc, 
  onUpload 
}) => {
  const [uploading, setUploading] = useState(false);

  let statusUI = 'missing';
  if (existingDoc) {
    if (existingDoc.status === 'valid') statusUI = 'approved';
    else if (existingDoc.status === 'rejected') statusUI = 'rejected';
    else statusUI = 'uploaded'; // pending
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploading(true);
      try {
        await onUpload(e.target.files[0], documentType);
      } catch (error) {
        console.error("Upload error", error);
        alert("Failed to upload document");
      } finally {
        setUploading(false);
      }
    }
  };

  const handleOpen = () => {
    if (existingDoc?.file_path) {
      openDocService(existingDoc.file_path);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-lg ${
            statusUI === 'approved' ? 'bg-green-100 text-green-600' :
            statusUI === 'rejected' ? 'bg-red-100 text-red-600' :
            statusUI === 'uploaded' ? 'bg-blue-100 text-blue-600' :
            'bg-gray-100 text-gray-400'
          }`}>
            <FileText size={24} />
          </div>
          <div>
            <h3 className="font-bold text-brand-charcoal">{title}</h3>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
        
        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
           statusUI === 'approved' ? 'bg-green-100 text-green-700' :
           statusUI === 'rejected' ? 'bg-red-100 text-red-700' :
           statusUI === 'uploaded' ? 'bg-blue-100 text-blue-700' :
           'bg-gray-100 text-gray-500'
        }`}>
          {statusUI}
        </div>
      </div>

      <div className="flex-1">
        {statusUI === 'rejected' && (
           <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2">
             <AlertCircle size={16} className="mt-0.5 shrink-0" />
             <span>Document rejected. Please upload a corrected version.</span>
           </div>
        )}
        
        {existingDoc && (
          <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
             <CheckCircle2 size={12} />
             Uploaded: {new Date(existingDoc.created_at).toLocaleString()}
          </p>
        )}
      </div>

      <div className="pt-4 border-t border-gray-100 mt-auto">
        {existingDoc ? (
          <div className="flex items-center gap-3">
            <button 
              onClick={handleOpen}
              className="flex-1 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm"
            >
              <Eye size={16} /> View
            </button>
            <label className="flex-1 cursor-pointer">
              <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.png" disabled={uploading} />
              <div className="w-full py-2 bg-brand-charcoal text-white font-bold rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2 text-sm transition-colors">
                 {uploading ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16} />}
                 Replace
              </div>
            </label>
          </div>
        ) : (
          <div className="w-full">
            <label className="w-full cursor-pointer block">
              <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.png" disabled={uploading} />
              <div className="w-full py-2 bg-brand-teal text-white font-bold rounded-lg hover:bg-brand-teal/90 flex items-center justify-center gap-2 transition-colors">
                {uploading ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16} />}
                Upload Document
              </div>
            </label>
            
            <div className="mt-3 text-center space-y-1">
              <p className="text-[10px] text-gray-400">Accepted formats: PDF, JPG, PNG • Max size: 5 MB per file</p>
              <p className="text-[10px] text-gray-400">Make sure document details are clear and readable</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
