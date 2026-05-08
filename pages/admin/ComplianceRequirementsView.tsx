
import React from 'react';
import { ROLE_REQUIREMENTS, DOCUMENT_DEFINITIONS, RoleRequirement } from '../../lib/complianceRequirements';
import { UserRole } from '../../types';
import { FileText, ShieldCheck } from 'lucide-react';

export const ComplianceRequirementsView: React.FC = () => {
  const roles: UserRole[] = ['operator', 'guide', 'driver', 'vehicle_owner'];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-charcoal flex items-center gap-3">
          <ShieldCheck className="text-brand-teal" size={32} />
          Compliance Standards
        </h1>
        <p className="text-gray-500 mt-2">
          System-wide document requirements for all provider roles.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {roles.map((role) => {
          const requirements = ROLE_REQUIREMENTS[role];
          
          return (
            <div key={role} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-bold text-brand-charcoal capitalize">{role.replace('_', ' ')}</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {requirements.length === 0 ? (
                  <div className="p-6 text-gray-400 text-sm italic">No requirements defined.</div>
                ) : (
                  requirements.map((req: RoleRequirement) => {
                    const def = DOCUMENT_DEFINITIONS[req.docId];
                    return (
                      <div key={req.docId} className="p-4 flex items-start gap-3">
                        <FileText size={18} className="text-gray-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-bold text-brand-charcoal text-sm">{def.label}</p>
                          <p className="text-xs text-gray-500">{def.description}</p>
                          <div className="mt-1">
                            <div className="flex gap-2 mt-2">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${req.required ? 'bg-brand-coral/10 text-brand-coral' : 'bg-gray-100 text-gray-600'}`}>
                                {req.required ? 'Required' : 'Optional'}
                              </span>
                              {req.requiresExpiry && (
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Expiry required</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
