import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useAuthStore } from '../stores/authStore';
import { useSocket } from '../hooks/useSocket';
import { IncomingEmergencyOverlay } from '../components/IncomingEmergencyOverlay';
import {
  Inbox,
  AlertTriangle,
  Clock,
  Hospital,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Zap,
  Filter,
  Siren,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Colour configs
// ---------------------------------------------------------------------------
const RISK_CONFIG = {
  emergency: { bg: 'rgba(244,63,94,0.18)',  color: '#fb7185', border: 'rgba(244,63,94,0.4)' },
  urgent:    { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.35)' },
  routine:   { bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.3)' },
};

const STATUS_CONFIG = {
  created:      { bg: 'rgba(59,130,246,0.15)',  color: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
  acknowledged: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: 'rgba(245,158,11,0.28)' },
  seen:         { bg: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: 'rgba(139,92,246,0.3)' },
  closed:       { bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.3)' },
};

const TIER_CONFIG = {
  sub_centre:        { color: '#34d399' },
  phc:               { color: '#22d3ee' },
  rural_hospital:    { color: '#c4b5fd' },
  district_hospital: { color: '#fb7185' },
};

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
    <span style={{
      padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '700',
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single referral row — extracted so it can be reused in both the pinned
// emergency section and the normal list without duplicating markup.
// ---------------------------------------------------------------------------
function ReferralRow({ ref: referralItem, isLast, onOpenTimeline, onAcknowledge, ackLoading, t, statusLabel, riskLabel, tierLabel }) {
  const riskCfg   = referralItem.riskLevel ? RISK_CONFIG[referralItem.riskLevel] : null;
  const statusCfg = STATUS_CONFIG[referralItem.status] || STATUS_CONFIG.created;
  const tierCfg   = referralItem.fromFacility?.tier
    ? (TIER_CONFIG[referralItem.fromFacility.tier] || { color: '#94a3b8' })
    : null;
  const isNew    = referralItem.status === 'created';
  const isAcking = ackLoading[referralItem._id];

  return (
    <div
      onClick={() => onOpenTimeline && onOpenTimeline(referralItem.patient?.phid)}
      style={{
        padding: '1rem 1.25rem',
        borderBottom: !isLast ? '1px solid var(--border-subtle)' : 'none',
        display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
        cursor: 'pointer',
        background: referralItem.isEmergency
          ? 'rgba(244,63,94,0.06)'
          : referralItem.isOverdue ? 'rgba(244,63,94,0.04)'
          : isNew ? 'rgba(59,130,246,0.04)' : 'transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      onMouseLeave={e => (e.currentTarget.style.background =
        referralItem.isEmergency ? 'rgba(244,63,94,0.06)'
        : referralItem.isOverdue ? 'rgba(244,63,94,0.04)'
        : isNew ? 'rgba(59,130,246,0.04)' : 'transparent'
      )}
    >
      {/* Indicator dot */}
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
        background: referralItem.isEmergency ? '#f43f5e'
          : referralItem.isOverdue ? '#f43f5e'
          : isNew ? '#3b82f6' : 'transparent',
        boxShadow: referralItem.isEmergency
          ? '0 0 8px rgba(244,63,94,0.9)'
          : referralItem.isOverdue ? '0 0 6px rgba(244,63,94,0.7)' : 'none',
      }} />

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
          <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#f8fafc' }}>
            {referralItem.patient?.name || 'Unknown Patient'}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#22d3ee' }}>
            {referralItem.patient?.phid}
          </span>
          {/* Emergency badge — distinct from the risk chip */}
          {referralItem.isEmergency && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              fontSize: '0.7rem', fontWeight: '800', color: '#f43f5e',
              background: 'rgba(244,63,94,0.15)', padding: '0.12rem 0.5rem',
              borderRadius: '9999px', border: '1px solid rgba(244,63,94,0.5)',
            }}>
              <Siren size={9} /> EMERGENCY
            </span>
          )}
          {riskCfg && <Chip cfg={riskCfg}><Zap size={9} />{riskLabel(referralItem.riskLevel)}</Chip>}
          <Chip cfg={statusCfg}>{statusLabel(referralItem.status)}</Chip>
          {referralItem.isOverdue && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem',
              fontWeight: '700', color: '#fb7185', background: 'rgba(244,63,94,0.12)',
              padding: '0.12rem 0.45rem', borderRadius: '9999px', border: '1px solid rgba(244,63,94,0.35)',
            }}>
              <AlertTriangle size={9} /> {t('referral.overdue')}
            </span>
          )}
          {referralItem.escalatedAt && (
            <span style={{
              fontSize: '0.68rem', color: '#fbbf24',
              background: 'rgba(245,158,11,0.1)', padding: '0.1rem 0.4rem',
              borderRadius: '9999px', border: '1px solid rgba(245,158,11,0.25)',
            }}>
              escalated {timeSince(referralItem.escalatedAt)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          {tierCfg && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: tierCfg.color }}>
              <Hospital size={11} />
              {referralItem.fromFacility?.name}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                ({tierLabel(referralItem.fromFacility?.tier)})
              </span>
            </span>
          )}
          {referralItem.reason && (
            <span style={{
              color: 'var(--text-secondary)', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px',
            }}>
              · {referralItem.reason}
            </span>
          )}
        </div>
      </div>

      {/* Time since */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem',
        color: (referralItem.isEmergency || referralItem.isOverdue) ? '#fb7185' : 'var(--text-muted)',
        flexShrink: 0,
      }}>
        <Clock size={12} />
        {timeSince(referralItem.createdAt)}
      </div>

      {/* Quick-acknowledge */}
      {isNew && (
        <button
          type="button"
          disabled={isAcking}
          onClick={e => { e.stopPropagation(); onAcknowledge(referralItem._id); }}
          className="btn btn-sm"
          style={{
            flexShrink: 0, padding: '0.3rem 0.75rem', fontSize: '0.75rem',
            background: referralItem.isEmergency
              ? 'rgba(244,63,94,0.2)' : 'rgba(59,130,246,0.15)',
            border: referralItem.isEmergency
              ? '1px solid rgba(244,63,94,0.5)' : '1px solid rgba(59,130,246,0.4)',
            color: referralItem.isEmergency ? '#f87171' : '#93c5fd',
            borderRadius: '9999px',
            display: 'flex', alignItems: 'center', gap: '0.3rem',
          }}
        >
          {isAcking ? t('referral.acknowledging') : <><CheckCircle2 size={12} />{t('referral.acknowledge')}</>}
        </button>
      )}

      <ArrowRight size={15} color="#64748b" style={{ flexShrink: 0 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReferralInboxPage
// ---------------------------------------------------------------------------
export const ReferralInboxPage = ({ onOpenTimeline }) => {
  const { t }  = useTranslation();
  const { user }  = useAuthStore();
  const socket    = useSocket();

  const [referrals,    setReferrals]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [riskFilter,   setRiskFilter]   = useState('');
  const [ackLoading,   setAckLoading]   = useState({});

  // Step 19 — incoming emergency overlay queue (FIFO)
  // Each entry is the full referral:emergency socket payload.
  const [emergencyQueue, setEmergencyQueue] = useState([]);

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

  // ── Join facility socket room ──
  useEffect(() => {
    if (!socket || !facilityId) return;
    const fid = facilityId.toString();
    socket.emit('join:facility', { facilityId: fid });
    return () => socket.emit('leave:facility', { facilityId: fid });
  }, [socket, facilityId]);

  // ── referral:created — normal new referral ──
  useEffect(() => {
    if (!socket) return;
    const handler = (payload) => {
      if (statusFilter === 'closed') return;
      setReferrals(prev => {
        if (prev.some(r => r._id === payload.referralId)) return prev;
        const newItem = {
          _id:          payload.referralId,
          status:       'created',
          riskLevel:    payload.riskLevel,
          isOverdue:    false,
          overdueByMs:  0,
          isEmergency:  false,
          escalatedAt:  null,
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

  // ── referral:emergency — Step 19 ──
  useEffect(() => {
    if (!socket) return;
    const handler = (payload) => {
      // 1. Push to overlay queue — triggers full-screen alert
      setEmergencyQueue(prev => {
        // Avoid duplicate overlays for the same referral (e.g. rapid re-emit)
        if (prev.some(p => p.referralId === payload.referralId)) return prev;
        return [...prev, payload];
      });

      // 2. Upsert into the referral list so the pinned section shows it
      if (statusFilter !== 'closed') {
        setReferrals(prev => {
          const existing = prev.find(r => r._id === payload.referralId);
          if (existing) {
            // Escalation: update in place — keep status, mark emergency
            return prev.map(r =>
              r._id === payload.referralId
                ? { ...r, isEmergency: true, escalatedAt: payload.escalatedAt, riskLevel: 'emergency' }
                : r
            );
          }
          // New emergency referral declared from scratch
          return [{
            _id:          payload.referralId,
            status:       payload.status || 'created',
            riskLevel:    'emergency',
            isOverdue:    false,
            overdueByMs:  0,
            isEmergency:  true,
            escalatedAt:  payload.escalatedAt || null,
            createdAt:    payload.createdAt,
            patient:      { name: payload.patientName, phid: payload.patientPhid, _id: payload.patientId },
            fromFacility: payload.fromFacility,
            reason:       payload.reason,
          }, ...prev];
        });
      }
    };
    socket.on('referral:emergency', handler);
    return () => socket.off('referral:emergency', handler);
  }, [socket, statusFilter]);

  // ── referral:statusUpdated ──
  useEffect(() => {
    if (!socket) return;
    const handler = (payload) => {
      setReferrals(prev => {
        const updated = prev.map(r =>
          r._id === payload.referralId ? { ...r, status: payload.status } : r
        );
        if (payload.status === 'closed' && statusFilter === 'active') {
          return updated.filter(r => r._id !== payload.referralId);
        }
        return updated;
      });
    };
    socket.on('referral:statusUpdated', handler);
    return () => socket.off('referral:statusUpdated', handler);
  }, [socket, statusFilter]);

  // ── Acknowledge ──
  const handleAcknowledge = async (referralId) => {
    setAckLoading(prev => ({ ...prev, [referralId]: true }));
    try {
      await api.patch(`/referrals/${referralId}/status`, { status: 'acknowledged' });
      setReferrals(prev =>
        prev.map(r => r._id === referralId ? { ...r, status: 'acknowledged' } : r)
      );
    } catch (err) {
      console.error('[Inbox] Acknowledge failed:', err.message);
    } finally {
      setAckLoading(prev => ({ ...prev, [referralId]: false }));
    }
  };

  // ── Overlay acknowledge — dismisses overlay AND updates list ──
  const handleOverlayAcknowledge = (referralId) => {
    // Remove from queue
    setEmergencyQueue(prev => prev.filter(p => p.referralId !== referralId));
    // Update list optimistically
    setReferrals(prev =>
      prev.map(r => r._id === referralId ? { ...r, status: 'acknowledged' } : r)
    );
  };

  // ── i18n helpers ──
  const statusLabel = (s) => t(`enums.referralStatus.${s}`) || s;
  const riskLabel   = (r) => t(`enums.riskLevels.${r}`)     || r;
  const tierLabel   = (ti) => t(`enums.tiers.${ti}`)         || ti;

  // ── Split referrals into pinned emergency section + normal list ──
  const emergencyRefs = referrals.filter(r => r.isEmergency);
  const normalRefs    = referrals.filter(r => !r.isEmergency);

  const sharedRowProps = { onOpenTimeline, onAcknowledge: handleAcknowledge, ackLoading, t, statusLabel, riskLabel, tierLabel };

  return (
    <>
      {/* ── Step 19: Full-screen emergency overlay — shows one at a time ── */}
      {emergencyQueue.length > 0 && (
        <IncomingEmergencyOverlay
          alert={emergencyQueue[0]}
          onAcknowledge={handleOverlayAcknowledge}
          onOpenTimeline={onOpenTimeline}
        />
      )}

      <div className="main-content">
        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Inbox size={26} color="#14b8a6" />
              {t('referral.inboxTitle')}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {t('referral.inboxDesc', { facility: user?.facility?.name || 'your facility' })}
            </p>
          </div>
          <button onClick={fetchInbox} className="btn btn-outline btn-sm">
            <RotateCcw size={13} /> {t('common.refresh')}
          </button>
        </div>

        {/* ── Filter row ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <Filter size={14} color="#64748b" />
          {[
            { value: 'active', label: t('referral.active') },
            { value: 'closed', label: t('referral.closed') },
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

          {[
            { value: '',          label: 'All Risk Levels' },
            { value: 'emergency', label: `🚨 ${t('enums.riskLevels.emergency')}` },
            { value: 'urgent',    label: `⚠️ ${t('enums.riskLevels.urgent')}` },
            { value: 'routine',   label: `✅ ${t('enums.riskLevels.routine')}` },
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
            <div style={{ fontWeight: '700', color: '#f8fafc' }}>{t('common.loading')}</div>
          </div>
        ) : error ? (
          <div className="card" style={{ textAlign: 'center', padding: '2.5rem', border: '1px solid rgba(244,63,94,0.3)' }}>
            <AlertTriangle size={32} color="#f43f5e" style={{ margin: '0 auto 0.75rem auto' }} />
            <div style={{ fontWeight: '700', color: '#ffffff', marginBottom: '0.5rem' }}>Failed to load inbox</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{error}</div>
            <button onClick={fetchInbox} className="btn btn-primary btn-sm">{t('common.retry')}</button>
          </div>
        ) : referrals.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', border: '1px dashed var(--border-subtle)' }}>
            <CheckCircle2 size={38} color="#34d399" style={{ margin: '0 auto 0.75rem auto', opacity: 0.6 }} />
            <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '1.05rem' }}>{t('referral.inboxClear')}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              {t('referral.noPending')}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* ── Step 19: Pinned emergency section ── */}
            {emergencyRefs.length > 0 && (
              <div>
                {/* Section label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Siren size={14} color="#f43f5e" />
                  <span style={{
                    fontSize: '0.72rem', fontWeight: '800', color: '#f43f5e',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    Emergency — {emergencyRefs.length} active
                  </span>
                </div>

                <div
                  className="card"
                  style={{
                    padding: 0, overflow: 'hidden',
                    border: '1px solid rgba(244,63,94,0.4)',
                    boxShadow: '0 0 20px rgba(244,63,94,0.1)',
                  }}
                >
                  {emergencyRefs.map((ref, idx) => (
                    <ReferralRow
                      key={ref._id}
                      ref={ref}
                      isLast={idx === emergencyRefs.length - 1}
                      {...sharedRowProps}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Normal referral list ── */}
            {normalRefs.length > 0 && (
              <div>
                {/* Only show the label when there's also an emergency section above */}
                {emergencyRefs.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: '700', color: '#64748b',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      Other referrals
                    </span>
                  </div>
                )}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {normalRefs.map((ref, idx) => (
                    <ReferralRow
                      key={ref._id}
                      ref={ref}
                      isLast={idx === normalRefs.length - 1}
                      {...sharedRowProps}
                    />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </>
  );
};
