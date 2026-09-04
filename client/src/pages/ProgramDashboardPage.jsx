/**
 * SetuCare Step 16 — Program Manager Rollup Dashboard
 *
 * District-level view: headline KPIs (completion rate, time-to-close, missed
 * follow-up rate) + facility comparison table sorted worst-first.
 *
 * NOT live — refresh-on-load + manual refresh button only (PRD §5).
 * Access: program_manager, admin.
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import {
  BarChart2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Package,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Colour-coding helpers (reuses existing palette from Step 7/10/13)
// ---------------------------------------------------------------------------
function rateColor(rate, higherIsBetter = true) {
  if (rate === null || rate === undefined) return { color: '#64748b', bg: 'transparent', border: 'transparent' };
  const good = higherIsBetter ? rate >= 70 : rate <= 20;
  const warn = higherIsBetter ? rate >= 40 : rate <= 50;
  if (good) return { color: '#34d399', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)' };
  if (warn) return { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)' };
  return     { color: '#fb7185', bg: 'rgba(244,63,94,0.12)',   border: 'rgba(244,63,94,0.3)'  };
}

function RateBadge({ value, suffix = '%', higherIsBetter = true }) {
  if (value === null || value === undefined) {
    return <span style={{ color: '#475569', fontSize: '0.82rem' }}>—</span>;
  }
  const c = rateColor(value, higherIsBetter);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: '700', background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {value}{suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({ icon: Icon, iconColor, label, value, suffix = '', sub, accent }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${accent || 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icon size={15} color={iconColor || '#94a3b8'} />
        <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.9rem', fontWeight: '700', color: '#f8fafc', lineHeight: 1.1 }}>
        {value !== null && value !== undefined ? `${value}${suffix}` : '—'}
      </div>
      {sub && <div style={{ fontSize: '11px', color: '#64748b' }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier badge
// ---------------------------------------------------------------------------
const TIER_COLORS = {
  sub_centre:        { color: '#34d399', bg: 'rgba(16,185,129,0.12)' },
  phc:               { color: '#22d3ee', bg: 'rgba(6,182,212,0.12)'  },
  rural_hospital:    { color: '#c4b5fd', bg: 'rgba(139,92,246,0.12)' },
  district_hospital: { color: '#fb7185', bg: 'rgba(244,63,94,0.12)'  },
};
const TIER_LABELS = {
  sub_centre:        'Sub-Centre',
  phc:               'PHC',
  rural_hospital:    'Rural Hospital',
  district_hospital: 'District Hospital',
};
function TierBadge({ tier }) {
  const c = TIER_COLORS[tier] || { color: '#94a3b8', bg: 'transparent' };
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', padding: '0.1rem 0.4rem', borderRadius: '4px', background: c.bg, color: c.color }}>
      {TIER_LABELS[tier] || tier}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export const ProgramDashboardPage = () => {
  const [window,    setWindow]    = useState('30d');
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  // Sort state for the facility table
  const [sortKey,   setSortKey]   = useState('completionRate');
  const [sortAsc,   setSortAsc]   = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/dashboard/program?window=${window}`);
      if (res.data.success) {
        setData(res.data);
        setLastRefresh(new Date());
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // ── Sort facilities ──
  const sortedFacilities = data?.facilities ? [...data.facilities].sort((a, b) => {
    const av = a[sortKey] ?? (sortAsc ? Infinity : -Infinity);
    const bv = b[sortKey] ?? (sortAsc ? Infinity : -Infinity);
    return sortAsc ? av - bv : bv - av;
  }) : [];

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span style={{ opacity: 0.3, fontSize: '0.65rem' }}>↕</span>;
    return sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  // ── Loading ──
  if (loading && !data) {
    return (
      <div className="main-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8', marginTop: '80px', justifyContent: 'center' }}>
          <RefreshCw size={17} style={{ animation: 'spin 1s linear infinite' }} />
          Loading district dashboard…
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
      </div>
    );
  }

  // ── Error ──
  if (error && !data) {
    return (
      <div className="main-content">
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', border: '1px solid rgba(244,63,94,0.3)' }}>
          <AlertTriangle size={32} color="#f43f5e" style={{ margin: '0 auto 0.75rem auto' }} />
          <div style={{ color: '#f8fafc', marginBottom: '1rem' }}>{error}</div>
          <button onClick={fetchDashboard} className="btn btn-primary btn-sm">Retry</button>
        </div>
      </div>
    );
  }

  const { summary } = data || {};

  return (
    <div className="main-content">
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <BarChart2 size={26} color="#14b8a6" />
            District Quality Overview
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem', fontSize: '0.875rem' }}>
            Maharashtra Stepped-Care Network — program manager view
            {lastRefresh && <span style={{ color: '#475569' }}> · Last refreshed {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* Window selector */}
          <div style={{ display: 'flex', background: '#0C0C0C', borderRadius: '9999px', padding: '3px 4px', gap: '2px' }}>
            {['7d', '30d', '90d'].map(w => (
              <button
                key={w}
                type="button"
                onClick={() => setWindow(w)}
                style={{
                  padding: '4px 14px', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: '600',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: window === w ? 'rgba(20,184,166,0.2)' : 'transparent',
                  color:      window === w ? '#5eead4' : 'rgba(255,255,255,0.6)',
                  transition: 'all 0.15s',
                }}
              >
                {w}
              </button>
            ))}
          </div>

          <button
            onClick={fetchDashboard}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: loading ? '#475569' : 'rgba(255,255,255,0.7)', cursor: loading ? 'default' : 'pointer', fontSize: '12px', fontFamily: 'inherit' }}
          >
            <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Headline KPI cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
        <KpiCard
          icon={CheckCircle2} iconColor="#34d399"
          label="Completion Rate"
          value={summary?.completionRate} suffix="%"
          sub={`${summary?.closedReferrals ?? 0}/${summary?.totalReferrals ?? 0} referrals closed`}
          accent={summary?.completionRate !== null ? rateColor(summary.completionRate).border : undefined}
        />
        <KpiCard
          icon={Clock} iconColor="#a78bfa"
          label="Median Time-to-Close"
          value={summary?.medianTimeToCloseHours} suffix=" h"
          sub={summary?.meanTimeToCloseHours != null ? `Mean: ${summary.meanTimeToCloseHours} h` : 'Based on closed referrals'}
        />
        <KpiCard
          icon={XCircle} iconColor={summary?.missedRate > 30 ? '#fb7185' : '#fbbf24'}
          label="Missed Follow-Up Rate"
          value={summary?.missedRate} suffix="%"
          sub={`${summary?.missedFollowUps ?? 0} missed of ${summary?.totalFollowUpsDue ?? 0} due`}
          accent={summary?.missedRate != null && summary.missedRate > 30 ? 'rgba(244,63,94,0.25)' : undefined}
        />
        <KpiCard
          icon={Package} iconColor="#22d3ee"
          label="Total Referrals"
          value={summary?.totalReferrals}
          sub={`Last ${data?.windowDays ?? 30} days`}
        />
      </div>

      {/* Missed by cohort strip */}
      {summary?.missedByCohort && (
        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0, padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
          {[
            { label: 'Maternal Missed', count: summary.missedByCohort.maternal, color: '#f9a8d4' },
            { label: 'Child Missed',    count: summary.missedByCohort.child,    color: '#93c5fd' },
            { label: 'Chronic Missed',  count: summary.missedByCohort.chronic,  color: '#c4b5fd' },
          ].map((c, i) => (
            <div key={c.label} style={{ padding: '0.85rem 1.25rem', borderRight: i < 2 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: '700', color: c.color }}>{c.count}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Facility comparison table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart2 size={16} color="#14b8a6" />
          <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#f8fafc' }}>Facility Comparison</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>sorted worst-first by default · click header to re-sort</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                {[
                  { label: 'Facility',          key: 'name',               sortable: false },
                  { label: 'Tier',              key: 'tier',               sortable: false },
                  { label: 'Referrals',         key: 'totalReferrals',     sortable: true  },
                  { label: 'Completion Rate',   key: 'completionRate',     sortable: true  },
                  { label: 'Median Close',      key: 'medianTimeToCloseHours', sortable: true },
                  { label: 'Missed FU Rate',    key: 'missedFollowUpRate', sortable: true  },
                  { label: 'Stock Alerts',      key: 'stockAlertsCount',   sortable: true  },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                    style={{
                      padding: '0.6rem 1rem', textAlign: 'left',
                      color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.72rem',
                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                      cursor: col.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                    onMouseEnter={e => { if (col.sortable) e.currentTarget.style.color = '#f8fafc'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {col.label}
                      {col.sortable && <SortIcon col={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedFacilities.map((f, idx) => {
                const compColor  = rateColor(f.completionRate,     true);
                const missColor  = rateColor(f.missedFollowUpRate, false);
                const hasAlerts  = f.stockAlertsCount > 0;

                return (
                  <tr
                    key={f.facilityId}
                    style={{
                      borderBottom: idx < sortedFacilities.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Facility name */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: '600', color: '#f8fafc' }}>{f.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{f.district}</div>
                    </td>

                    {/* Tier */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <TierBadge tier={f.tier} />
                    </td>

                    {/* Total referrals */}
                    <td style={{ padding: '0.75rem 1rem', color: f.totalReferrals > 0 ? '#f8fafc' : '#475569', fontWeight: '600' }}>
                      {f.totalReferrals}
                    </td>

                    {/* Completion rate — colour-coded */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <RateBadge value={f.completionRate} higherIsBetter={true} />
                    </td>

                    {/* Median time-to-close */}
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                      {f.medianTimeToCloseHours !== null ? `${f.medianTimeToCloseHours} h` : '—'}
                    </td>

                    {/* Missed follow-up rate — colour-coded (lower is better) */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <RateBadge value={f.missedFollowUpRate} higherIsBetter={false} />
                    </td>

                    {/* Stock alerts */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {hasAlerts ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.15rem 0.45rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700', background: 'rgba(244,63,94,0.12)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.3)' }}>
                          <AlertTriangle size={11} /> {f.stockAlertsCount}
                        </span>
                      ) : (
                        <span style={{ color: '#34d399', fontSize: '0.78rem', fontWeight: '600' }}>✓</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {sortedFacilities.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No facility data available for this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scaling note */}
      <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: '#475569', lineHeight: 1.5 }}>
        <strong style={{ color: '#64748b' }}>Note:</strong> KPIs are computed on-demand from live data. At multi-district scale, pre-computed daily rollups would replace this live aggregation.
        This dashboard does not update in real time — use the Refresh button.
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );
};
