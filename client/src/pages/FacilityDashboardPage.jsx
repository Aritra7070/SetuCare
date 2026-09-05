/**
 * SetuCare Step 14 — Facility Dashboard Page (Step 18: i18n)
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
          width: '32px', height: '32px', borderRadius: '8px',
          background: `${color}22`, border: `1px solid ${color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        background: `${color}11`, border: `1px solid ${color}33`,
        borderRadius: '8px', padding: '8px 14px',
      }}
    >
      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>{label}</span>
      <span style={{ fontSize: '18px', fontWeight: '700', color }}>{count}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const FacilityDashboardPage = ({ onNavigateToInbox }) => {
  const { t }    = useTranslation();
  const { user } = useAuthStore();
  const socket   = useSocket();

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const facilityId = user?.facility?._id || user?.facility;

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

  useEffect(() => {
    if (!socket || !facilityId) return;
    const fid = facilityId.toString();
    socket.emit('join:facility', { facilityId: fid });
    return () => socket.emit('leave:facility', { facilityId: fid });
  }, [socket, facilityId]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      setData(prev => {
        if (!prev) return prev;
        return { ...prev, referrals: { ...prev.referrals, incoming: { ...prev.referrals.incoming, unacknowledged: prev.referrals.incoming.unacknowledged + 1 } } };
      });
    };
    socket.on('referral:created', handler);
    return () => socket.off('referral:created', handler);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => { fetchDashboard(); };
    socket.on('referral:statusUpdated', handler);
    return () => socket.off('referral:statusUpdated', handler);
  }, [socket, fetchDashboard]);

  useEffect(() => {
    if (!socket) return;
    const handler = (payload) => {
      setData(prev => {
        if (!prev) return prev;
        const cohort = payload.cohortType;
        const byCohort = { ...prev.followUps.byCohort };
        if (cohort in byCohort) byCohort[cohort] = byCohort[cohort] + 1;
        return { ...prev, followUps: { ...prev.followUps, missedCount: prev.followUps.missedCount + 1, byCohort } };
      });
    };
    socket.on('followup:missed', handler);
    return () => socket.off('followup:missed', handler);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      setData(prev => {
        if (!prev) return prev;
        return { ...prev, followUps: { ...prev.followUps, dueTodayCount: prev.followUps.dueTodayCount + 1 } };
      });
    };
    socket.on('followup:due_today', handler);
    return () => socket.off('followup:due_today', handler);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      setData(prev => {
        if (!prev) return prev;
        return { ...prev, activity: { ...prev.activity, encountersToday: prev.activity.encountersToday + 1 } };
      });
    };
    socket.on('encounter:created', handler);
    return () => socket.off('encounter:created', handler);
  }, [socket]);

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
          {t('dashboard.loading')}
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={containerStyle}>
        <div style={{ marginTop: '60px', padding: '20px 24px', borderRadius: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <XCircle size={18} />
          <span>{error}</span>
          <button
            onClick={fetchDashboard}
            style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: '9999px', border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}
          >
            {t('common.retry')}
          </button>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const { referrals, followUps, activity } = data || {};
  const hasOverdue = referrals?.incoming?.overdue > 0;
  const hasMissed  = followUps?.missedCount > 0;

  return (
    <div style={containerStyle}>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.4rem', fontWeight: '700', color: '#f8fafc' }}>
            {t('dashboard.facilityTitle')}
          </h1>
          <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#22d3ee', fontWeight: '600' }}>{facilityName}</span>
            {lastRefresh && (
              <>
                <span>·</span>
                <span>{t('dashboard.updatedAt', { time: lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}</span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={fetchDashboard}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: loading ? '#475569' : 'rgba(255,255,255,0.7)', cursor: loading ? 'default' : 'pointer', fontSize: '12px', fontFamily: 'inherit', transition: 'color 0.2s, border-color 0.2s' }}
        >
          <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          {t('dashboard.refresh')}
        </button>
      </div>

      {/* ── Alert banners ── */}
      {hasOverdue && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}>
          <AlertTriangle size={15} color="#f87171" />
          {referrals.incoming.overdue === 1
            ? t('dashboard.overdueAlert', { count: referrals.incoming.overdue })
            : t('dashboard.overdueAlert_plural', { count: referrals.incoming.overdue })}
        </div>
      )}
      {hasMissed && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '10px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', color: '#fde68a', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500' }}>
          <AlertTriangle size={15} color="#fbbf24" />
          {followUps.missedCount === 1
            ? t('dashboard.missedAlert', { count: followUps.missedCount })
            : t('dashboard.missedAlert_plural', { count: followUps.missedCount })}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ── Panel A: Referral Backlog ── */}
        <section style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px 22px' }}>
          <SectionHeader icon={ClipboardList} title={t('dashboard.referralBacklog')} color="#38bdf8" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <StatCard
              icon={ArrowDownLeft}
              iconColor={referrals?.incoming?.unacknowledged > 0 ? '#f87171' : '#38bdf8'}
              label={t('dashboard.unacknowledged')}
              value={referrals?.incoming?.unacknowledged}
              sub={t('dashboard.incomingNotAcked')}
              accent={referrals?.incoming?.unacknowledged > 0 ? 'rgba(239,68,68,0.25)' : undefined}
            />
            <StatCard
              icon={AlertTriangle}
              iconColor={referrals?.incoming?.overdue > 0 ? '#f87171' : '#64748b'}
              label={t('dashboard.overdue')}
              value={referrals?.incoming?.overdue}
              sub={t('dashboard.breachedSla')}
              accent={referrals?.incoming?.overdue > 0 ? 'rgba(239,68,68,0.25)' : undefined}
            />
            <StatCard
              icon={Clock}
              iconColor="#a78bfa"
              label={t('dashboard.inProgress')}
              value={referrals?.incoming?.inProgress}
              sub={t('dashboard.ackedOrSeen')}
            />
            <StatCard
              icon={ArrowUpRight}
              iconColor="#34d399"
              label={t('dashboard.outgoingOpen')}
              value={referrals?.outgoing?.open}
              sub={t('dashboard.outgoingNotClosed')}
            />
          </div>

          {onNavigateToInbox && (
            <button
              onClick={onNavigateToInbox}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '9999px', border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.06)', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit', transition: 'background 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.06)'; }}
            >
              <ClipboardList size={13} />
              {t('dashboard.openReferralInbox')}
            </button>
          )}
        </section>

        {/* ── Panel B: Follow-Up Status ── */}
        <section style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px 22px' }}>
          <SectionHeader icon={CalendarClock} title={t('dashboard.followUpStatus')} color="#fb923c" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <StatCard
              icon={XCircle}
              iconColor={followUps?.missedCount > 0 ? '#f87171' : '#64748b'}
              label={t('dashboard.missed')}
              value={followUps?.missedCount}
              sub={t('dashboard.acrossAllWorkers')}
              accent={followUps?.missedCount > 0 ? 'rgba(239,68,68,0.25)' : undefined}
            />
            <StatCard
              icon={CalendarClock}
              iconColor={followUps?.dueTodayCount > 0 ? '#fbbf24' : '#64748b'}
              label={t('dashboard.dueToday')}
              value={followUps?.dueTodayCount}
              sub={t('dashboard.pendingDueToday')}
              accent={followUps?.dueTodayCount > 0 ? 'rgba(234,179,8,0.2)' : undefined}
            />
          </div>

          {/* Cohort breakdown */}
          <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              {t('dashboard.missedByCohort')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <CohortPill label={t('enums.cohortTypes.maternal')} count={followUps?.byCohort?.maternal ?? 0} color="#f472b6" />
              <CohortPill label={t('enums.cohortTypes.child')}    count={followUps?.byCohort?.child    ?? 0} color="#60a5fa" />
              <CohortPill label={t('enums.cohortTypes.chronic')}  count={followUps?.byCohort?.chronic  ?? 0} color="#a78bfa" />
            </div>
            {followUps && (() => {
              const cohortSum = (followUps.byCohort?.maternal ?? 0) + (followUps.byCohort?.child ?? 0) + (followUps.byCohort?.chronic ?? 0);
              return cohortSum !== followUps.missedCount ? (
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#475569' }}>
                  {t('dashboard.cohortBreakdownMismatch', { sum: cohortSum, total: followUps.missedCount })}
                </div>
              ) : null;
            })()}
          </div>
        </section>

        {/* ── Panel C: Today's Activity ── */}
        <section style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px 22px' }}>
          <SectionHeader icon={Stethoscope} title={t('dashboard.todayActivity')} color="#34d399" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            <StatCard
              icon={Users}
              iconColor="#34d399"
              label={t('dashboard.encountersToday')}
              value={activity?.encountersToday}
              sub={t('dashboard.encountersTodayDesc')}
              accent="rgba(52,211,153,0.15)"
            />
          </div>

          <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: '#475569', lineHeight: 1.5 }}>
            <strong style={{ color: '#64748b' }}>{t('common.note')}:</strong> {t('dashboard.proxyNote')}
          </div>
        </section>

      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default FacilityDashboardPage;
