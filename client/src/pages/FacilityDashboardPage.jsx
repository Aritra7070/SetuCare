/**
 * SetuCare Step 14 — Facility Dashboard Page
 *
 * Answers "how is my facility doing right now" across three panels:
 *   A. Referral Backlog  — incoming unacknowledged/overdue/in-progress, outgoing open
 *   B. Follow-Up Status  — missed (by cohort) + due today
 *   C. Today's Activity  — encounters logged today (honest proxy, NOT a waiting-room count)
 *
 * Live updates via the facility:${facilityId} socket room (Step 10 room, reused here).
 * Listens for: referral:created, referral:statusUpdated, followup:missed,
 *              followup:due_today, encounter:created
 *
 * Access: medical_officer, specialist, admin only (enforced server-side too).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  RefreshCw,
  Stethoscope,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import api from '../api/axios';
import { useAuthStore } from '../stores/authStore';
import { useSocket } from '../hooks/useSocket';

// ── Tiny helper components ────────────────────────────────────────────────────

function StatCard({ icon: Icon, iconColor, label, value, sub, accent }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${accent || 'rgba(255,255,255,0.08)'}`,
        borderRadius: '12px',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icon size={16} color={iconColor || '#94a3b8'} />
        <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f8fafc', lineHeight: 1.1 }}>
        {value ?? '—'}
      </div>
      {sub && (
        <div style={{ fontSize: '11px', color: '#64748b' }}>{sub}</div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: `${color}22`,
          border: `1px solid ${color}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={16} color={color} />
      </div>
      <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#f1f5f9' }}>
        {title}
      </h2>
    </div>
  );
}

function CohortPill({ label, count, color }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        background: `${color}11`,
        border: `1px solid ${color}33`,
        borderRadius: '8px',
        padding: '8px 14px',
      }}
    >
      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>{label}</span>
      <span style={{ fontSize: '18px', fontWeight: '700', color }}>{count}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const FacilityDashboardPage = ({ onNavigateToInbox }) => {
  const { user }  = useAuthStore();
  const socket    = useSocket();

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const facilityId = user?.facility?._id || user?.facility;

  // ── Fetch snapshot ──────────────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/dashboard/facility');
      if (res.data.success) {
        setData(res.data);
        setLastRefresh(new Date());
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // ── Join facility socket room ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !facilityId) return;
    const fid = facilityId.toString();
    socket.emit('join:facility', { facilityId: fid });
    return () => socket.emit('leave:facility', { facilityId: fid });
  }, [socket, facilityId]);

  // ── Live: new referral → bump unacknowledged ───────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          referrals: {
            ...prev.referrals,
            incoming: {
              ...prev.referrals.incoming,
              unacknowledged: prev.referrals.incoming.unacknowledged + 1,
            },
          },
        };
      });
    };
    socket.on('referral:created', handler);
    return () => socket.off('referral:created', handler);
  }, [socket]);

  // ── Live: referral status change → adjust in-progress count ───────────────
  useEffect(() => {
    if (!socket) return;
    const handler = (payload) => {
      // When a 'created' referral moves to 'acknowledged'/'seen': −1 unacknowledged, +1 inProgress
      // When a referral moves to 'closed': −1 inProgress
      // Simplest correct approach: re-fetch so counts stay exactly in sync
      fetchDashboard();
    };
    socket.on('referral:statusUpdated', handler);
    return () => socket.off('referral:statusUpdated', handler);
  }, [socket, fetchDashboard]);

  // ── Live: follow-up flipped to missed ──────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handler = (payload) => {
      setData(prev => {
        if (!prev) return prev;
        const cohort = payload.cohortType;
        const byCohort = { ...prev.followUps.byCohort };
        if (cohort in byCohort) byCohort[cohort] = byCohort[cohort] + 1;
        return {
          ...prev,
          followUps: {
            ...prev.followUps,
            missedCount: prev.followUps.missedCount + 1,
            byCohort,
          },
        };
      });
    };
    socket.on('followup:missed', handler);
    return () => socket.off('followup:missed', handler);
  }, [socket]);

  // ── Live: follow-up due today ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          followUps: {
            ...prev.followUps,
            dueTodayCount: prev.followUps.dueTodayCount + 1,
          },
        };
      });
    };
    socket.on('followup:due_today', handler);
    return () => socket.off('followup:due_today', handler);
  }, [socket]);

  // ── Live: new encounter logged → bump today's count ────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          activity: {
            ...prev.activity,
            encountersToday: prev.activity.encountersToday + 1,
          },
        };
      });
    };
    socket.on('encounter:created', handler);
    return () => socket.off('encounter:created', handler);
  }, [socket]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const facilityName = user?.facility?.name || 'Your Facility';

  const containerStyle = {
    minHeight: '100vh',
    background: 'var(--bg-main)',
    padding: '28px 24px 48px',
    maxWidth: '960px',
    margin: '0 auto',
  };

  if (loading && !data) {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#94a3b8', marginTop: '60px', justifyContent: 'center' }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
          Loading dashboard…
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            marginTop: '60px',
            padding: '20px 24px',
            borderRadius: '12px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <XCircle size={18} />
          <span>{error}</span>
          <button
            onClick={fetchDashboard}
            style={{
              marginLeft: 'auto',
              padding: '5px 14px',
              borderRadius: '9999px',
              border: '1px solid rgba(239,68,68,0.4)',
              background: 'transparent',
              color: '#fca5a5',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'inherit',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { referrals, followUps, activity } = data || {};

  const hasOverdue     = referrals?.incoming?.overdue > 0;
  const hasMissed      = followUps?.missedCount > 0;

  return (
    <div style={containerStyle}>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1
            style={{
              margin: '0 0 4px',
              fontSize: '1.4rem',
              fontWeight: '700',
              color: '#f8fafc',
            }}
          >
            Facility Overview
          </h1>
          <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#22d3ee', fontWeight: '600' }}>{facilityName}</span>
            {lastRefresh && (
              <>
                <span>·</span>
                <span>Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={fetchDashboard}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 16px',
            borderRadius: '9999px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent',
            color: loading ? '#475569' : 'rgba(255,255,255,0.7)',
            cursor: loading ? 'default' : 'pointer',
            fontSize: '12px',
            fontFamily: 'inherit',
            transition: 'color 0.2s, border-color 0.2s',
          }}
        >
          <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      {/* ── Alert banners ── */}
      {hasOverdue && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px 16px',
            borderRadius: '10px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: '500',
          }}
        >
          <AlertTriangle size={15} color="#f87171" />
          {referrals.incoming.overdue} incoming referral{referrals.incoming.overdue > 1 ? 's have' : ' has'} breached SLA — action needed
        </div>
      )}
      {hasMissed && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px 16px',
            borderRadius: '10px',
            background: 'rgba(234,179,8,0.08)',
            border: '1px solid rgba(234,179,8,0.25)',
            color: '#fde68a',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: '500',
          }}
        >
          <AlertTriangle size={15} color="#fbbf24" />
          {followUps.missedCount} missed follow-up{followUps.missedCount > 1 ? 's' : ''} across this facility
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ── Panel A: Referral Backlog ── */}
        <section
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px',
            padding: '20px 22px',
          }}
        >
          <SectionHeader icon={ClipboardList} title="Referral Backlog" color="#38bdf8" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <StatCard
              icon={ArrowDownLeft}
              iconColor={referrals?.incoming?.unacknowledged > 0 ? '#f87171' : '#38bdf8'}
              label="Unacknowledged"
              value={referrals?.incoming?.unacknowledged}
              sub="Incoming, not yet acknowledged"
              accent={referrals?.incoming?.unacknowledged > 0 ? 'rgba(239,68,68,0.25)' : undefined}
            />
            <StatCard
              icon={AlertTriangle}
              iconColor={referrals?.incoming?.overdue > 0 ? '#f87171' : '#64748b'}
              label="Overdue"
              value={referrals?.incoming?.overdue}
              sub="Breached SLA threshold"
              accent={referrals?.incoming?.overdue > 0 ? 'rgba(239,68,68,0.25)' : undefined}
            />
            <StatCard
              icon={Clock}
              iconColor="#a78bfa"
              label="In Progress"
              value={referrals?.incoming?.inProgress}
              sub="Acknowledged or seen"
            />
            <StatCard
              icon={ArrowUpRight}
              iconColor="#34d399"
              label="Outgoing Open"
              value={referrals?.outgoing?.open}
              sub="Sent, not yet closed"
            />
          </div>

          {/* Click-through to inbox */}
          {onNavigateToInbox && (
            <button
              onClick={onNavigateToInbox}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                borderRadius: '9999px',
                border: '1px solid rgba(56,189,248,0.3)',
                background: 'rgba(56,189,248,0.06)',
                color: '#38bdf8',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                fontFamily: 'inherit',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.06)'; }}
            >
              <ClipboardList size={13} />
              Open Referral Inbox →
            </button>
          )}
        </section>

        {/* ── Panel B: Follow-Up Status ── */}
        <section
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px',
            padding: '20px 22px',
          }}
        >
          <SectionHeader icon={CalendarClock} title="Follow-Up Status" color="#fb923c" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <StatCard
              icon={XCircle}
              iconColor={followUps?.missedCount > 0 ? '#f87171' : '#64748b'}
              label="Missed"
              value={followUps?.missedCount}
              sub="Across all workers at this facility"
              accent={followUps?.missedCount > 0 ? 'rgba(239,68,68,0.25)' : undefined}
            />
            <StatCard
              icon={CalendarClock}
              iconColor={followUps?.dueTodayCount > 0 ? '#fbbf24' : '#64748b'}
              label="Due Today"
              value={followUps?.dueTodayCount}
              sub="Pending, due date is today"
              accent={followUps?.dueTodayCount > 0 ? 'rgba(234,179,8,0.2)' : undefined}
            />
          </div>

          {/* Cohort breakdown of missed */}
          <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              Missed by cohort
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <CohortPill label="Maternal" count={followUps?.byCohort?.maternal ?? 0} color="#f472b6" />
              <CohortPill label="Child"    count={followUps?.byCohort?.child    ?? 0} color="#60a5fa" />
              <CohortPill label="Chronic"  count={followUps?.byCohort?.chronic  ?? 0} color="#a78bfa" />
            </div>
            {/* Sanity note: cohort breakdown should add up to missedCount */}
            {followUps && (
              (() => {
                const cohortSum = (followUps.byCohort?.maternal ?? 0)
                  + (followUps.byCohort?.child ?? 0)
                  + (followUps.byCohort?.chronic ?? 0);
                return cohortSum !== followUps.missedCount ? (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#475569' }}>
                    Note: breakdown total ({cohortSum}) differs from missed count ({followUps.missedCount}) — some follow-ups may lack a cohort type.
                  </div>
                ) : null;
              })()
            )}
          </div>
        </section>

        {/* ── Panel C: Today's Activity ── */}
        <section
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px',
            padding: '20px 22px',
          }}
        >
          <SectionHeader icon={Stethoscope} title="Today's Activity" color="#34d399" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            <StatCard
              icon={Users}
              iconColor="#34d399"
              label="Encounters Today"
              value={activity?.encountersToday}
              sub="Clinical encounters logged at this facility today"
              accent="rgba(52,211,153,0.15)"
            />
          </div>

          {/* Honest scope note */}
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              fontSize: '11px',
              color: '#475569',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: '#64748b' }}>Note:</strong> This count reflects clinical encounters recorded in SetuCare — it is a proxy for patient activity, not a live waiting-room or appointment queue. Queue management is out of scope for this system.
          </div>
        </section>

      </div>

      {/* Spin keyframe (injected inline for portability) */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default FacilityDashboardPage;
