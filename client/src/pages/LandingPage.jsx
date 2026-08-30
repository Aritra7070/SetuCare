import React, { useState, useEffect } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';

const BG_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_155101_f2540600-6fe9-433e-8e48-b3f4b72f0727.mp4';

const NAV_ITEMS = ['Platform', 'How it works', 'Features', 'Network', 'About'];

// ---------------------------------------------------------------------------
// Hamburger toggle button
// ---------------------------------------------------------------------------
function HamburgerButton({ open, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Toggle menu"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        backgroundColor: open ? '#1a1a1a' : 'transparent',
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* Menu icon */}
      <span
        style={{
          position: 'absolute',
          opacity: open ? 0 : 1,
          transform: open ? 'rotate(-90deg) scale(0.5)' : 'rotate(0deg) scale(1)',
          transition: 'opacity 0.3s cubic-bezier(0.23,1,0.32,1), transform 0.3s cubic-bezier(0.23,1,0.32,1)',
        }}
      >
        <Menu size={20} color="white" strokeWidth={1.5} />
      </span>
      {/* X icon */}
      <span
        style={{
          position: 'absolute',
          opacity: open ? 1 : 0,
          transform: open ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0.5)',
          transition: 'opacity 0.3s cubic-bezier(0.23,1,0.32,1), transform 0.3s cubic-bezier(0.23,1,0.32,1)',
        }}
      >
        <X size={20} color="white" strokeWidth={1.5} />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mobile menu panel
// ---------------------------------------------------------------------------
function MobileMenu({ open, onClose, onGetStarted }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 30,
          backdropFilter: open ? 'blur(12px)' : 'blur(0px)',
          backgroundColor: open ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
          pointerEvents: open ? 'auto' : 'none',
          transition: 'backdrop-filter 0.5s ease, background-color 0.5s ease',
        }}
      />

      {/* Slide-down panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          overflow: 'hidden',
          maxHeight: open ? '420px' : '0px',
          transition: 'max-height 0.5s cubic-bezier(0.23,1,0.32,1)',
        }}
      >
        <div
          style={{
            paddingTop: '80px',
            paddingBottom: '24px',
            paddingLeft: '20px',
            paddingRight: '20px',
            backgroundColor: 'rgba(8,8,8,0.97)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {NAV_ITEMS.map((item, i) => (
              <a
                key={item}
                href="#"
                onClick={onClose}
                style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '16px',
                  padding: '12px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textDecoration: 'none',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  opacity: open ? 1 : 0,
                  transform: open ? 'translateY(0)' : 'translateY(-8px)',
                  transition: `opacity 0.4s cubic-bezier(0.23,1,0.32,1) ${i * 50 + 80}ms, transform 0.4s cubic-bezier(0.23,1,0.32,1) ${i * 50 + 80}ms`,
                }}
              >
                {item}
                <ArrowRight size={14} style={{ opacity: 0.3 }} />
              </a>
            ))}
          </div>

          {/* Mobile CTA */}
          <div
            style={{
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              opacity: open ? 1 : 0,
              transform: open ? 'translateY(0)' : 'translateY(-8px)',
              transition: 'opacity 0.4s cubic-bezier(0.23,1,0.32,1) 360ms, transform 0.4s cubic-bezier(0.23,1,0.32,1) 360ms',
            }}
          >
            <button
              onClick={() => { onClose(); onGetStarted(); }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '9999px',
                backgroundColor: '#ffffff',
                color: '#000000',
                fontSize: '14px',
                fontWeight: '500',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------
function LandingNavbar({ onGetStarted }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <nav
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Brand */}
        <span
          style={{
            color: '#ffffff',
            fontSize: '20px',
            fontWeight: '600',
            letterSpacing: '-0.02em',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          SetuCare
        </span>

        {/* Desktop nav pill */}
        <div
          style={{
            display: 'none', // hidden on mobile; overridden below via media-query equivalent
            alignItems: 'center',
            gap: '4px',
            borderRadius: '9999px',
            padding: '6px 8px',
            backgroundColor: '#0C0C0C',
          }}
          className="desktop-nav"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item}
              href="#"
              style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: '14px',
                padding: '6px 16px',
                borderRadius: '9999px',
                textDecoration: 'none',
                fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'color 0.2s, background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {item}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HamburgerButton open={open} onClick={() => setOpen((v) => !v)} />
          <button
            onClick={onGetStarted}
            className="desktop-cta"
            style={{
              display: 'none', // shown via inline style override below
              fontSize: '14px',
              fontWeight: '500',
              padding: '8px 20px',
              borderRadius: '9999px',
              backgroundColor: '#ffffff',
              color: '#000000',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'opacity 0.3s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Get Started
          </button>
        </div>
      </nav>

      <MobileMenu open={open} onClose={() => setOpen(false)} onGetStarted={onGetStarted} />

      {/* Inline style block to handle the responsive show/hide without Tailwind */}
      <style>{`
        @media (min-width: 1024px) {
          .desktop-nav  { display: flex !important; }
          .desktop-cta  { display: block !important; }
          nav button[aria-label="Toggle menu"] { display: none !important; }
        }
      `}</style>
    </>
  );
}

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------
export function LandingPage({ onGetStarted }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#000000',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Background video */}
      <video
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
        src={BG_VIDEO}
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Subtle dark overlay so text is always legible over any video frame */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background: 'rgba(0,0,0,0.25)',
        }}
      />

      <LandingNavbar onGetStarted={onGetStarted} />

      {/* Hero content */}
      <div
        style={{
          position: 'relative',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          paddingTop: 'clamp(90px, 14vh, 140px)',
          paddingLeft: '20px',
          paddingRight: '20px',
        }}
      >
        {/* Headline */}
        <h1
          style={{
            color: '#ffffff',
            fontWeight: '400',
            lineHeight: '1.12',
            letterSpacing: '-0.025em',
            maxWidth: '720px',
            margin: '0',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 'clamp(1.75rem, 5vw, 2.6rem)',
          }}
        >
          Where every patient's story
          <br />
          follows them across every tier
        </h1>

        {/* Sub-headline */}
        <p
          style={{
            marginTop: '24px',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 'clamp(13px, 1.8vw, 15px)',
            lineHeight: '1.7',
            maxWidth: '420px',
            fontFamily: "'Courier New', Courier, monospace",
            letterSpacing: '0.01em',
          }}
        >
          a seamless bridge — PHID, vitals, triage
          <br />
          and referrals unified as one record
        </p>

        {/* CTA */}
        <button
          onClick={onGetStarted}
          style={{
            marginTop: '32px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 22px',
            borderRadius: '9999px',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontSize: '14px',
            fontWeight: '500',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'opacity 0.3s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Enter SetuCare
          <ArrowRight
            size={15}
            style={{ transition: 'transform 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateX(0)')}
          />
        </button>

      </div>
    </div>
  );
}
