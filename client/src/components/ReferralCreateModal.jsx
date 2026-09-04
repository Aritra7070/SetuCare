import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../stores/authStore';
import {
  X,
  Hospital,
  Send,
  CheckCircle2,
  AlertTriangle,
  Search,
  ArrowRight,
  Zap,
  ChevronDown,
  Package,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Referral status colour map — shared by ReferralStatusChip too
// ---------------------------------------------------------------------------
export const REFERRAL_STATUS_CONFIG = {
  created:      { label: 'Referred',     bg: 'rgba(59,130,246,0.15)',  color: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
  acknowledged: { label: 'Acknowledged', bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  seen:         { label: 'Seen',         bg: 'rgba(139,92,246,0.15)',  color: '#c4b5fd', border: 'rgba(139,92,246,0.3)' },
  closed:       { label: 'Closed',       bg: 'rgba(16,185,129,0.15)',  color: '#34d399', border: 'rgba(16,185,129,0.3)' },
};

// ---------------------------------------------------------------------------
// Tier labels for the facility picker
// ---------------------------------------------------------------------------
const TIER_LABELS = {
  sub_centre:       'Sub-Centre',
  phc:              'PHC',
  rural_hospital:   'Rural Hospital',
  district_hospital:'District Hospital',
};

// ---------------------------------------------------------------------------
// ReferralCreateModal
//
// Props:
//   patient         — patient object  { _id, name, phid }
//   encounter       — source encounter { _id, encounterType, triageResult, facility }
//   onClose()
//   onSuccess(referral) — called with the created referral on successful submit
// ---------------------------------------------------------------------------
export function ReferralCreateModal({ patient, encounter, onClose, onSuccess }) {
  const { user } = useAuthStore();

  // ── Facilities list ──
  const [facilities, setFacilities] = useState([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(true);

  // ── Form state ──
  const [toFacilityId, setToFacilityId] = useState('');
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // ── Submission ──
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [savedReferral, setSavedReferral] = useState(null);

  // ── Load all facilities ──
  useEffect(() => {
    api.get('/facilities')
      .then((res) => {
        if (res.data.success) {
          // Exclude the worker's own facility — can't refer to yourself
          const myFacilityId = user?.facility?._id?.toString() || user?.facility?.toString();
          const others = (res.data.facilities || []).filter(
            (f) => f._id.toString() !== myFacilityId
          );
          setFacilities(others);
        }
      })
      .catch(() => {})
      .finally(() => setFacilitiesLoading(false));
  }, [user]);

  // ── Pre-fill from triage suggestion or parentFacility ──
  useEffect(() => {
    if (facilitiesLoading || facilities.length === 0) return;

    // 1. Triage suggested a specific facility
    const suggestedId = encounter?.triageResult?.suggestedFacility?._id
      || encounter?.triageResult?.suggestedFacility;
    if (suggestedId) {
      const match = facilities.find((f) => f._id.toString() === suggestedId.toString());
      if (match) {
        setToFacilityId(match._id);
        return;
      }
    }

    // 2. No triage — default to immediate parent of the encounter's facility
    const encFacilityId = encounter?.facility?._id || encounter?.facility;
    if (encFacilityId) {
      const encFacility = facilities.find((f) => f._id.toString() === encFacilityId.toString())
        // also check outside-my-facility list
        || null;
      // We need parentFacility — look at encounter.facility.parentFacility if available
      const parentId = encounter?.facility?.parentFacility;
      if (parentId) {
        const parent = facilities.find((f) => f._id.toString() === parentId.toString());
        if (parent) { setToFacilityId(parent._id); return; }
      }
    }

    // 3. Fallback — leave blank so worker must choose
  }, [facilitiesLoading, facilities, encounter]);

  // ── Stock snapshot for selected facility (Step 15) ──
  const [stockSummary, setStockSummary] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);

  // Derive the patient's cohort category for filtering (maternal > chronic > general)
  const cohortCategory = useMemo(() => {
    const memberships = patient?.cohortMemberships || [];
    if (memberships.some(m => m.cohortType === 'maternal' && m.status === 'active')) return 'maternal';
    if (memberships.some(m => m.cohortType === 'chronic'  && m.status === 'active')) return 'chronic';
    return 'general';
  }, [patient]);

  useEffect(() => {
    if (!toFacilityId) { setStockSummary([]); return; }
    setStockLoading(true);
    api.get(`/stock/facility/${toFacilityId}/summary`, { params: { category: cohortCategory } })
      .then(res => { if (res.data.success) setStockSummary(res.data.summary); })
      .catch(() => {})
      .finally(() => setStockLoading(false));
  }, [toFacilityId, cohortCategory]);
  useEffect(() => {
    if (encounter?.triageResult?.rationale && !reason) {
      setReason(encounter.triageResult.rationale);
    }
  }, [encounter]);

  // ── Derived: selected facility object ──
  const selectedFacility = useMemo(
    () => facilities.find((f) => f._id === toFacilityId || f._id.toString() === toFacilityId?.toString()),
    [facilities, toFacilityId]
  );

  // ── Filtered facility list for search ──
  const filteredFacilities = useMemo(() => {
    if (!search.trim()) return facilities;
    const q = search.toLowerCase();
    return facilities.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.district?.toLowerCase().includes(q) ||
        f.tier?.toLowerCase().includes(q)
    );
  }, [facilities, search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!toFacilityId) {
      setFormError('Please select a destination facility.');
      return;
    }
    if (!reason.trim()) {
      setFormError('A referral reason is required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/referrals', {
        patient: patient._id,
        sourceEncounter: encounter._id,
        toFacility: toFacilityId,
        reason: reason.trim(),
      });
      if (res.data.success) {
        setSavedReferral(res.data.referral);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to create referral.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ──
  if (savedReferral) {
    return (
      <div style={OVERLAY}>
        <div className="card" style={{ ...PANEL, maxWidth: '480px', textAlign: 'center' }}>
          <div style={SUCCESS_ICON_WRAP}>
            <CheckCircle2 size={28} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.4rem' }}>
            Referral Sent
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            <strong style={{ color: '#f8fafc' }}>{patient.name}</strong> has been referred to{' '}
            <strong style={{ color: '#38bdf8' }}>{savedReferral.toFacility?.name}</strong>.
          </p>

          {/* Status + destination */}
          <div
            style={{
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem',
              marginBottom: '1.25rem', textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem' }}>
              <Hospital size={13} color="#93c5fd" />
              <span style={{ color: '#cbd5e1' }}>
                To: <strong style={{ color: '#f8fafc' }}>{savedReferral.toFacility?.name}</strong>
                {' '}
                <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  ({TIER_LABELS[savedReferral.toFacility?.tier] || savedReferral.toFacility?.tier})
                </span>
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              "{savedReferral.reason}"
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Status will update as the receiving facility acknowledges, sees, and closes this referral.
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onSuccess(savedReferral)}>
            <ArrowRight size={15} /> Back to Timeline
          </button>
        </div>
      </div>
    );
  }

  // ── Triage context badge (shown at top of form when triage was run) ──
  const triageRiskLevel = encounter?.triageResult?.riskLevel;
  const TRIAGE_CFG = {
    routine:   { label: 'Routine',   color: '#34d399', border: 'rgba(16,185,129,0.35)' },
    urgent:    { label: 'Urgent',    color: '#fbbf24', border: 'rgba(245,158,11,0.35)' },
    emergency: { label: 'Emergency', color: '#fb7185', border: 'rgba(244,63,94,0.4)' },
  };
  const tc = triageRiskLevel ? TRIAGE_CFG[triageRiskLevel] : null;

  return (
    <div style={OVERLAY}>
      <div className="card" style={PANEL}>
        {/* Header */}
        <div style={HEADER_ROW}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Send size={20} color="#14b8a6" />
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>
                Refer Patient
              </h2>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {patient.name} &bull;{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: '#22d3ee' }}>{patient.phid}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={CLOSE_BTN}>
            <X size={18} />
          </button>
        </div>

        {/* Triage context strip */}
        {tc && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.55rem 0.9rem',
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${tc.border}`,
              borderRadius: 'var(--radius-sm)', marginBottom: '1.1rem',
              fontSize: '0.8rem',
            }}
          >
            <Zap size={13} color={tc.color} />
            <span style={{ color: tc.color, fontWeight: '700' }}>{tc.label} Risk</span>
            {encounter.triageResult?.rationale && (
              <span style={{ color: 'var(--text-secondary)' }}>
                — {encounter.triageResult.rationale}
              </span>
            )}
            {encounter.triageResult?.tierSkipped && (
              <span
                style={{
                  marginLeft: 'auto', fontSize: '0.7rem', color: '#fb7185',
                  background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)',
                  padding: '0.1rem 0.45rem', borderRadius: '4px',
                }}
              >
                Tier skip
              </span>
            )}
          </div>
        )}

        {formError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            <AlertTriangle size={14} />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ── Destination facility ── */}
          <div className="form-group">
            <label className="form-label">Destination Facility</label>

            {/* Searchable custom dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', padding: '0.55rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-focus)',
                  background: 'rgba(15,23,42,0.7)', color: '#f8fafc',
                  fontSize: '0.875rem', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {selectedFacility ? (
                  <span>
                    {selectedFacility.name}{' '}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      · {TIER_LABELS[selectedFacility.tier] || selectedFacility.tier}
                      {selectedFacility.district ? ` · ${selectedFacility.district}` : ''}
                    </span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>
                    {facilitiesLoading ? 'Loading facilities…' : 'Select destination facility'}
                  </span>
                )}
                <ChevronDown size={15} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
              </button>

              {dropdownOpen && (
                <div
                  style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    zIndex: 200, borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-focus)',
                    background: '#0f172a',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
                    maxHeight: '260px', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  {/* Search input */}
                  <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={13} color="#64748b" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        placeholder="Search by name, district, or tier…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                        style={{
                          width: '100%', padding: '0.4rem 0.5rem 0.4rem 1.75rem',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.04)',
                          color: '#f8fafc', fontSize: '0.82rem', fontFamily: 'inherit',
                        }}
                      />
                    </div>
                  </div>

                  {/* Options */}
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {filteredFacilities.length === 0 ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        No facilities match "{search}"
                      </div>
                    ) : (
                      filteredFacilities.map((f) => {
                        const isSelected = f._id.toString() === toFacilityId?.toString();
                        const isSuggested =
                          f._id.toString() === (
                            encounter?.triageResult?.suggestedFacility?._id ||
                            encounter?.triageResult?.suggestedFacility
                          )?.toString();
                        return (
                          <button
                            key={f._id}
                            type="button"
                            onClick={() => { setToFacilityId(f._id); setDropdownOpen(false); setSearch(''); }}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.55rem 0.85rem',
                              background: isSelected ? 'rgba(20,184,166,0.12)' : 'transparent',
                              border: 'none', cursor: 'pointer',
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              textAlign: 'left', fontFamily: 'inherit',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: isSelected ? '700' : '500', color: isSelected ? '#5eead4' : '#f8fafc' }}>
                                {f.name}
                                {isSuggested && (
                                  <span style={{ marginLeft: '6px', fontSize: '0.68rem', color: '#fbbf24', background: 'rgba(245,158,11,0.15)', padding: '0.05rem 0.35rem', borderRadius: '3px' }}>
                                    Suggested
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {TIER_LABELS[f.tier] || f.tier}
                                {f.district ? ` · ${f.district}` : ''}
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 size={14} color="#14b8a6" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Step 15: Stock snapshot for selected facility ── */}
          {toFacilityId && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem 0.9rem',
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
                <Package size={11} />
                {selectedFacility?.name} — {cohortCategory.charAt(0).toUpperCase() + cohortCategory.slice(1)} stock
              </div>
              {stockLoading ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Loading…</span>
              ) : stockSummary.length === 0 ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No stock data available</span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {stockSummary.map(item => {
                    const statusColors = {
                      available: { color: '#34d399', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
                      low:       { color: '#fbbf24', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
                      out:       { color: '#fb7185', bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.3)'   },
                    };
                    const sc = statusColors[item.status] || statusColors.available;
                    return (
                      <span
                        key={item._id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem', background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}
                      >
                        {item.name}
                        {item.status !== 'available' && <span style={{ fontWeight: '700', fontSize: '0.68rem' }}>·{item.status === 'out' ? 'OUT' : 'LOW'}</span>}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Reason ── */}
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">
              Referral Reason{' '}
              {encounter?.triageResult?.rationale && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '400' }}>
                  (pre-filled from triage)
                </span>
              )}
            </label>
            <textarea
              rows={3}
              className="form-input"
              placeholder="Describe clinical reason for referral…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={submitting || !toFacilityId} className="btn btn-primary">
              {submitting ? 'Sending…' : (
                <><Send size={14} /> Send Referral</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared inline styles
// ---------------------------------------------------------------------------
const OVERLAY = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 120, padding: '1rem',
};
const PANEL = {
  width: '100%', maxWidth: '600px', maxHeight: '92vh', overflowY: 'auto',
  border: '1px solid rgba(20,184,166,0.4)',
  boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
  padding: '1.5rem',
};
const HEADER_ROW = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  borderBottom: '1px solid var(--border-subtle)',
  paddingBottom: '0.85rem', marginBottom: '1rem',
};
const CLOSE_BTN = {
  background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem',
};
const SUCCESS_ICON_WRAP = {
  width: '52px', height: '52px', borderRadius: '13px',
  background: 'linear-gradient(135deg,#10b981 0%,#06b6d4 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  margin: '0 auto 1rem auto',
};
