/**
 * SetuCare Step 19 — EmergencyDeclareModal
 *
 * Fast-path emergency declaration. Minimal form — description is optional so
 * a worker can act in seconds. Vitals are also optional; if already captured
 * on the current encounter, the caller can pass them in via props.
 *
 * On success: calls onSuccess({ referral, routedTo }) so PatientTimelinePage
 * can update its encounter list optimistically and show the confirmation strip.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Siren, X, ArrowRight, Hospital, Phone } from 'lucide-react';
import api from '../api/axios';

export const EmergencyDeclareModal = ({ patient, prefillVitals, onClose, onSuccess }) => {
  const { t } = useTranslation();

  const [description, setDescription] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [confirmed,   setConfirmed]   = useState(false); // two-step confirm guard

  const handleDeclare = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = { patient: patient._id };
      if (description.trim())  body.description = description.trim();
      if (prefillVitals)        body.vitals      = prefillVitals;

      const res = await api.post('/emergency/declare', body);
      if (res.data.success) {
        onSuccess(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Emergency declaration failed.');
      setConfirmed(false); // allow retry
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200,
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: '480px',
          background: 'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,10,10,0.98) 100%)',
          border: '1px solid rgba(244,63,94,0.5)',
          borderRadius: '16px',
          boxShadow: '0 0 60px rgba(244,63,94,0.25), 0 24px 48px rgba(0,0,0,0.8)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            background: 'rgba(244,63,94,0.12)',
            borderBottom: '1px solid rgba(244,63,94,0.3)',
            padding: '1.25rem 1.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(244,63,94,0.2)', border: '1px solid rgba(244,63,94,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Siren size={22} color="#f43f5e" />
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#f87171' }}>
                Declare Emergency
              </div>
              <div style={{ fontSize: '0.78rem', color: '#fca5a5', marginTop: '1px' }}>
                {patient.name} &bull;{' '}
                <span style={{ fontFamily: 'var(--font-mono)', color: '#fb7185' }}>{patient.phid}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '1.5rem' }}>

          {/* What this does */}
          <div
            style={{
              background: 'rgba(244,63,94,0.07)',
              border: '1px solid rgba(244,63,94,0.2)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.82rem',
              color: '#fca5a5',
              lineHeight: 1.55,
              marginBottom: '1.25rem',
            }}
          >
            <strong style={{ color: '#f87171' }}>This will:</strong>
            {' '}create an emergency encounter, route directly to the nearest district hospital via
            the stepped-care chain, and immediately alert the receiving facility.
            The triage rule engine is bypassed — your clinical judgment takes precedence.
          </div>

          {/* Optional description */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ color: '#fca5a5' }}>
              Brief clinical description{' '}
              <span style={{ color: '#64748b', fontWeight: '400' }}>
                (optional — leave blank to send immediately)
              </span>
            </label>
            <textarea
              rows={3}
              className="form-input"
              style={{
                borderColor: 'rgba(244,63,94,0.3)',
                background: 'rgba(15,23,42,0.8)',
                resize: 'vertical',
              }}
              placeholder="e.g. Patient collapsed, SpO₂ 76%, chest pain radiating to left arm…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Vitals summary if prefilled */}
          {prefillVitals && (
            <div
              style={{
                background: 'rgba(244,63,94,0.05)',
                border: '1px solid rgba(244,63,94,0.15)',
                borderRadius: '8px',
                padding: '0.6rem 0.9rem',
                fontSize: '0.78rem',
                color: '#fca5a5',
                marginBottom: '1.25rem',
                display: 'flex', gap: '1rem', flexWrap: 'wrap',
              }}
            >
              {prefillVitals.spo2     != null && <span>SpO₂: <strong>{prefillVitals.spo2}%</strong></span>}
              {prefillVitals.bp?.systolic != null && <span>BP: <strong>{prefillVitals.bp.systolic}/{prefillVitals.bp.diastolic}</strong></span>}
              {prefillVitals.pulse    != null && <span>Pulse: <strong>{prefillVitals.pulse} bpm</strong></span>}
              {prefillVitals.tempC    != null && <span>Temp: <strong>{prefillVitals.tempC}°C</strong></span>}
            </div>
          )}

          {error && (
            <div
              className="alert alert-error"
              style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}
            >
              <AlertTriangle size={16} />
              <div>{error}</div>
            </div>
          )}

          {/* Two-step confirm guard */}
          {!confirmed ? (
            <button
              type="button"
              onClick={() => setConfirmed(true)}
              disabled={loading}
              className="btn"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: '800',
                background: 'rgba(244,63,94,0.15)',
                border: '1px solid rgba(244,63,94,0.5)',
                color: '#f87171',
                borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.15)'; }}
            >
              <Siren size={18} />
              Declare Emergency
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div
                style={{
                  fontSize: '0.82rem', color: '#fbbf24',
                  textAlign: 'center', fontWeight: '600',
                  padding: '0.5rem',
                  background: 'rgba(245,158,11,0.08)',
                  borderRadius: '8px',
                  border: '1px solid rgba(245,158,11,0.25)',
                }}
              >
                ⚠️ Confirm: this will immediately alert the district hospital and cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setConfirmed(false)}
                  disabled={loading}
                  className="btn btn-outline"
                  style={{ flex: 1, borderColor: 'rgba(148,163,184,0.3)' }}
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={handleDeclare}
                  disabled={loading}
                  className="btn"
                  style={{
                    flex: 2,
                    padding: '0.75rem',
                    fontWeight: '800',
                    fontSize: '0.92rem',
                    background: loading ? 'rgba(244,63,94,0.2)' : 'rgba(244,63,94,0.9)',
                    border: '1px solid rgba(244,63,94,0.8)',
                    color: '#ffffff',
                    borderRadius: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    transition: 'background 0.15s',
                  }}
                >
                  {loading ? (
                    <>
                      <span
                        style={{
                          width: '14px', height: '14px',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#ffffff',
                          borderRadius: '50%',
                          display: 'inline-block',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                      Declaring…
                    </>
                  ) : (
                    <>
                      <Siren size={16} /> Confirm — Declare Emergency <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Honest limitation notice */}
          <div
            style={{
              marginTop: '1rem',
              fontSize: '0.72rem',
              color: '#475569',
              lineHeight: 1.5,
              textAlign: 'center',
            }}
          >
            <strong style={{ color: '#64748b' }}>Note:</strong>{' '}
            The alert reaches anyone with the app currently open at the receiving facility.
            For a life-threatening case, also make a direct phone call — do not rely solely on this system.
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ---------------------------------------------------------------------------
// EmergencyConfirmationStrip — shown inline on the timeline after declaration
// ---------------------------------------------------------------------------
export const EmergencyConfirmationStrip = ({ routedTo, onDismiss }) => (
  <div
    style={{
      background: 'rgba(244,63,94,0.1)',
      border: '1px solid rgba(244,63,94,0.4)',
      borderRadius: '10px',
      padding: '1rem 1.25rem',
      display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
      marginBottom: '1rem',
    }}
  >
    <Siren size={22} color="#f43f5e" style={{ flexShrink: 0 }} />
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: '800', color: '#f87171', fontSize: '0.95rem' }}>
        Emergency Declared
      </div>
      <div style={{ fontSize: '0.82rem', color: '#fca5a5', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Hospital size={13} />
        Routed to <strong>{routedTo.name}</strong>
        {routedTo.contactPhone && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#fb7185' }}>
            <Phone size={12} /> {routedTo.contactPhone}
          </span>
        )}
        <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
          — facility notified via app. Make a direct call for confirmed life-threat.
        </span>
      </div>
    </div>
    {onDismiss && (
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.2rem', flexShrink: 0 }}
      >
        <X size={16} />
      </button>
    )}
  </div>
);
