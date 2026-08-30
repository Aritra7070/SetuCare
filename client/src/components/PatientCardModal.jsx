import React, { useState } from 'react';
import {
  QrCode,
  Printer,
  Copy,
  Check,
  X,
  Hospital,
  User,
  Calendar,
  Phone,
  MapPin,
  ShieldCheck,
  Share2,
} from 'lucide-react';
import { getLanguageLabel } from '../utils/languages';

export const PatientCardModal = ({ patient, qrCodeDataUrl, age, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!patient) return null;

  const handleCopyPHID = () => {
    navigator.clipboard.writeText(patient.phid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not recorded';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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
          maxWidth: '640px',
          maxHeight: '92vh',
          overflowY: 'auto',
          border: '1px solid rgba(20, 184, 166, 0.5)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(20, 184, 166, 0.2)',
          padding: '1.75rem',
        }}
      >
        {/* Modal Top Actions (Hidden on Print) */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={20} color="#14b8a6" />
            <span style={{ fontWeight: '800', fontSize: '1.1rem', color: '#f8fafc' }}>
              Patient Health Card Generated
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={handlePrint} className="btn btn-primary btn-sm">
              <Printer size={14} /> Print Card
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                padding: '0.2rem',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PRINTABLE DIGITAL HEALTH CARD CONTAINER */}
        <div
          id="printable-patient-card"
          style={{
            background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
            border: '2px solid #0d9488',
            borderRadius: '16px',
            padding: '1.5rem',
            color: '#f8fafc',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Watermark Logo */}
          <div
            style={{
              position: 'absolute',
              right: '-25px',
              bottom: '-25px',
              opacity: 0.05,
              pointerEvents: 'none',
            }}
          >
            <Hospital size={240} color="#ffffff" />
          </div>

          {/* Card Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '2px solid rgba(20, 184, 166, 0.3)',
              paddingBottom: '0.75rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Hospital size={22} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#38bdf8' }}>
                  Government of Maharashtra &bull; Public Health Department
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#ffffff' }}>
                  SetuCare (सेतुकेअर) &bull; Universal PHID Card
                </div>
              </div>
            </div>

            <span
              className="tier-badge"
              style={{
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                borderColor: 'rgba(16, 185, 129, 0.4)',
                fontWeight: '800',
              }}
            >
              ACTIVE ID
            </span>
          </div>

          {/* Card Body: QR Code + Patient Details Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '170px 1fr',
              gap: '1.5rem',
              alignItems: 'center',
            }}
          >
            {/* Left: Scannable QR Code Column */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  background: '#ffffff',
                  padding: '8px',
                  borderRadius: '12px',
                  display: 'inline-block',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                }}
              >
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt={`QR Code for ${patient.phid}`}
                    style={{ width: '144px', height: '144px', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '144px', height: '144px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                    Generating QR...
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', marginTop: '6px' }}>
                Offline Scannable Key
              </div>
            </div>

            {/* Right: Demographic Information */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {/* PHID High-Visibility Chip */}
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
                  Patient Health ID (PHID)
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid #14b8a6',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '8px',
                    marginTop: '2px',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '900', fontSize: '1.05rem', color: '#22d3ee', letterSpacing: '0.04em' }}>
                    {patient.phid}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPHID}
                    className="no-print"
                    style={{ background: 'none', color: copied ? '#34d399' : '#94a3b8', display: 'flex', alignItems: 'center' }}
                    title="Copy PHID"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Patient Name */}
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
                  Patient Name
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>
                  {patient.name}
                </div>
              </div>

              {/* Demographics Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Age / DOB</div>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>
                    {age !== null && age !== undefined ? `${age} yrs` : 'N/A'}{' '}
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      ({formatDate(patient.dob)})
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Gender</div>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                    {patient.gender || 'Not specified'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Language</div>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>
                    {getLanguageLabel(patient.preferredLanguage || 'mr')}
                  </div>
                </div>
              </div>

              {/* Guardian Row (if recorded) */}
              {patient.guardianName && (
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Guardian / Parent Name (Minor)</div>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#fde68a' }}>
                    {patient.guardianName}
                  </div>
                </div>
              )}

              {/* Phone & Village Address */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Mobile Phone</div>
                  <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                    {patient.phone || 'None recorded'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Address / Village</div>
                  <div style={{ fontWeight: '600', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {patient.address || 'Maharashtra'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card Footer */}
          <div
            style={{
              marginTop: '1.25rem',
              paddingTop: '0.75rem',
              borderTop: '1px dashed rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.78rem',
              color: '#cbd5e1',
            }}
          >
            <div>
              Registered At:{' '}
              <strong style={{ color: '#38bdf8' }}>
                {patient.registeredAtFacility?.name || 'Local Health Facility'}
              </strong>{' '}
              ({patient.registeredAtFacility?.district || 'Maharashtra'})
            </div>
            <div style={{ color: '#94a3b8' }}>
              Issued: {formatDate(patient.createdAt || new Date())}
            </div>
          </div>
        </div>

        {/* Modal Bottom Close Action (Hidden on Print) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button onClick={onClose} className="btn btn-outline" style={{ minWidth: '100px' }}>
            Done / Close
          </button>
        </div>
      </div>
    </div>
  );
};
