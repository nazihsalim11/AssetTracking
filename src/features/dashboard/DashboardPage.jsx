import DashboardsPanel from '../../DashboardsPanel'
import AssetOverview from './AssetOverview'
import { ClipboardList, ShieldCheck, Users } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'

export default function DashboardPage() {
  const { addToast, can, navigate } = useAppData();

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

              {/* Asset Management overview — live from /api/dashboards/assets. Total
                  Assets is a true row count, and every widget below is computed from the
                  database on request, with its own loading/error/retry handling. */}
              <AssetOverview can={can} navigate={navigate} addToast={addToast} />
              </section>

              <DashboardsPanel view="tickets" title="Ticket Operations" subtitle="Live queue health across all tickets" icon={ClipboardList} addToast={addToast} />
              <DashboardsPanel view="sla" title="SLA Compliance" subtitle="Response and resolution against policy" icon={ShieldCheck} addToast={addToast} />
              <DashboardsPanel view="technicians" title="Technician Performance" subtitle="Workload and throughput by agent" icon={Users} addToast={addToast} />
            </div>
  );
}
