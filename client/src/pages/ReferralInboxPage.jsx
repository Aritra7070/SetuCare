import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../stores/authStore';
import { useSocket } from '../hooks/useSocket';
import {
  Inbox,
  AlertTriangle,
  Clock,
  Hospital,
  CheckCircle2,
  Eye,
  XCircle,
  ArrowRight,
  RotateCcw,
  Zap,
  User,
  Send,
  Filter,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Colour configs (mirrors PatientTimelinePage / REFERRAL_STATUS_CONFIG)
// ---------------------------------------------------------------------------
const RISK_CONFIG = {
  emergency: { label: 'Emergency', bg: 'rgba(244,63,94,0.18)',  color: '#fb7185', border: 'rgba(244,63,94,0.4)' },
  urgent:    { label: 'Urgent',    bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.35)' },
  routine:   { label: 'Routine',   bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.3)' },
};

const STATUS_CONFIG = {
  created:      { label: 'New',          bg: 'rgba(59,130,246,0.15)',  color: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
  acknowledged: { label: 'Acknowledged', bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: 'rgba(245,158,11,0.28)' },
  seen:         { label: 'Seen',         bg: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: 'rgba(139,92,246,0.3)' },
  closed:       { label: 'Closed',       bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.3)' },
};

const TIER_CONFIG = {
  sub_centre:       { label: 'Sub-Centre',       color: '#34d399' },
  phc:              { label: 'PHC',               color: '#22d3ee' },
  rural_hospital:   { label: 'Rural Hospital',    color: '#c4b5fd' },
  district_hospital:{ label: 'District Hospital', color: '#fb7185' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function timeSince(dateStr) {
  if (!dateStr) return '—';
  const ms  = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60)  return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr  < 24)  return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function Chip({ cfg, children }) {
  return (
    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '700', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ReferralInboxPage
// ---------------------------------------------------------------------------
export const ReferralInboxPage = ({ onOpenTimeline }) => {
  const { user }   = useAuthStore();
  const socket     = useSocket();

  const [referrals,    setReferrals]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'closed'
  const [riskFilter,   setRiskFilter]   = useState('');        // '' | 'emergency' | 'urgent' | 'routine'

  // Per-row acknowledge loading state
  const [ackLoading, setAckLoading]     = useState({});

  const facilityId = user?.facility?._id || user?.facility;

  // ── Fetch inbox ──
  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter === 'closed') params.status = 'closed';
      if (riskFilter)                params.riskLevel = riskFilter;
      const res = await api.get('/referrals/inbox', { params });
      if (res.data.success) setReferrals(res.data.referrals);
    } catch (err) {
      setError(err.message || 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, riskFilter]);

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  // ── Join facility socket room on mount ──
  useEffect(() => {
    if (!socket || !facilityId) return;
    const fid = facilityId.toString();
    socket.emit('join:facility', { facilityId: fid });
    return () => socket.emit('leave:facility', { facilityId: fid });
  }, [socket, facilityId]);

  // ── Live: new referral arrives ──
  useEffect(() => {
    if (!socket) return;
    const handler = (payload) => {
      // Only add if it matches current filter
      if (statusFilter === 'closed') return; // new arrivals are never closed
      setReferrals(prev => {
        // Avoid duplicates
        if (prev.some(r => r._id === payload.referralId)) return prev;
        // Insert at top of 'created' items (will resort on next fetch)
        const newItem = {
          _id:          payload.referralId,
          status:       'created',
          riskLevel:    payload.riskLevel,
          isOverdue:    false,
          overdueByMs:  0,
          createdAt:    payload.createdAt,
          patient:      { name: payload.patientName, phid: payload.patientPhid, _id: payload.patientId },
          fromFacility: payload.fromFacility,
          reason:       payload.reason,
        };
        return [newItem, ...prev];
      });
    };
    socket.on('referral:created', handler);
    return () => socket.off('referral:created', handler);
  }, [socket, statusFilter]);

  // ── Live: status updated ──
  useEffect(() => {
    if (!socket) return;
    const handler = (payload) => {
      setReferrals(prev => {
        const updated = prev.map(r =>
          r._id === payload.referralId ? { ...r, status: payload.status } : r
        );
        // If now closed and filter is 'active', remove from list
        if (payload.status === 'closed' && statusFilter === 'active') {
          return updated.filter(r => r._id !== payload.referralId);
        }
        return updated;
      });
    };
    socket.on('referral:statusUpdated', handler);
    return () => socket.off('referral:statusUpdated', handler);
  }, [socket, statusFilter]);

  // ── Quick-acknowledge ──
  const handleAcknowledge = async (referralId, e) => {
    e.stopPropagation(); // don't navigate to timeline
    setAckLoading(prev => ({ ...prev, [referralId]: true }));
    try {
      await api.patch(`/referrals/${referralId}/status`, { status: 'acknowledged' });
      setReferrals(prev =>
        prev.map(r => r._id === referralId ? { ...r, status: 'acknowledged' } : r)
      );
    } catch (err) {
      // Surface error in-place without interrupting the rest of the list
      console.error('[Inbox] Acknowledge failed:', err.message);
    } finally {
      setAckLoading(prev => ({ ...prev, [referralId]: false }));
    }
  };

  // ── Filter chip counts ──
  const activeCount = referrals.filter(r => r.status !== 'closed').length;

  return (
    <div className="main-content">
      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Inbox size={26} color="#14b8a6" />
            Referral Inbox
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Incoming referrals for{' '}
            <strong style={{ color: '#f8fafc' }}>{user?.facility?.name || 'your facility'}</strong>
            {' '}· Priority-sorted, oldest unacknowledged first
          </p>
        </div>
        <button onClick={fetchInbox} className="btn btn-outline btn-sm">
          <RotateCcw size={13} /> Refresh
        </button>
      </div>

      {/* ── Filter row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <Filter size={14} color="#64748b" />

        {/* Status filter */}
        {[
          { value: 'active', label: 'Active' },
          { value: 'closed', label: 'Closed' },
        ].map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            style={{
              padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: '600',
              border: statusFilter === f.value ? '1px solid #14b8a6' : '1px solid var(--border-subtle)',
              background: statusFilter === f.value ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.04)',
              color: statusFilter === f.value ? '#5eead4' : 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {f.label}
          </button>
        ))}

        <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 4px' }} />

        {/* Risk filter */}
        {[
          { value: '',          label: 'All Risk Levels' },
          { value: 'emergency', label: '🚨 Emergency' },
          { value: 'urgent',    label: '⚠️ Urgent' },
          { value: 'routine',   label: '✅ Routine' },
        ].map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => setRiskFilter(f.value)}
            style={{
              padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: '600',
              border: riskFilter === f.value ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--border-subtle)',
              background: riskFilter === f.value ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
              color: riskFilter === f.value ? '#f8fafc' : 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
          <Inbox size={36} color="#14b8a6" style={{ margin: '0 auto 0.75rem auto' }} />
          <div style={{ fontWeight: '700', color: '#f8fafc' }}>Loading inbox…</div>
        </div>
      ) : error ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', border: '1px solid rgba(244,63,94,0.3)' }}>
          <AlertTriangle size={32} color="#f43f5e" style={{ margin: '0 auto 0.75rem auto' }} />
          <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.5rem' }}>Failed to load inbox</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{error}</div>
          <button onClick={fetchInbox} className="btn btn-primary btn-sm">Retry</button>
        </div>
      ) : referrals.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', border: '1px dashed var(--border-subtle)' }}>
          <CheckCircle2 size={38} color="#34d399" style={{ margin: '0 auto 0.75rem auto', opacity: 0.6 }} />
          <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '1.05rem' }}>Inbox clear</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            {statusFilter === 'closed' ? 'No closed referrals on record.' : 'No pending referrals for your facility.'}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {referrals.map((ref, idx) => {
            const riskCfg   = ref.riskLevel ? RISK_CONFIG[ref.riskLevel] : null;
            const statusCfg = STATUS_CONFIG[ref.status] || STATUS_CONFIG.created;
            const tierCfg   = ref.fromFacility?.tier ? (TIER_CONFIG[ref.fromFacility.tier] || { label: ref.fromFacility.tier, color: '#94a3b8' }) : null;
            const isNew     = ref.status === 'created';
            const isAcking  = ackLoading[ref._id];

            return (
              <div
                key={ref._id}
                onClick={() => onOpenTimeline && onOpenTimeline(ref.patient?.phid)}
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: idx < referrals.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
                  cursor: 'pointer',
                  background: ref.isOverdue
                    ? 'rgba(244,63,94,0.04)'
                    : isNew ? 'rgba(59,130,246,0.04)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = ref.isOverdue ? 'rgba(244,63,94,0.04)' : isNew ? 'rgba(59,130,246,0.04)' : 'transparent')}
              >
                {/* Overdue / new indicator dot */}
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: ref.isOverdue ? '#f43f5e' : isNew ? '#3b82f6' : 'transparent', boxShadow: ref.isOverdue ? '0 0 6px rgba(244,63,94,0.7)' : 'none' }} />

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                    {/* Patient name */}
                    <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#f8fafc' }}>
                      {ref.patient?.name || 'Unknown Patient'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#22d3ee' }}>
                      {ref.patient?.phid}
                    </span>

                    {/* Risk badge */}
                    {riskCfg && <Chip cfg={riskCfg}><Zap size={9} />{riskCfg.label}</Chip>}

                    {/* Status badge */}
                    <Chip cfg={statusCfg}>{statusCfg.label}</Chip>

                    {/* Overdue warning */}
                    {ref.isOverdue && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: '700', color: '#fb7185', background: 'rgba(244,63,94,0.12)', padding: '0.12rem 0.45rem', borderRadius: '9999px', border: '1px solid rgba(244,63,94,0.35)' }}>
                        <AlertTriangle size={9} /> OVERDUE
                      </span>
                    )}
                  </div>

                  {/* From facility + reason */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                    {tierCfg && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: tierCfg.color }}>
                        <Hospital size={11} />
                        {ref.fromFacility?.name}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>({tierCfg.label})</span>
                      </span>
                    )}
                    {ref.reason && (
                      <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>
                        · {ref.reason}
                      </span>
                    )}
                  </div>
                </div>

                {/* Time since */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: ref.isOverdue ? '#fb7185' : 'var(--text-muted)', flexShrink: 0 }}>
                  <Clock size={12} />
                  {timeSince(ref.createdAt)}
                </div>

                {/* Quick-acknowledge button — only for 'created' status */}
                {isNew && (
                  <button
                    type="button"
                    disabled={isAcking}
                    onClick={e => handleAcknowledge(ref._id, e)}
                    className="btn btn-sm"
                    style={{ flexShrink: 0, padding: '0.3rem 0.75rem', fontSize: '0.75rem', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    {isAcking ? '…' : <><CheckCircle2 size={12} />Acknowledge</>}
                  </button>
                )}

                {/* Open timeline arrow */}
                <ArrowRight size={15} color="#64748b" style={{ flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
