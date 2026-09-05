/**
 * LanguageSwitcher — Step 18
 *
 * Three-pill switcher: मराठी | हिंदी | English
 * Changing language:
 *   1. Calls i18n.changeLanguage() immediately — current screen updates instantly
 *   2. Persists to server via PATCH /api/auth/me/preferred-language so next login
 *      restores the chosen language without any manual action
 *   3. Updates authStore user.preferredLanguage optimistically
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useAuthStore } from '../stores/authStore';

const LANGS = [
  { code: 'mr', label: 'मराठी' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'en', label: 'English' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { user, setUser } = useAuthStore();
  const current = i18n.language?.slice(0, 2) || 'en'; // normalise 'mr-IN' → 'mr'
  const [saving, setSaving] = useState(false);

  const handleChange = async (code) => {
    if (code === current || saving) return;

    // 1. Instant UI change
    i18n.changeLanguage(code);
    localStorage.setItem('setucare_lang', code);

    // 2. Persist to server (fire-and-forget — don't block UI)
    if (user) {
      setSaving(true);
      try {
        const res = await api.patch('/auth/me/preferred-language', { preferredLanguage: code });
        if (res.data.success && res.data.user) {
          // Optimistically update the store so Navbar role label stays in sync
          useAuthStore.setState({ user: res.data.user });
        }
      } catch (_) {
        // Silent — language is already changed in UI, server persistence is best-effort
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '9999px',
        padding: '3px 4px',
        gap: '1px',
        border: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}
    >
      {LANGS.map((lang) => {
        const isActive = current === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => handleChange(lang.code)}
            title={lang.label}
            style={{
              padding: '3px 9px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: isActive ? '700' : '500',
              border: 'none',
              cursor: saving ? 'default' : 'pointer',
              fontFamily: 'inherit',
              background: isActive ? 'rgba(20,184,166,0.25)' : 'transparent',
              color: isActive ? '#5eead4' : 'rgba(255,255,255,0.55)',
              transition: 'background 0.15s, color 0.15s',
              opacity: saving && !isActive ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isActive && !saving) {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
}
