/**
 * VideoRoom — SetuCare Step 17
 *
 * PeerJS-based video room shared between the requesting worker and the
 * joining specialist. Uses PeerJS's public hosted broker (no self-hosted
 * TURN server needed for a demo — known limitation for production NAT scenarios).
 *
 * Props:
 *   sessionId   — TeleconsultSession._id
 *   roomId      — PeerJS room identifier
 *   isInitiator — true for the requesting worker (calls the peer)
 *                 false for the joining specialist (waits for call)
 *   patient     — { name, phid }
 *   onEnd(notes) — called when session ends (opens post-call prompt in parent)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Peer } from 'peerjs';
import api from '../api/axios';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  AlertTriangle, Loader,
} from 'lucide-react';

// PeerJS public broker config — sufficient for a demo
const PEER_CONFIG = {
  host:   '0.peerjs.com',
  port:   443,
  path:   '/',
  secure: true,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  },
};

export function VideoRoom({ sessionId, roomId, isInitiator, patient, onEnd }) {
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef        = useRef(null);
  const streamRef      = useRef(null);
  const callRef        = useRef(null);

  const [status,      setStatus]      = useState('connecting'); // connecting|waiting|active|error
  const [errorMsg,    setErrorMsg]    = useState('');
  const [micMuted,    setMicMuted]    = useState(false);
  const [camOff,      setCamOff]      = useState(false);
  const [elapsedSec,  setElapsedSec]  = useState(0);
  const [ending,      setEnding]      = useState(false);
  const [showNotes,   setShowNotes]   = useState(false);
  const [postNotes,   setPostNotes]   = useState('');
  const [logAsEnc,    setLogAsEnc]    = useState(false);

  // ── Timer ──
  useEffect(() => {
    if (status !== 'active') return;
    const t = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  // ── Attach stream to video element ──
  const attachStream = useCallback((el, stream) => {
    if (!el || !stream) return;
    el.srcObject = stream;
    el.play().catch(() => {});
  }, []);

  // ── Cleanup ──
  const cleanup = useCallback(() => {
    callRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    peerRef.current?.destroy();
  }, []);

  // ── Main PeerJS setup ──
  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      try {
        // Get local media first
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        attachStream(localVideoRef.current, stream);

        // Create Peer with deterministic ID
        const myPeerId = isInitiator ? `${roomId}-caller` : `${roomId}-receiver`;
        const peer = new Peer(myPeerId, PEER_CONFIG);
        peerRef.current = peer;

        peer.on('error', (err) => {
          if (!mounted) return;
          console.error('[PeerJS]', err);
          setStatus('error');
          setErrorMsg(err.type === 'unavailable-id'
            ? 'Room ID conflict — please try again.'
            : `Connection error: ${err.message || err.type}`);
        });

        if (isInitiator) {
          // Caller: wait for peer to register then call
          peer.on('open', () => {
            if (!mounted) return;
            setStatus('waiting');
            // Poll briefly then call — receiver may not be registered yet
            setTimeout(() => {
              if (!mounted) return;
              const call = peer.call(`${roomId}-receiver`, stream);
              callRef.current = call;
              call.on('stream', (remoteStream) => {
                if (!mounted) return;
                attachStream(remoteVideoRef.current, remoteStream);
                setStatus('active');
              });
              call.on('close', () => mounted && setStatus('ended'));
              call.on('error', (e) => { if (mounted) { setStatus('error'); setErrorMsg(e.message); }});
            }, 2500);
          });
        } else {
          // Receiver: answer incoming call
          setStatus('waiting');
          peer.on('open', () => {});
          peer.on('call', (call) => {
            if (!mounted) return;
            callRef.current = call;
            call.answer(stream);
            call.on('stream', (remoteStream) => {
              if (!mounted) return;
              attachStream(remoteVideoRef.current, remoteStream);
              setStatus('active');
            });
            call.on('close', () => mounted && setStatus('ended'));
          });
        }
      } catch (err) {
        if (!mounted) return;
        setStatus('error');
        setErrorMsg(
          err.name === 'NotAllowedError'
            ? 'Camera/microphone access denied. Please allow permissions and try again.'
            : `Media error: ${err.message}`
        );
      }
    };

    setup();
    return () => { mounted = false; cleanup(); };
  }, [roomId, isInitiator, attachStream, cleanup]);

  // ── Mute / camera toggle ──
  const toggleMic = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = micMuted; });
    setMicMuted(v => !v);
  };
  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = camOff; });
    setCamOff(v => !v);
  };

  // ── End call ──
  const handleEnd = async (notes = '') => {
    setEnding(true);
    try {
      await api.patch(`/teleconsult/${sessionId}/end`, { notes: notes || undefined });
    } catch (_) {}
    cleanup();
    onEnd({ notes, logAsEncounter: logAsEnc });
  };

  const handleEndClick = () => {
    if (status === 'active') {
      setShowNotes(true);
    } else {
      handleEnd();
    }
  };

  // ── Status overlay ──
  const renderOverlay = () => {
    if (status === 'connecting') return (
      <div style={overlayStyle}>
        <Loader size={28} color="#14b8a6" style={{ animation: 'spin 1s linear infinite' }} />
        <div style={overlayText}>Requesting camera access…</div>
      </div>
    );
    if (status === 'waiting') return (
      <div style={overlayStyle}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[0,1,2].map(i => <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#14b8a6', animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out` }} />)}
        </div>
        <div style={overlayText}>{isInitiator ? 'Ringing…' : 'Waiting for caller…'}</div>
        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>{patient.name} · {patient.phid}</div>
      </div>
    );
    if (status === 'error') return (
      <div style={overlayStyle}>
        <AlertTriangle size={28} color="#f43f5e" />
        <div style={{ ...overlayText, color: '#fb7185' }}>{errorMsg || 'Connection failed'}</div>
        <button onClick={() => handleEnd()} style={btnStyle('#f43f5e')}>Close</button>
      </div>
    );
    return null;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#070c1a', zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes bounce  { 0%,80%,100% { transform: scaleY(0.4); } 40% { transform: scaleY(1.0); } }
      `}</style>

      {/* Patient info bar */}
      <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: '700', color: '#f8fafc' }}>{patient.name}</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: '#22d3ee', fontSize: '12px' }}>{patient.phid}</span>
        </div>
        {status === 'active' && (
          <span style={{ color: '#34d399', fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34d399', display: 'inline-block', animation: 'none' }} />
            {formatTime(elapsedSec)}
          </span>
        )}
      </div>

      {/* Video area */}
      <div style={{ flex: 1, position: 'relative', background: '#0a0f1a', overflow: 'hidden' }}>
        {/* Remote video — full size */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: status === 'active' ? 1 : 0.15 }}
        />

        {/* Local video — PiP corner */}
        <div style={{ position: 'absolute', bottom: '80px', right: '16px', width: '160px', height: '120px', borderRadius: '10px', overflow: 'hidden', border: '2px solid rgba(20,184,166,0.5)', boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: camOff ? 0.3 : 1 }}
          />
          {camOff && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}><VideoOff size={20} color="#94a3b8" /></div>}
        </div>

        {/* Status overlay */}
        {renderOverlay()}
      </div>

      {/* Controls bar */}
      <div style={{ padding: '14px 24px', background: 'rgba(10,15,29,0.95)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <button onClick={toggleMic} title={micMuted ? 'Unmute' : 'Mute'} style={{ ...controlBtn, background: micMuted ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.06)' }}>
          {micMuted ? <MicOff size={20} color="#fb7185" /> : <Mic size={20} color="#e2e8f0" />}
        </button>
        <button onClick={toggleCam} title={camOff ? 'Enable camera' : 'Disable camera'} style={{ ...controlBtn, background: camOff ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.06)' }}>
          {camOff ? <VideoOff size={20} color="#fb7185" /> : <Video size={20} color="#e2e8f0" />}
        </button>
        <button onClick={handleEndClick} disabled={ending} style={{ ...controlBtn, background: 'rgba(244,63,94,0.85)', padding: '12px 24px', borderRadius: '9999px', gap: '8px' }}>
          <PhoneOff size={18} color="#ffffff" />
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#ffffff' }}>End Call</span>
        </button>
      </div>

      {/* Post-call notes panel */}
      {showNotes && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '1.5rem', border: '1px solid rgba(20,184,166,0.4)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffffff', marginBottom: '1rem' }}>End Teleconsult</h2>
            <div className="form-group">
              <label className="form-label">Consultation notes <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>(optional)</span></label>
              <textarea
                rows={3}
                className="form-input"
                placeholder="Summary of discussion, advice given, follow-up plan…"
                value={postNotes}
                onChange={e => setPostNotes(e.target.value)}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0.75rem 0 1.25rem', cursor: 'pointer', fontSize: '0.875rem', color: '#f1f5f9' }}>
              <input
                type="checkbox"
                checked={logAsEnc}
                onChange={e => setLogAsEnc(e.target.checked)}
                style={{ accentColor: '#14b8a6', width: '15px', height: '15px' }}
              />
              Log this consultation as a clinical Encounter (pre-fills referral_consult form)
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNotes(false)} className="btn btn-outline">Back to Call</button>
              <button onClick={() => handleEnd(postNotes)} disabled={ending} className="btn btn-primary" style={{ background: 'linear-gradient(135deg,#f43f5e,#dc2626)' }}>
                <PhoneOff size={14} /> Confirm End
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const controlBtn = {
  width: '46px', height: '46px', borderRadius: '50%', border: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', transition: 'background 0.2s',
};
const overlayStyle = {
  position: 'absolute', inset: 0,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: '12px', background: 'rgba(7,12,26,0.85)',
};
const overlayText  = { fontSize: '15px', fontWeight: '600', color: '#e2e8f0' };
const btnStyle = (color) => ({
  padding: '7px 20px', borderRadius: '9999px', border: `1px solid ${color}`,
  background: 'transparent', color, cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit',
});
