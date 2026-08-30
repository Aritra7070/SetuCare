import React, { useState, useMemo } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../stores/authStore';
import { SYMPTOM_CATEGORIES } from '../utils/symptomVocabulary';
import {
  Stethoscope,
  Activity,
  FileText,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  Hospital,
  User,
  Layers,
  ArrowRight,
  RotateCcw,
  Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Vitals plausibility rules — PRD §6: warn-but-allow, never block
// ---------------------------------------------------------------------------
const VITALS_WARNINGS = {
  systolic:  (v) => v > 180 ? 'Systolic BP unusually high — please confirm' : v < 70 ? 'Systolic BP unusually low — please confirm' : null,
  diastolic: (v) => v > 120 ? 'Diastolic BP unusually high — please confirm' : v < 40 ? 'Diastolic BP unusually low — please confirm' : null,
  tempC:     (v) => v >= 40.0 ? 'Very high temperature — please confirm' : v < 34.0 ? 'Very low temperature — please confirm' : null,
  pulse:     (v) => v > 150 ? 'Pulse unusually high — please confirm' : v < 30 ? 'Pulse unusually low — please confirm' : null,
  spo2:      (v) => v < 90 ? 'SpO₂ below 90% — hypoxia warning, please confirm' : null,
  weightKg:  (v) => v > 250 ? 'Weight unusually high — please confirm' : v < 1 ? 'Weight unusually low — please confirm' : null,
};

function getVitalsWarnings(vitals) {
  const warnings = [];
  const fields = ['systolic', 'diastolic', 'tempC', 'pulse', 'spo2', 'weightKg'];
  for (const field of fields) {
    const raw = field === 'systolic' ? vitals.bp.systolic : field === 'diastolic' ? vitals.bp.diastolic : vitals[field];
    if (raw === '' || raw === undefined) continue;
    const val = Number(raw);
    if (isNaN(val)) continue;
    const msg = VITALS_WARNINGS[field]?.(val);
    if (msg) warnings.push(msg);
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Demo preset data
// ---------------------------------------------------------------------------
const PRESETS = {
  routine: {
    encounterType: 'walk_in',
    vitals: { bp: { systolic: '120', diastolic: '80' }, tempC: '37.8', pulse: '76', spo2: '98', weightKg: '56' },
    symptoms: ['fever', 'cough_severe', 'fatigue'],
    otherSymptoms: '',
    notes: 'Routine walk-in. 3-day history of dry cough and mild fever. Hydration and rest advised.',
  },
  emergency: {
    encounterType: 'referral_consult',
    vitals: { bp: { systolic: '155', diastolic: '100' }, tempC: '37.0', pulse: '112', spo2: '88', weightKg: '62' },
    symptoms: ['chest_pain', 'breathlessness', 'dizziness'],
    otherSymptoms: '',
    notes: 'ACUTE DISTRESS: Retrosternal chest pain with severe breathlessness and desaturation (SpO₂ 88%). High risk ACS / cardiac emergency.',
  },
  antenatal: {
    encounterType: 'follow_up',
    vitals: { bp: { systolic: '145', diastolic: '95' }, tempC: '36.8', pulse: '84', spo2: '97', weightKg: '68' },
    symptoms: ['anc_high_bp', 'anc_swelling', 'headache'],
    otherSymptoms: '',
    notes: 'Third-trimester ANC check. Elevated BP with bilateral pedal oedema and persistent headache. High-risk preeclampsia warning signs.',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const EncounterCreateModal = ({ patient, onClose, onSuccess }) => {
  const { user } = useAuthStore();

  // Form state
  const [encounterType, setEncounterType] = useState('walk_in');
  const [vitals, setVitals] = useState({
    bp: { systolic: '', diastolic: '' },
    tempC: '',
    pulse: '',
    spo2: '',
    weightKg: '',
  });
  const [selectedSymptoms, setSelectedSymptoms] = useState([]); // stores IDs e.g. ['fever', 'cough_severe']
  const [otherSymptoms, setOtherSymptoms] = useState('');
  const [activeCategory, setActiveCategory] = useState('general');
  const [notes, setNotes] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [savedEncounter, setSavedEncounter] = useState(null); // success screen

  // ---------------------------------------------------------------------------
  // Derived vitals warnings (recalculated on each render, cheap)
  // ---------------------------------------------------------------------------
  const vitalsWarnings = useMemo(() => getVitalsWarnings(vitals), [vitals]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleVitalChange = (e) => {
    const { name, value } = e.target;
    if (name === 'systolic' || name === 'diastolic') {
      setVitals((prev) => ({ ...prev, bp: { ...prev.bp, [name]: value } }));
    } else {
      setVitals((prev) => ({ ...prev, [name]: value }));
    }
  };

  const toggleSymptom = (symptomId) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptomId) ? prev.filter((s) => s !== symptomId) : [...prev, symptomId]
    );
  };

  const handlePresetFill = (presetKey) => {
    const p = PRESETS[presetKey];
    if (!p) return;
    setFormError(null);
    setEncounterType(p.encounterType);
    setVitals(p.vitals);
    setSelectedSymptoms(p.symptoms);
    setOtherSymptoms(p.otherSymptoms);
    setNotes(p.notes);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Build bp payload — only include if at least one value is filled
    const bpPayload = {};
    if (vitals.bp.systolic !== '') bpPayload.systolic = vitals.bp.systolic;
    if (vitals.bp.diastolic !== '') bpPayload.diastolic = vitals.bp.diastolic;

    const payload = {
      patientId: patient._id,
      encounterType,
      vitals: {
        ...(Object.keys(bpPayload).length > 0 && { bp: bpPayload }),
        ...(vitals.tempC    !== '' && { tempC:    vitals.tempC }),
        ...(vitals.pulse    !== '' && { pulse:    vitals.pulse }),
        ...(vitals.spo2     !== '' && { spo2:     vitals.spo2 }),
        ...(vitals.weightKg !== '' && { weightKg: vitals.weightKg }),
      },
      symptoms: selectedSymptoms,          // canonical IDs only
      otherSymptoms: otherSymptoms.trim() || undefined,
      notes,
    };

    try {
      setSubmitting(true);
      const res = await api.post('/encounters', payload);
      if (res.data.success) {
        setSavedEncounter(res.data.encounter);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to record encounter');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Success screen
  // ---------------------------------------------------------------------------
  if (savedEncounter) {
    return (
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 110, padding: '1rem',
        }}
      >
        <div
          className="card"
          style={{
            width: '100%', maxWidth: '520px',
            border: '1px solid rgba(16,185,129,0.5)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 35px rgba(16,185,129,0.2)',
            padding: '2rem', textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px', height: '56px', borderRadius: '14px',
              background: 'linear-gradient(135deg,#10b981 0%,#06b6d4 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem auto',
            }}
          >
            <CheckCircle2 size={28} color="#ffffff" />
          </div>

          <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.4rem' }}>
            Encounter Recorded
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            Clinical encounter for{' '}
            <strong style={{ color: '#f8fafc' }}>{patient.name}</strong> has been saved and
            stamped to{' '}
            <strong style={{ color: '#38bdf8' }}>
              {savedEncounter.facility?.name || user?.facility?.name || 'your facility'}
            </strong>.
          </p>

          {/* Encounter summary pill row */}
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <span style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', color: '#34d399' }}>
              {savedEncounter.encounterType?.replace('_', ' ')}
            </span>
            {selectedSymptoms.length > 0 && (
              <span style={{ background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.25)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', color: '#5eead4' }}>
                {selectedSymptoms.length} symptom{selectedSymptoms.length !== 1 ? 's' : ''} logged
              </span>
            )}
            {savedEncounter.vitals?.bp?.systolic && (
              <span style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', color: '#93c5fd' }}>
                BP {savedEncounter.vitals.bp.systolic}/{savedEncounter.vitals.bp.diastolic} mmHg
              </span>
            )}
          </div>

          {/* Dual CTA — PRD §6 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => {
                onSuccess(savedEncounter, 'timeline');
              }}
            >
              <Activity size={15} /> View Patient Timeline
            </button>

            <button
              className="btn btn-outline"
              style={{ width: '100%', borderColor: 'rgba(245,158,11,0.4)', color: '#fbbf24' }}
              onClick={() => {
                onSuccess(savedEncounter, 'triage');
              }}
            >
              <Zap size={15} /> Run Triage on This Encounter (Step 7)
            </button>

            <button
              type="button"
              className="btn btn-outline"
              style={{ width: '100%', fontSize: '0.825rem' }}
              onClick={() => onSuccess(savedEncounter, 'close')}
            >
              <RotateCcw size={13} /> Done — Back to Patient Record
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main form
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 110, padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%', maxWidth: '780px',
          maxHeight: '92vh', overflowY: 'auto',
          border: '1px solid rgba(20,184,166,0.5)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 35px rgba(20,184,166,0.2)',
          padding: '1.75rem',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.25rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Stethoscope size={22} color="#14b8a6" />
              <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#ffffff' }}>
                Record Clinical Encounter
              </h2>
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Patient: <strong style={{ color: '#f8fafc' }}>{patient.name}</strong> &bull; PHID:{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: '#22d3ee' }}>{patient.phid}</span>
            </div>
          </div>

          <button type="button" onClick={onClose} style={{ background: 'none', color: '#94a3b8', padding: '0.2rem' }}>
            <X size={20} />
          </button>
        </div>

        {/* Auto-stamped worker + facility badge */}
        <div
          style={{
            background: 'rgba(15,23,42,0.7)', border: '1px solid var(--border-subtle)',
            padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', fontSize: '0.825rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={15} color="#14b8a6" />
            <span>
              Attending Worker: <strong style={{ color: '#ffffff' }}>{user?.name}</strong>{' '}
              (<span style={{ textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</span>)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Hospital size={15} color="#06b6d4" />
            <span>
              Facility: <strong style={{ color: '#38bdf8' }}>{user?.facility?.name || 'Local Facility'}</strong>{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: '#22d3ee' }}>
                [{user?.facility?.shortCode || 'FAC'}]
              </span>
            </span>
          </div>
        </div>

        {formError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            <AlertTriangle size={16} />
            <div>{formError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ── Encounter type ── */}
          <div className="form-group">
            <label className="form-label">Encounter / Visit Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.6rem' }}>
              {[
                { id: 'walk_in',          label: '🚶 Walk-In Visit',     desc: 'Primary acute / general visit' },
                { id: 'follow_up',        label: '🔄 Follow-Up Check',   desc: 'Scheduled maternal / cohort visit' },
                { id: 'referral_consult', label: '🩺 Referral Consult',  desc: 'Escalated specialist review' },
              ].map((t) => (
                <button
                  key={t.id} type="button" onClick={() => setEncounterType(t.id)}
                  style={{
                    padding: '0.6rem', borderRadius: 'var(--radius-md)', textAlign: 'left',
                    background: encounterType === t.id ? 'rgba(20,184,166,0.15)' : 'rgba(15,23,42,0.6)',
                    border: encounterType === t.id ? '1px solid #14b8a6' : '1px solid var(--border-subtle)',
                    color: encounterType === t.id ? '#ffffff' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{t.label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Vitals ── */}
          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <Activity size={16} color="#14b8a6" />
              <label className="form-label" style={{ marginBottom: 0 }}>
                Patient Vital Signs <span style={{ fontWeight: '400', color: 'var(--text-muted)' }}>(all optional)</span>
              </label>
            </div>

            {/* 6-column grid: systolic | diastolic | temp | pulse | spo2 | weight */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '0.6rem' }}>
              {[
                { name: 'systolic',  label: 'BP Sys (mmHg)', placeholder: '120', type: 'number' },
                { name: 'diastolic', label: 'BP Dia (mmHg)', placeholder: '80',  type: 'number' },
                { name: 'tempC',     label: 'Temp (°C)',     placeholder: '37.2', type: 'number', step: '0.1' },
                { name: 'pulse',     label: 'Pulse (bpm)',   placeholder: '78',  type: 'number' },
                { name: 'spo2',      label: 'SpO₂ (%)',      placeholder: '98',  type: 'number' },
                { name: 'weightKg',  label: 'Weight (kg)',   placeholder: '58',  type: 'number', step: '0.1' },
              ].map((f) => {
                const val = f.name === 'systolic' || f.name === 'diastolic'
                  ? vitals.bp[f.name] : vitals[f.name];
                const warnMsg = VITALS_WARNINGS[f.name]?.(Number(val));
                const showWarn = val !== '' && !isNaN(Number(val)) && warnMsg;

                return (
                  <div key={f.name}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                      {f.label}
                    </label>
                    <input
                      type={f.type}
                      step={f.step || '1'}
                      name={f.name}
                      placeholder={f.placeholder}
                      className="form-input"
                      style={{
                        fontSize: '0.85rem', padding: '0.5rem 0.6rem',
                        borderColor: showWarn ? 'rgba(245,158,11,0.6)' : undefined,
                      }}
                      value={val}
                      onChange={handleVitalChange}
                    />
                    {showWarn && (
                      <div style={{ fontSize: '0.67rem', color: '#f59e0b', marginTop: '2px', lineHeight: '1.3' }}>
                        ⚠ {warnMsg}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Aggregate warning banner for multiple flags */}
            {vitalsWarnings.length > 1 && (
              <div
                style={{
                  marginTop: '0.6rem', padding: '0.55rem 0.85rem',
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: '#f59e0b',
                  display: 'flex', alignItems: 'flex-start', gap: '0.4rem',
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                <div>
                  {vitalsWarnings.length} unusual vital reading{vitalsWarnings.length !== 1 ? 's' : ''} detected.
                  Submission is not blocked — verify readings with patient before saving.
                </div>
              </div>
            )}
          </div>

          {/* ── Symptoms checklist ── */}
          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={16} color="#06b6d4" />
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Structured Symptom Checklist
                </label>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#22d3ee', fontWeight: '700' }}>
                {selectedSymptoms.length} Selected
              </span>
            </div>

            {/* Category tabs */}
            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.4rem', marginBottom: '0.6rem' }}>
              {SYMPTOM_CATEGORIES.map((cat) => (
                <button
                  key={cat.id} type="button" onClick={() => setActiveCategory(cat.id)}
                  style={{
                    padding: '0.3rem 0.65rem', fontSize: '0.75rem',
                    borderRadius: 'var(--radius-full)',
                    background: activeCategory === cat.id ? '#0d9488' : 'rgba(255,255,255,0.05)',
                    color: activeCategory === cat.id ? '#ffffff' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap', border: 'none',
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Symptom chips — toggling stores/removes the symptom's `id` */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', minHeight: '80px' }}>
              {SYMPTOM_CATEGORIES.find((c) => c.id === activeCategory)?.symptoms.map((s) => {
                const isSelected = selectedSymptoms.includes(s.id);
                return (
                  <button
                    key={s.id} type="button" onClick={() => toggleSymptom(s.id)}
                    style={{
                      padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-md)',
                      fontSize: '0.78rem', fontWeight: '600',
                      background: isSelected ? 'rgba(20,184,166,0.25)' : 'rgba(15,23,42,0.7)',
                      border: isSelected ? '1px solid #14b8a6' : '1px solid var(--border-subtle)',
                      color: isSelected ? '#5eead4' : '#e2e8f0',
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isSelected && <CheckCircle2 size={12} color="#14b8a6" />}
                    {s.en} <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>({s.mr})</span>
                  </button>
                );
              })}
            </div>

            {/* Free-text catch-all — PRD §3: not parsed by triage */}
            <div style={{ marginTop: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                Other Symptoms <span style={{ color: 'var(--text-muted)' }}>(free text — not used by triage engine)</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. rash on forearm, joint swelling…"
                value={otherSymptoms}
                onChange={(e) => setOtherSymptoms(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <FileText size={16} color="#94a3b8" />
              <label className="form-label" style={{ marginBottom: 0 }}>
                Clinical Observations &amp; Treatment Notes
              </label>
            </div>
            <textarea
              rows={3}
              className="form-input"
              placeholder="Patient complaints, initial diagnosis, medications prescribed, referral notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* ── Demo presets ── */}
          <div className="demo-accounts" style={{ marginTop: '1.25rem' }}>
            <div className="demo-title">
              <Sparkles size={13} color="#14b8a6" />
              1-Click Demo Clinical Presets
            </div>
            <div className="demo-chips">
              <button type="button" className="demo-chip" onClick={() => handlePresetFill('routine')}>
                🩺 Routine Walk-in (Fever &amp; Cough)
              </button>
              <button type="button" className="demo-chip" onClick={() => handlePresetFill('emergency')}>
                🚨 Acute Emergency (Chest Pain, SOB, SpO₂ 88%)
              </button>
              <button type="button" className="demo-chip" onClick={() => handlePresetFill('antenatal')}>
                🤰 High-Risk Antenatal (BP 145/95, Edema)
              </button>
            </div>
          </div>

          {/* ── Actions ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? (
                'Saving Encounter…'
              ) : (
                <>
                  <Stethoscope size={15} /> Save Clinical Encounter
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
