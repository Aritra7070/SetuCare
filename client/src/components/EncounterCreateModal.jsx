import React, { useState } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../stores/authStore';
import { SYMPTOM_CATEGORIES } from '../utils/symptomVocabulary';
import {
  Stethoscope,
  Activity,
  Heart,
  Thermometer,
  Wind,
  Weight,
  FileText,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  Hospital,
  User,
  Layers,
} from 'lucide-react';

export const EncounterCreateModal = ({ patient, onClose, onSuccess }) => {
  const { user } = useAuthStore();

  const [encounterType, setEncounterType] = useState('walk_in');
  const [vitals, setVitals] = useState({
    bp: '',
    tempC: '',
    pulse: '',
    spo2: '',
    weightKg: '',
  });
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [activeCategory, setActiveCategory] = useState('general');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleVitalChange = (e) => {
    const { name, value } = e.target;
    setVitals((prev) => ({ ...prev, [name]: value }));
  };

  const toggleSymptom = (symptomString) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptomString)
        ? prev.filter((s) => s !== symptomString)
        : [...prev, symptomString]
    );
  };

  const handlePresetFill = (presetType) => {
    setFormError(null);
    if (presetType === 'routine') {
      setEncounterType('walk_in');
      setVitals({
        bp: '120/80',
        tempC: '37.8',
        pulse: '76',
        spo2: '98',
        weightKg: '56',
      });
      setSelectedSymptoms([
        'Fever (ताप)',
        'Severe Persistent Cough (तीव्र खोकला)',
        'Severe Weakness / Fatigue (अशक्तपणा)',
      ]);
      setNotes('Routine walk-in consultation. 3-day history of dry cough and mild fever. Hydration and rest advised.');
    } else if (presetType === 'emergency') {
      setEncounterType('referral_consult');
      setVitals({
        bp: '155/100',
        tempC: '37.0',
        pulse: '112',
        spo2: '88',
        weightKg: '62',
      });
      setSelectedSymptoms([
        'Acute Chest Pain / Tightness (छातीत तीव्र दुखणे)',
        'Breathlessness / SOB (दम लागणे)',
        'Dizziness / Vertigo (चक्कर येणे)',
      ]);
      setNotes('ACUTE CLINICAL DISTRESS: Patient presents with retrosternal chest pain and severe breathlessness with desaturation (SpO2 88%). High risk for acute coronary syndrome / cardiac emergency.');
    } else if (presetType === 'antenatal') {
      setEncounterType('follow_up');
      setVitals({
        bp: '145/95',
        tempC: '36.8',
        pulse: '84',
        spo2: '97',
        weightKg: '68',
      });
      setSelectedSymptoms([
        'Pregnancy-Induced High BP / Headache (गरोदरपणातील उच्च रक्तदाब)',
        'Swelling of Face & Feet (Edema) (चेहऱ्यावर व पायावर सूज)',
        'Severe Headache (डोकेदुखी)',
      ]);
      setNotes('Third-trimester antenatal check. Elevated BP with bilateral pedal edema and persistent headache. High risk preeclampsia warning signs.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    try {
      setSubmitting(true);
      const payload = {
        patientId: patient._id,
        encounterType,
        vitals,
        symptoms: selectedSymptoms,
        notes,
      };

      const res = await api.post('/encounters', payload);
      if (res.data.success) {
        onSuccess(res.data.encounter);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to record encounter');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 110,
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '92vh',
          overflowY: 'auto',
          border: '1px solid rgba(20, 184, 166, 0.5)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(20, 184, 166, 0.2)',
          padding: '1.75rem',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '1rem',
            marginBottom: '1.25rem',
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

          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', color: '#94a3b8', padding: '0.2rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Auto-Stamped Worker & Facility Badge */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid var(--border-subtle)',
            padding: '0.6rem 1rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1.25rem',
            fontSize: '0.825rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={15} color="#14b8a6" />
            <span>
              Attending Worker: <strong style={{ color: '#ffffff' }}>{user?.name}</strong> (
              <span style={{ textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</span>)
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
          <div className="alert alert-error">
            <AlertTriangle size={16} />
            <div>{formError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Encounter Type Selector */}
          <div className="form-group">
            <label className="form-label">Encounter / Visit Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
              {[
                { id: 'walk_in', label: '🚶 Walk-In Visit', desc: 'Primary acute/general visit' },
                { id: 'follow_up', label: '🔄 Follow-Up Check', desc: 'Scheduled maternal/cohort visit' },
                { id: 'referral_consult', label: '🩺 Referral Consult', desc: 'Escalated specialist review' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEncounterType(t.id)}
                  style={{
                    padding: '0.6rem',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'left',
                    background: encounterType === t.id ? 'rgba(20, 184, 166, 0.15)' : 'rgba(15, 23, 42, 0.6)',
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

          {/* Vitals Form Section */}
          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <Activity size={16} color="#14b8a6" />
              <label className="form-label" style={{ marginBottom: 0 }}>
                Patient Vital Signs (Loose Typed & Optional)
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.6rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  BP (mmHg)
                </label>
                <input
                  type="text"
                  name="bp"
                  placeholder="120/80"
                  className="form-input"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 0.6rem' }}
                  value={vitals.bp}
                  onChange={handleVitalChange}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  Temp (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="tempC"
                  placeholder="37.2"
                  className="form-input"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 0.6rem' }}
                  value={vitals.tempC}
                  onChange={handleVitalChange}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  Pulse (bpm)
                </label>
                <input
                  type="number"
                  name="pulse"
                  placeholder="78"
                  className="form-input"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 0.6rem' }}
                  value={vitals.pulse}
                  onChange={handleVitalChange}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  SpO2 (%)
                </label>
                <input
                  type="number"
                  name="spo2"
                  placeholder="98"
                  className="form-input"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 0.6rem' }}
                  value={vitals.spo2}
                  onChange={handleVitalChange}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="weightKg"
                  placeholder="58.5"
                  className="form-input"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 0.6rem' }}
                  value={vitals.weightKg}
                  onChange={handleVitalChange}
                />
              </div>
            </div>
          </div>

          {/* Structured Symptoms Checklist Section */}
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

            {/* Category Tabs */}
            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.4rem', marginBottom: '0.6rem' }}>
              {SYMPTOM_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.75rem',
                    borderRadius: 'var(--radius-full)',
                    background: activeCategory === cat.id ? '#0d9488' : 'rgba(255, 255, 255, 0.05)',
                    color: activeCategory === cat.id ? '#ffffff' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Symptoms Grid for Active Category */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', minHeight: '80px' }}>
              {SYMPTOM_CATEGORIES.find((c) => c.id === activeCategory)?.symptoms.map((s) => {
                const symptomLabel = `${s.en} (${s.mr})`;
                const isSelected = selectedSymptoms.includes(symptomLabel);

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSymptom(symptomLabel)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.78rem',
                      fontWeight: '600',
                      background: isSelected ? 'rgba(20, 184, 166, 0.25)' : 'rgba(15, 23, 42, 0.7)',
                      border: isSelected ? '1px solid #14b8a6' : '1px solid var(--border-subtle)',
                      color: isSelected ? '#5eead4' : '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isSelected && <CheckCircle2 size={12} color="#14b8a6" />}
                    {s.en} <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>({s.mr})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clinical Notes & Observations */}
          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <label className="form-label">Clinical Observations & Treatment Notes</label>
            <textarea
              rows={3}
              className="form-input"
              placeholder="e.g. Patient complaints, initial diagnosis, medication prescribed, or referral notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* 1-Click Clinical Presets */}
          <div className="demo-accounts" style={{ marginTop: '1.25rem' }}>
            <div className="demo-title">
              <Sparkles size={13} color="#14b8a6" />
              1-Click Demo Clinical Presets
            </div>
            <div className="demo-chips">
              <button
                type="button"
                className="demo-chip"
                onClick={() => handlePresetFill('routine')}
              >
                🩺 Routine Walk-in (Fever & Cough)
              </button>
              <button
                type="button"
                className="demo-chip"
                onClick={() => handlePresetFill('emergency')}
              >
                🚨 Acute Emergency (Chest Pain, SOB, SpO2 88%)
              </button>
              <button
                type="button"
                className="demo-chip"
                onClick={() => handlePresetFill('antenatal')}
              >
                🤰 High-Risk Antenatal (BP 145/95, Edema)
              </button>
            </div>
          </div>

          {/* Bottom Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? (
                'Saving Encounter...'
              ) : (
                <>
                  <Stethoscope size={15} /> Save Clinical Encounter
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
