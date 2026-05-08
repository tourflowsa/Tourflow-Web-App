import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPayoutBatchDetail } from '../../lib/payoutService';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { getPayableAmount } from '../../lib/payoutUtils';
import { Loader2, ArrowLeft, Download } from 'lucide-react';

export const AdminPayoutBatchDetail: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (batchId) {
      getPayoutBatchDetail(batchId)
        .then(res => {
          setData(res);
        })
        .catch(err => {
          console.error('BATCH DETAIL LOAD ERROR', err);
          setData(null);
        })
        .finally(() => setLoading(false));
    }
  }, [batchId]);

  const exportCSV = () => {
    if (!data) return;
    const headers = ['Batch Ref', 'Payout Ref', 'Operator', 'Provider', 'Booking Ref', 'Tour', 'Service Date', 'Gross', 'Platform Fee', 'Net', 'Status', 'Paid At'];
    const rows = data.payouts.map((p: any) => [
      data.batch.batch_ref ?? data.batch.batch_reference ?? data.batch.id,
      p.payout_reference,
      p.operator_display_name,
      p.provider_display_name,
      p.booking_reference,
      p.tour_title,
      p.service_date,
      p.amount_gross,
      p.platform_fee,
      getPayableAmount(p),
      p.status,
      p.paid_at
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-${data.batch.batch_ref ?? data.batch.batch_reference ?? data.batch.id}.csv`;
    a.click();
  };

  if (loading) return <div className="p-12 text-center text-gray-400"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;
  if (!data) return <div className="p-12 text-center text-red-500">Batch not found.</div>;

  return (
    <div className="p-6">
      <button onClick={() => navigate('/admin/payouts')} className="flex items-center gap-2 text-gray-500 mb-4 hover:underline"><ArrowLeft size={16} /> Back to Payouts</button>
      <div className="bg-white p-6 rounded shadow mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Batch {data.batch.batch_ref ?? data.batch.batch_reference ?? data.batch.id}</h1>
          <button onClick={exportCSV} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"><Download size={16} /> Export CSV</button>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500">Processed At:</span> {data.batch.processed_at ? formatDate(data.batch.processed_at) : 'Processing'}</div>
          <div><span className="text-gray-500">Created At:</span> {formatDate(data.batch.created_at)}</div>
          <div><span className="text-gray-500">Created By:</span> {data.batch.created_by_name}</div>
          <div><span className="text-gray-500">Total Amount:</span> {formatCurrency(data.batch.total_amount)}</div>
          <div><span className="text-gray-500">Payout Count:</span> {data.batch.total_count || data.batch.payout_count}</div>
          <div><span className="text-gray-500">Status:</span> <span className="uppercase">{data.batch.status}</span></div>
        </div>
      </div>
      {data.payouts.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded shadow">No payouts found for this batch.</div>
      ) : (
        <table className="w-full border-collapse bg-white shadow rounded">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Provider</th>
              <th className="p-2 text-left">Booking Ref</th>
              <th className="p-2 text-left text-xs uppercase text-gray-500">Timeline</th>
              <th className="p-2 text-left">Gross</th>
              <th className="p-2 text-left">Fee</th>
              <th className="p-2 text-left">Net</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Payout Ref</th>
            </tr>
          </thead>
          <tbody>
            {data.payouts.map((p: any) => (
              <tr key={p.id} className="border-b">
                <td className="p-2">{p.provider_display_name}</td>
                <td className="p-2">{p.booking_reference}</td>
                <td className="p-2">
                  <div className="text-[10px] space-y-0.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400">Created:</span>
                      <span>{formatDate(p.created_at)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400">Approved:</span>
                      <span>{p.approved_at ? formatDate(p.approved_at) : '-'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-400">Paid:</span>
                      <span>{p.paid_at ? formatDate(p.paid_at) : '-'}</span>
                    </div>
                  </div>
                </td>
                <td className="p-2">{formatCurrency(p.amount_gross)}</td>
                <td className="p-2">{formatCurrency(p.platform_fee)}</td>
                <td className="p-2">{formatCurrency(getPayableAmount(p))}</td>
                <td className="p-2">{p.status.toUpperCase()}</td>
                <td className="p-2">{p.payout_reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
