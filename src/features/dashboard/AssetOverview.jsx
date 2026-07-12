import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../../api';
import { SkeletonCards, Skeleton } from '../../Skeleton';
import RelativeTime from '../../RelativeTime';

/**
 * Live Asset Management overview. Every figure is fetched from /api/dashboards/assets,
 * which computes them from the database on request — there is no client-side aggregation
 * and no hardcoded fallback. Total Assets is a straight COUNT of asset rows, so it always
 * matches the real ledger size. A failed load shows an error with Retry rather than
 * silently rendering zeros or stale placeholder data.
 */

const COLORS = {
  available: 'var(--status-available, #10b981)',
  assigned: 'var(--status-assigned, #3b82f6)',
  warn: 'var(--status-maintenance, #f59e0b)',
  danger: 'var(--status-disposed, #ef4444)'
};

// A horizontal-bar breakdown of a { key: count } map.
const Breakdown = ({ title, data, color }) => {
  const entries = Object.entries(data || {});
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="card">
      <span className="card-title">{title}</span>
      {entries.length === 0
        ? <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '8px 0' }}>No assets recorded.</div>
        : (
          <div className="hbar-list">
            {entries.map(([k, v]) => (
              <div key={k} className="hbar-row">
                <span className="hbar-label">{k}</span>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${(v / max) * 100}%`, ...(color ? { background: color } : {}) }} />
                </div>
                <span className="hbar-count">{v}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
};

const StatCell = ({ label, value, note, alert }) => (
  <div className="stat-cell">
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
    <span className={`stat-note ${alert ? 'alert' : ''}`}>{note}</span>
  </div>
);

export default function AssetOverview({ can, navigate, addToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getAssetDashboard());
    } catch (err) {
      setError(err.message || 'Could not load asset dashboard');
      addToast?.('Dashboard failed', err.message || 'Could not load asset dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  if (loading || (!data && !error)) {
    return (
      <div role="status" aria-busy="true" aria-label="Loading asset overview" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <SkeletonCards count={6} />
        <Skeleton style={{ height: '200px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: '30px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <AlertTriangle size={22} style={{ color: 'var(--status-disposed)' }} />
        <div style={{ color: 'var(--status-disposed)', fontWeight: 600 }}>Could not load live asset metrics</div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{error}</div>
        <button className="btn btn-secondary btn-sm" onClick={load}>
          <RefreshCw size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} /> Retry
        </button>
      </div>
    );
  }

  const { counts, byDepartment, byCategory, byStatus, recentlyAdded = [], lowStock = [] } = data;
  const assignedU = counts.assignedUnits ?? 0;
  const availableU = counts.availableUnits ?? 0;
  const unitsTotal = Math.max(1, assignedU + availableU);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Headline figures — all live from the database. */}
      <div className="stat-strip">
        <StatCell label="Total Assets" value={counts.total} note="Rows on the ledger" />
        <StatCell label="Assigned" value={counts.assigned} note="In custodians' hands" />
        <StatCell label="Available (units)" value={availableU} note="In inventory" />
        {can('assets', 'view') && (
          <StatCell label="Warranty Expiring" value={counts.warrantyExpiring} note="Within 90 days" alert={counts.warrantyExpiring > 0} />
        )}
        {can('amc', 'view') && (
          <StatCell label="AMC Expiring" value={counts.amcExpiring} note="Within 90 days" alert={counts.amcExpiring > 0} />
        )}
        <StatCell label="Low Inventory" value={counts.lowInventory} note="At/below reorder level" alert={counts.lowInventory > 0} />
      </div>

      {/* Assigned vs Available (by unit quantity). */}
      <div className="card">
        <span className="card-title">Assets Assigned vs Available</span>
        <div className="allocation-spectrum-bar" style={{ display: 'flex', height: '14px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', backgroundColor: 'var(--border-color)', margin: '10px 0 14px' }}>
          {assignedU > 0 && <div style={{ width: `${(assignedU / unitsTotal) * 100}%`, backgroundColor: COLORS.assigned }} title={`Assigned: ${assignedU}`} />}
          {availableU > 0 && <div style={{ width: `${(availableU / unitsTotal) * 100}%`, backgroundColor: COLORS.available }} title={`Available: ${availableU}`} />}
        </div>
        <div className="pie-labels">
          <div className="pie-label-item">
            <span className="color-dot" style={{ backgroundColor: COLORS.assigned }} />
            Assigned — {assignedU} ({Math.round((assignedU / unitsTotal) * 100)}%)
          </div>
          <div className="pie-label-item">
            <span className="color-dot" style={{ backgroundColor: COLORS.available }} />
            Available — {availableU} ({Math.round((availableU / unitsTotal) * 100)}%)
          </div>
        </div>
      </div>

      {/* Breakdowns. */}
      <div className="dashboard-grid-secondary">
        <Breakdown title="Assets by Department" data={byDepartment} color={COLORS.assigned} />
        <Breakdown title="Assets by Category" data={byCategory} />
      </div>
      <div className="dashboard-grid-secondary">
        <Breakdown title="Assets by Status" data={byStatus} color={COLORS.warn} />

        {/* Recently Added */}
        <div className="card">
          <span className="card-title">Recently Added Assets</span>
          {recentlyAdded.length === 0
            ? <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '8px 0' }}>No assets yet.</div>
            : (
              <div className="log-list" style={{ marginTop: '8px' }}>
                {recentlyAdded.map((a) => (
                  <div key={a.id} className="log-entry" style={{ cursor: navigate ? 'pointer' : 'default' }} onClick={() => navigate?.('assets')}>
                    <div className="log-entry-meta">
                      <span className="log-entry-actor">{a.name}</span>
                      <RelativeTime className="log-entry-time" value={a.createdAt} />
                    </div>
                    <span className="log-entry-detail">{a.id} · {a.category}{a.department ? ` · ${a.department}` : ''} · {a.status}</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Low Inventory detail — only when there is something to show. */}
      {lowStock.length > 0 && (
        <div className="card">
          <span className="card-title" style={{ color: 'var(--status-disposed)' }}>
            <AlertTriangle size={13} style={{ verticalAlign: '-2px' }} /> Low Inventory Assets
          </span>
          <div className="hbar-list" style={{ marginTop: '8px' }}>
            {lowStock.map((a) => (
              <div key={a.id} className="hbar-row" onClick={() => navigate?.('assets')} style={{ cursor: navigate ? 'pointer' : 'default' }}>
                <span className="hbar-label">{a.name} <span style={{ color: 'var(--text-muted)' }}>({a.id})</span></span>
                <span className="hbar-count" style={{ color: a.availableQuantity <= 0 ? 'var(--status-disposed)' : 'var(--status-maintenance)' }}>
                  {a.availableQuantity} / reorder {a.reorderLevel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
