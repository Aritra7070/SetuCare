import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Image, RefreshCw, AlertTriangle, SwitchCamera } from 'lucide-react';

/**
 * QRScanner — Step 4
 *
 * Two independent modes:
 *   camera — uses a dedicated Html5Qrcode instance mounted into #qr-camera-viewport
 *   file   — uses a separate, ephemeral Html5Qrcode instance that never touches the DOM
 *
 * Keeping them separate is critical: html5-qrcode's scanFile() must be called on
 * an instance that has never been used for camera streaming, otherwise it throws
 * "QR Code scanning is not in running state" or silently fails to decode.
 */
export const QRScanner = ({ onScanSuccess }) => {
  const [scannerMode, setScannerMode]       = useState('camera');
  const [cameraActive, setCameraActive]     = useState(false);
  const [cameraError, setCameraError]       = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [fileScanning, setFileScanning]     = useState(false);

  // Instance used exclusively for live camera — mounts into #qr-camera-viewport
  const cameraInstanceRef = useRef(null);

  const CAMERA_DIV_ID = 'qr-camera-viewport';

  // Enumerate cameras on mount
  useEffect(() => {
    let alive = true;
    Html5Qrcode.getCameras()
      .then(cameras => { if (alive && cameras?.length) setAvailableCameras(cameras); })
      .catch(err => console.warn('[QRScanner] getCameras:', err));

    return () => {
      alive = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Camera mode ──────────────────────────────────────────────────────────

  const startCamera = async (cameraId = null) => {
    setCameraError(null);
    try {
      // Always create a fresh instance; re-using a stopped instance can hang
      if (cameraInstanceRef.current) {
        try { await cameraInstanceRef.current.stop(); } catch (_) {}
      }
      cameraInstanceRef.current = new Html5Qrcode(CAMERA_DIV_ID);

      const target =
        cameraId ||
        (availableCameras.length > 0
          ? availableCameras[currentCameraIndex].id
          : { facingMode: 'environment' });

      await cameraInstanceRef.current.start(
        target,
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => {
          stopCamera();
          onScanSuccess(decodedText, 'camera_qr');
        },
        () => { /* per-frame error — normal, ignore */ }
      );
      setCameraActive(true);
    } catch (err) {
      console.error('[QRScanner] startCamera:', err);
      setCameraActive(false);
      setCameraError(
        'Camera access unavailable or permission denied. Upload a QR image or type the PHID manually.'
      );
    }
  };

  const stopCamera = async () => {
    if (cameraInstanceRef.current?.isScanning) {
      try { await cameraInstanceRef.current.stop(); } catch (err) {
        console.warn('[QRScanner] stopCamera:', err);
      }
    }
    setCameraActive(false);
  };

  const switchCamera = async () => {
    if (availableCameras.length < 2) return;
    const next = (currentCameraIndex + 1) % availableCameras.length;
    setCurrentCameraIndex(next);
    await stopCamera();
    startCamera(availableCameras[next].id);
  };

  // ── File / screenshot mode ────────────────────────────────────────────────
  // Uses a brand-new instance with a temporary off-screen div so it never
  // conflicts with the camera instance or its DOM element.

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    // Reset input so the same file can be re-selected after an error
    e.target.value = '';
    if (!file) return;

    setFileScanning(true);
    setCameraError(null);

    // Temporary container — Html5Qrcode requires a mounted DOM element even
    // for scanFile() in some versions; give it a hidden one.
    const tempId  = `qr-file-tmp-${Date.now()}`;
    const tempDiv = document.createElement('div');
    tempDiv.id = tempId;
    tempDiv.style.display = 'none';
    document.body.appendChild(tempDiv);

    let scanner = null;
    try {
      scanner = new Html5Qrcode(tempId);
      const decodedText = await scanner.scanFile(file, /* showImage */ false);
      onScanSuccess(decodedText, 'file_upload');
    } catch (err) {
      console.error('[QRScanner] scanFile:', err);
      setCameraError(
        'Could not decode a QR code from that image. Try a clearer screenshot, or type the PHID manually.'
      );
    } finally {
      // Clean up the ephemeral scanner and DOM node
      try { if (scanner) await scanner.clear(); } catch (_) {}
      try { document.body.removeChild(tempDiv); } catch (_) {}
      setFileScanning(false);
    }
  };

  // ── Mode switch helpers ───────────────────────────────────────────────────

  const switchToCamera = () => {
    setCameraError(null);
    setScannerMode('camera');
  };

  const switchToFile = async () => {
    await stopCamera();
    setCameraError(null);
    setScannerMode('file');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Mode toggle */}
      <div style={{
        display: 'flex', gap: '0.5rem',
        background: 'rgba(15,23,42,0.8)', padding: '0.25rem',
        borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
      }}>
        <button
          type="button"
          onClick={switchToCamera}
          className={`btn btn-sm ${scannerMode === 'camera' ? 'btn-primary' : 'btn-outline'}`}
          style={{ flex: 1, border: 'none' }}
        >
          <Camera size={14} /> Live Camera Scanner
        </button>
        <button
          type="button"
          onClick={switchToFile}
          className={`btn btn-sm ${scannerMode === 'file' ? 'btn-primary' : 'btn-outline'}`}
          style={{ flex: 1, border: 'none' }}
        >
          <Image size={14} /> Scan from Image / Screenshot
        </button>
      </div>

      {/* Error banner */}
      {cameraError && (
        <div className="alert alert-error" style={{ fontSize: '0.85rem' }}>
          <AlertTriangle size={16} />
          <div>{cameraError}</div>
        </div>
      )}

      {/* ── Camera mode ── */}
      {scannerMode === 'camera' && (
        <div style={{ textAlign: 'center' }}>
          {/* This div is the mount target for the camera instance */}
          <div
            id={CAMERA_DIV_ID}
            style={{
              width: '100%', maxWidth: '360px', minHeight: '260px',
              margin: '0 auto', borderRadius: '16px', overflow: 'hidden',
              background: '#090d16',
              border: cameraActive ? '2px solid #14b8a6' : '1px dashed var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: cameraActive ? '0 0 25px rgba(20,184,166,0.25)' : 'none',
            }}
          >
            {!cameraActive && (
              <div style={{ padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                <Camera size={44} color="#14b8a6" style={{ margin: '0 auto 0.75rem auto', opacity: 0.8 }} />
                <div style={{ fontWeight: '700', color: '#f8fafc', marginBottom: '0.35rem' }}>
                  Camera Ready
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Position the patient's PHID QR card in front of the lens
                </div>
                <button type="button" onClick={() => startCamera()} className="btn btn-primary btn-sm">
                  <Camera size={14} /> Start Camera Scanner
                </button>
              </div>
            )}
          </div>

          {cameraActive && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
              <button type="button" onClick={stopCamera} className="btn btn-outline btn-sm">
                Stop Camera
              </button>
              {availableCameras.length > 1 && (
                <button type="button" onClick={switchCamera} className="btn btn-outline btn-sm" title="Switch Camera">
                  <SwitchCamera size={14} /> Switch Lens
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── File / screenshot mode ── */}
      {scannerMode === 'file' && (
        <div style={{
          border: '2px dashed rgba(20,184,166,0.4)', borderRadius: '16px',
          padding: '2.5rem 1.5rem', textAlign: 'center',
          background: 'rgba(15,23,42,0.5)',
        }}>
          <Image size={40} color="#14b8a6" style={{ margin: '0 auto 0.75rem auto' }} />
          <div style={{ fontWeight: '700', fontSize: '1rem', color: '#f8fafc' }}>
            Upload PHID Card Image or Screenshot
          </div>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '1.25rem' }}>
            Supports PNG, JPG, WEBP formats (on-device decoding)
          </div>

          <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex' }}>
            {fileScanning ? (
              <>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Decoding QR Image…
              </>
            ) : (
              <>
                <Image size={14} /> Choose Image File
              </>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              disabled={fileScanning}
            />
          </label>

          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Take a screenshot of the patient's QR card and upload it here
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
