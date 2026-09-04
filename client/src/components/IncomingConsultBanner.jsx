/**
 * IncomingConsultBanner — Step 17
 *
 * Globally mounted (in App.jsx). Listens on the facility socket room for
 * teleconsult:requested events and shows a fixed banner for medical_officers
 * and specialists who can answer.
 *
 * Props:
 *   onJoin({ sessionId, roomId, patient }) — called when user accepts
 */
import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../stores/authStore';
import { useSocket } from '../hooks/useSocket';
import { Video, X, PhoneOff } from 'lucide-react';

const TIER_COLORS = {
  sub_centre: '#34d399', phc: '#22d3ee',
  rural_hospital: '#c4b5fd', district_hospital: '#fb7185',
};

export function IncomingConsultBanner({ onJoin }) {
  const { user } = useAuthStore();
  const socket   = useSocket();
  const [request, setRequest] = useState(null);   // incoming teleconsult payload
  const [joining, setJoining] = useState(false);
  const [declined, setDeclined] = useState(false);

  const canAnswer = user && ['medical_officer', 'specialist', 'admin'].includes(user.role);

  // ── Join facility socket room (same pattern as Step 10) ──
  useEffect(() => {
    if (!socket || !user?.facility) return;
    const fid = (user.facility._id || user.facility).toString();
    socket.emit('join:facility', { facilityId: fid });
    return () => socket.emit('leave:facility', { facilityId: fid });
  }, [socket, user]);

  // ── Listen for incoming requests ──
  useEffect(() => {
    if (!socket || !canAnswer) return;
    const handler = (payload) => {
      setRequest(payload);
      setDeclined(false);
      setJoining(false);
    };
    socket.on('teleconsult:requested', handler);
    return () => socket.off('teleconsult:requested', handler);
  }, [socket, canAnswer]);

  // ── Listen for end/cancel while banner is showing ──
  useEffect(() => {
    if (!socket || !request) return;
    const handler = (payload) => {
      if (payload.sessionId === request.sessionId) setRequest(null);
    };
    socket.on('teleconsult:ended', handler);
    return () => socket.off('teleconsult:ended', handler);
  }, [socket, request]);

  const handleJoin = async () => {
    if (!request) return;
    setJoining(true);
    try {
      const res = await api.patch(`/teleconsult/${request.sessionId}/join`);
      if (res.data.success) {
        setRequest(null);
        onJoin({ sessionId: request.sessionId, roomId: res.data.roomId, patient: { name: request.patientName, phid: request.patientPhid, _id: request.patientId } });
      }
    } catch (err) {
      console.error('[Teleconsult] join error:', err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleDecline = async () => {
    if (!request) return;
    setDeclined(true);
    try {
      await api.patch(`/teleconsult/${request.sessionId}/end`, { declined: true });
    } catch (_) {}
    setTimeout(() => { setRequest(null); setDeclined(false); }, 1500);
  };

  if (!request || !canAnswer) return null;

  const fromColor = TIER_COLORS[request.fromFacility?.tier] || '#94a3b8';

  return (
    <div
      style={{
        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 190, width: '100%', maxWidth: '460px', padding: '0 1rem',
        animation: 'slideUp17 0.35s cubic-bezier(0.23,1,0.32,1)',
      }}
    >
      <style>{`@keyframes slideUp17{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
      <div
        style={{
          background: 'rgba(10,15,29,0.97)',
          border: '1px solid rgba(20,184,166,0.5)',
          borderRadius: '14px',
          padding: '1rem 1.25rem',
          boxShadow: '0 8px 40px rgba(0,0,0,0.8), 0 0 20px rgba(20,184,166,0.15)',
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}
      >
        {/* Pulse dot + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#14b8a6', boxShadow: '0 0 8px rgba(20,184,166,0.8)', animation: 'pulse17 1.5s infinite', flexShrink: 0 }} />
          <style>{`@keyframes pulse17{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
          <span style={{ fontWeight: '800', fontSize: '0.95rem', color: '#ffffff' }}>Incoming Teleconsult</span>
          {!declined && (
            <button onClick={() => setRequest(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0' }}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Patient + from-facility info */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '0.9rem' }}>{request.patientName}</div>
            <div style={{ fontFamily: 'var(--font-mono)', color: '#22d3ee', fontSize: '0.75rem', marginTop: '1px' }}>{request.patientPhid}</div>
            <div style={{ marginTop: '5px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              From:{' '}
              <strong style={{ color: fromColor }}>{request.fromFacility?.name}</strong>
              {' '}· {request.requestedBy?.name}
            </div>
          </div>
        </div>

        {declined ? (
          <div style={{ textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8', padding: '0.35rem 0' }}>Call declined.</div>
        ) : (
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="btn btn-primary"
              style={{ flex: 1, background: 'linear-gradient(135deg,#0d9488,#06b6d4)', fontSize: '0.875rem' }}
            >
              <Video size={15} /> {joining ? 'Connecting…' : 'Join Video Call'}
            </button>
            <button
              onClick={handleDecline}
              className="btn btn-outline"
              style={{ padding: '0.55rem 0.85rem', borderColor: 'rgba(244,63,94,0.4)', color: '#fb7185' }}
            >
              <PhoneOff size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
