
import React from 'react';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  isDestructive?: boolean;
  isProcessing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<Props> = ({ 
  isOpen, title, body, confirmLabel, isDestructive, isProcessing, onConfirm, onCancel 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden scale-100">
        <div className="p-6">
          <div className={`flex items-center gap-3 mb-4 ${isDestructive ? 'text-red-600' : 'text-brand-charcoal'}`}>
            {isDestructive ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} className="text-brand-teal" />}
            <h3 className="text-lg font-bold">{title}</h3>
          </div>
          
          <div className="text-gray-600 text-sm mb-6 leading-relaxed">
            {body}
          </div>
          
          <div className="flex gap-3 justify-end pt-2">
            <button 
              onClick={onCancel}
              disabled={isProcessing}
              className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button 
              onClick={onConfirm}
              disabled={isProcessing}
              className={`px-6 py-2 text-white font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm ${
                isDestructive 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-brand-charcoal hover:bg-gray-800'
              }`}
            >
              {isProcessing && <Loader2 size={16} className="animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
