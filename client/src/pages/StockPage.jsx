import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useAuthStore } from '../stores/authStore';
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Edit3,
  Check,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Status config — labels come from i18n
// ---------------------------------------------------------------------------
const STATUS_STYLE = {
  available: { bg: 'rgba(16,185,129,0.15)',  color: '#34d399', border: 'rgba(16,185,129,0.3)',  Icon: CheckCircle2 },
  low:       { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24', border: 'rgba(245,158,11,0.3)',  Icon: AlertTriangle },
  out:       { bg: 'rgba(244,63,94,0.15)',   color: '#fb7185', border: 'rgba(244,63,94,0.3)',   Icon: XCircle       },
};

const CATEGORY_KEYS = {
  maternal: 'stock.maternal',
  chronic:  'stock.chronic',
  general:  'stock.general',
};

const CATEGORY_COLORS = {
  maternal: { color: '#f9a8d4', border: 'rgba(236,72,153,0.3)' },
  chronic:  { color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  general:  { color: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
};

function StatusBadge({ status }) {
  const { t } = useTranslation();
  const cfg = STATUS_STYLE[status] || STATUS_STYLE.available;
  const Icon = cfg.Icon;
  const label = t(`stock.${status}`);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.18rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: '700', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
      <Icon size={11} /> {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inline quantity editor
// ---------------------------------------------------------------------------
function QuantityCell({ item, onUpdated }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState(null);

  const startEdit = () => { setDraft(String(item.currentQuantity)); setEditing(true); setErr(null); };
  const cancel    = () => { setEditing(false); setErr(null); };

  const save = async () => {
    const qty = Number(draft);
    if (isNaN(qty) || qty < 0) { setErr('Invalid'); return; }
    setSaving(true);
    try {
      const res = await api.patch(`/stock/${item._id}`, { currentQuantity: qty });
      if (res.data.success) { onUpdated(res.data.item); setEditing(false); }
    } catch (e) {
      setErr(e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <input
          type="number"
          min="0"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          autoFocus
          style={{ width: '64px', padding: '0.25rem 0.4rem', borderRadius: '6px', border: '1px solid var(--border-focus)', background: 'rgba(15,23,42,0.8)', color: '#f8fafc', fontSize: '0.85rem', fontFamily: 'inherit' }}
        />
        <button type="button" onClick={save} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#34d399', padding: '0.1rem' }}>
          <Check size={14} />
        </button>
        <button type="button" onClick={cancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.1rem' }}>
          <X size={14} />
        </button>
        {err && <span style={{ fontSize: '0.7rem', color: '#fb7185' }}>{err}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <span style={{ fontWeight: '600', color: '#f8fafc', fontSize: '0.9rem' }}>
        {item.currentQuantity}
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{item.unit}</span>
      <button
        type="button"
        onClick={startEdit}
        title={t('common.edit')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.1rem', opacity: 0.7 }}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
      >
        <Edit3 size={12} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StockPage
// ---------------------------------------------------------------------------
export const StockPage = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [items,    setItems]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState(null);
  const [catFilter, setCatFilter] = useState('');

  const fetchStock = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = catFilter ? { category: catFilter } : {};
      const res = await api.get('/stock/my', { params });
      if (res.data.success) setItems(res.data.items);
    } catch (err) {
      setError(err.message || 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  }, [catFilter]);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  const handleItemUpdated = (updatedItem) => {
    setItems(prev => prev.map(i => i._id === updatedItem._id ? updatedItem : i));
  };

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const lowCount = items.filter(i => i.status === 'low' || i.status === 'out').length;

  const catFilters = [
    { value: '',         labelKey: 'stock.allCategories' },
    { value: 'maternal', labelKey: 'stock.maternal'      },
    { value: 'chronic',  labelKey: 'stock.chronic'       },
    { value: 'general',  labelKey: 'stock.general'       },
  ];

  const tableHeaders = [
    t('stock.item'),
    t('stock.type'),
    t('stock.quantity'),
    t('stock.threshold'),
    t('stock.status'),
    t('stock.lastUpdated'),
  ];

  return (
    <div className="main-content">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Package size={26} color="#14b8a6" />
            {t('stock.title')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {t('stock.desc', { facility: user?.facility?.name || 'Your facility' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lowCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: '700', background: 'rgba(244,63,94,0.12)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.3)' }}>
              <AlertTriangle size={13} />
              {lowCount === 1
                ? t('stock.needAttention', { count: lowCount })
                : t('stock.needAttention_plural', { count: lowCount })}
            </span>
          )}
          <button onClick={fetchStock} className="btn btn-outline btn-sm">
            <RotateCcw size={13} /> {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {catFilters.map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => setCatFilter(f.value)}
            style={{
              padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: '600',
              border: catFilter === f.value ? '1px solid #14b8a6' : '1px solid var(--border-subtle)',
              background: catFilter === f.value ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.03)',
              color: catFilter === f.value ? '#5eead4' : 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Package size={36} color="#14b8a6" style={{ margin: '0 auto 0.75rem auto' }} />
          <div style={{ fontWeight: '700', color: '#f8fafc' }}>{t('stock.loadingInventory')}</div>
        </div>
      ) : error ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', border: '1px solid rgba(244,63,94,0.3)' }}>
          <AlertTriangle size={32} color="#f43f5e" style={{ margin: '0 auto 0.75rem auto' }} />
          <div style={{ color: '#f8fafc', marginBottom: '1rem' }}>{error}</div>
          <button onClick={fetchStock} className="btn btn-primary btn-sm">{t('common.retry')}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {Object.entries(grouped).map(([cat, catItems]) => {
            const cc = CATEGORY_COLORS[cat] || CATEGORY_COLORS.general;
            const catLabel = t(CATEGORY_KEYS[cat] || `stock.${cat}`);
            return (
              <div key={cat} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Category header */}
                <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.9rem', color: cc.color }}>
                    {catLabel}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({catItems.length} {t('stock.items')})</span>
                  {catItems.some(i => i.status !== 'available') && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#fb7185', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <AlertTriangle size={11} />
                      {catItems.filter(i => i.status !== 'available').length} {t('stock.lowOut')}
                    </span>
                  )}
                </div>

                {/* Items table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                        {tableHeaders.map(h => (
                          <th key={h} style={{ padding: '0.6rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {catItems.map((item, idx) => (
                        <tr
                          key={item._id}
                          style={{
                            borderBottom: idx < catItems.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                            background: item.status !== 'available' ? 'rgba(244,63,94,0.03)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '0.7rem 1rem', fontWeight: '600', color: '#f8fafc' }}>{item.name}</td>
                          <td style={{ padding: '0.7rem 1rem', color: 'var(--text-muted)', textTransform: 'capitalize', fontSize: '0.78rem' }}>
                            {item.itemType?.replace('_', ' ')}
                          </td>
                          <td style={{ padding: '0.7rem 1rem' }}>
                            <QuantityCell item={item} onUpdated={handleItemUpdated} />
                          </td>
                          <td style={{ padding: '0.7rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            {item.thresholdQuantity} {item.unit}
                          </td>
                          <td style={{ padding: '0.7rem 1rem' }}>
                            <StatusBadge status={item.status} />
                          </td>
                          <td style={{ padding: '0.7rem 1rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {item.lastUpdatedBy?.name
                              ? `${item.lastUpdatedBy.name} · ${new Date(item.lastUpdatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                              : t('stock.seeded')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {Object.keys(grouped).length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', border: '1px dashed var(--border-subtle)' }}>
              <Package size={36} color="#64748b" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
              <div style={{ color: '#f8fafc', fontWeight: '700' }}>{t('stock.noItems')}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem' }}>{t('stock.runSeed')}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
