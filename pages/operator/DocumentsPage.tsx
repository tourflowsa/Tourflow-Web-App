
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Document } from '../../types';
import { fetchOperatorDocuments, uploadDocumentFile, upsertDocumentRecord } from '../../lib/documentService';
import { DocumentCard } from '../../components/documents/DocumentCard';
import { FileCheck } from 'lucide-react';
import { getRequirementsForRole, DOCUMENT_DEFINITIONS, computeDerivedStatus } from '../../lib/complianceRequirements';

export const DocumentsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, [user]);

  const loadDocuments = async () => {
    if (!user) return;
    try {
      const docs = await fetchOperatorDocuments(user.id);
      setDocuments(docs);
    } catch (error) {
      console.error("Failed to load documents", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File, type: any) => {
    if (!user || !profile) return;
    
    const path = await uploadDocumentFile(user.id, profile.role, type, file);

    await upsertDocumentRecord(user.id, profile.role, type, path, {
      originalName: file.name,
      size: file.size,
      mimeType: file.type
    });

    await loadDocuments();
  };

  if (loading || !profile) return <div className="p-12 text-center text-gray-500">Loading documents...</div>;

  const requirements = getRequirementsForRole(profile.role);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-charcoal flex items-center gap-3">
          <FileCheck className="text-brand-teal" size={32} />
          Compliance Documents
        </h1>
        <p className="text-gray-500 mt-2 max-w-2xl">
          To activate your account and receive bookings, please upload the required verification documents below. 
          Ensure all files are clear and legible.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {requirements.map((req) => {
          const def = DOCUMENT_DEFINITIONS[req.docId];
          if (!def) return null;

          const existingRaw = documents.find(d => d.document_type === req.docId);
          
          // Use the computed status to "fake" the status passed to the card if needed, 
          // or just pass the doc. The card mostly cares about existence and DB status, 
          // but we want to show expired state visually.
          const computedStatus = computeDerivedStatus(existingRaw, req.requiresExpiry);
          
          // Transform for display if expired/expiring
          const displayDoc = existingRaw ? {
            ...existingRaw,
            // Override status field strictly for UI display logic in child
            status: (computedStatus === 'expired' || computedStatus === 'expiring_soon') 
              ? computedStatus as any 
              : existingRaw.status
          } : undefined;

          // Override label for Insurance if Operator
          const displayTitle = (profile.role === 'operator' && req.docId === 'insurance_cert') 
            ? 'Liability Insurance' 
            : def.label;

          return (
            <DocumentCard
              key={req.docId}
              title={displayTitle}
              description={def.description}
              documentType={req.docId as any}
              existingDoc={displayDoc}
              onUpload={handleUpload}
            />
          );
        })}
      </div>
    </div>
  );
};
