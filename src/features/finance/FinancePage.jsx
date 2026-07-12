import CustomSelect from '../../CustomSelect'
import PurchaseOrdersPage from '../../PurchaseOrdersPage'
import { Download, FileUp, RefreshCw, Search } from 'lucide-react'
import { SpinnerButton } from '../../SpinnerButton'
import { formatINR } from '../../utils/format'
import { useAppData } from '../../context/AppDataContext'

export default function FinancePage() {
  const { addToast, addingInvoice, amcs, assets, can, filteredInvoices, financeSubTab, handleAddInvoice, handleBulkDeleteInvoices, handleBulkExportInvoices, handleBulkInvoiceStatusChange, handleBulkMapAssetsToInvoice, handleInvoicePaymentStatus, handleUploadPdfForInvoice, hasPermission, invoiceCurrentPage, invoiceFilterStatus, invoiceItemsPerPage, invoicePdfSearchTerm, invoiceSearchTerm, invoiceSortField, invoiceSortOrder, invoices, isInitialLoading, mappingAssetCategory, mappingAssetSearch, mappingInvoiceAssets, mappingInvoiceId, paginatedInvoices, selectedInvoiceIds, selectedMappingAssets, setAssetDetailModal, setFinanceSubTab, setInvoiceCurrentPage, setInvoiceDetailModal, setInvoiceFilterStatus, setInvoicePdfSearchTerm, setInvoiceSearchTerm, setInvoiceSortField, setInvoiceSortOrder, setMappingAssetCategory, setMappingAssetSearch, setMappingInvoiceId, setSelectedInvoiceIds, setSelectedMappingAssets, setShowBulkImportInvoices, startIndex, totalInvoicePages } = useAppData();

  return (
            <>
              <div className="page-header">
                <div className="page-title-section">
                  <span className="page-kicker">Financial Ledger</span>
                  <h1 className="page-title">Procurement, Invoices & Finance</h1>
                  <span className="page-subtitle">Map equipment purchases, tax calculations, and process vendor settlements</span>
                </div>
              </div>

              {/* Finance Sub-Tabs */}
              <div className="tabs-container" style={{ marginBottom: '24px', display: 'flex', gap: '8px' }}>
                <button 
                  className={`tab-btn ${financeSubTab === 'all' ? 'active' : ''}`} 
                  onClick={() => { setFinanceSubTab('all'); setSelectedInvoiceIds([]); }}
                >
                  📁 All Invoices ({invoices.length})
                </button>
                <button
                  className={`tab-btn ${financeSubTab === 'purchase_orders' ? 'active' : ''}`}
                  onClick={() => { setFinanceSubTab('purchase_orders'); setSelectedInvoiceIds([]); }}
                >
                  🧾 Purchase Orders
                </button>
                <button 
                  className={`tab-btn ${financeSubTab === 'pending_upload' ? 'active' : ''}`} 
                  onClick={() => { setFinanceSubTab('pending_upload'); setSelectedInvoiceIds([]); }}
                >
                  ⚠️ Pending Scan Uploads ({invoices.filter(i => !i.fileName || i.fileName === 'None' || i.fileName === 'invoice.pdf').length})
                </button>
                <button 
                  className={`tab-btn ${financeSubTab === 'asset_mapping' ? 'active' : ''}`} 
                  onClick={() => { setFinanceSubTab('asset_mapping'); setSelectedInvoiceIds([]); }}
                >
                  🔗 Bidirectional Asset Mapping
                </button>
              </div>

              {financeSubTab === 'purchase_orders' && (
                <PurchaseOrdersPage
                  canManage={can('finance', 'create')}
                  can={can}
                  invoices={invoices}
                  amcs={amcs}
                  addToast={addToast}
                />
              )}

              {isInitialLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px', color: 'var(--primary)' }}>
                  <RefreshCw className="animate-spin" size={36} />
                  <span style={{ fontWeight: '600', fontSize: '15px' }}>Loading purchase invoices & ledger data...</span>
                </div>
              ) : (
                <>
                  {financeSubTab === 'all' && (
                    <>
                      <div className="dashboard-grid-secondary">
                        {/* Upload Invoice Form */}
                        <div className="card">
                          <span className="card-title">Record Vendor Purchase Invoice</span>
                          {hasPermission('finance') ? (
                            <form onSubmit={handleAddInvoice} className="form-grid">
                              <div className="form-group">
                                <label className="form-label">Purchase Order Ref</label>
                                <input type="text" name="poReference" placeholder="e.g. PO-2026-99" className="form-input" required />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Vendor Business Name</label>
                                <input type="text" name="vendor" placeholder="e.g. Dell Commercial Sales" className="form-input" required />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Base Invoice Cost (₹)</label>
                                <input type="number" name="amount" placeholder="e.g. 5000" className="form-input" required />
                              </div>
                              <div className="form-group">
                                <label className="form-label">GST / Tax Percentage (%)</label>
                                <input type="number" name="gst" placeholder="e.g. 18" className="form-input" required />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Invoice Issue Date</label>
                                <input type="date" name="date" className="form-input" required />
                              </div>
                              <div className="form-group">
                                <label className="form-label">PDF Invoice Scan File (Optional)</label>
                                <input type="file" name="fileName" className="form-input" />
                              </div>
                              <div className="form-group full-width">
                                <label className="form-label">Link Asset IDs (comma-separated, e.g. AST-101, AST-102)</label>
                                <input type="text" name="linkAssetIds" placeholder="e.g. AST-201, AST-202" className="form-input" />
                              </div>
                              <div className="form-group full-width" style={{ marginTop: '8px' }}>
                                <SpinnerButton type="submit" className="btn btn-primary" style={{ width: '100%' }} loading={addingInvoice} loadingText="Filing…">Record &amp; File Purchase Invoice</SpinnerButton>
                              </div>
                            </form>
                          ) : (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
                              Finance Team credentials are required to file new acquisition invoices.
                            </div>
                          )}
                        </div>

                        <div className="card">
                          <span className="card-title">Tax and Procurement summary</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                              <span>Total Procurement Spend:</span>
                              <span style={{ fontWeight: '700' }}>
                                {formatINR(invoices.reduce((acc, curr) => acc + Number(curr.amount || 0) + (Number(curr.amount || 0) * (Number(curr.gst || 0) / 100)), 0))}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                              <span>Pending Settlements:</span>
                              <span style={{ fontWeight: '700', color: 'var(--status-maintenance)' }}>
                                {formatINR(invoices.filter(i => i.paymentStatus !== 'Paid').reduce((acc, curr) => acc + Number(curr.amount || 0) + (Number(curr.amount || 0) * (Number(curr.gst || 0) / 100)), 0))}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                              <span>Estimated Accrued Taxes (GST):</span>
                              <span style={{ fontWeight: '700', color: 'var(--primary)' }}>
                                {formatINR(invoices.reduce((acc, curr) => acc + (Number(curr.amount || 0) * (Number(curr.gst || 0) / 100)), 0))}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {invoices.length === 0 ? (
                        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', gap: '16px', marginTop: '20px' }}>
                          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99, 44, 237, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: 'var(--primary)' }}>
                            📄
                          </div>
                          <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>No Purchase Invoices Filed</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '400px', margin: 0 }}>
                              Procurement scan records, GST settlements, and billing links will appear here once recorded.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Search and Action Toolbar */}
                          <div className="card" style={{ padding: '16px', margin: '20px 0 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '12px', flexGrow: 1, minWidth: 'min(280px, 100%)', flexWrap: 'wrap', alignItems: 'center' }}>
                              {/* Search */}
                              <div className="search-field" style={{ width: 'min(250px, 100%)' }}>
                                <Search size={16} className="search-field-icon" />
                                <input
                                  type="text"
                                  placeholder="Search invoices..."
                                  className="form-input"
                                  value={invoiceSearchTerm}
                                  onChange={e => { setInvoiceSearchTerm(e.target.value); setInvoiceCurrentPage(1); }}

                                />
                              </div>
                              
                              {/* Filter Status */}
                              <div style={{ width: '160px' }}>
                                <CustomSelect
                                  options={[
                                    { value: 'All', label: '📊 Status: All' },
                                    { value: 'Pending', label: 'Pending' },
                                    { value: 'Partially Paid', label: 'Partially Paid' },
                                    { value: 'Paid', label: 'Paid' },
                                    { value: 'Overdue', label: 'Overdue' }
                                  ]}
                                  value={invoiceFilterStatus}
                                  onChange={e => { setInvoiceFilterStatus(e.target.value); setInvoiceCurrentPage(1); }}
                                />
                              </div>

                              {/* Sort Field */}
                              <div style={{ width: '160px' }}>
                                <CustomSelect
                                  options={[
                                    { value: 'id', label: '🔀 Sort: ID' },
                                    { value: 'date', label: 'Sort: Issue Date' },
                                    { value: 'amount', label: 'Sort: Base Value' },
                                    { value: 'vendor', label: 'Sort: Vendor' },
                                    { value: 'poReference', label: 'Sort: PO Ref' }
                                  ]}
                                  value={invoiceSortField}
                                  onChange={e => setInvoiceSortField(e.target.value)}
                                />
                              </div>

                              {/* Sort Order Button */}
                              <button 
                                className="btn btn-secondary"
                                onClick={() => setInvoiceSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                style={{ height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '80px', padding: '0 12px' }}
                                title="Toggle Sort Order"
                                type="button"
                              >
                                {invoiceSortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                              </button>
                            </div>

                            <div className="action-row">
                              <button className="btn btn-secondary" onClick={() => setShowBulkImportInvoices(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FileUp size={14} />
                                Bulk Import Invoices
                              </button>
                              <button className="btn btn-secondary" onClick={handleBulkExportInvoices} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Download size={14} />
                                Export Invoices
                              </button>
                            </div>
                          </div>

                          {/* Bulk Actions Bar */}
                          {selectedInvoiceIds.length > 0 && (
                            <div className="card" style={{ padding: '12px 20px', marginBottom: '16px', backgroundColor: 'rgba(99, 44, 237, 0.05)', border: '1.5px solid var(--primary)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)' }}>
                                ⚡ {selectedInvoiceIds.length} Invoice{selectedInvoiceIds.length > 1 ? 's' : ''} Selected
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Update Status:</span>
                                  <CustomSelect
                                    options={['Pending', 'Partially Paid', 'Paid', 'Overdue'].map(s => ({ value: s, label: s }))}
                                    placeholder="Change Status"
                                    onChange={e => handleBulkInvoiceStatusChange(e.target.value)}
                                    style={{ width: '150px' }}
                                  />
                                </div>
                                <button className="btn btn-secondary" onClick={handleBulkExportInvoices} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Download size={14} />
                                  Export Selected
                                </button>
                                <SpinnerButton className="btn btn-primary" style={{ backgroundColor: 'var(--status-disposed)' }} onClick={handleBulkDeleteInvoices} loadingText="Deleting…">Delete Selected</SpinnerButton>
                              </div>
                            </div>
                          )}

                          {/* Invoices List */}
                          <div className="table-container">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th style={{ width: '40px' }}>
                                    <input 
                                      type="checkbox"
                                      checked={paginatedInvoices.length > 0 && paginatedInvoices.every(i => selectedInvoiceIds.includes(i.id))}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          const visibleIds = paginatedInvoices.map(i => i.id);
                                          setSelectedInvoiceIds(prev => Array.from(new Set([...prev, ...visibleIds])));
                                        } else {
                                          const visibleIds = paginatedInvoices.map(i => i.id);
                                          setSelectedInvoiceIds(prev => prev.filter(id => !visibleIds.includes(id)));
                                        }
                                      }}
                                    />
                                  </th>
                                  <th>Invoice ID</th>
                                  <th>PO Reference</th>
                                  <th>Vendor Partner</th>
                                  <th>Date</th>
                                  <th>Base Value</th>
                                  <th>GST (%)</th>
                                  <th>Total Cost</th>
                                  <th>Associated Assets</th>
                                  <th>Payment Status</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedInvoices.length === 0 ? (
                                  <tr>
                                    <td colSpan="11" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                      No invoices match your search/filter criteria.
                                    </td>
                                  </tr>
                                ) : (
                                  paginatedInvoices.map(inv => {
                                    const amountNum = Number(inv.amount || 0);
                                    const gstNum = Number(inv.gst || 0);
                                    const total = amountNum + (amountNum * (gstNum / 100));
                                    const isSelected = selectedInvoiceIds.includes(inv.id);
                                    const hasPdf = inv.fileName && inv.fileName !== 'None' && inv.fileName !== 'invoice.pdf';
                                    return (
                                      <tr key={inv.id} className={isSelected ? 'selected-row' : ''}>
                                        <td>
                                          <input 
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {
                                              setSelectedInvoiceIds(prev => 
                                                prev.includes(inv.id) ? prev.filter(id => id !== inv.id) : [...prev, inv.id]
                                              );
                                            }}
                                          />
                                        </td>
                                        <td 
                                          onClick={() => setInvoiceDetailModal(inv)}
                                          style={{ fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: '700', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                          {inv.id}
                                        </td>
                                        <td style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{inv.poReference}</td>
                                        <td style={{ fontWeight: '600' }}>{inv.vendor}</td>
                                        <td style={{ fontSize: '12px' }}>{inv.date}</td>
                                        <td>{formatINR(amountNum)}</td>
                                        <td>{inv.gst}%</td>
                                        <td style={{ fontWeight: '700' }}>{formatINR(total)}</td>
                                        <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                          {(inv.mappedAssets || []).length > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                              {(inv.mappedAssets || []).map(aid => (
                                                <span 
                                                  key={aid}
                                                  onClick={() => {
                                                    const assetObj = assets.find(a => a.id === aid);
                                                    if (assetObj) setAssetDetailModal(assetObj);
                                                  }}
                                                  style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline', fontWeight: '500' }}
                                                >
                                                  {aid}
                                                </span>
                                              ))}
                                            </div>
                                          ) : (
                                            'No mapped assets'
                                          )}
                                        </td>
                                        <td>
                                          <span className="badge" style={{
                                            backgroundColor: inv.paymentStatus === 'Paid' ? 'var(--status-available-bg)' : inv.paymentStatus === 'Pending' ? 'var(--status-maintenance-bg)' : inv.paymentStatus === 'Overdue' ? 'var(--status-disposed-bg)' : 'var(--status-assigned-bg)',
                                            color: inv.paymentStatus === 'Paid' ? 'var(--status-available)' : inv.paymentStatus === 'Pending' ? 'var(--status-maintenance)' : inv.paymentStatus === 'Overdue' ? 'var(--status-disposed)' : 'var(--status-assigned)'
                                          }}>
                                            {inv.paymentStatus}
                                          </span>
                                        </td>
                                        <td>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {hasPermission('finance') ? (
                                              <CustomSelect
                                                options={['Pending', 'Partially Paid', 'Paid', 'Overdue'].map(s => ({ value: s, label: s }))}
                                                value={inv.paymentStatus}
                                                onChange={(e) => handleInvoicePaymentStatus(inv.id, e.target.value)}
                                                style={{ width: '130px' }}
                                              />
                                            ) : (
                                              <span style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--text-muted)' }}>Authorized only</span>
                                            )}
                                            {hasPdf ? (
                                              <a 
                                                href={`/api/files/${inv.fileName}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="btn btn-secondary btn-sm" 
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px'}}
                                              >
                                                📄 PDF
                                              </a>
                                            ) : (
                                              <span 
                                                style={{ 
                                                  display: 'inline-flex', 
                                                  alignItems: 'center', 
                                                  gap: '4px', 
                                                  padding: '4px 8px', 
                                                  fontSize: '11px', 
                                                  borderRadius: '4px', 
                                                  background: 'rgba(220, 38, 38, 0.1)', 
                                                  color: '#dc2626', 
                                                  fontWeight: '600',
                                                  border: '1px dashed rgba(220, 38, 38, 0.3)'
                                                }}
                                              >
                                                ⚠️ No PDF
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination Controls */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '0 4px', fontSize: '13px' }}>
                            <div style={{ color: 'var(--text-secondary)' }}>
                              Showing {filteredInvoices.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + invoiceItemsPerPage, filteredInvoices.length)} of {filteredInvoices.length} invoices
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <button 
                                className="btn btn-secondary btn-sm" disabled={invoiceCurrentPage === 1} onClick={() => setInvoiceCurrentPage(prev => Math.max(1, prev - 1))} type="button"
                              >
                                Previous
                              </button>
                              <span style={{ margin: '0 8px', fontWeight: '600' }}>
                                Page {invoiceCurrentPage} of {totalInvoicePages}
                              </span>
                              <button 
                                className="btn btn-secondary btn-sm" disabled={invoiceCurrentPage === totalInvoicePages} onClick={() => setInvoiceCurrentPage(prev => Math.min(totalInvoicePages, prev + 1))} type="button"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {financeSubTab === 'pending_upload' && (
                    <>
                      <div className="card" style={{ padding: '16px', marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="search-field" style={{ display: 'flex', gap: '12px', flexGrow: 1, minWidth: 'min(280px, 100%)', maxWidth: '500px' }}>
                          <Search size={16} className="search-field-icon" />
                          <input
                            type="text"
                            placeholder="Search pending uploads by ID, PO or vendor..."
                            className="form-input"
                            value={invoicePdfSearchTerm}
                            onChange={e => setInvoicePdfSearchTerm(e.target.value)}

                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                        {invoices.filter(inv => {
                          const isPending = !inv.fileName || inv.fileName === 'None' || inv.fileName === 'invoice.pdf';
                          if (!isPending) return false;
                          const term = invoicePdfSearchTerm.toLowerCase();
                          return (
                            String(inv.id).toLowerCase().includes(term) ||
                            String(inv.vendor).toLowerCase().includes(term) ||
                            String(inv.poReference).toLowerCase().includes(term)
                          );
                        }).length === 0 ? (
                          <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                            🎉 All invoices have verified PDF scans uploaded. No pending uploads!
                          </div>
                        ) : (
                          invoices.filter(inv => {
                            const isPending = !inv.fileName || inv.fileName === 'None' || inv.fileName === 'invoice.pdf';
                            if (!isPending) return false;
                            const term = invoicePdfSearchTerm.toLowerCase();
                            return (
                              String(inv.id).toLowerCase().includes(term) ||
                              String(inv.vendor).toLowerCase().includes(term) ||
                              String(inv.poReference).toLowerCase().includes(term)
                            );
                          }).map(inv => {
                            const amountNum = Number(inv.amount || 0);
                            const gstNum = Number(inv.gst || 0);
                            const total = amountNum + (amountNum * (gstNum / 100));
                            return (
                              <div key={inv.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', borderLeft: '4px solid var(--status-maintenance)' }}>
                                <div style={{ flex: '1 1 300px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span 
                                      onClick={() => setInvoiceDetailModal(inv)}
                                      style={{ fontFamily: 'var(--mono)', fontWeight: '700', fontSize: '15px', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                      {inv.id}
                                    </span>
                                    <span className="badge" style={{ backgroundColor: 'var(--bg-sidebar)', color: 'var(--text-primary)' }}>PO: {inv.poReference}</span>
                                  </div>
                                  <div style={{ fontSize: '13px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 16px' }}>
                                    <div><strong>Vendor Partner:</strong> {inv.vendor}</div>
                                    <div><strong>Issue Date:</strong> {inv.date}</div>
                                    <div><strong>Total Bill:</strong> {formatINR(total)}</div>
                                    <div><strong>GST Tax:</strong> {inv.gst}%</div>
                                  </div>
                                </div>
                                <div 
                                  style={{ 
                                    border: '2px dashed var(--border-color)', 
                                    borderRadius: 'var(--radius-lg)', 
                                    padding: '16px 24px', 
                                    background: 'var(--bg-sidebar)', 
                                    textAlign: 'center', 
                                    position: 'relative', 
                                    minWidth: 'min(280px, 100%)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  onDragOver={e => e.preventDefault()}
                                  onDrop={e => {
                                    e.preventDefault();
                                    const file = e.dataTransfer?.files[0];
                                    if (file) handleUploadPdfForInvoice(inv.id, file);
                                  }}
                                >
                                  <FileUp size={24} style={{ color: 'var(--primary)' }} />
                                  <span style={{ fontSize: '12px', fontWeight: '600' }}>Drag & Drop PDF scan here</span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>or click to choose</span>
                                  <input 
                                    type="file" 
                                    accept=".pdf" 
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadPdfForInvoice(inv.id, file);
                                    }} 
                                    style={{ opacity: 0, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                                  />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}

                  {financeSubTab === 'asset_mapping' && (
                    <div className="dashboard-grid-secondary" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                      <div className="card">
                        <span className="card-title">Link Assets to Invoice</span>
                        {hasPermission('finance') ? (
                          <form onSubmit={(e) => {
                            e.preventDefault();
                            const invId = mappingInvoiceId;
                            if (!invId) {
                              addToast("Error", "Please select an invoice.", "error");
                              return;
                            }
                            handleBulkMapAssetsToInvoice(invId, selectedMappingAssets.join(','));
                          }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div className="form-group">
                              <label className="form-label">Select Target Invoice</label>
                              <CustomSelect
                                options={[
                                  { value: '', label: 'Select an invoice...' },
                                  ...invoices.map(inv => ({ value: inv.id, label: `${inv.id} - ${inv.vendor} (PO: ${inv.poReference})` }))
                                ]}
                                value={mappingInvoiceId}
                                onChange={e => setMappingInvoiceId(e.target.value)}
                                required
                              />
                            </div>
                            
                            <div className="form-group">
                              <label className="form-label">Asset Picker (Select Assets to Link)</label>
                              
                              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <input 
                                  type="text" 
                                  placeholder="Search assets by ID or name..." 
                                  value={mappingAssetSearch}
                                  onChange={e => setMappingAssetSearch(e.target.value)}
                                  className="form-input form-input-sm"
                                  style={{ flexGrow: 1, height: '36px'}}
                                />
                                <CustomSelect
                                  options={[
                                    { value: 'All', label: 'All Categories' },
                                    { value: 'IT', label: 'IT' },
                                    { value: 'Office', label: 'Office' }
                                  ]}
                                  value={mappingAssetCategory}
                                  onChange={e => setMappingAssetCategory(e.target.value)}
                                  style={{ width: '130px', height: '36px' }}
                                />
                              </div>

                              <div style={{ 
                                maxHeight: '180px', 
                                overflowY: 'auto', 
                                border: '1px solid var(--border-color)', 
                                borderRadius: '6px', 
                                padding: '8px',
                                background: 'var(--bg-sidebar)'
                              }}>
                                {assets
                                  .filter(asset => {
                                    const term = mappingAssetSearch.toLowerCase();
                                    const matchSearch = asset.id.toLowerCase().includes(term) || asset.name.toLowerCase().includes(term);
                                    const matchCategory = mappingAssetCategory === 'All' || asset.category === mappingAssetCategory;
                                    return matchSearch && matchCategory;
                                  })
                                  .map(asset => {
                                    const isChecked = selectedMappingAssets.includes(asset.id);
                                    const isLinkedElsewhere = asset.invoiceId && asset.invoiceId !== mappingInvoiceId;
                                    return (
                                      <label 
                                        key={asset.id} 
                                        style={{ 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          padding: '6px 8px', 
                                          borderRadius: '4px', 
                                          cursor: 'pointer',
                                          fontSize: '12px',
                                          background: isChecked ? 'rgba(99, 44, 237, 0.05)' : 'transparent',
                                          justifyContent: 'space-between',
                                          transition: 'background 0.2s'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <input 
                                            type="checkbox" 
                                            checked={isChecked}
                                            onChange={() => {
                                              if (isChecked) {
                                                setSelectedMappingAssets(prev => prev.filter(id => id !== asset.id));
                                              } else {
                                                setSelectedMappingAssets(prev => [...prev, asset.id]);
                                              }
                                            }}
                                          />
                                          <span style={{ fontWeight: '600' }}>{asset.id}</span>
                                          <span style={{ color: 'var(--text-secondary)' }}>- {asset.name}</span>
                                        </div>
                                        {isLinkedElsewhere && (
                                          <span style={{ fontSize: '10px', color: 'var(--status-maintenance)', fontStyle: 'italic', fontWeight: '500' }}>
                                            (linked: {asset.invoiceId})
                                          </span>
                                        )}
                                      </label>
                                    );
                                  })
                                }
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                                {selectedMappingAssets.length === 0
                                  ? 'No assets selected — saving will unlink every asset from this invoice.'
                                  : `${selectedMappingAssets.length} asset(s) will be linked to this invoice. Unchecking removes a link.`}
                              </span>
                            </div>

                            <SpinnerButton type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={!mappingInvoiceId} loading={mappingInvoiceAssets} loadingText="Saving…">Save Asset Mapping</SpinnerButton>
                          </form>
                        ) : (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
                            Only the Finance Team or Super Admins can map assets to invoices.
                          </div>
                        )}
                      </div>

                      <div className="card">
                        <span className="card-title">Assets Linking Status Directory</span>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                          Review current mapping links of inventory assets to vendor purchase invoices.
                        </p>
                        <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                <th style={{ padding: '8px 12px' }}>Asset ID</th>
                                <th style={{ padding: '8px 12px' }}>Asset Name</th>
                                <th style={{ padding: '8px 12px' }}>Linked Invoice ID</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assets.length === 0 ? (
                                <tr>
                                  <td colSpan="3" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No assets in inventory</td>
                                </tr>
                              ) : (
                                assets.map(asset => (
                                  <tr key={asset.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '8px 12px', fontWeight: '700' }}>{asset.id}</td>
                                    <td style={{ padding: '8px 12px' }}>{asset.name}</td>
                                    <td style={{ padding: '8px 12px', color: asset.invoiceId ? 'var(--primary)' : 'var(--text-muted)', fontWeight: asset.invoiceId ? '600' : 'normal' }}>
                                      {asset.invoiceId || 'Not linked'}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
  );
}
