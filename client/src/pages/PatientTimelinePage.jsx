import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../stores/authStore';
import { EncounterCreateModal } from '../components/EncounterCreateModal';
import { SYMPTOM_LABEL_MAP } from '../utils/symptomVocabulary';
import {
  ArrowLeft,
  User,
  Hospital,
  Calendar,
  Phone,
  MapPin,
  Stethoscope,
  Activity,
  Clock,
  Globe,
  Shield,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
  QrCode,
  Users,
  Layers,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Tier colour scheme — matches Step 2's facility hierarchy palette exactly.
// These are the colours that make cross-facility legible at a glance.
// ---------------------------------------------------------------------------
const TIER_CONFIG = {
  sub_centre: {
    label: 'Sub-Centre',
    bg: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.35)',
    color: '#34d399',
    dot: '#10b981',
    cardAccent: 'rgba(16, 185, 129, 0.08)',
    cardBorder: 'rgba(16, 185, 129, 0.25)',
  },
  phc: {
    label: 'PHC',
    bg: 'rgba(6, 182, 212, 0.15)',
    border: 'rgba(6, 182, 212, 0.35)',
    color: '#22d3ee',
    dot: '#06b6d4',
    cardAccent: 'rgba(6, 182, 212, 0.08)',
    cardBorder: 'rgba(6, 182, 212, 0.25)',
  },
  rural_hospital: {
    label: 'Rural Hospital',
    bg: 'rgba(139, 92, 246, 0.15)',
    border: 'rgba(139, 92, 246, 0.35)',
    color: '#c4b5fd',
    dot: '#8b5cf6',
    cardAccent: 'rgba(139, 92, 246, 0.08)',
    cardBorder: 'rgba(139, 92, 246, 0.25)',
  },
  district_hospital: {
    label: 'District Hospital',
    bg: 'rgba(244, 63, 94, 0.15)',
    border: 'rgba(244, 63, 94, 0.35)',
    color: '#fb7185',
    dot: '#f43f5e',
    cardAccent: 'rgba(244, 63, 94, 0.08)',
    cardBorder: 'rgba(244, 63, 94, 0.25)',
  },
};

const ENCOUNTER_TYPE_CONFIG = {
  walk_in:          { label: 'Routine Walk-In',    bg: 'rgba(16,185,129,0.15)',  color: '#34d399', border: 'rgba(16,185,129,0.3)' },
  follow_up:        { label: 'Follow-Up Check',    bg: 'rgba(59,130,246,0.15)',  color: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
  referral_consult: { label: 'Referral Consult',   bg: 'rgba(244,63,94,0.15)',   color: '#fb7185', border: 'rgba(244,63,94,0.3)' },
};

const TRIAGE_CONFIG = {
  routine:   { label: 'Routine',   bg: 'rgba(16,185,129,0.15)',  color: '#34d399', border: 'rgba(16,185,129,0.35)' },
  urgent:    { label: 'Urgent',    bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24', border: 'rgba(245,158,11,0.35)' },
  emergency: { label: 'Emergency', bg: 'rgba(244,63,94,0.18)',   color: '#fb7185', border: 'rgba(244,63,94,0.4)' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function tierConfig(tier) {
  return TIER_CONFIG[tier] || {
    label: tier || 'Facility',
    bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.3)',
    color: '#94a3b8', dot: '#64748b',
    cardAccent: 'rgba(100,116,139,0.06)', cardBorder: 'rgba(100,116,139,0.2)',
  };
}

// ---------------------------------------------------------------------------
// EncounterCard — extension point for Step 8/9 referral chip is marked below
// ---------------------------------------------------------------------------
function EncounterCard({ enc }) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const tier = tierConfig(enc.facility?.tier);
  const typeCfg = ENCOUNTER_TYPE_CONFIG[enc.encounterType] || ENCOUNTER_TYPE_CONFIG.walk_in;

  const hasVitals =
    enc.vitals?.bp?.systolic || enc.vitals?.bp?.diastolic ||
    enc.vitals?.tempC != null || enc.vitals?.pulse != null ||
    enc.vitals?.spo2 != null || enc.vitals?.weightKg != null;

  return (
    <div
      style={{
        background: tier.cardAccent,
        border: `1px solid ${tier.cardBorder}`,
        borderLeft: `3px solid ${tier.dot}`,
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      {/* ── Card header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Tier badge — the primary visual differentiator for cross-facility */}
          <span
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.72rem', fontWeight: '800',
              background: tier.bg, color: tier.color, border: `1px solid ${tier.border}`,
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}
          >
            {tier.label}
          </span>

          {/* Encounter type badge */}
          <span
            style={{
              padding: '0.2rem 0.55rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.72rem', fontWeight: '700',
              background: typeCfg.bg, color: typeCfg.color, border: `1px solid ${typeCfg.border}`,
            }}
          >
            {typeCfg.label}
          </span>

          {/* ── EXTENSION POINT (Step 8/9): referral status chip slots in here ──
              When Step 8 ships, add:
              {enc.referral && <ReferralStatusChip referral={enc.referral} />}
              No structural change to this card needed.
          ── */}

          {/* Triage badge — only rendered when triageResult is populated (Step 7) */}
          {enc.triageResult?.riskLevel && (() => {
            const tc = TRIAGE_CONFIG[enc.triageResult.riskLevel] || TRIAGE_CONFIG.routine;
            return (
              <span
                style={{
                  padding: '0.2rem 0.55rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.72rem', fontWeight: '700',
                  background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                }}
              >
                <Zap size={10} />
                {tc.label} Risk
              </span>
            );
          })()}

          <span style={{ fontWeight: '700', fontSize: '0.875rem', color: '#f8fafc' }}>
            {enc.facility?.name || 'Health Facility'}
          </span>
          {enc.facility?.shortCode && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#22d3ee' }}>
              [{enc.facility.shortCode}]
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <Clock size={13} />
          {formatDateTime(enc.createdAt)}
        </div>
      </div>

      {/* ── Attending clinician ── */}
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Attending:{' '}
        <strong style={{ color: '#e2e8f0' }}>{enc.worker?.name || 'Clinician'}</strong>{' '}
        <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>
          ({enc.worker?.role?.replace(/_/g, ' ') || 'Staff'})
        </span>
      </div>

      {/* ── Vitals — compact one-line ── */}
      {hasVitals && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {(enc.vitals.bp?.systolic || enc.vitals.bp?.diastolic) && (
            <VitalPill
              label="BP"
              value={`${enc.vitals.bp.systolic ?? '?'}/${enc.vitals.bp.diastolic ?? '?'} mmHg`}
              alert={enc.vitals.bp.systolic > 180}
              color="blue"
            />
          )}
          {enc.vitals.tempC != null && (
            <VitalPill
              label="Temp"
              value={`${enc.vitals.tempC}°C`}
              alert={enc.vitals.tempC >= 38}
              color={enc.vitals.tempC >= 38 ? 'rose' : 'neutral'}
            />
          )}
          {enc.vitals.pulse != null && (
            <VitalPill label="Pulse" value={`${enc.vitals.pulse} bpm`} color="neutral" />
          )}
          {enc.vitals.spo2 != null && (
            <VitalPill
              label="SpO₂"
              value={`${enc.vitals.spo2}%${enc.vitals.spo2 < 92 ? ' ⚠' : ''}`}
              alert={enc.vitals.spo2 < 92}
              color={enc.vitals.spo2 < 92 ? 'rose' : 'green'}
            />
          )}
          {enc.vitals.weightKg != null && (
            <VitalPill label="Weight" value={`${enc.vitals.weightKg} kg`} color="neutral" />
          )}
        </div>
      )}

      {/* ── Symptom chips — IDs resolved to English labels ── */}
      {enc.symptoms?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {enc.symptoms.map((s, i) => (
            <span
              key={i}
              style={{
                background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(20,184,166,0.25)',
                padding: '0.18rem 0.48rem', borderRadius: '4px',
                fontSize: '0.74rem', color: '#5eead4',
              }}
            >
              · {SYMPTOM_LABEL_MAP[s] || s}
            </span>
          ))}
        </div>
      )}

      {/* Other symptoms free-text */}
      {enc.otherSymptoms && (
        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
          Other: {enc.otherSymptoms}
        </div>
      )}

      {/* ── Clinical notes (truncate, expand on click) ── */}
      {enc.notes && (
        <div>
          <div
            style={{
              background: 'rgba(11,17,32,0.8)',
              padding: '0.6rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.825rem', color: '#cbd5e1',
              borderLeft: `3px solid ${tier.dot}`,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: notesExpanded ? 'unset' : 2,
              WebkitBoxOrient: 'vertical',
              whiteSpace: notesExpanded ? 'pre-wrap' : 'normal',
            }}
          >
            {enc.notes}
          </div>
          {enc.notes.length > 120 && (
            <button
              type="button"
              onClick={() => setNotesExpanded((p) => !p)}
              style={{
                background: 'none', border: 'none', padding: '0.2rem 0',
                fontSize: '0.75rem', color: '#64748b', display: 'flex',
                alignItems: 'center', gap: '0.25rem', marginTop: '2px',
              }}
            >
              {notesExpanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
            </button>
          )}
        </div>
      )}

      {/* ── Triage routing suggestion (Step 7, conditional) ── */}
      {enc.triageResult?.suggestedRouting && (
        <div
          style={{
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
            padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem', color: '#fbbf24',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          <Zap size={13} />
          <span>Triage routing: {enc.triageResult.suggestedRouting}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VitalPill helper
// ---------------------------------------------------------------------------
const VITAL_COLOURS = {
  blue:    { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)',  text: '#93c5fd' },
  green:   { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  text: '#6ee7b7' },
  rose:    { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',    text: '#fca5a5' },
  neutral: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', text: '#e2e8f0' },
};

function VitalPill({ label, value, color = 'neutral' }) {
  const c = VITAL_COLOURS[color] || VITAL_COLOURS.neutral;
  return (
    <span
      style={{
        background: c.bg, border: `1px solid ${c.border}`,
        padding: '0.22rem 0.55rem', borderRadius: '6px',
        fontSize: '0.78rem', color: c.text,
      }}
    >
      {label}: <strong>{value}</strong>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export const PatientTimelinePage = ({ phid, onBack, onNavigateToScan }) => {
  const { user } = useAuthStore();

  const [data, setData]           = useState(null);   // { patient, encounters, summary, age }
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [encounterModalOpen, setEncounterModalOpen] = useState(false);

  const fetchTimeline = useCallback(async () => {
    if (!phid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/patients/${encodeURIComponent(phid)}/timeline`);
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load patient timeline');
    } finally {
      setLoading(false);
    }
  }, [phid]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const handleEncounterCreated = (encounter, action) => {
    setEncounterModalOpen(false);
    fetchTimeline(); // refresh timeline to show the new card
    if (action === 'triage') {
      alert(
        'Step 7 Digital Triage Rule Engine — coming in Phase 2. ' +
        'Will compute risk levels and routing recommendations for encounter ' + encounter._id
      );
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="main-content" style={{ maxWidth: '860px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button onClick={onBack} className="btn btn-outline btn-sm">
            <ArrowLeft size={14} /> Back
          </button>
        </div>
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
          <Activity size={36} color="#14b8a6" style={{ margin: '0 auto 0.75rem auto' }} />
          <div style={{ fontWeight: '700', color: '#f8fafc' }}>Loading patient timeline…</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>Fetching cross-facility records</div>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="main-content" style={{ maxWidth: '860px' }}>
        <button onClick={onBack} className="btn btn-outline btn-sm" style={{ marginBottom: '1.5rem' }}>
          <ArrowLeft size={14} /> Back to Scanner
        </button>
        <div
          className="card"
          style={{
            textAlign: 'center', padding: '3rem 2rem',
            border: '1px solid rgba(244,63,94,0.3)',
            background: 'rgba(244,63,94,0.05)',
          }}
        >
          <AlertTriangle size={40} color="#f43f5e" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontWeight: '800', color: '#ffffff', marginBottom: '0.5rem' }}>Timeline Unavailable</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>{error}</p>
          <button onClick={fetchTimeline} className="btn btn-primary">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { patient, encounters, summary, age } = data;
  const originTier = tierConfig(patient.registeredAtFacility?.tier);
  const isCrossFacility =
    user?.facility?._id &&
    patient.registeredAtFacility?._id &&
    user.facility._id.toString() !== patient.registeredAtFacility._id.toString();

  return (
    <div className="main-content" style={{ maxWidth: '860px' }}>

      {/* ── Back nav ── */}
      <button
        onClick={onBack}
        className="btn btn-outline btn-sm"
        style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
      >
        <ArrowLeft size={14} /> Back to Scanner
      </button>

      {/* ══════════════════════════════════════════════════════════
          STICKY PATIENT HEADER
      ══════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'sticky', top: '65px', zIndex: 40,
          background: 'rgba(10,15,29,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Patient identity */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.01em' }}>
                {patient.name}
              </h1>
              {/* Cross-facility indicator */}
              {isCrossFacility && (
                <span
                  style={{
                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)',
                    color: '#93c5fd', padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: '700',
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                  }}
                >
                  <Globe size={11} /> Cross-Facility
                </span>
              )}
            </div>

            {/* PHID + quick demographics */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.4rem', alignItems: 'center' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '0.82rem',
                  color: '#22d3ee', background: 'rgba(6,182,212,0.1)',
                  padding: '0.15rem 0.5rem', borderRadius: '6px',
                  border: '1px solid rgba(6,182,212,0.25)',
                }}
              >
                {patient.phid}
              </span>
              {age !== null && (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <User size={12} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                  {age} yrs · <span style={{ textTransform: 'capitalize' }}>{patient.gender || 'unknown'}</span>
                </span>
              )}
              {patient.dob && (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <Calendar size={12} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                  DOB: {formatDate(patient.dob)}
                </span>
              )}
              {patient.guardianName && (
                <span style={{ fontSize: '0.82rem', color: '#f59e0b' }}>
                  Guardian: {patient.guardianName}
                </span>
              )}
            </div>

            {/* Origin facility badge */}
            {patient.registeredAtFacility && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <Hospital size={13} color={originTier.dot} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Enrolled at{' '}
                  <strong style={{ color: '#f8fafc' }}>{patient.registeredAtFacility.name}</strong>
                </span>
                <span
                  style={{
                    padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-full)',
                    fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase',
                    background: originTier.bg, color: originTier.color, border: `1px solid ${originTier.border}`,
                  }}
                >
                  {originTier.label}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {patient.registeredAtFacility.district}
                </span>
              </div>
            )}
          </div>

          {/* Record encounter CTA */}
          <button
            onClick={() => setEncounterModalOpen(true)}
            className="btn btn-primary btn-sm"
            style={{ flexShrink: 0 }}
          >
            <Stethoscope size={14} /> + Record Visit
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SUMMARY STRIP
      ══════════════════════════════════════════════════════════ */}
      <div
        className="card"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0',
          padding: '0',
          overflow: 'hidden',
          marginBottom: '1.25rem',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {[
          {
            icon: <Stethoscope size={18} color="#14b8a6" />,
            value: summary.totalEncounters,
            label: summary.totalEncounters === 1 ? 'Total Visit' : 'Total Visits',
          },
          {
            icon: <Globe size={18} color="#06b6d4" />,
            value: summary.facilitiesVisited,
            label: summary.facilitiesVisited === 1 ? 'Facility Visited' : 'Facilities Visited',
          },
          {
            icon: <Calendar size={18} color="#8b5cf6" />,
            value: summary.firstEncounterDate ? formatDate(summary.firstEncounterDate) : '—',
            label: 'Patient Since',
            small: true,
          },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              padding: '1rem 1.25rem',
              borderRight: i < 2 ? '1px solid var(--border-subtle)' : 'none',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}
          >
            <div
              style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: stat.small ? '1rem' : '1.5rem', fontWeight: '800', color: '#f8fafc', lineHeight: 1.1 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          TIMELINE
      ══════════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 className="card-title">
              <Layers size={19} color="#14b8a6" />
              Longitudinal Clinical Timeline
            </h3>
            <p className="card-desc">
              All visits across the Maharashtra stepped-care network · newest first
            </p>
          </div>

          {/* Tier legend — makes the colour coding self-explanatory without tooltips */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {Object.entries(TIER_CONFIG).map(([key, cfg]) => (
              <span
                key={key}
                style={{
                  padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-full)',
                  fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase',
                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                }}
              >
                {cfg.label}
              </span>
            ))}
          </div>
        </div>

        {encounters.length === 0 ? (
          /* ── Empty state ── */
          <div
            style={{
              textAlign: 'center', padding: '3rem 1.5rem',
              background: 'rgba(15,23,42,0.4)', borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-subtle)',
            }}
          >
            <Stethoscope size={38} color="#64748b" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
            <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '1.05rem' }}>
              No Visits Recorded Yet
            </div>
            <div
              style={{
                fontSize: '0.85rem', color: 'var(--text-muted)',
                maxWidth: '400px', margin: '0.4rem auto 1.5rem auto',
              }}
            >
              This patient was recently registered. Record their first clinical encounter to start
              their longitudinal health record across the Maharashtra network.
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setEncounterModalOpen(true)}
            >
              <Stethoscope size={15} /> Record First Clinical Encounter
            </button>
          </div>
        ) : (
          /* ── Encounter cards ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {encounters.map((enc) => (
              <EncounterCard key={enc._id} enc={enc} />
            ))}
          </div>
        )}
      </div>

      {/* ── Encounter creation modal ── */}
      {encounterModalOpen && (
        <EncounterCreateModal
          patient={patient}
          onClose={() => setEncounterModalOpen(false)}
          onSuccess={handleEncounterCreated}
        />
      )}
    </div>
  );
};
