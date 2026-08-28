import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Image, RefreshCw, AlertTriangle, CheckCircle2, SwitchCamera } from 'lucide-react';

export const QRScanner = ({ onScanSuccess }) => {
  const [scannerMode, setScannerMode] = useState('camera'); // 'camera' | 'file'
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [fileScanning, setFileScanning] = useState(false);

  const html5QrCodeRef = useRef(null);
  const scannerContainerId = 'qr-camera-viewport';

  // Initialize and list video cameras
  useEffect(() => {
    let isMounted = true;

    Html5Qrcode.getCameras()
      .then((cameras) => {
        if (isMounted && cameras && cameras.length > 0) {
          setAvailableCameras(cameras);
        }
      })
      .catch((err) => {
        console.warn('Could not enumerate cameras:', err);
      });

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, []);

  const startCamera = async (cameraId = null) => {
    setCameraError(null);
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId);
      }

      const targetCamera =
        cameraId ||
        (availableCameras.length > 0
          ? availableCameras[currentCameraIndex].id
          : { facingMode: 'environment' });

      await html5QrCodeRef.current.start(
        targetCamera,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          stopCamera();
          onScanSuccess(decodedText, 'camera_qr');
        },
        (errorMessage) => {
          // Ignore scanning frame errors (normal while searching for QR)
        }
      );
      setCameraActive(true);
    } catch (err) {
      console.error('Camera start error:', err);
      setCameraActive(false);
      setCameraError(
        'Camera access unavailable or permission denied. You can upload a QR image/screenshot or type the PHID manually.'
      );
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
    }
    setCameraActive(false);
  };

  const toggleCameraSwitch = async () => {
    if (availableCameras.length < 2) return;
    const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
    setCurrentCameraIndex(nextIndex);
    await stopCamera();
    startCamera(availableCameras[nextIndex].id);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileScanning(true);
    setCameraError(null);

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId);
      }

      const decodedText = await html5QrCodeRef.current.scanFile(file, true);
      setFileScanning(false);
      onScanSuccess(decodedText, 'file_upload');
    } catch (err) {
      setFileScanning(false);
      setCameraError('Could not decode QR code from the selected image file. Please try a clearer screenshot or enter the PHID manually.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Scanner Mode Toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.8)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => {
            setScannerMode('camera');
            setCameraError(null);
          }}
          className={`btn btn-sm ${scannerMode === 'camera' ? 'btn-primary' : 'btn-outline'}`}
          style={{ flex: 1, border: 'none' }}
        >
          <Camera size={14} /> Live Camera Scanner
        </button>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            setScannerMode('file');
            setCameraError(null);
          }}
          className={`btn btn-sm ${scannerMode === 'file' ? 'btn-primary' : 'btn-outline'}`}
          style={{ flex: 1, border: 'none' }}
        >
          <Image size={14} /> Scan from Image / Screenshot
        </button>
      </div>

      {cameraError && (
        <div className="alert alert-error" style={{ fontSize: '0.85rem' }}>
          <AlertTriangle size={16} />
          <div>{cameraError}</div>
        </div>
      )}

      {/* Mode 1: Live Camera Scanner */}
      {scannerMode === 'camera' && (
        <div style={{ textAlign: 'center' }}>
          <div
            id={scannerContainerId}
            style={{
              width: '100%',
              maxWidth: '360px',
              minHeight: '260px',
              margin: '0 auto',
              borderRadius: '16px',
              overflow: 'hidden',
              background: '#090d16',
              border: cameraActive ? '2px solid #14b8a6' : '1px dashed var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: cameraActive ? '0 0 25px rgba(20, 184, 166, 0.25)' : 'none',
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
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="btn btn-primary btn-sm"
                >
                  <Camera size={14} /> Start Camera Scanner
                </button>
              </div>
            )}
          </div>

          {cameraActive && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
              <button
                type="button"
                onClick={stopCamera}
                className="btn btn-outline btn-sm"
              >
                Stop Camera
              </button>
              {availableCameras.length > 1 && (
                <button
                  type="button"
                  onClick={toggleCameraSwitch}
                  className="btn btn-outline btn-sm"
                  title="Switch Camera"
                >
                  <SwitchCamera size={14} /> Switch Lens
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Scan from File Upload */}
      {scannerMode === 'file' && (
        <div
          style={{
            border: '2px dashed rgba(20, 184, 166, 0.4)',
            borderRadius: '16px',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            background: 'rgba(15, 23, 42, 0.5)',
          }}
        >
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
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Decoding QR Image...
              </>
            ) : (
              <>
                <Image size={14} /> Choose Image File
              </>
            )}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              disabled={fileScanning}
            />
          </label>
        </div>
      )}
    </div>
  );
};
