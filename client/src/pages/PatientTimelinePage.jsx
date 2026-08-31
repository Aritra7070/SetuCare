import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../stores/authStore';
import { useSocket } from '../hooks/useSocket';
import { EncounterCreateModal } from '../components/EncounterCreateModal';
import { ReferralCreateModal, REFERRAL_STATUS_CONFIG } from '../components/ReferralCreateModal';
import { SYMPTOM_LABEL_MAP } from '../utils/symptomVocabulary';
import {
  ArrowLeft,
  User,
  Hospital,
  Calendar,
  Stethoscope,
  Activity,
  Clock,
  Globe,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
  Layers,
  Send,
  ArrowRight,
  Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Tier colour scheme — matches Step 2 palette exactly
// ---------------------------------------------------------------------------
const TIER_CONFIG = {
  sub_centre: {
    label: 'Sub-Centre',
    bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)',
    color: '#34d399', dot: '#10b981',
    cardAccent: 'rgba(16,185,129,0.08)', cardBorder: 'rgba(16,185,129,0.25)',
  },
  phc: {
    label: 'PHC',
    bg: 'rgba(6,182,212,0.15)', border: 'rgba(6,182,212,0.35)',
    color: '#22d3ee', dot: '#06b6d4',
    cardAccent: 'rgba(6,182,212,0.08)', cardBorder: 'rgba(6,182,212,0.25)',
  },
  rural_hospital: {
    label: 'Rural Hospital',
    bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.35)',
    color: '#c4b5fd', dot: '#8b5cf6',
    cardAccent: 'rgba(139,92,246,0.08)', cardBorder: 'rgba(139,92,246,0.25)',
  },
  district_hospital: {
    label: 'District Hospital',
    bg: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.35)',
    color: '#fb7185', dot: '#f43f5e',
    cardAccent: 'rgba(244,63,94,0.08)', cardBorder: 'rgba(244,63,94,0.25)',
  },
};

const ENCOUNTER_TYPE_CONFIG = {
  walk_in:          { label: 'Routine Walk-In',  bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.3)' },
  follow_up:        { label: 'Follow-Up Check',  bg: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
  referral_consult: { label: 'Referral Consult', bg: 'rgba(244,63,94,0.15)',  color: '#fb7185', border: 'rgba(244,63,94,0.3)' },
};

const TRIAGE_CONFIG = {
  routine:   { label: 'Routine',   bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.35)' },
  urgent:    { label: 'Urgent',    bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.35)' },
  emergency: { label: 'Emergency', bg: 'rgba(244,63,94,0.18)',  color: '#fb7185', border: 'rgba(244,63,94,0.4)' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatDateTime(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
// ReferralStatusChip — small inline chip shown next to the tier badge
// ---------------------------------------------------------------------------
function ReferralStatusChip({ referral }) {
  const cfg = REFERRAL_STATUS_CONFIG[referral.status] || REFERRAL_STATUS_CONFIG.created;
  const destTier = referral.toFacility?.tier
    ? (TIER_CONFIG[referral.toFacility.tier]?.label || referral.toFacility.tier)
    : '';
  return (
    <span
      title={`Referred → ${referral.toFacility?.name || 'Unknown'} · ${cfg.label}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        padding: '0.18rem 0.55rem', borderRadius: 'var(--radius-full)',
        fontSize: '0.7rem', fontWeight: '700',
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <Send size={9} />
      {cfg.label}
      {referral.toFacility?.name && (
        <span style={{ opacity: 0.75 }}>→ {referral.toFacility.name}</span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// VitalPill
// ---------------------------------------------------------------------------
const VITAL_COLOURS = {
  blue:    { bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.25)',  text: '#93c5fd' },
  green:   { bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.25)',  text: '#6ee7b7' },
  rose:    { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',    text: '#fca5a5' },
  neutral: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)',  text: '#e2e8f0' },
};
function VitalPill({ label, value, color = 'neutral' }) {
  const c = VITAL_COLOURS[color] || VITAL_COLOURS.neutral;
  return (
    <span style={{ background: c.bg, border: `1px solid ${c.border}`, padding: '0.22rem 0.55rem', borderRadius: '6px', fontSize: '0.78rem', color: c.text }}>
      {label}: <strong>{value}</strong>
    </span>
  );
}

// ---------------------------------------------------------------------------
// EncounterCard
// Props:
//   enc          — encounter object (may have .referral chip attached by timeline endpoint)
//   patient      — patient object { _id, name, phid }
//   onTriageRun     — (encounterId, triageResult) => void
//   onReferred      — (encounterId, referral) => void
//   onStatusUpdated — (encounterId, newStatus, outcomeNotes?) => void  [Step 10]
// ---------------------------------------------------------------------------
function EncounterCard({ enc, patient, onTriageRun, onReferred, onStatusUpdated }) {
  const { user }       = useAuthStore();
  const [notesExpanded,  setNotesExpanded]  = useState(false);
  const [triageLoading,  setTriageLoading]  = useState(false);
  const [triageError,    setTriageError]    = useState(null);
  const [referralOpen,   setReferralOpen]   = useState(false);
  // Step 10 — inline status actions (Mark Seen / Close)
  const [statusLoading,  setStatusLoading]  = useState(false);
  const [statusError,    setStatusError]    = useState(null);
  const [closeFormOpen,  setCloseFormOpen]  = useState(false);
  const [outcomeNotes,   setOutcomeNotes]   = useState('');

  const tier    = tierConfig(enc.facility?.tier);
  const typeCfg = ENCOUNTER_TYPE_CONFIG[enc.encounterType] || ENCOUNTER_TYPE_CONFIG.walk_in;

  const hasVitals =
    enc.vitals?.bp?.systolic || enc.vitals?.bp?.diastolic ||
    enc.vitals?.tempC != null || enc.vitals?.pulse != null ||
    enc.vitals?.spo2  != null || enc.vitals?.weightKg != null;

  const hasReferral = Boolean(enc.referral);

  // Is the current user at the receiving facility for this referral?
  const userFacilityId = user?.facility?._id?.toString() || user?.facility?.toString();
  const toFacilityId   = enc.referral?.toFacility?._id?.toString()
    || enc.referral?.toFacility?.toString();
  const isReceivingFacility = hasReferral && userFacilityId && toFacilityId
    && userFacilityId === toFacilityId;
  const canAct = isReceivingFacility
    && ['medical_officer', 'specialist', 'admin'].includes(user?.role)
    && enc.referral?.status !== 'closed';

  const handleStatusTransition = async (newStatus, notes) => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      await api.patch(`/referrals/${enc.referral._id}/status`, {
        status: newStatus,
        ...(notes && { outcomeNotes: notes }),
      });
      onStatusUpdated?.(enc._id, newStatus, notes);
      if (newStatus === 'closed') {
        setCloseFormOpen(false);
        setOutcomeNotes('');
      }
    } catch (err) {
      setStatusError(err.message || 'Status update failed');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleRunTriage = async () => {
    setTriageLoading(true);
    setTriageError(null);
    try {
      const res = await api.post(`/encounters/${enc._id}/triage`);
      if (res.data.success) onTriageRun(enc._id, res.data.triageResult);
    } catch (err) {
      setTriageError(err.message || 'Triage failed');
    } finally {
      setTriageLoading(false);
    }
  };

  return (
    <>
      <div
        style={{
          background: tier.cardAccent,
          border: `1px solid ${tier.cardBorder}`,
          borderLeft: `3px solid ${tier.dot}`,
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          display: 'flex', flexDirection: 'column', gap: '0.85rem',
        }}
      >
        {/* ── Header row ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Tier badge */}
            <span style={{ padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: '800', background: tier.bg, color: tier.color, border: `1px solid ${tier.border}`, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {tier.label}
            </span>

            {/* Encounter type */}
            <span style={{ padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: '700', background: typeCfg.bg, color: typeCfg.color, border: `1px solid ${typeCfg.border}` }}>
              {typeCfg.label}
            </span>

            {/* Step 8: Referral status chip — slots in next to type badge */}
            {hasReferral && <ReferralStatusChip referral={enc.referral} />}

            {/* Triage risk badge */}
            {enc.triageResult?.riskLevel && (() => {
              const tc = TRIAGE_CONFIG[enc.triageResult.riskLevel] || TRIAGE_CONFIG.routine;
              return (
                <span style={{ padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: '700', background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Zap size={10} />{tc.label} Risk
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

        {/* ── Vitals ── */}
        {hasVitals && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            {(enc.vitals.bp?.systolic || enc.vitals.bp?.diastolic) && (
              <VitalPill label="BP" value={`${enc.vitals.bp.systolic ?? '?'}/${enc.vitals.bp.diastolic ?? '?'} mmHg`} color="blue" />
            )}
            {enc.vitals.tempC != null && (
              <VitalPill label="Temp" value={`${enc.vitals.tempC}°C`} color={enc.vitals.tempC >= 38 ? 'rose' : 'neutral'} />
            )}
            {enc.vitals.pulse != null && (
              <VitalPill label="Pulse" value={`${enc.vitals.pulse} bpm`} color="neutral" />
            )}
            {enc.vitals.spo2 != null && (
              <VitalPill label="SpO₂" value={`${enc.vitals.spo2}%${enc.vitals.spo2 < 92 ? ' ⚠' : ''}`} color={enc.vitals.spo2 < 92 ? 'rose' : 'green'} />
            )}
            {enc.vitals.weightKg != null && (
              <VitalPill label="Weight" value={`${enc.vitals.weightKg} kg`} color="neutral" />
            )}
          </div>
        )}

        {/* ── Symptoms ── */}
        {enc.symptoms?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {enc.symptoms.map((s, i) => (
              <span key={i} style={{ background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(20,184,166,0.25)', padding: '0.18rem 0.48rem', borderRadius: '4px', fontSize: '0.74rem', color: '#5eead4' }}>
                · {SYMPTOM_LABEL_MAP[s] || s}
              </span>
            ))}
          </div>
        )}
        {enc.otherSymptoms && (
          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Other: {enc.otherSymptoms}</div>
        )}

        {/* ── Notes ── */}
        {enc.notes && (
          <div>
            <div
              style={{
                background: 'rgba(11,17,32,0.8)', padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', color: '#cbd5e1',
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
                onClick={() => setNotesExpanded(p => !p)}
                style={{ background: 'none', border: 'none', padding: '0.2rem 0', fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', marginTop: '2px' }}
              >
                {notesExpanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
              </button>
            )}
          </div>
        )}

        {/* ── Triage panel ── */}
        {enc.triageResult?.riskLevel ? (() => {
          const tc = TRIAGE_CONFIG[enc.triageResult.riskLevel] || TRIAGE_CONFIG.routine;
          return (
            <div style={{ background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: 'var(--radius-sm)', padding: '0.7rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {/* Badge + rationale */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                <span style={{ padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: '800', background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                  <Zap size={10} /> {tc.label} Risk
                </span>
                <span style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>{enc.triageResult.rationale}</span>
              </div>

              {/* Suggested facility + Refer button */}
              {enc.triageResult.suggestedRouting && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.35rem', borderTop: `1px solid ${tc.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: tc.color }}>
                    <Hospital size={12} />
                    <span>Suggested: <strong>{enc.triageResult.suggestedRouting}</strong></span>
                    {enc.triageResult.tierSkipped && (
                      <span style={{ fontSize: '0.68rem', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', padding: '0.05rem 0.35rem', borderRadius: '3px' }}>
                        Tier skip
                      </span>
                    )}
                  </div>
                  {/* Refer Patient button — only if no referral already exists */}
                  {!hasReferral && (
                    <button
                      type="button"
                      onClick={() => setReferralOpen(true)}
                      className="btn btn-sm"
                      style={{ padding: '0.25rem 0.65rem', fontSize: '0.76rem', background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.4)', color: '#5eead4', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Send size={11} /> Refer Patient
                    </button>
                  )}
                </div>
              )}

              {/* Scored timestamp + re-run */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.2rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                {enc.triageResult.scoredAt && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Scored {new Date(enc.triageResult.scoredAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleRunTriage}
                  disabled={triageLoading}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                >
                  <Zap size={11} />{triageLoading ? 'Re-running…' : 'Re-run Triage'}
                </button>
              </div>
            </div>
          );
        })() : (
          /* No triage yet — Run Triage + Refer Patient (without triage) */
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleRunTriage}
              disabled={triageLoading}
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.35)' }}
            >
              <Zap size={12} />{triageLoading ? 'Running…' : 'Run Triage'}
            </button>

            {/* Refer without triage — worker clinical judgment path */}
            {!hasReferral && (
              <button
                type="button"
                onClick={() => setReferralOpen(true)}
                className="btn btn-outline btn-sm"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', color: '#5eead4', borderColor: 'rgba(20,184,166,0.3)' }}
              >
                <Send size={12} /> Refer Patient
              </button>
            )}

            {triageError && (
              <span style={{ fontSize: '0.75rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={11} /> {triageError}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Referral creation modal — mounted outside the card div to avoid z-index traps */}
      {referralOpen && (
        <ReferralCreateModal
          patient={patient}
          encounter={enc}
          onClose={() => setReferralOpen(false)}
          onSuccess={(referral) => {
            setReferralOpen(false);
            onReferred(enc._id, referral);
          }}
        />
      )}

      {/* ── Step 10: Inline receiving-facility actions ── */}
      {canAct && (
        <div
          style={{
            marginTop: '0.25rem',
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 0.9rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Receiving Facility Actions
          </div>

          {statusError && (
            <div style={{ fontSize: '0.78rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <AlertTriangle size={12} /> {statusError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Mark Seen — only when acknowledged */}
            {enc.referral.status === 'acknowledged' && (
              <button
                type="button"
                disabled={statusLoading}
                onClick={() => handleStatusTransition('seen')}
                className="btn btn-sm"
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.76rem', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Eye size={12} />
                {statusLoading ? 'Updating…' : 'Mark Seen'}
              </button>
            )}

            {/* Close — only when seen */}
            {enc.referral.status === 'seen' && !closeFormOpen && (
              <button
                type="button"
                onClick={() => setCloseFormOpen(true)}
                className="btn btn-sm"
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.76rem', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <CheckCircle2 size={12} /> Close Referral
              </button>
            )}
          </div>

          {/* Close form — outcome notes required */}
          {closeFormOpen && enc.referral.status === 'seen' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <textarea
                rows={2}
                className="form-input"
                placeholder="Outcome notes (required to close)…"
                value={outcomeNotes}
                onChange={e => setOutcomeNotes(e.target.value)}
                style={{ fontSize: '0.82rem', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={statusLoading || !outcomeNotes.trim()}
                  onClick={() => handleStatusTransition('closed', outcomeNotes)}
                  className="btn btn-sm btn-primary"
                  style={{ fontSize: '0.76rem' }}
                >
                  {statusLoading ? 'Closing…' : <><CheckCircle2 size={12} /> Confirm Close</>}
                </button>
                <button
                  type="button"
                  onClick={() => { setCloseFormOpen(false); setOutcomeNotes(''); setStatusError(null); }}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.76rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// PatientTimelinePage — main component
// ---------------------------------------------------------------------------
export const PatientTimelinePage = ({ phid, onBack }) => {
  const { user } = useAuthStore();
  const socket   = useSocket();

  const [data,               setData]               = useState(null);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState(null);
  const [encounterModalOpen, setEncounterModalOpen] = useState(false);
  // Live notification toasts — { id, message, type }
  const [notifications,      setNotifications]      = useState([]);

  // Optimistic overrides keyed by encounter _id
  // Shape: { [encId]: { triageResult?, referral? } }
  const [overrides, setOverrides] = useState({});

  const fetchTimeline = useCallback(async () => {
    if (!phid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/patients/${encodeURIComponent(phid)}/timeline`);
      if (res.data.success) setData(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load patient timeline');
    } finally {
      setLoading(false);
    }
  }, [phid]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  // ── Socket.IO: join patient room when this timeline opens ──
  useEffect(() => {
    if (!socket || !phid || !data?.patient?._id) return;
    const patientId = data.patient._id;
    socket.emit('join:patient', { patientId });
    return () => {
      socket.emit('leave:patient', { patientId });
    };
  }, [socket, phid, data?.patient?._id]);

  // ── Socket.IO: live referral chip updates ──
  useEffect(() => {
    if (!socket) return;

    const handleStatusUpdate = (payload) => {
      // payload: { referralId, patientId, status, toFacility, updatedAt }
      // Update the referral chip on the matching encounter optimistically
      setOverrides(prev => {
        const next = { ...prev };
        // Walk every encounter override looking for the matching referral
        // We also need to search the base data for the encounter that holds this referral
        for (const encId of Object.keys(next)) {
          if (next[encId]?.referral?._id?.toString() === payload.referralId) {
            next[encId] = {
              ...next[encId],
              referral: { ...next[encId].referral, status: payload.status },
            };
            return next;
          }
        }
        return next;
      });

      // Also update base data encounters that haven't been overridden yet
      setData(prev => {
        if (!prev) return prev;
        const updatedEncounters = prev.encounters.map(enc => {
          if (enc.referral?._id?.toString() === payload.referralId) {
            return { ...enc, referral: { ...enc.referral, status: payload.status } };
          }
          return enc;
        });
        return { ...prev, encounters: updatedEncounters };
      });
    };

    socket.on('referral:statusUpdated', handleStatusUpdate);
    return () => { socket.off('referral:statusUpdated', handleStatusUpdate); };
  }, [socket]);

  // ── Socket.IO: incoming notifications (referral closed etc.) ──
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notif) => {
      const toastId = notif._id || Date.now().toString();
      setNotifications(prev => [
        { id: toastId, message: notif.message, type: notif.type },
        ...prev.slice(0, 4), // keep at most 5 toasts
      ]);
      // Auto-dismiss after 8 s
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== toastId));
      }, 8000);
    };

    socket.on('notification:new', handleNotification);
    return () => { socket.off('notification:new', handleNotification); };
  }, [socket]);

  const handleEncounterCreated = () => {
    setEncounterModalOpen(false);
    fetchTimeline();
  };

  // Called by EncounterCard when triage runs successfully
  const handleTriageRun = (encId, triageResult) => {
    setOverrides(prev => ({ ...prev, [encId]: { ...prev[encId], triageResult } }));
  };

  // Called by EncounterCard when a referral is successfully created
  const handleReferred = (encId, referral) => {
    setOverrides(prev => ({
      ...prev,
      [encId]: {
        ...prev[encId],
        referral: {
          _id:       referral._id,
          status:    referral.status,
          toFacility: referral.toFacility,
          createdAt: referral.createdAt,
        },
      },
    }));
  };

  // Called by EncounterCard (Step 10) when receiving facility transitions status inline
  const handleStatusUpdated = (encId, newStatus, notes) => {
    setOverrides(prev => {
      const existing = prev[encId]?.referral || data?.encounters?.find(e => e._id === encId)?.referral || {};
      return {
        ...prev,
        [encId]: {
          ...prev[encId],
          referral: {
            ...existing,
            status: newStatus,
            ...(notes && { outcomeNotes: notes }),
          },
        },
      };
    });
  };

  // Merge optimistic overrides onto encounter list
  const mergedEncounters = (data?.encounters || []).map(enc => {
    const ov = overrides[enc._id];
    if (!ov) return enc;
    return {
      ...enc,
      ...(ov.triageResult !== undefined && { triageResult: ov.triageResult }),
      ...(ov.referral     !== undefined && { referral:     ov.referral }),
    };
  });

  // ── Loading ──
  if (loading) {
    return (
      <div className="main-content" style={{ maxWidth: '860px' }}>
        <button onClick={onBack} className="btn btn-outline btn-sm" style={{ marginBottom: '1.5rem' }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
          <Activity size={36} color="#14b8a6" style={{ margin: '0 auto 0.75rem auto' }} />
          <div style={{ fontWeight: '700', color: '#f8fafc' }}>Loading patient timeline…</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>Fetching cross-facility records</div>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="main-content" style={{ maxWidth: '860px' }}>
        <button onClick={onBack} className="btn btn-outline btn-sm" style={{ marginBottom: '1.5rem' }}>
          <ArrowLeft size={14} /> Back to Scanner
        </button>
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', border: '1px solid rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.05)' }}>
          <AlertTriangle size={40} color="#f43f5e" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontWeight: '800', color: '#ffffff', marginBottom: '0.5rem' }}>Timeline Unavailable</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>{error}</p>
          <button onClick={fetchTimeline} className="btn btn-primary">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { patient, summary, age } = data;
  const originTier = tierConfig(patient.registeredAtFacility?.tier);
  const isCrossFacility =
    user?.facility?._id &&
    patient.registeredAtFacility?._id &&
    user.facility._id.toString() !== patient.registeredAtFacility._id.toString();

  return (
    <div className="main-content" style={{ maxWidth: '860px' }}>

      {/* Back */}
      <button onClick={onBack} className="btn btn-outline btn-sm" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <ArrowLeft size={14} /> Back to Scanner
      </button>

      {/* ══ Sticky patient header ══ */}
      <div style={{ position: 'sticky', top: '65px', zIndex: 40, background: 'rgba(10,15,29,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', marginBottom: '1rem', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.01em' }}>{patient.name}</h1>
              {isCrossFacility && (
                <span style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#93c5fd', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Globe size={11} /> Cross-Facility
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.4rem', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '0.82rem', color: '#22d3ee', background: 'rgba(6,182,212,0.1)', padding: '0.15rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(6,182,212,0.25)' }}>
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
                <span style={{ fontSize: '0.82rem', color: '#f59e0b' }}>Guardian: {patient.guardianName}</span>
              )}
            </div>

            {patient.registeredAtFacility && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <Hospital size={13} color={originTier.dot} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Enrolled at <strong style={{ color: '#f8fafc' }}>{patient.registeredAtFacility.name}</strong>
                </span>
                <span style={{ padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', background: originTier.bg, color: originTier.color, border: `1px solid ${originTier.border}` }}>
                  {originTier.label}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{patient.registeredAtFacility.district}</span>
              </div>
            )}
          </div>

          {/* Step 11 — Cohort badges */}
          {(() => {
            const activeMemberships = (patient.cohortMemberships || []).filter(m => m.status === 'active');
            const maternal  = activeMemberships.find(m => m.cohortType === 'maternal');
            const chronic   = activeMemberships.find(m => m.cohortType === 'chronic');
            // Child: computed from dob — never stored
            const isChild   = age !== null && age < 5;

            if (!maternal && !chronic && !isChild) return null;

            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                {maternal && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)',
                    fontSize: '0.72rem', fontWeight: '700',
                    background: 'rgba(236,72,153,0.15)', color: '#f9a8d4',
                    border: '1px solid rgba(236,72,153,0.35)',
                  }}>
                    🤰 Maternal
                    {maternal.metadata?.expectedDeliveryDate && (
                      <span style={{ fontWeight: '400', opacity: 0.85 }}>
                        · EDD {formatDate(maternal.metadata.expectedDeliveryDate)}
                      </span>
                    )}
                  </span>
                )}
                {chronic && chronic.metadata?.conditions?.length > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)',
                    fontSize: '0.72rem', fontWeight: '700',
                    background: 'rgba(245,158,11,0.15)', color: '#fbbf24',
                    border: '1px solid rgba(245,158,11,0.35)',
                  }}>
                    🩺 Chronic: {chronic.metadata.conditions
                      .map(c => c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' '))
                      .join(', ')}
                  </span>
                )}
                {isChild && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)',
                    fontSize: '0.72rem', fontWeight: '700',
                    background: 'rgba(16,185,129,0.15)', color: '#34d399',
                    border: '1px solid rgba(16,185,129,0.35)',
                  }}>
                    👶 Child Cohort
                  </span>
                )}
              </div>
            );
          })()}

          <button onClick={() => setEncounterModalOpen(true)} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
            <Stethoscope size={14} /> + Record Visit
          </button>
        </div>
      </div>

      {/* ══ Summary strip ══ */}
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0, padding: 0, overflow: 'hidden', marginBottom: '1.25rem', border: '1px solid var(--border-subtle)' }}>
        {[
          { icon: <Stethoscope size={18} color="#14b8a6" />, value: summary.totalEncounters, label: summary.totalEncounters === 1 ? 'Total Visit' : 'Total Visits' },
          { icon: <Globe size={18} color="#06b6d4" />, value: summary.facilitiesVisited, label: summary.facilitiesVisited === 1 ? 'Facility Visited' : 'Facilities Visited' },
          { icon: <Calendar size={18} color="#8b5cf6" />, value: summary.firstEncounterDate ? formatDate(summary.firstEncounterDate) : '—', label: 'Patient Since', small: true },
        ].map((stat, i) => (
          <div key={i} style={{ padding: '1rem 1.25rem', borderRight: i < 2 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: stat.small ? '1rem' : '1.5rem', fontWeight: '800', color: '#f8fafc', lineHeight: 1.1 }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ══ Timeline ══ */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 className="card-title"><Layers size={19} color="#14b8a6" /> Longitudinal Clinical Timeline</h3>
            <p className="card-desc">All visits across the Maharashtra stepped-care network · newest first</p>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {Object.entries(TIER_CONFIG).map(([key, cfg]) => (
              <span key={key} style={{ padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-full)', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                {cfg.label}
              </span>
            ))}
          </div>
        </div>

        {mergedEncounters.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: 'rgba(15,23,42,0.4)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)' }}>
            <Stethoscope size={38} color="#64748b" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
            <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '1.05rem' }}>No Visits Recorded Yet</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0.4rem auto 1.5rem auto' }}>
              Record their first clinical encounter to start the longitudinal health record.
            </div>
            <button className="btn btn-primary" onClick={() => setEncounterModalOpen(true)}>
              <Stethoscope size={15} /> Record First Clinical Encounter
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {mergedEncounters.map(enc => (
              <EncounterCard
                key={enc._id}
                enc={enc}
                patient={patient}
                onTriageRun={handleTriageRun}
                onReferred={handleReferred}
                onStatusUpdated={handleStatusUpdated}
              />
            ))}
          </div>
        )}
      </div>

      {/* Encounter creation modal */}
      {encounterModalOpen && (
        <EncounterCreateModal
          patient={patient}
          onClose={() => setEncounterModalOpen(false)}
          onSuccess={handleEncounterCreated}
        />
      )}

      {/* ── Live notification toasts (Step 9) ── */}
      {notifications.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxWidth: '380px',
            pointerEvents: 'none',
          }}
        >
          {notifications.map((n) => (
            <div
              key={n.id}
              style={{
                background: 'rgba(10,15,29,0.97)',
                border: '1px solid rgba(20,184,166,0.45)',
                borderLeft: '3px solid #14b8a6',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                pointerEvents: 'auto',
                animation: 'slideInRight 0.35s cubic-bezier(0.23,1,0.32,1)',
              }}
            >
              <CheckCircle2 size={16} color="#14b8a6" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#5eead4', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Referral Update
                </div>
                <div style={{ fontSize: '0.82rem', color: '#e2e8f0', lineHeight: 1.45 }}>
                  {n.message}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0', marginLeft: 'auto', flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};
