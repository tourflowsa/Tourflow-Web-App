import React from 'react';
import { OnboardingStep } from '../../lib/onboardingUtils';
import { AlertCircle, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';

interface Props {
  status: OnboardingStep;
}

export const StatusBanner: React.FC<Props> = ({ status }) => {
  if (status === 'verified') return null;

  const config = {
    not_started: {
      color: 'bg-gray-100 text-gray-700 border-gray-200',
      icon: <AlertCircle size={20} />,
      title: 'Action Required: Complete your profile',
      desc: 'Please upload the required documents below to start receiving bookings.'
    },
    in_progress: {
      color: 'bg-blue-50 text-blue-700 border-blue-100',
      icon: <Loader2 size={20} className="animate-spin" />,
      title: 'Onboarding in progress',
      desc: 'You have started uploading documents. Complete the list below to submit for review.'
    },
    awaiting_review: {
      color: 'bg-amber-50 text-amber-700 border-amber-100',
      icon: <Clock size={20} />,
      title: 'Awaiting Verification',
      desc: 'Our admin team is reviewing your documents. This usually takes 24-48 hours.'
    },
    verified: {
      color: 'bg-green-50 text-green-700 border-green-100',
      icon: <CheckCircle2 size={20} />,
      title: 'Account Verified',
      desc: 'You are fully verified and ready to operate.'
    },
    rejected: {
      color: 'bg-red-50 text-red-700 border-red-100',
      icon: <XCircle size={20} />,
      title: 'Verification Failed',
      desc: 'One or more documents were rejected. Please check the list below and re-upload.'
    }
  };

  const current = config[status];

  return (
    <div className={`p-4 rounded-xl border ${current.color} mb-6 flex items-start gap-4`}>
      <div className="mt-0.5">{current.icon}</div>
      <div>
        <h3 className="font-bold text-lg">{current.title}</h3>
        <p className="text-sm opacity-90">{current.desc}</p>
      </div>
    </div>
  );
};