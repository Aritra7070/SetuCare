/**
 * useSocket — SetuCare Step 9
 *
 * Returns a stable Socket.IO client instance for the current user session.
 * The socket is created once per app lifetime (singleton), connects on first
 * call, and is torn down when the user logs out (user becomes null).
 *
 * Usage:
 *   const socket = useSocket();
 *   useEffect(() => {
 *     socket.on('referral:statusUpdated', handler);
 *     return () => socket.off('referral:statusUpdated', handler);
 *   }, [socket]);
 *
 * To join / leave a patient room:
 *   socket.emit('join:patient',  { patientId });
 *   socket.emit('leave:patient', { patientId });
 */

import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

// Singleton — shared across all hook consumers in the same tab
let _socket = null;

function getOrCreateSocket() {
  if (_socket) return _socket;

  _socket = io(
    // In development Vite proxies /api → localhost:5000, but Socket.IO
    // connects to the origin directly (not via the /api path), so we
    // point straight at the server URL.
    import.meta.env.VITE_API_URL || 'http://localhost:5000',
    {
      withCredentials: true,     // sends the httpOnly JWT cookie
      transports: ['websocket', 'polling'],
      autoConnect: false,        // we control connect/disconnect explicitly
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    }
  );

  _socket.on('connect', () => {
    console.log('[Socket] Connected —', _socket.id);
  });
  _socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });
  _socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected —', reason);
  });

  return _socket;
}

export function useSocket() {
  const { user } = useAuthStore();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      // Logged out — disconnect and clear singleton
      if (_socket) {
        _socket.disconnect();
        _socket = null;
      }
      socketRef.current = null;
      return;
    }

    // User is authenticated — get or create socket and connect
    const socket = getOrCreateSocket();
    socketRef.current = socket;

    if (!socket.connected) {
      socket.connect();
    }

    // No cleanup on unmount — socket persists across page navigations.
    // It is only torn down above when user logs out.
  }, [user]);

  return socketRef.current;
}
