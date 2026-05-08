// pages/admin/AdminBookingsList.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { archiveBookingRpc, unarchiveBookingRpc } from "../../lib/bookingService";
import { downloadCSV } from "../../lib/csvExportService";
import { Archive, RotateCcw, Eye, RefreshCw, Loader2, AlertCircle, CheckCircle2, Clock, Users, AlertTriangle, ShieldCheck, Download } from "lucide-react";

type BookingRow = Record<string, any>;

type ProfileLite = {
  id: string;
  email: string | null;
  full_name: string | null;
};

function normalizeText(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function formatMoney(amount: any, currency: any) {
  const n = Number(amount ?? 0);
  const cur = String(currency ?? "ZAR");
  if (Number.isNaN(n)) return `${cur} 0`;
  return `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function getReference(b: BookingRow) {
  return b.booking_reference ?? b.reference ?? b.ref ?? b.code ?? null;
}

function getStart(b: BookingRow) {
  return b.start_date ?? b.start_at ?? b.starts_at ?? b.start_time ?? null;
}

function getEnd(b: BookingRow) {
  return b.end_date ?? b.end_at ?? b.ends_at ?? b.end_time ?? null;
}

function getGuests(b: BookingRow) {
  return b.num_guests ?? b.guests ?? b.guest_count ?? 0;
}

function getGuestName(b: BookingRow) {
  return b.guest_name ?? b.customer_name ?? b.name ?? null;
}

function getArchivedFlag(b: BookingRow) {
  // Source of truth in this view is archived_at timestamp
  return Boolean(b.archived_at);
}

export function AdminBookingsList() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [rows, setRows] = useState<BookingRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileLite>>({});
  const [payoutLedgers, setPayoutLedgers] = useState<any[]>([]);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, { driverStatus?: string; guideStatus?: string }>>({});

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const { data, error: qErr } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (qErr) {
      setRows([]);
      setProfilesById({});
      setError(qErr.message);
      setLoading(false);
      return;
    }

    const bookings = (data ?? []) as BookingRow[];
    setRows(bookings);

    // Load payout ledger summary and assignments for these bookings
    const bookingIds = bookings.map(b => b.id);
    const [payData, assignData] = await Promise.all([
      supabase
        .from('payout_ledger')
        .select('booking_id, status')
        .in('booking_id', bookingIds),
      supabase
        .from('booking_assignments')
        .select('booking_id, resource_type, status')
        .in('booking_id', bookingIds)
    ]);
    
    setPayoutLedgers(payData.data || []);

    if (assignData.data) {
      const amap: Record<string, { driverStatus?: string; guideStatus?: string }> = {};
      assignData.data.forEach((a: any) => {
        if (!amap[a.booking_id]) amap[a.booking_id] = {};
        if (a.resource_type === 'driver') amap[a.booking_id].driverStatus = a.status;
        if (a.resource_type === 'guide') amap[a.booking_id].guideStatus = a.status;
      });
      setAssignmentMap(amap);
    }

    // Load operator profiles for display
    const operatorIds = Array.from(
      new Set(bookings.map((b) => b.operator_id).filter(Boolean))
    );

    if (operatorIds.length === 0) {
      setProfilesById({});
      setLoading(false);
      return;
    }

    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .in("id", operatorIds);

    if (pErr) {
      setProfilesById({});
      setLoading(false);
      return;
    }

    const map: Record<string, ProfileLite> = {};
    (profs ?? []).forEach((p: any) => {
      map[p.id] = {
        id: p.id,
        email: p.email ?? null,
        full_name: p.full_name ?? null,
      };
    });
    setProfilesById(map);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
  const s = normalizeText(search);

  return rows.filter((b) => {
    const isArchived = getArchivedFlag(b);

    // Strict archive separation
    if (showArchived) {
      if (!isArchived) return false;
    } else {
      if (isArchived) return false;
    }

    if (status !== "all" && normalizeText(b.status) !== normalizeText(status)) {
      return false;
    }

    if (!s) return true;

    const ref = normalizeText(getReference(b));
    const guest = normalizeText(getGuestName(b));
    const opId = b.operator_id;
    const prof = opId ? profilesById[String(opId)] : undefined;
    const opName = normalizeText(prof?.full_name);
    const opEmail = normalizeText(prof?.email);

    return (
      ref.includes(s) ||
      guest.includes(s) ||
      opName.includes(s) ||
      opEmail.includes(s)
    );
  });
}, [rows, profilesById, search, status, showArchived]);

  const payoutStatsMap = useMemo(() => {
    const map: Record<string, { total: number; paid: number }> = {};
    payoutLedgers.forEach(p => {
      if (!map[p.booking_id]) map[p.booking_id] = { total: 0, paid: 0 };
      map[p.booking_id].total++;
      if (p.status === 'paid') map[p.booking_id].paid++;
    });
    return map;
  }, [payoutLedgers]);

    const getEscrowStatusBadge = (b: BookingRow) => {
    const status = b.escrow_status || b.payment_status;
    const base = {
      fontSize: 9,
      fontWeight: 800,
      textTransform: "uppercase" as const,
      padding: "2px 6px",
      borderRadius: 4,
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      border: "1px solid"
    };
    
    switch(status) {
      case 'funds_received':
      case 'funds_held':
        return <span style={{ ...base, background: '#eff6ff', color: '#1d4ed8', borderColor: '#dbeafe' }}><AlertCircle size={10}/> Funds Held</span>;
      case 'partially_released':
        return <span style={{ ...base, background: '#fffbeb', color: '#b45309', borderColor: '#fef3c7' }}><RotateCcw size={10}/> Partially Released</span>;
      case 'fully_released':
      case 'payout_completed':
        return <span style={{ ...base, background: '#f0fdf4', color: '#15803d', borderColor: '#dcfce7' }}><CheckCircle2 size={10}/> Fully Released</span>;
      case 'pending_payment':
      case 'payment_pending':
      default:
        return <span style={{ ...base, background: '#f9fafb', color: '#6b7280', borderColor: '#f3f4f6' }}><Clock size={10}/> Payment Pending</span>;
    }
  };

  const getAssignmentReadinessBadge = (b: BookingRow) => {
    const status = assignmentMap[b.id];
    const base = {
      fontSize: 9,
      fontWeight: 800,
      textTransform: "uppercase" as const,
      padding: "2px 6px",
      borderRadius: 4,
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      border: "1px solid"
    };
    
    if (!status || (!status.driverStatus && !status.guideStatus)) {
      return <span style={{ ...base, background: '#fef2f2', color: '#b91c1c', borderColor: '#fee2e2' }}><Users size={10}/> Missing Providers</span>;
    }
    
    const statuses = [status.driverStatus, status.guideStatus].filter(Boolean);
    
    if (statuses.some(s => s === 'rejected')) {
      return <span style={{ ...base, background: '#fef2f2', color: '#b91c1c', borderColor: '#fee2e2' }}><AlertTriangle size={10}/> Declined</span>;
    }
    if (statuses.some(s => s === 'pending')) {
      return <span style={{ ...base, background: '#fffbeb', color: '#b45309', borderColor: '#fef3c7' }}><Clock size={10}/> Pending Acceptance</span>;
    }
    if (statuses.every(s => s === 'accepted')) {
      return <span style={{ ...base, background: '#f0fdf4', color: '#15803d', borderColor: '#dcfce7' }}><CheckCircle2 size={10}/> Accepted</span>;
    }
    
    return <span style={{ ...base, background: '#f9fafb', color: '#374151', borderColor: '#f3f4f6' }}>Assignment Incomplete</span>;
  };

  const getComplianceBadge = (b: BookingRow) => {
    // Simplified compliance for list view - if confirmed, assume mostly ok for now or needs check
    // In real app, we'd fetch compliance status
    const base = {
      fontSize: 9,
      fontWeight: 800,
      textTransform: "uppercase" as const,
      padding: "2px 6px",
      borderRadius: 4,
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      border: "1px solid"
    };

    if (b.status === 'confirmed') {
      return <span style={{ ...base, background: '#f0fdf4', color: '#15803d', borderColor: '#dcfce7' }}><ShieldCheck size={10}/> Ready</span>;
    }
    return null;
  };

  const handleToggleArchive = async (booking: BookingRow) => {
    if (!user || profile?.role !== 'admin') return;
    
    const isArchived = getArchivedFlag(booking);
    setActioningId(booking.id);
    setNotice(null);

    try {
      if (isArchived) {
        await unarchiveBookingRpc(booking.id);
      } else {
        await archiveBookingRpc(booking.id);
      }

      setNotice({ 
        type: 'success', 
        text: isArchived ? 'Booking unarchived successfully.' : 'Booking archived successfully.' 
      });
      
      // Refetch to sync local state
      await load();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Failed to update booking archive state.' });
    } finally {
      setActioningId(null);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleExportBookings = () => {
    const headers = ['Booking Reference', 'Operator', 'Total Revenue', 'Status', 'Created Date'];
    const data = filtered.map(b => [
      getReference(b),
      profilesById[b.operator_id]?.full_name || 'N/A',
      b.total_amount || 0,
      b.status,
      b.created_at
    ]);
    downloadCSV(`tourflow-bookings-${new Date().toISOString().split('T')[0]}.csv`, headers, data);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold m-0">Global Bookings</h1>
          <div className="opacity-70 mt-1.5">Platform-wide oversight of all reservations.</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportBookings}
            className="px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-white flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            <Download size={16} /> Export CSV
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-white flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div style={{ 
          marginTop: 18, 
          padding: "12px 16px", 
          borderRadius: 10, 
          background: notice.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${notice.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: notice.type === 'success' ? '#166534' : '#991b1b',
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          {notice.type === 'success' ? <RefreshCw size={16} /> : <AlertCircle size={16} />}
          {notice.text}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 18, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference, guest, operator..."
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", minWidth: 280 }}
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Archived Only
        </label>
      </div>

      <div style={{ marginTop: 16 }}>
        {loading && !rows.length && <div style={{ padding: 40, textAlign: "center", opacity: 0.5 }}>Loading global bookings…</div>}
        {!loading && error && (
          <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 10, color: "#991b1b" }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", marginTop: 12 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#f9fafb" }}>
                  <tr>
                    <th style={{ textAlign: "left", padding: 12, fontSize: 12, textTransform: "uppercase", color: "#6b7280" }}>Reference</th>
                    <th style={{ textAlign: "left", padding: 12, fontSize: 12, textTransform: "uppercase", color: "#6b7280" }}>Start</th>
                    <th style={{ textAlign: "left", padding: 12, fontSize: 12, textTransform: "uppercase", color: "#6b7280" }}>Operator</th>
                    <th style={{ textAlign: "left", padding: 12, fontSize: 12, textTransform: "uppercase", color: "#6b7280" }}>Guest</th>
                    <th style={{ textAlign: "left", padding: 12, fontSize: 12, textTransform: "uppercase", color: "#6b7280" }}>Payment</th>
                    <th style={{ textAlign: "left", padding: 12, fontSize: 12, textTransform: "uppercase", color: "#6b7280" }}>Status</th>
                    <th style={{ textAlign: "right", padding: 12, fontSize: 12, textTransform: "uppercase", color: "#6b7280" }}>Total</th>
                    <th style={{ textAlign: "right", padding: 12, fontSize: 12, textTransform: "uppercase", color: "#6b7280" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const id = String(b.id);
                    const ref = getReference(b) ?? "N/A";
                    const start = getStart(b) ?? "N/A";
                    const guestName = getGuestName(b) ?? "N/A";
                    const guests = getGuests(b);
                    const st = String(b.status ?? "unknown").toUpperCase();
                    const total = formatMoney(b.total_amount, b.currency);
                    const prof = b.operator_id ? profilesById[String(b.operator_id)] : undefined;
                    const operatorLabel = prof?.full_name || prof?.email || "N/A";
                    const isArchived = getArchivedFlag(b);

                    return (
                      <tr key={id} style={{ borderTop: "1px solid #f1f5f9", background: isArchived ? "#f9fafb" : "#fff", opacity: isArchived ? 0.7 : 1 }}>
                        <td style={{ padding: 12, fontWeight: 600 }}>
                          {ref}
                          {isArchived && <span style={{ marginLeft: 8, fontSize: 10, background: "#e5e7eb", padding: "2px 6px", borderRadius: 4, color: "#4b5563" }}>ARCHIVED</span>}
                        </td>
                        <td style={{ padding: 12 }}>{String(start)}</td>
                        <td style={{ padding: 12 }}>{operatorLabel}</td>
                        <td style={{ padding: 12 }}>
                          <div style={{ fontWeight: 500 }}>{guestName}</div>
                          <div style={{ opacity: 0.7, fontSize: 12 }}>{Number(guests) || 0} guests</div>
                        </td>
                        <td style={{ padding: 12 }}>
                          {(() => {
                            const stats = payoutStatsMap[b.id];
                            const total = stats?.total || 0;
                            const paid = stats?.paid || 0;
                            const isCompleted = normalizeText(b.status) === 'completed';

                            let label = String(b.payment_status || 'pending').replace('_', ' ');
                            let bg = '#f3f4f6';
                            let color = '#6b7280';
                            let border = '#e5e7eb';

                            // Settlement priority logic
                            if (total > 0 && paid === total) {
                              label = 'Paid';
                              bg = '#f0fdf4';
                              color = '#166534';
                              border = '#bbf7d0';
                            } else if (paid > 0) {
                              label = 'Partially Paid';
                              bg = '#fffbeb';
                              color = '#92400e';
                              border = '#fde68a';
                            } else if (isCompleted || b.payment_status === 'payout_ready' || b.payment_status === 'funds_received') {
                              label = 'Ready for Payout';
                              bg = '#ebf8ff';
                              color = '#2c5282';
                              border = '#bee3f8';
                            }

                            return (
                              <span style={{ 
                                fontSize: 10, 
                                fontWeight: 700, 
                                textTransform: "uppercase",
                                padding: "2px 6px",
                                borderRadius: 6,
                                background: bg,
                                color: color,
                                border: `1px solid ${border}`
                              }}>
                                {label}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: 12 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700 }}>{st}</span>
                            {getEscrowStatusBadge(b)}
                            {getAssignmentReadinessBadge(b)}
                            {getComplianceBadge(b)}
                          </div>
                        </td>
                        <td style={{ padding: 12, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{total}</td>
                        <td style={{ padding: 12, textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button
                              onClick={() => navigate(`/admin/bookings/${id}`)}
                              title="View Details"
                              style={{ padding: "8px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex" }}
                            >
                              <Eye size={16} color="#6b7280" />
                            </button>
                            
                            {profile?.role === 'admin' && (
                              <button
                                onClick={() => handleToggleArchive(b)}
                                disabled={actioningId === id}
                                title={isArchived ? "Restore Booking" : "Archive Booking"}
                                style={{ 
                                  padding: "8px", 
                                  borderRadius: 10, 
                                  border: "1px solid #e5e7eb", 
                                  background: "#fff", 
                                  cursor: actioningId === id ? "not-allowed" : "pointer",
                                  display: "flex",
                                  color: isArchived ? "#00abc6" : "#f87171"
                                }}
                              >
                                {actioningId === id ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : isArchived ? (
                                  <RotateCcw size={16} />
                                ) : (
                                  <Archive size={16} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 40, textAlign: "center", opacity: 0.5, fontStyle: "italic" }}>
                        No bookings found matching current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminBookingsList;