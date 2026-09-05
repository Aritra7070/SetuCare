/**
 * SetuCare Step 19 — IncomingEmergencyOverlay
 *
 * Full-screen persistent alert shown at the receiving facility when a
 * 'referral:emergency' socket event arrives. Stays visible until the
 * user explicitly acknowledges it — cannot be dismissed by clicking outside.
 *
 * Audio: attempts a Web Audio API beep sequence. Browsers often block
 * autoplay without a prior user interaction; the beep may not fire on the
 * very first load. This is an honest limitation — not a silent failure.
 *
 * Props:
 *   alert          — the socket payload: { referralId, patientName, patientPhid,
 *                    fromFacility, reason, riskLevel, isEmergency, escalatedAt,
 *                    createdAt, status }
 *   onAcknowledge  — called after PATCH /api/referrals/:id/status succeeds
 *   onOpenTimeline — optional — open the patient timeline from within the overlay
 */

import React, { useEffect, useRef, useState } from 'react';
import { Siren, Hospital, ArrowRight, CheckCircle2, AlertTriangle, Phone } from 'lucide-react';
import api from '../api/axios';

// ---------------------------------------------------------------------------
// Audio helper — three short 880Hz beeps via Web Audio API.
// Wrapped in a function so we can catch the autoplay NotAllowedError gracefully.
// ---------------------------------------------------------------------------
function playEmergencyBeeps() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const schedule = (startTime) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type      = 'square';
      osc.frequency.setValueAtTime(880, startTime);
      gain.gain.setValueAtTime(0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
      osc.start(startTime);
      osc.stop(startTime + 0.28);
    };
    const now = ctx.currentTime;
    schedule(now);
    schedule(now + 0.4);
    schedule(now + 0.8);
    // Close context after beeps finish to release resources
    setTimeout(() => ctx.close(), 1500);
  } catch (e) {
    // Autoplay blocked or Web Audio unavailable — degrade silently
    console.info('[Emergency] Audio alert unavailable (browser autoplay policy):', e.message);
  }
}

// ---------------------------------------------------------------------------
// IncomingEmergencyOverlay
// ---------------------------------------------------------------------------
export const IncomingEmergencyOverlay = ({ alert, onAcknowledge, onOpenTimeline }) => {
  const [acking,  setAcking]  = useState(false);
  const [ackDone, setAckDone] = useState(false);
  const [error,   setError]   = useState(null);
  const pulseRef = useRef(null);

  // Play audio + start pulse animation on mount
  useEffect(() => {
    playEmergencyBeeps();
    // Pulse the border continuously until acknowledged
    if (pulseRef.current) {
      pulseRef.current.style.animation = 'emergencyPulse 1.4s ease-in-out infinite';
    }
  }, []);

  const handleAcknowledge = async () => {
    setAcking(true);
    setError(null);
    try {
      await api.patch(`/referrals/${alert.referralId}/status`, { status: 'acknowledged' });
      setAckDone(true);
      // Stop pulsing
      if (pulseRef.current) pulseRef.current.style.animation = 'none';
      // Give a moment for the success state to render, then hand off
      setTimeout(() => onAcknowledge(alert.referralId), 1200);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Acknowledge failed — try again.');
      setAcking(false);
    }
  };

  const timeSince = (dateStr) => {
    if (!dateStr) return '';
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins} min ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 300,   // above everything else including other modals
        padding: '1.5rem',
      }}
      // Prevent dismiss on backdrop click — this alert must be explicitly acknowledged
      onClick={e => e.stopPropagation()}
    >
      <div
        ref={pulseRef}
        style={{
          width: '100%', maxWidth: '520px',
          background: 'linear-gradient(160deg, rgba(15,5,5,0.99) 0%, rgba(30,5,5,0.99) 100%)',
          border: '2px solid rgba(244,63,94,0.7)',
          borderRadius: '18px',
          boxShadow: '0 0 80px rgba(244,63,94,0.4), 0 32px 64px rgba(0,0,0,0.9)',
          overflow: 'hidden',
        }}
      >
        {/* ── Flashing top banner ── */}
        <div
          style={{
            background: 'rgba(244,63,94,0.22)',
            borderBottom: '1px solid rgba(244,63,94,0.4)',
            padding: '1rem 1.5rem',
            display: 'flex', alignItems: 'center', gap: '0.9rem',
          }}
        >
          <Siren size={28} color="#f43f5e" style={{ flexShrink: 0, filter: 'drop-shadow(0 0 8px rgba(244,63,94,0.8))' }} />
          <div>
            <div style={{ fontWeight: '900', fontSize: '1.2rem', color: '#f87171', letterSpacing: '-0.01em' }}>
              🚨 INCOMING EMERGENCY REFERRAL
            </div>
            <div style={{ fontSize: '0.78rem', color: '#fca5a5', marginTop: '2px' }}>
              {alert.escalatedAt
                ? `Escalated from existing referral · ${timeSince(alert.escalatedAt)}`
                : `Declared ${timeSince(alert.createdAt)}`}
            </div>
          </div>
        </div>

        {/* ── Patient identity ── */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(244,63,94,0.15)' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.02em' }}>
            {alert.patientName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '0.88rem',
                color: '#22d3ee', background: 'rgba(6,182,212,0.12)',
                padding: '0.2rem 0.6rem', borderRadius: '6px',
                border: '1px solid rgba(6,182,212,0.3)',
              }}
            >
              {alert.patientPhid}
            </span>
            {alert.fromFacility && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', color: '#94a3b8' }}>
                <Hospital size={13} />
                From: <strong style={{ color: '#e2e8f0' }}>{alert.fromFacility.name}</strong>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  ({alert.fromFacility.tier?.replace('_', ' ')})
                </span>
              </span>
            )}
          </div>
        </div>

        {/* ── Reason ── */}
        {alert.reason && (
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(244,63,94,0.15)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>
              Clinical Reason
            </div>
            <div style={{ fontSize: '0.9rem', color: '#f1f5f9', lineHeight: 1.5 }}>
              {alert.reason}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#f87171', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '8px', padding: '0.6rem 0.9rem' }}>
              <AlertTriangle size={15} />
              {error}
            </div>
          )}

          {/* Primary: Acknowledge */}
          {!ackDone ? (
            <button
              type="button"
              onClick={handleAcknowledge}
              disabled={acking}
              style={{
                width: '100%', padding: '1rem',
                fontWeight: '900', fontSize: '1rem',
                background: acking
                  ? 'rgba(244,63,94,0.3)'
                  : 'linear-gradient(135deg, rgba(244,63,94,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                border: '1px solid rgba(244,63,94,0.7)',
                color: '#ffffff',
                borderRadius: '12px',
                cursor: acking ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                boxShadow: acking ? 'none' : '0 4px 20px rgba(244,63,94,0.4)',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              {acking ? (
                <>
                  <span
                    style={{
                      width: '16px', height: '16px',
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: '#ffffff',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  Acknowledging…
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  Acknowledge Emergency
                </>
              )}
            </button>
          ) : (
            <div
              style={{
                width: '100%', padding: '1rem',
                background: 'rgba(16,185,129,0.15)',
                border: '1px solid rgba(16,185,129,0.4)',
                borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                color: '#34d399', fontWeight: '700', fontSize: '0.95rem',
              }}
            >
              <CheckCircle2 size={18} />
              Acknowledged — updating…
            </div>
          )}

          {/* Secondary: open patient timeline */}
          {onOpenTimeline && alert.patientPhid && (
            <button
              type="button"
              onClick={() => onOpenTimeline(alert.patientPhid)}
              style={{
                width: '100%', padding: '0.7rem',
                fontWeight: '600', fontSize: '0.875rem',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#94a3b8',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                fontFamily: 'inherit',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#f1f5f9'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              Open Patient Timeline <ArrowRight size={14} />
            </button>
          )}

          {/* Limitation notice */}
          <div style={{ fontSize: '0.7rem', color: '#334155', textAlign: 'center', lineHeight: 1.5 }}>
            This alert only reaches users currently logged in. For a confirmed life-threatening emergency,
            also make a direct phone call to the referring facility.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes emergencyPulse {
          0%, 100% { box-shadow: 0 0 80px rgba(244,63,94,0.4), 0 32px 64px rgba(0,0,0,0.9); border-color: rgba(244,63,94,0.7); }
          50%       { box-shadow: 0 0 120px rgba(244,63,94,0.7), 0 32px 64px rgba(0,0,0,0.9); border-color: rgba(244,63,94,1.0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
