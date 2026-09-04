/**
 * TeleconsultRequestModal — Step 17
 *
 * Props:
 *   patient    — { _id, name, phid, cohortMemberships }
 *   encounter  — { _id }
 *   onClose()
 *   onJoined({ sessionId, roomId, patient }) — called when the remote peer joins
 */
import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../stores/authStore';
import { useSocket } from '../hooks/useSocket';
import {
  Video, X, Search, ChevronDown, CheckCircle2,
  AlertTriangle, PhoneOff, Loader,
} from 'lucide-react';

const TIER_LABELS = {
  sub_centre: 'Sub-Centre', phc: 'PHC',
  rural_hospital: 'Rural Hospital', district_hospital: 'District Hospital',
};

export function TeleconsultRequestModal({ patient, encounter, onClose, onJoined }) {
  const { user } = useAuthStore();
  const socket   = useSocket();

  const [facilities,      setFacilities]      = useState([]);
  const [facLoading,      setFacLoading]       = useState(true);
  const [toFacilityId,    setToFacilityId]     = useState('');
  const [search,          setSearch]           = useState('');
  const [dropdownOpen,    setDropdownOpen]      = useState(false);

  const [submitting,      setSubmitting]        = useState(false);
  const [formError,       setFormError]         = useState(null);
  const [session,         setSession]           = useState(null); // after request
  const [callStatus,      setCallStatus]        = useState('idle'); // idle|ringing|declined|joined

  // ── Load facilities (exclude own) ──
  useEffect(() => {
    const myFid = user?.facility?._id?.toString() || user?.facility?.toString();
    api.get('/facilities')
      .then(res => {
        if (res.data.success) {
          setFacilities((res.data.facilities || []).filter(f => f._id.toString() !== myFid));
        }
      })
      .catch(() => {})
      .finally(() => setFacLoading(false));
  }, [user]);

  // ── Listen for join / end events ──
  useEffect(() => {
    if (!socket || !session) return;
    const handleJoined = (payload) => {
      if (payload.sessionId !== session._id) return;
      setCallStatus('joined');
      setSession(prev => ({ ...prev, roomId: prev.roomId }));
      onJoined({ sessionId: session._id, roomId: session.roomId, patient });
    };
    const handleEnded = (payload) => {
      if (payload.sessionId !== session._id) return;
      if (payload.status === 'declined') setCallStatus('declined');
    };
    socket.on('teleconsult:joined', handleJoined);
    socket.on('teleconsult:ended',  handleEnded);
    return () => {
      socket.off('teleconsult:joined', handleJoined);
      socket.off('teleconsult:ended',  handleEnded);
    };
  }, [socket, session, patient, onJoined]);

  const filteredFacilities = useMemo(() => {
    if (!search.trim()) return facilities;
    const q = search.toLowerCase();
    return facilities.filter(f =>
      f.name.toLowerCase().includes(q) || f.district?.toLowerCase().includes(q) || f.tier?.toLowerCase().includes(q)
    );
  }, [facilities, search]);

  const selectedFacility = useMemo(
    () => facilities.find(f => f._id === toFacilityId || f._id.toString() === toFacilityId?.toString()),
    [facilities, toFacilityId]
  );

  const handleRequest = async () => {
    if (!toFacilityId) { setFormError('Select a target facility.'); return; }
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await api.post('/teleconsult/request', {
        patient:         patient._id,
        sourceEncounter: encounter._id,
        targetFacility:  toFacilityId,
      });
      if (res.data.success) {
        setSession(res.data.session);
        setCallStatus('ringing');
      }
    } catch (err) {
      setFormError(err.message || 'Failed to request teleconsult');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (session?._id) {
      await api.patch(`/teleconsult/${session._id}/end`, { declined: true }).catch(() => {});
    }
    onClose();
  };

  // ── Ringing state ──
  if (callStatus === 'ringing' && session) {
    return (
      <div style={OVERLAY}>
        <div className="card" style={{ ...PANEL, maxWidth: '420px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#14b8a6', animation: `bounce17 1.2s ${i * 0.2}s infinite ease-in-out` }} />
            ))}
          </div>
          <style>{`@keyframes bounce17 { 0%,80%,100%{transform:scaleY(0.4)} 40%{transform:scaleY(1)} }`}</style>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.35rem' }}>Ringing…</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Waiting for <strong style={{ color: '#f8fafc' }}>{selectedFacility?.name || 'target facility'}</strong> to answer
          </p>
          <p style={{ fontSize: '0.78rem', color: '#22d3ee', fontFamily: 'var(--font-mono)', marginBottom: '1.25rem' }}>
            Patient: {patient.name} · {patient.phid}
          </p>
          <button onClick={handleCancel} className="btn btn-outline" style={{ borderColor: 'rgba(244,63,94,0.4)', color: '#fb7185' }}>
            <PhoneOff size={14} /> Cancel
          </button>
        </div>
      </div>
    );
  }

  if (callStatus === 'declined') {
    return (
      <div style={OVERLAY}>
        <div className="card" style={{ ...PANEL, maxWidth: '380px', textAlign: 'center' }}>
          <AlertTriangle size={32} color="#f43f5e" style={{ margin: '0 auto 0.75rem auto' }} />
          <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#ffffff', marginBottom: '0.4rem' }}>Call Declined</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            {selectedFacility?.name} declined the teleconsult request.
          </p>
          <button onClick={onClose} className="btn btn-outline">Close</button>
        </div>
      </div>
    );
  }

  // ── Facility picker form ──
  return (
    <div style={OVERLAY}>
      <div className="card" style={PANEL}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Video size={20} color="#14b8a6" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#ffffff' }}>Request Teleconsult</h2>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Patient: <strong style={{ color: '#f8fafc' }}>{patient.name}</strong>
          {' '}· <span style={{ fontFamily: 'var(--font-mono)', color: '#22d3ee' }}>{patient.phid}</span>
        </div>

        {formError && (
          <div className="alert alert-error" style={{ marginBottom: '0.85rem' }}>
            <AlertTriangle size={14} /><span>{formError}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Target Facility</label>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setDropdownOpen(v => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-focus)', background: 'rgba(15,23,42,0.7)', color: '#f8fafc', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {selectedFacility ? (
                <span>{selectedFacility.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>· {TIER_LABELS[selectedFacility.tier]} · {selectedFacility.district}</span></span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>{facLoading ? 'Loading…' : 'Select facility'}</span>
              )}
              <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>

            {dropdownOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-focus)', background: '#0f172a', boxShadow: '0 12px 40px rgba(0,0,0,0.7)', maxHeight: '240px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={12} color="#64748b" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input autoFocus type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                      style={{ width: '100%', padding: '0.4rem 0.5rem 0.4rem 1.7rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.04)', color: '#f8fafc', fontSize: '0.82rem', fontFamily: 'inherit' }} />
                  </div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {filteredFacilities.map(f => {
                    const isSel = f._id.toString() === toFacilityId?.toString();
                    return (
                      <button key={f._id} type="button"
                        onClick={() => { setToFacilityId(f._id); setDropdownOpen(false); setSearch(''); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.85rem', background: isSel ? 'rgba(20,184,166,0.12)' : 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'left', fontFamily: 'inherit' }}
                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: isSel ? '700' : '500', color: isSel ? '#5eead4' : '#f8fafc' }}>{f.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{TIER_LABELS[f.tier]}{f.district ? ` · ${f.district}` : ''}</div>
                        </div>
                        {isSel && <CheckCircle2 size={14} color="#14b8a6" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button type="button" onClick={handleRequest} disabled={submitting || !toFacilityId} className="btn btn-primary">
            {submitting ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Requesting…</> : <><Video size={14} /> Request Teleconsult</>}
          </button>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    </div>
  );
}

const OVERLAY = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 130, padding: '1rem' };
const PANEL   = { width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(20,184,166,0.4)', boxShadow: '0 25px 60px rgba(0,0,0,0.9)', padding: '1.5rem' };
