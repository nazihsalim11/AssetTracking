import DashboardsPanel from '../../DashboardsPanel'
import RelativeTime from '../../RelativeTime'
import { AlertCircle, AlertTriangle, CheckCircle2, ClipboardList, ShieldCheck, Users } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'

export default function DashboardPage() {
  const { addToast, assets, assignedCount, availableCount, can, disposedCount, expiringAMCsCount, expiringWarrantiesCount, logs, maintenanceCount, navigate, pendingPaymentsCount, totalAssetsCount } = useAppData();

  return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {/* Unified dashboard: every section stacks on one scrollable page —
                  no tabs. The asset overview leads, then the live ticket, SLA and
                  technician dashboards, each streaming in independently. */}
              <section>
              <div className="page-header">
                <div className="page-title-section">
                  <span className="page-kicker">System Overview</span>
                  <h1 className="page-title">The Asset Ledger</h1>
                  <span className="page-subtitle">
                    Fleet, contracts & settlements in brief — {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Headline figures */}
              <div className="stat-strip">
                <div className="stat-cell">
                  <span className="stat-label">Total Assets</span>
                  <span className="stat-value">{totalAssetsCount}</span>
                  <span className="stat-note">All registered on ledger</span>
                </div>

                <div className="stat-cell">
                  <span className="stat-label">Assigned</span>
                  <span className="stat-value">{assignedCount}</span>
                  <span className="stat-note">In custodians' hands</span>
                </div>

                {can('assets', 'view') && (
                  <div className="stat-cell">
                    <span className="stat-label">Warranties Expiring</span>
                    <span className="stat-value">{expiringWarrantiesCount}</span>
                    <span className={`stat-note ${expiringWarrantiesCount > 0 ? 'alert' : ''}`}>Within 90 days</span>
                  </div>
                )}

                {can('finance', 'view') && (
                  <div className="stat-cell">
                    <span className="stat-label">Open Invoices</span>
                    <span className="stat-value">{pendingPaymentsCount}</span>
                    <span className={`stat-note ${pendingPaymentsCount > 0 ? 'alert' : ''}`}>Awaiting settlement</span>
                  </div>
                )}
              </div>

              {/* Inventory breakdown & the day's notices */}
              <div className="dashboard-grid-secondary">
                <div className="card">
                  <span className="card-title">Inventory Breakdown — by Type</span>

                  <div className="hbar-list">
                    {[...new Set(assets.map(a => a.type))].map(type => {
                      const count = assets.filter(a => a.type === type).length;
                      const max = Math.max(...[...new Set(assets.map(a => a.type))].map(t => assets.filter(a => a.type === t).length), 1);
                      return (
                        <div key={type} className="hbar-row">
                          <span className="hbar-label">{type}</span>
                          <div className="hbar-track">
                            <div className="hbar-fill" style={{ width: `${(count / max) * 100}%` }}></div>
                          </div>
                          <span className="hbar-count">{count}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="custom-pie-chart-mock">
                    <span className="card-subtitle" style={{ display: 'block', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allocation Status Spectrum</span>
                    <div className="allocation-spectrum-bar" style={{ display: 'flex', height: '14px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', backgroundColor: 'var(--border-color)', marginBottom: '14px' }}>
                      {availableCount > 0 && <div className="spectrum-segment" style={{ width: `${(availableCount / totalAssetsCount) * 100}%`, backgroundColor: 'var(--status-available)', transition: 'width 0.4s ease' }} title={`Available: ${availableCount}`} />}
                      {assignedCount > 0 && <div className="spectrum-segment" style={{ width: `${(assignedCount / totalAssetsCount) * 100}%`, backgroundColor: 'var(--status-assigned)', transition: 'width 0.4s ease' }} title={`Assigned: ${assignedCount}`} />}
                      {maintenanceCount > 0 && <div className="spectrum-segment" style={{ width: `${(maintenanceCount / totalAssetsCount) * 100}%`, backgroundColor: 'var(--status-maintenance)', transition: 'width 0.4s ease' }} title={`Maintenance: ${maintenanceCount}`} />}
                      {disposedCount > 0 && <div className="spectrum-segment" style={{ width: `${(disposedCount / totalAssetsCount) * 100}%`, backgroundColor: 'var(--status-disposed)', transition: 'width 0.4s ease' }} title={`Disposed: ${disposedCount}`} />}
                    </div>
                    <div className="pie-labels">
                      <div className="pie-label-item">
                        <span className="color-dot" style={{ backgroundColor: 'var(--status-available)' }}></span>
                        Available — {availableCount} ({Math.round((availableCount / (totalAssetsCount || 1)) * 100)}%)
                      </div>
                      <div className="pie-label-item">
                        <span className="color-dot" style={{ backgroundColor: 'var(--status-assigned)' }}></span>
                        Assigned — {assignedCount} ({Math.round((assignedCount / (totalAssetsCount || 1)) * 100)}%)
                      </div>
                      <div className="pie-label-item">
                        <span className="color-dot" style={{ backgroundColor: 'var(--status-maintenance)' }}></span>
                        Maintenance — {maintenanceCount} ({Math.round((maintenanceCount / (totalAssetsCount || 1)) * 100)}%)
                      </div>
                      <div className="pie-label-item">
                        <span className="color-dot" style={{ backgroundColor: 'var(--status-disposed)' }}></span>
                        Disposed — {disposedCount} ({Math.round((disposedCount / (totalAssetsCount || 1)) * 100)}%)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <span className="card-title">Notices & Action Items</span>

                  <div className="item-list">
                    {expiringAMCsCount > 0 && (
                      <div className="item-list-row">
                        <div className="item-left">
                          <AlertTriangle className="item-icon" style={{ color: 'var(--status-disposed)', backgroundColor: 'var(--status-disposed-bg)' }} />
                          <div className="item-title-section">
                            <span className="item-title">AMC contracts expiring</span>
                            <span className="item-subtitle">{expiringAMCsCount} due for renewal this month</span>
                          </div>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate('amc')}>Renew</button>
                      </div>
                    )}

                    {pendingPaymentsCount > 0 && (
                      <div className="item-list-row">
                        <div className="item-left">
                          <AlertCircle className="item-icon" style={{ color: 'var(--status-maintenance)', backgroundColor: 'var(--status-maintenance-bg)' }} />
                          <div className="item-title-section">
                            <span className="item-title">Vendor invoices outstanding</span>
                            <span className="item-subtitle">{pendingPaymentsCount} await settlement</span>
                          </div>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate('finance')}>Settle</button>
                      </div>
                    )}

                    <div className="item-list-row">
                      <div className="item-left">
                        <CheckCircle2 className="item-icon" style={{ color: 'var(--status-available)', backgroundColor: 'var(--status-available-bg)' }} />
                        <div className="item-title-section">
                          <span className="item-title">System health</span>
                          <span className="item-subtitle">Database backups up to date (daily)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="card-title" style={{ display: 'flex' }}>Latest Entries</span>
                    <div className="log-list" style={{ marginTop: '10px' }}>
                      {logs.slice(0, 4).map(log => (
                        <div key={log.id} className="log-entry">
                          <div className="log-entry-meta">
                            <span className="log-entry-actor">{log.actor}</span>
                            <RelativeTime className="log-entry-time" value={log.createdAt} />
                          </div>
                          <span className="log-entry-detail">{log.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              </section>

              <DashboardsPanel view="tickets" title="Ticket Operations" subtitle="Live queue health across all tickets" icon={ClipboardList} addToast={addToast} />
              <DashboardsPanel view="sla" title="SLA Compliance" subtitle="Response and resolution against policy" icon={ShieldCheck} addToast={addToast} />
              <DashboardsPanel view="technicians" title="Technician Performance" subtitle="Workload and throughput by agent" icon={Users} addToast={addToast} />
            </div>
  );
}
