import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import { silk } from './engine/motion'
import {
  LayoutDashboard,
  Package,
  RefreshCw,
  UserCheck,
  FileText,
  FolderOpen,
  QrCode,
  ClipboardList,
  Bell,
  Search,
  AlertCircle,
  Plus,
  Eye,
  Edit2,
  Trash2,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  X,
  Download,
  FileUp,
  Mail,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  Check,
  Users
} from 'lucide-react'
import QRCode from 'qrcode'
import { mockAuthService, DEMO_CREDENTIALS } from './auth'
import LoginView from './LoginView'
import { api } from './api'
import './App.css'

// Reusable Custom Premium Dropdown Component
const CustomSelect = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select option...',
  disabled = false,
  className = '',
  style = {},
  id = '',
  name = '',
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = React.useRef(null);
  const listRef = React.useRef(null);

  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return { value: opt.value, label: opt.label || opt.value };
    }
    return { value: opt, label: opt };
  });

  const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value));

  const toggleDropdown = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (focusedIndex >= 0 && focusedIndex < normalizedOptions.length) {
        selectOption(normalizedOptions[focusedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setFocusedIndex(0);
      } else {
        const nextIndex = (focusedIndex + 1) % normalizedOptions.length;
        setFocusedIndex(nextIndex);
        scrollIntoView(nextIndex);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setFocusedIndex(normalizedOptions.length - 1);
      } else {
        const prevIndex = (focusedIndex - 1 + normalizedOptions.length) % normalizedOptions.length;
        setFocusedIndex(prevIndex);
        scrollIntoView(prevIndex);
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const selectOption = (opt) => {
    onChange({ target: { value: opt.value, name } });
    setIsOpen(false);
  };

  const scrollIntoView = (index) => {
    if (listRef.current) {
      const activeEl = listRef.current.children[index];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      const initialIndex = normalizedOptions.findIndex(opt => String(opt.value) === String(value));
      setFocusedIndex(initialIndex >= 0 ? initialIndex : 0);
    } else {
      setFocusedIndex(-1);
    }
  }, [isOpen, value]);

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}
      style={{ position: 'relative', width: '100%', ...style }}
      id={id}
    >
      <button
        type="button"
        className="custom-select-trigger"
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="custom-select-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="custom-select-chevron" size={16} />
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          className="custom-select-menu"
          role="listbox"
          tabIndex={-1}
        >
          {normalizedOptions.length === 0 ? (
            <li className="custom-select-item is-disabled" style={{ fontStyle: 'italic', justifyContent: 'center' }}>
              No options available
            </li>
          ) : (
            normalizedOptions.map((opt, index) => {
              const isSelected = String(opt.value) === String(value);
              const isFocused = index === focusedIndex;
              return (
                <li
                  key={opt.value}
                  className={`custom-select-item ${isSelected ? 'is-selected' : ''} ${isFocused ? 'is-focused' : ''}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectOption(opt)}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <span className="custom-select-item-label">{opt.label}</span>
                  {isSelected && <Check className="custom-select-item-check" size={14} />}
                </li>
              );
            })
          )}
        </ul>
      )}

      {(name || required) && (
        <input
          type="text"
          name={name}
          value={value || ''}
          required={required}
          readOnly
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            bottom: 0,
            left: 0,
            right: 0,
            height: '1px'
          }}
        />
      )}
    </div>
  );
};

const USER_ROLE_OPTIONS = ['Super Admin', 'IT Admin', 'Facility Admin', 'Auditor', 'Employee'];

const UserDirectoryPage = ({ usersList, setUsersList, isApiConnected }) => {
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('Employee');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (!formUsername.trim() || !formPassword.trim() || !formName.trim()) {
      setFormError('Username, password and name are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (isApiConnected) {
        const { api: apiModule } = await import('./api');
        const created = await apiModule.createUser({
          username: formUsername.trim(),
          password: formPassword,
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole
        });
        setUsersList(prev => [...prev, created]);
      } else {
        const newUser = {
          id: Date.now(),
          username: formUsername.trim(),
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole,
          created_at: new Date().toISOString()
        };
        setUsersList(prev => [...prev, newUser]);
      }
      const saved = formUsername.trim();
      setFormSuccess(`User "${saved}" created successfully!`);
      setFormUsername('');
      setFormPassword('');
      setFormName('');
      setFormEmail('');
      setFormRole('Employee');
    } catch (err) {
      setFormError(err.message || 'Failed to create user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      {/* ---- Left: User table ---- */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="page-header" style={{ marginBottom: '20px' }}>
          <div className="page-title-section">
            <h2 className="page-title">User Directory</h2>
            <p className="page-subtitle">
              {usersList.length} registered account{usersList.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map((u, idx) => (
                <tr key={u.id || u.username || idx}>
                  <td><strong style={{ color: 'var(--primary)' }}>{u.username}</strong></td>
                  <td>{u.name || u.username}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{u.email || '—'}</td>
                  <td>
                    <span className={`badge ${
                      u.role === 'Super Admin' ? 'badge-available' :
                      u.role === 'Auditor'    ? 'badge-under-maintenance' : 'badge-assigned'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}
                  </td>
                </tr>
              ))}
              {usersList.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-muted)' }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Right: Create user card ---- */}
      <div style={{ width: '340px', flexShrink: 0 }}>
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700 }}>Register New User</h3>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--color-muted)' }}>
            Create a new system account
          </p>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input className="form-input" type="text" placeholder="e.g. john.doe"
                value={formUsername} onChange={e => setFormUsername(e.target.value)} autoComplete="off" />
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input className="form-input" type="password" placeholder="Min. 8 characters"
                value={formPassword} onChange={e => setFormPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" type="text" placeholder="e.g. John Doe"
                value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="john@company.com"
                value={formEmail} onChange={e => setFormEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <CustomSelect
                options={USER_ROLE_OPTIONS.map(r => ({ value: r, label: r }))}
                value={formRole}
                onChange={setFormRole}
                placeholder="Select role"
              />
            </div>
            {formError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#ef4444' }}>
                {formError}
              </div>
            )}
            {formSuccess && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#22c55e' }}>
                {formSuccess}
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ marginTop: '4px' }}>
              {isSubmitting ? 'Creating…' : 'Create User'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ─── Default role permission matrix ───────────────────────────────────────────
// Keys match the action strings used in hasPermission().
// 'Super Admin' is always full-access and cannot be edited.
const DEFAULT_ROLE_PERMISSIONS = {
  'IT Admin':       { view: true,  write: true,  allocate: true,  delete: true,  finance: false, viewReports: true,  viewAMC: true,  viewFinance: false },
  'Facility Admin': { view: true,  write: true,  allocate: true,  delete: true,  finance: false, viewReports: true,  viewAMC: true,  viewFinance: false },
  'Finance Team':   { view: true,  write: false, allocate: false, delete: false, finance: true,  viewReports: true,  viewAMC: true,  viewFinance: true  },
  'Auditor':        { view: true,  write: false, allocate: false, delete: false, finance: false, viewReports: true,  viewAMC: true,  viewFinance: true  },
  'Employee':       { view: true,  write: false, allocate: false, delete: false, finance: false, viewReports: false, viewAMC: false, viewFinance: false },
};

const PERMISSION_LABELS = [
  { key: 'view',        label: 'View Assets',       description: 'Can browse the asset list' },
  { key: 'write',       label: 'Add / Edit Assets',  description: 'Can register and modify assets' },
  { key: 'allocate',    label: 'Allocate Assets',    description: 'Can assign assets to employees' },
  { key: 'delete',      label: 'Delete Assets',      description: 'Can permanently remove assets' },
  { key: 'finance',     label: 'Finance Actions',    description: 'Can manage invoices and payments' },
  { key: 'viewReports', label: 'View Reports',       description: 'Can access Reports & Logs tab' },
  { key: 'viewAMC',     label: 'View AMC',           description: 'Can access AMC Contracts tab' },
  { key: 'viewFinance', label: 'View Finance Tab',   description: 'Can access Finance tab' },
];

const EDITABLE_ROLES = ['IT Admin', 'Facility Admin', 'Finance Team', 'Auditor', 'Employee'];

const RolePermissionsPage = ({ rolePermissions, setRolePermissions }) => {
  const toggle = (role, key) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: { ...prev[role], [key]: !prev[role][key] }
    }));
  };

  const resetToDefault = () => {
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div className="page-title-section">
          <h2 className="page-title">Role Permissions</h2>
          <p className="page-subtitle">Toggle access rights for each system role. Super Admin always has full access.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={resetToDefault}>
            Reset to Defaults
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: '780px' }}>
          <thead>
            <tr>
              <th style={{ width: '200px' }}>Permission</th>
              <th style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: '12px' }}>Description</th>
              {EDITABLE_ROLES.map(role => (
                <th key={role} style={{ textAlign: 'center', whiteSpace: 'nowrap', width: '110px' }}>
                  <span style={{ fontSize: '12px' }}>{role}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_LABELS.map(({ key, label, description }) => (
              <tr key={key}>
                <td style={{ fontWeight: 600, fontSize: '13px' }}>{label}</td>
                <td style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{description}</td>
                {EDITABLE_ROLES.map(role => {
                  const granted = rolePermissions[role]?.[key] ?? false;
                  return (
                    <td key={role} style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => toggle(role, key)}
                        title={granted ? 'Click to revoke' : 'Click to grant'}
                        style={{
                          width: '36px', height: '20px',
                          borderRadius: '10px',
                          border: 'none',
                          cursor: 'pointer',
                          position: 'relative',
                          background: granted ? 'var(--primary)' : 'var(--border-color)',
                          transition: 'background 0.2s ease',
                          flexShrink: 0,
                          display: 'inline-block'
                        }}
                        aria-label={`${granted ? 'Revoke' : 'Grant'} ${label} for ${role}`}
                      >
                        <span style={{
                          position: 'absolute',
                          top: '2px',
                          left: granted ? '18px' : '2px',
                          width: '16px', height: '16px',
                          borderRadius: '50%',
                          background: '#fff',
                          transition: 'left 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                        }} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-sidebar)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Note:</strong> Changes take effect immediately for all active sessions. 
          Super Admin always retains full access regardless of these settings.
          IT Admin and Facility Admin permissions apply only to their respective asset categories (IT / Office).
        </p>
      </div>
    </div>
  );
};

const UserManagementPage = ({ usersList, setUsersList, isApiConnected, rolePermissions, setRolePermissions }) => {
  const [usersSubTab, setUsersSubTab] = useState('directory');
  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', background: 'var(--bg-sidebar)', padding: '4px', borderRadius: 'var(--radius-lg)', width: 'fit-content', border: '1px solid var(--border-color)' }}>
        {[{ id: 'directory', label: '👥  User Directory' }, { id: 'permissions', label: '🔐  Role Permissions' }].map(tab => (
          <button
            key={tab.id}
            onClick={() => setUsersSubTab(tab.id)}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              transition: 'all 0.2s',
              background: usersSubTab === tab.id ? 'var(--primary)' : 'transparent',
              color: usersSubTab === tab.id ? 'var(--ink-contrast)' : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {usersSubTab === 'directory' && (
        <UserDirectoryPage
          usersList={usersList}
          setUsersList={setUsersList}
          isApiConnected={isApiConnected}
        />
      )}
      {usersSubTab === 'permissions' && (
        <RolePermissionsPage
          rolePermissions={rolePermissions}
          setRolePermissions={setRolePermissions}
        />
      )}
    </div>
  );
};

// Default Initial Mock Data
const INITIAL_ASSETS = [
  {
    id: "AST-001",
    name: "Dell XPS 15 Laptop",
    serialNumber: "CN-0V2D6M-89102",
    category: "IT",
    type: "Laptops",
    status: "Assigned",
    cost: 1500,
    purchaseDate: "2025-01-15",
    warrantyExpiry: "2027-01-15",
    department: "Engineering",
    location: "New York HQ",
    amcId: "",
    invoiceId: "INV-101",
    assignedEmployee: "Alice Johnson",
    depreciationLifeYears: 4,
    disposalDate: "",
    disposalReason: "",
    notes: "Developer workstation with 32GB RAM."
  },
  {
    id: "AST-002",
    name: "MacBook Pro 16\"",
    serialNumber: "C02F87DKMD6R",
    category: "IT",
    type: "Laptops",
    status: "Assigned",
    cost: 2400,
    purchaseDate: "2025-06-10",
    warrantyExpiry: "2026-06-10",
    department: "Engineering",
    location: "London Branch",
    amcId: "",
    invoiceId: "INV-102",
    assignedEmployee: "Bob Smith",
    depreciationLifeYears: 3,
    disposalDate: "",
    disposalReason: "",
    notes: "M3 Max, 64GB RAM, 1TB SSD."
  },
  {
    id: "AST-003",
    name: "Herman Miller Aeron Chair",
    serialNumber: "HM-AER-98273",
    category: "Office",
    type: "Chairs",
    status: "Available",
    cost: 1200,
    purchaseDate: "2024-09-05",
    warrantyExpiry: "2029-09-05",
    department: "HR",
    location: "New York HQ",
    amcId: "",
    invoiceId: "INV-103",
    assignedEmployee: "",
    depreciationLifeYears: 10,
    disposalDate: "",
    disposalReason: "",
    notes: "Ergonomic chair, size B."
  },
  {
    id: "AST-004",
    name: "Carrier 2-Ton Split AC",
    serialNumber: "CR-AC-908273",
    category: "Office",
    type: "AC Units",
    status: "Under Maintenance",
    cost: 850,
    purchaseDate: "2023-05-20",
    warrantyExpiry: "2025-05-20",
    department: "Operations",
    location: "Tokyo Office",
    amcId: "AMC-101",
    invoiceId: "INV-104",
    assignedEmployee: "",
    depreciationLifeYears: 5,
    disposalDate: "",
    disposalReason: "",
    notes: "Needs compressor servicing."
  },
  {
    id: "AST-005",
    name: "Dell 24\" IPS Monitor",
    serialNumber: "CN-0M3892-1209",
    category: "IT",
    type: "Monitors",
    status: "Assigned",
    cost: 220,
    purchaseDate: "2025-02-12",
    warrantyExpiry: "2028-02-12",
    department: "HR",
    location: "London Branch",
    amcId: "",
    invoiceId: "INV-101",
    assignedEmployee: "Charlie Brown",
    depreciationLifeYears: 5,
    disposalDate: "",
    disposalReason: "",
    notes: "Secondary display for HR workspace."
  },
  {
    id: "AST-006",
    name: "PowerEdge R750 Server",
    serialNumber: "Dell-PE-R750-X82",
    category: "IT",
    type: "Servers",
    status: "Available",
    cost: 7500,
    purchaseDate: "2024-11-01",
    warrantyExpiry: "2027-11-01",
    department: "IT",
    location: "New York HQ Server Room",
    amcId: "AMC-102",
    invoiceId: "INV-105",
    assignedEmployee: "",
    depreciationLifeYears: 5,
    disposalDate: "",
    disposalReason: "",
    notes: "Rack mount database server."
  }
];

const INITIAL_AMCS = [
  {
    id: "AMC-101",
    vendor: "Carrier CoolCare Services",
    cost: 150,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    mappedAssets: ["AST-004"],
    serviceSchedule: "Quarterly",
    agreementFile: "carrier_amc_2026.pdf",
    serviceHistory: [
      { date: "2026-02-15", type: "Routine Filter Cleaning", notes: "Done by tech John." },
      { date: "2026-05-18", type: "Gas Recharge", notes: "Completed successfully." }
    ]
  },
  {
    id: "AMC-102",
    vendor: "Dell Enterprise Support",
    cost: 800,
    startDate: "2026-06-01",
    endDate: "2026-11-01",
    mappedAssets: ["AST-006"],
    serviceSchedule: "Bi-Annual",
    agreementFile: "dell_support_agreement.pdf",
    serviceHistory: [
      { date: "2026-06-10", type: "Firmware Diagnostics", notes: "No hardware errors found." }
    ]
  }
];

const INITIAL_INVOICES = [
  {
    id: "INV-101",
    poReference: "PO-2025-001",
    vendor: "TechDistributors LLC",
    amount: 1720,
    gst: 18,
    date: "2025-01-10",
    paymentStatus: "Paid",
    mappedAssets: ["AST-001", "AST-005"],
    fileName: "invoice_101_techdist.pdf"
  },
  {
    id: "INV-102",
    poReference: "PO-2025-042",
    vendor: "Apple Retail Corp.",
    amount: 2400,
    gst: 0,
    date: "2025-06-05",
    paymentStatus: "Paid",
    mappedAssets: ["AST-002"],
    fileName: "apple_invoice_MBP.pdf"
  },
  {
    id: "INV-103",
    poReference: "PO-2024-118",
    vendor: "Office Space Solutions",
    amount: 1200,
    gst: 12,
    date: "2024-09-01",
    paymentStatus: "Paid",
    mappedAssets: ["AST-003"],
    fileName: "herman_miller_invoice.pdf"
  },
  {
    id: "INV-104",
    poReference: "PO-2023-089",
    vendor: "Tokyo AC Retailers",
    amount: 850,
    gst: 10,
    date: "2023-05-18",
    paymentStatus: "Paid",
    mappedAssets: ["AST-004"],
    fileName: "carrier_ac_invoice.pdf"
  },
  {
    id: "INV-105",
    poReference: "PO-2024-902",
    vendor: "Dell Commercial Sales",
    amount: 7500,
    gst: 18,
    date: "2024-10-25",
    paymentStatus: "Partially Paid",
    mappedAssets: ["AST-006"],
    fileName: "dell_invoice_R750.pdf"
  },
  {
    id: "INV-106",
    poReference: "PO-2026-004",
    vendor: "Office Depot Corp.",
    amount: 450,
    gst: 12,
    date: "2026-06-01",
    paymentStatus: "Pending",
    mappedAssets: [],
    fileName: "stationery_invoice.pdf"
  },
  {
    id: "INV-107",
    poReference: "PO-2026-009",
    vendor: "NetSupply Co.",
    amount: 3500,
    gst: 18,
    date: "2026-05-10",
    paymentStatus: "Overdue",
    mappedAssets: [],
    fileName: "switch_invoice_netsupply.pdf"
  }
];

const INITIAL_DOCUMENTS = [
  {
    id: "DOC-001",
    name: "dell_invoice_R750.pdf",
    type: "Invoice",
    size: "450 KB",
    uploadDate: "2024-10-26",
    association: "Invoice INV-105"
  },
  {
    id: "DOC-002",
    name: "carrier_amc_2026.pdf",
    type: "AMC Agreement",
    size: "1.2 MB",
    uploadDate: "2026-01-02",
    association: "AMC AMC-101"
  },
  {
    id: "DOC-003",
    name: "macbook_warranty_card.pdf",
    type: "Warranty Certificate",
    size: "820 KB",
    uploadDate: "2025-06-11",
    association: "Asset AST-002"
  }
];

const INITIAL_MOVEMENTS = [
  {
    id: "MVT-001",
    assetId: "AST-001",
    date: "2025-01-15",
    type: "Procurement",
    from: "TechDistributors LLC",
    to: "Inventory (New York HQ)",
    actor: "Finance Team",
    notes: "Purchased under PO-2025-001"
  },
  {
    id: "MVT-002",
    assetId: "AST-001",
    date: "2025-01-16",
    type: "Allocation",
    from: "Inventory",
    to: "Alice Johnson (HR)",
    actor: "IT Admin",
    notes: "Developer XPS assigned."
  },
  {
    id: "MVT-003",
    assetId: "AST-002",
    date: "2025-06-10",
    type: "Procurement",
    from: "Apple Retail",
    to: "Inventory (London)",
    actor: "Finance Team",
    notes: "Standard issue MacBook Pro"
  },
  {
    id: "MVT-004",
    assetId: "AST-002",
    date: "2025-06-12",
    type: "Allocation",
    from: "Inventory",
    to: "Bob Smith (Engineering)",
    actor: "IT Admin",
    notes: "Engineering laptop assigned."
  },
  {
    id: "MVT-005",
    assetId: "AST-004",
    date: "2023-05-20",
    type: "Procurement",
    from: "Tokyo AC Retailers",
    to: "Operations (Tokyo)",
    actor: "Finance Team",
    notes: "Office cooling infrastructure"
  },
  {
    id: "MVT-006",
    assetId: "AST-004",
    date: "2025-07-01",
    type: "Status Change",
    from: "Available",
    to: "Under Maintenance",
    actor: "Facility Admin",
    notes: "Sent for compressor servicing under AMC AMC-101"
  }
];

const INITIAL_LOGS = [
  {
    id: "LOG-001",
    timestamp: "2026-07-06 09:15 AM",
    actor: "Super Admin",
    action: "User Login",
    detail: "System session initialized."
  },
  {
    id: "LOG-002",
    timestamp: "2026-07-06 10:20 AM",
    actor: "IT Admin",
    action: "Asset Allocation",
    detail: "Assigned Dell XPS 15 (AST-001) to Alice Johnson."
  },
  {
    id: "LOG-003",
    timestamp: "2026-07-06 11:45 AM",
    actor: "Finance Team",
    action: "Invoice Upload",
    detail: "Uploaded NetSupply Invoice INV-107, marked Overdue."
  }
];

const INITIAL_EMAILS = [
  {
    id: "EML-001",
    sender: "AssetFlow Monitor",
    date: "2026-07-06 08:00 AM",
    subject: "ALERT: Overdue Invoice Payments",
    body: "Hi Team,\n\nThis is an automated alert. Invoice INV-107 from vendor NetSupply Co. amounting to $3500.00 is currently marked as OVERDUE. Please review and process the payments immediately.\n\nRegards,\nAssetFlow Finance Bot"
  },
  {
    id: "EML-002",
    sender: "AMC Alerts Engine",
    date: "2026-07-05 10:30 AM",
    subject: "WARNING: Dell Enterprise Support Contract Expiring Soon",
    body: "Attention Facilities/IT Admins,\n\nAMC Contract AMC-102 (Dell Enterprise Support) mapped to Asset AST-006 (PowerEdge R750 Server) is expiring on 2026-11-01 (within 120 days). Please coordinate with the vendor for renewals.\n\nRegards,\nContract Management Engine"
  },
  {
    id: "EML-003",
    sender: "Warranty Monitoring",
    date: "2026-07-04 09:00 AM",
    subject: "NOTIF: Warranty Expiry Warning for MacBook Pro",
    body: "Dear Administrator,\n\nThe warranty of Asset AST-002 (MacBook Pro 16\", Serial: C02F87DKMD6R) will expire on 2026-06-10. Please log any pending hardware repairs prior to expiration.\n\nRegards,\nWarranty Engine"
  }
];

const INITIAL_NOTIFICATIONS = [
  { id: "NTF-001", text: "Invoice INV-107 from NetSupply Co. is OVERDUE ($3500)", type: "error", time: "2 hours ago", read: false },
  { id: "NTF-002", text: "AMC Contract AMC-102 expiring soon (Dell Enterprise Support)", type: "warning", time: "1 day ago", read: false },
  { id: "NTF-003", text: "Asset AST-004 (AC Unit) status set to Under Maintenance", type: "info", time: "5 days ago", read: true }
];

// Helper to initialize Local Storage
const getStoredData = (key, fallback) => {
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return fallback;
    }
  }
  localStorage.setItem(key, JSON.stringify(fallback));
  return fallback;
};

// QR Code Sticker Renderer Component
const QRCodeSticker = ({ asset }) => {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (asset) {
      QRCode.toDataURL(
        JSON.stringify({
          id: asset.id,
          name: asset.name,
          serial: asset.serialNumber,
          category: asset.category,
          company: "NPS Enterprise"
        }),
        { margin: 2, width: 120 }
      ).then(url => {
        setQrUrl(url);
      }).catch(err => {
        console.error("QR Generation failed", err);
      });
    }
  }, [asset]);

  return (
    <div className="qr-sticker-card">
      <div className="sticker-header">
        <span className="sticker-company">NPS ENTERPRISE</span>
        <span className="sticker-logo">SECURE TAG</span>
      </div>
      <div className="sticker-body">
        <div className="sticker-qr">
          {qrUrl ? <img src={qrUrl} alt="QR Code" /> : <div style={{ fontSize: '9px' }}>Generating...</div>}
        </div>
        <div className="sticker-details">
          <div className="sticker-detail-row">
            <span className="sticker-label">Asset Code</span>
            <span className="sticker-val code">{asset.id}</span>
          </div>
          <div className="sticker-detail-row">
            <span className="sticker-label">Asset Type</span>
            <span className="sticker-val">{asset.type}</span>
          </div>
          <div className="sticker-detail-row">
            <span className="sticker-label">Serial Number</span>
            <span className="sticker-val">{asset.serialNumber}</span>
          </div>
        </div>
      </div>
      <div className="sticker-footer">
        <div className="barcode-visual">
          <div className="barcode-bar thick"></div>
          <div className="barcode-bar spacer"></div>
          <div className="barcode-bar thin"></div>
          <div className="barcode-bar medium"></div>
          <div className="barcode-bar thick"></div>
          <div className="barcode-bar spacer"></div>
          <div className="barcode-bar thin"></div>
          <div className="barcode-bar medium"></div>
          <div className="barcode-bar thin"></div>
          <div className="barcode-bar spacer"></div>
          <div className="barcode-bar thick"></div>
          <div className="barcode-bar thin"></div>
        </div>
      </div>
    </div>
  );
};

function App() {
  // Navigation & Auth States
  const [currentUser, setCurrentUser] = useState(() => mockAuthService.getCurrentSession());
  const [activeTab, setActiveTab] = useState(() => {
    const session = mockAuthService.getCurrentSession();
    if (!session) return 'login';
    const hash = window.location.hash.replace('#/', '');
    const validTabs = ['dashboard', 'assets', 'allocations', 'amc', 'finance', 'documents', 'qr_lookup', 'reports', 'emails'];
    return hash && validTabs.includes(hash) ? hash : 'dashboard';
  });
  const [currentRole, setCurrentRole] = useState(() => {
    const session = mockAuthService.getCurrentSession();
    return session ? session.role : 'Super Admin';
  });
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 'light';
  });

  // DB States (Loaded from Local Storage)
  const [assets, setAssets] = useState(() => getStoredData('db_assets', INITIAL_ASSETS));
  const [amcs, setAmcs] = useState(() => getStoredData('db_amcs', INITIAL_AMCS));
  const [invoices, setInvoices] = useState(() => getStoredData('db_invoices', INITIAL_INVOICES));
  const [documents, setDocuments] = useState(() => getStoredData('db_documents', INITIAL_DOCUMENTS));
  const [movements, setMovements] = useState(() => getStoredData('db_movements', INITIAL_MOVEMENTS));
  const [logs, setLogs] = useState(() => getStoredData('db_logs', INITIAL_LOGS));
  const [notifications, setNotifications] = useState(() => getStoredData('db_notifications', INITIAL_NOTIFICATIONS));
  const [emails, setEmails] = useState(() => getStoredData('db_emails', INITIAL_EMAILS));
  const [selectedEmailId, setSelectedEmailId] = useState(() => emails[0]?.id || null);
  const [usersList, setUsersList] = useState(() => getStoredData('db_users', DEMO_CREDENTIALS));
  const [rolePermissions, setRolePermissions] = useState(() => getStoredData('db_role_permissions', DEFAULT_ROLE_PERMISSIONS));

  const [quickAllocAssetId, setQuickAllocAssetId] = useState('');
  const [quickTransferAssetId, setQuickTransferAssetId] = useState('');

  // Controlled states for AMC forms
  const [newAmcServiceSchedule, setNewAmcServiceSchedule] = useState('Monthly');
  const [mapAmcId, setMapAmcId] = useState('');
  const [mapAssetId, setMapAssetId] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('Invoice');

  // Controlled states for Modal selectors
  const [addAssetCategory, setAddAssetCategory] = useState('IT');
  const [addAssetInvoiceId, setAddAssetInvoiceId] = useState('');
  const [editAssetInvoiceId, setEditAssetInvoiceId] = useState('');
  const [allocateEmployee, setAllocateEmployee] = useState('Alice Johnson');
  const [transferTargetType, setTransferTargetType] = useState('employee');
  const [transferEmployee, setTransferEmployee] = useState('Alice Johnson');
  const [newUserRole, setNewUserRole] = useState('Employee');

  const [isApiConnected, setIsApiConnected] = useState(false);

  // Initialize live data from PostgreSQL if connected
  useEffect(() => {
    const initApiData = async () => {
      try {
        const connected = await api.checkConnection();
        if (connected) {
          console.log('[AssetFlow] Connected to PostgreSQL API backend. Loading live data...');
          const [dbAssets, dbAmcs, dbInvoices, dbDocuments, dbMovements, dbLogs, dbNotifications, dbEmails, dbUsers] = await Promise.all([
            api.getAssets(),
            api.getAmcs(),
            api.getInvoices(),
            api.getDocuments(),
            api.getMovements(),
            api.getLogs(),
            api.getNotifications(),
            api.getEmails(),
            api.getUsers()
          ]);

          const assetsList = dbAssets || [];
          if (assetsList.length > 0) setAssets(assetsList);

          if (dbAmcs && dbAmcs.length > 0) {
            const mappedAmcs = dbAmcs.map(amc => ({
              ...amc,
              mappedAssets: assetsList.filter(a => a.amcId === amc.id).map(a => a.id),
              serviceHistory: amc.serviceHistory || []
            }));
            setAmcs(mappedAmcs);
          }

          if (dbInvoices && dbInvoices.length > 0) {
            const mappedInvoices = dbInvoices.map(inv => ({
              ...inv,
              mappedAssets: assetsList.filter(a => a.invoiceId === inv.id).map(a => a.id)
            }));
            setInvoices(mappedInvoices);
          }
          if (dbDocuments && dbDocuments.length > 0) setDocuments(dbDocuments);
          if (dbMovements && dbMovements.length > 0) setMovements(dbMovements);
          if (dbLogs && dbLogs.length > 0) setLogs(dbLogs);
          if (dbNotifications && dbNotifications.length > 0) setNotifications(dbNotifications);
          if (dbEmails && dbEmails.length > 0) setEmails(dbEmails);
          if (dbUsers && dbUsers.length > 0) setUsersList(dbUsers);

          setIsApiConnected(true);
        } else {
          console.log('[AssetFlow] API backend offline. Using LocalStorage fallback.');
        }
      } catch (err) {
        console.warn('[AssetFlow] PostgreSQL backend connection error. Reverting to LocalStorage.', err);
      }
    };
    initApiData();
  }, []);

  // Modals & UI States
  const [showNotifications, setShowNotifications] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals Data States
  const [assetDetailModal, setAssetDetailModal] = useState(null);
  const [qrStickerModal, setQrStickerModal] = useState(null);
  const [addAssetModal, setAddAssetModal] = useState(false);
  const [editAssetModal, setEditAssetModal] = useState(null);
  const [allocateModal, setAllocateModal] = useState(null);
  const [transferModal, setTransferModal] = useState(null);
  const [returnModal, setReturnModal] = useState(null);

  // Sync controlled editAssetInvoiceId state when Edit Asset Modal opens
  useEffect(() => {
    if (editAssetModal) {
      setEditAssetInvoiceId(editAssetModal.invoiceId || '');
    }
  }, [editAssetModal]);
  
  // Scanners / Filters
  const [scannerSelectedAssetId, setScannerSelectedAssetId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isWebcamScanning, setIsWebcamScanning] = useState(false);

  useEffect(() => {
    let scanner = null;
    if (isWebcamScanning) {
      setTimeout(() => {
        const element = document.getElementById("reader");
        if (element) {
          scanner = new Html5QrcodeScanner("reader", {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          }, false);

          scanner.render((decodedText) => {
            setIsWebcamScanning(false);
            scanner.clear().catch(err => console.error("Failed to clear scanner:", err));
            
            const assetId = decodedText.trim();
            const asset = assets.find(a => a.id === assetId || assetId.includes(a.id));
            if (asset) {
              setAssetDetailModal(asset);
              addToast("QR Code Scanned", `Asset lookup found: ${asset.id}`, "success");
            } else {
              addToast("Not Found", `No asset matches: "${assetId}"`, "error");
            }
          }, () => {
            // Frame scan failure - ignore
          });
        }
      }, 300);
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(err => console.log("Failed to clear scanner on unmount:", err));
      }
    };
  }, [isWebcamScanning, assets]);
  const [assetFilterCategory, setAssetFilterCategory] = useState('All');
  const [assetFilterStatus, setAssetFilterStatus] = useState('All');
  const [assetFilterDept, setAssetFilterDept] = useState('All');

  // Report State
  const [reportType, setReportType] = useState('inventory');
  const [generatedReport, setGeneratedReport] = useState([]);

  // Save States to Local Storage on Change
  useEffect(() => {
    localStorage.setItem('db_assets', JSON.stringify(assets));
  }, [assets]);
  useEffect(() => {
    localStorage.setItem('db_amcs', JSON.stringify(amcs));
  }, [amcs]);
  useEffect(() => {
    localStorage.setItem('db_invoices', JSON.stringify(invoices));
  }, [invoices]);
  useEffect(() => {
    localStorage.setItem('db_documents', JSON.stringify(documents));
  }, [documents]);
  useEffect(() => {
    localStorage.setItem('db_movements', JSON.stringify(movements));
  }, [movements]);
  useEffect(() => {
    localStorage.setItem('db_logs', JSON.stringify(logs));
  }, [logs]);
  useEffect(() => {
    localStorage.setItem('db_notifications', JSON.stringify(notifications));
  }, [notifications]);
  useEffect(() => {
    localStorage.setItem('db_emails', JSON.stringify(emails));
  }, [emails]);
  useEffect(() => {
    localStorage.setItem('db_users', JSON.stringify(usersList));
  }, [usersList]);
  useEffect(() => {
    localStorage.setItem('db_role_permissions', JSON.stringify(rolePermissions));
  }, [rolePermissions]);

  // Apply Theme class to Body
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-theme');
    } else {
      root.classList.remove('light-theme');
    }
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  // Handle hash change routing & route protection
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '');
      const validTabs = ['dashboard', 'assets', 'allocations', 'amc', 'finance', 'documents', 'qr_lookup', 'reports', 'emails', 'users'];
      
      const session = mockAuthService.getCurrentSession();
      if (!session) {
        if (window.location.hash !== '#/login') {
          window.location.hash = '#/login';
        }
        setActiveTab('login');
      } else {
        if (hash === 'login' || !hash) {
          window.location.hash = '#/dashboard';
          setActiveTab('dashboard');
        } else if (validTabs.includes(hash)) {
          setActiveTab(hash);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentUser]);

  // Synchronize role state with currentUser session details
  useEffect(() => {
    if (currentUser) {
      setCurrentRole(currentUser.role);
    }
  }, [currentUser]);

  // Handle Logout
  const handleLogout = () => {
    mockAuthService.logout();
    setCurrentUser(null);
    setCurrentRole('Super Admin');
    window.location.hash = '#/login';
    setActiveTab('login');
    addToast("Logged Out", "You have successfully signed out.", "info");
  };

  const navigate = (tab) => {
    window.location.hash = `#/${tab}`;
  };

  // Toast triggers helper
  const addToast = (title, message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Add Log Entry helper
  const addAuditLog = async (action, detail) => {
    const newLog = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toLocaleString([], { hour: '2-digit', minute: '2-digit', hour12: true }) + " " + new Date().toLocaleDateString(),
      actor: currentRole,
      action,
      detail
    };
    setLogs(prev => [newLog, ...prev]);
    if (isApiConnected) {
      try {
        await api.createLog(newLog);
      } catch (err) {
        console.error("Failed to save audit log to DB:", err);
      }
    }
  };

  // Role Permissions Helper — reads from the live `rolePermissions` config
  const hasPermission = (action, assetCategory = null) => {
    // Super Admin always has full access
    if (currentRole === 'Super Admin') return true;

    const perms = rolePermissions[currentRole];
    if (!perms) return false;

    // Category scoping still applies for IT Admin and Facility Admin
    if (currentRole === 'IT Admin' && assetCategory && assetCategory !== 'IT') return false;
    if (currentRole === 'Facility Admin' && assetCategory && assetCategory !== 'Office') return false;

    // Direct lookup from the permission matrix
    if (action in perms) return !!perms[action];

    return false;
  };

  // Auto notification triggers (Warranties / AMC expirations etc.) on mount
  useEffect(() => {
    const today = new Date();
    // Scan warranties expiring soon (within 90 days)
    assets.forEach(asset => {
      const expDate = new Date(asset.warrantyExpiry);
      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0 && diffDays < 90) {
        // Trigger notification check if already exists
        const exists = notifications.some(n => n.text.includes(asset.id) && n.text.includes('Warranty'));
        if (!exists) {
          const text = `Warranty expiring in ${diffDays} days for Asset ${asset.id} (${asset.name})`;
          setNotifications(prev => [
            { id: `NTF-${Date.now()}`, text, type: "warning", time: "Today", read: false },
            ...prev
          ]);
        }
      }
    });

    // Scan AMC contract expirations (within 30 days)
    amcs.forEach(amc => {
      const expDate = new Date(amc.endDate);
      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0 && diffDays < 30) {
        const exists = notifications.some(n => n.text.includes(amc.id) && n.text.includes('AMC'));
        if (!exists) {
          const text = `AMC Contract ${amc.id} with ${amc.vendor} expires in ${diffDays} days!`;
          setNotifications(prev => [
            { id: `NTF-${Date.now() + 1}`, text, type: "error", time: "Today", read: false },
            ...prev
          ]);
        }
      }
    });
  }, [assets, amcs]);

  // Handle asset addition
  const handleAddAsset = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const category = data.get('category');
    
    if (!hasPermission('write', category)) {
      addToast("Access Denied", `Your role (${currentRole}) is not permitted to register ${category} assets.`, "error");
      return;
    }

    const cost = parseFloat(data.get('cost') || 0);
    const newAsset = {
      id: data.get('id') || `AST-${String(assets.length + 1).padStart(3, '0')}`,
      name: data.get('name'),
      serialNumber: data.get('serialNumber'),
      category,
      type: data.get('type'),
      status: "Available",
      cost,
      purchaseDate: data.get('purchaseDate') || new Date().toISOString().split('T')[0],
      warrantyExpiry: data.get('warrantyExpiry'),
      department: data.get('department'),
      location: data.get('location'),
      amcId: "",
      invoiceId: data.get('invoiceId') || "",
      assignedEmployee: "",
      depreciationLifeYears: parseInt(data.get('depreciationLifeYears') || 5),
      disposalDate: "",
      disposalReason: "",
      notes: data.get('notes')
    };

    if (isApiConnected) {
      try {
        await api.createAsset(newAsset);
      } catch {
        addToast("Database Error", "Failed to save asset to PostgreSQL.", "error");
        return;
      }
    }

    // Update list
    setAssets(prev => [newAsset, ...prev]);
    // Log movement
    const newMvt = {
      id: `MVT-${Date.now()}`,
      assetId: newAsset.id,
      date: newAsset.purchaseDate,
      type: "Procurement",
      from: "Vendor",
      to: `Inventory (${newAsset.location})`,
      actor: currentRole,
      notes: `Asset registered. ${newAsset.notes}`
    };
    setMovements(prev => [newMvt, ...prev]);
    if (isApiConnected) {
      try {
        await api.createMovement(newMvt);
      } catch (err) {
        console.error("Failed to log movement to database:", err);
      }
    }
    await addAuditLog("Asset Registration", `Registered asset ${newAsset.id} (${newAsset.name})`);
    addToast("Asset Registered", `${newAsset.id} added successfully to inventory.`, "success");
    setAddAssetModal(false);
    setAddAssetCategory('IT');
    setAddAssetInvoiceId('');
  };

  // Handle asset edit
  const handleEditAsset = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const id = editAssetModal.id;
    const category = editAssetModal.category;

    if (!hasPermission('write', category)) {
      addToast("Access Denied", `Your role (${currentRole}) is not permitted to edit ${category} assets.`, "error");
      return;
    }

    const updatedFields = {
      name: data.get('name'),
      serialNumber: data.get('serialNumber'),
      type: data.get('type'),
      cost: parseFloat(data.get('cost') || 0),
      purchaseDate: data.get('purchaseDate'),
      warrantyExpiry: data.get('warrantyExpiry'),
      location: data.get('location'),
      department: data.get('department'),
      invoiceId: data.get('invoiceId'),
      depreciationLifeYears: parseInt(data.get('depreciationLifeYears') || 5),
      notes: data.get('notes')
    };

    if (isApiConnected) {
      try {
        await api.updateAsset(id, updatedFields);
      } catch {
        addToast("Database Error", "Failed to update asset in PostgreSQL.", "error");
        return;
      }
    }

    setAssets(prev => prev.map(asset => {
      if (asset.id === id) {
        return {
          ...asset,
          ...updatedFields
        };
      }
      return asset;
    }));

    await addAuditLog("Asset Edit", `Updated asset details for ${id}`);
    addToast("Asset Updated", `Asset ${id} details updated.`, "success");
    setEditAssetModal(null);
  };

  // Handle asset deletion
  const handleDeleteAsset = async (asset) => {
    if (!hasPermission('delete', asset.category)) {
      addToast("Access Denied", `Your role (${currentRole}) is not permitted to delete ${asset.category} assets.`, "error");
      return;
    }

    if (window.confirm(`Are you sure you want to delete asset ${asset.id} (${asset.name}) permanently?`)) {
      if (isApiConnected) {
        try {
          await api.deleteAsset(asset.id);
        } catch {
          addToast("Database Error", "Failed to delete asset from PostgreSQL.", "error");
          return;
        }
      }
      setAssets(prev => prev.filter(a => a.id !== asset.id));
      await addAuditLog("Asset Deletion", `Deleted asset ${asset.id}`);
      addToast("Asset Deleted", `Asset ${asset.id} removed from system.`, "success");
      
      // Close detail view if open
      if (assetDetailModal && assetDetailModal.id === asset.id) {
        setAssetDetailModal(null);
      }
    }
  };

  // Handle asset allocation
  const handleAllocate = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const assetId = allocateModal.id;
    const employee = data.get('employee');
    const dept = data.get('department');
    const date = data.get('date') || new Date().toISOString().split('T')[0];
    const notes = data.get('notes');

    if (!hasPermission('allocate', allocateModal.category)) {
      addToast("Access Denied", `Your role (${currentRole}) is not permitted to allocate ${allocateModal.category} assets.`, "error");
      return;
    }

    if (isApiConnected) {
      try {
        await api.updateAsset(assetId, { status: "Assigned", assignedEmployee: employee, department: dept });
      } catch {
        addToast("Database Error", "Failed to allocate asset in PostgreSQL.", "error");
        return;
      }
    }

    setAssets(prev => prev.map(a => {
      if (a.id === assetId) {
        return { ...a, status: "Assigned", assignedEmployee: employee, department: dept };
      }
      return a;
    }));

    const newMvt = {
      id: `MVT-${Date.now()}`,
      assetId,
      date,
      type: "Allocation",
      from: "Inventory",
      to: `${employee} (${dept})`,
      actor: currentRole,
      notes
    };
    setMovements(prev => [newMvt, ...prev]);
    if (isApiConnected) {
      try {
        await api.createMovement(newMvt);
      } catch (err) {
        console.error("Failed to save movement to DB:", err);
      }
    }

    await addAuditLog("Asset Allocation", `Assigned ${assetId} to ${employee}`);
    addToast("Asset Allocated", `Asset ${assetId} assigned to ${employee}.`, "success");
    setAllocateModal(null);
  };

  // Handle asset transfer
  const handleTransfer = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const assetId = transferModal.id;
    const target = data.get('targetType'); // employee or department
    const newEmployee = data.get('employee');
    const newDept = data.get('department');
    const newLocation = data.get('location');
    const date = data.get('date') || new Date().toISOString().split('T')[0];
    const notes = data.get('notes');

    if (!hasPermission('allocate', transferModal.category)) {
      addToast("Access Denied", `Your role (${currentRole}) is not permitted to transfer ${transferModal.category} assets.`, "error");
      return;
    }

    let prevEmployee = transferModal.assignedEmployee;
    let prevDept = transferModal.department;
    let prevLoc = transferModal.location;

    const updatedFields = {
      assignedEmployee: target === 'employee' ? newEmployee : '',
      department: newDept,
      location: newLocation,
      status: target === 'employee' ? 'Assigned' : 'Available'
    };

    if (isApiConnected) {
      try {
        await api.updateAsset(assetId, updatedFields);
      } catch {
        addToast("Database Error", "Failed to transfer asset in PostgreSQL.", "error");
        return;
      }
    }

    setAssets(prev => prev.map(a => {
      if (a.id === assetId) {
        return {
          ...a,
          ...updatedFields
        };
      }
      return a;
    }));

    const destination = target === 'employee' ? `${newEmployee} (${newDept})` : `Dept: ${newDept} (${newLocation})`;
    const source = prevEmployee ? `${prevEmployee} (${prevDept})` : `Dept: ${prevDept} (${prevLoc})`;

    const newMvt = {
      id: `MVT-${Date.now()}`,
      assetId,
      date,
      type: "Transfer",
      from: source,
      to: destination,
      actor: currentRole,
      notes
    };
    setMovements(prev => [newMvt, ...prev]);
    if (isApiConnected) {
      try {
        await api.createMovement(newMvt);
      } catch (err) {
        console.error("Failed to save movement to DB:", err);
      }
    }

    await addAuditLog("Asset Transfer", `Transferred ${assetId} from ${source} to ${destination}`);
    addToast("Asset Transferred", `Asset ${assetId} moved successfully.`, "success");
    setTransferModal(null);
    setTransferTargetType('employee');
    setTransferEmployee('Alice Johnson');
  };

  // Handle return
  const handleReturn = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const assetId = returnModal.id;
    const location = data.get('location');
    const date = data.get('date') || new Date().toISOString().split('T')[0];
    const notes = data.get('notes');

    if (!hasPermission('allocate', returnModal.category)) {
      addToast("Access Denied", `Your role (${currentRole}) is not permitted to handle asset returns.`, "error");
      return;
    }

    const prevEmployee = returnModal.assignedEmployee;
    const prevDept = returnModal.department;

    if (isApiConnected) {
      try {
        await api.updateAsset(assetId, { status: "Available", assignedEmployee: '', location });
      } catch {
        addToast("Database Error", "Failed to process asset return in PostgreSQL.", "error");
        return;
      }
    }

    setAssets(prev => prev.map(a => {
      if (a.id === assetId) {
        return { ...a, status: "Available", assignedEmployee: '', location };
      }
      return a;
    }));

    const newMvt = {
      id: `MVT-${Date.now()}`,
      assetId,
      date,
      type: "Return",
      from: `${prevEmployee} (${prevDept})`,
      to: `Inventory (${location})`,
      actor: currentRole,
      notes
    };
    setMovements(prev => [newMvt, ...prev]);
    if (isApiConnected) {
      try {
        await api.createMovement(newMvt);
      } catch (err) {
        console.error("Failed to save movement to DB:", err);
      }
    }

    await addAuditLog("Asset Return", `Returned ${assetId} to inventory at ${location}`);
    addToast("Asset Returned", `Asset ${assetId} returned to inventory.`, "success");
    setReturnModal(null);
  };

  // Handle disposal
  const handleDisposeAsset = async (asset, reason) => {
    if (!hasPermission('write', asset.category)) {
      addToast("Access Denied", `Your role (${currentRole}) is not permitted to dispose assets.`, "error");
      return;
    }

    const date = new Date().toISOString().split('T')[0];

    if (isApiConnected) {
      try {
        await api.updateAsset(asset.id, {
          status: "Disposed",
          assignedEmployee: '',
          disposalDate: date,
          disposalReason: reason
        });
      } catch {
        addToast("Database Error", "Failed to dispose asset in PostgreSQL.", "error");
        return;
      }
    }

    setAssets(prev => prev.map(a => {
      if (a.id === asset.id) {
        return {
          ...a,
          status: "Disposed",
          assignedEmployee: '',
          disposalDate: date,
          disposalReason: reason
        };
      }
      return a;
    }));

    const newMvt = {
      id: `MVT-${Date.now()}`,
      assetId: asset.id,
      date,
      type: "Disposal",
      from: asset.assignedEmployee ? `${asset.assignedEmployee} (${asset.department})` : "Inventory",
      to: `Disposed (${reason})`,
      actor: currentRole,
      notes: `Retired: ${reason}`
    };
    setMovements(prev => [newMvt, ...prev]);
    if (isApiConnected) {
      try {
        await api.createMovement(newMvt);
      } catch (err) {
        console.error("Failed to save movement to DB:", err);
      }
    }

    await addAuditLog("Asset Disposal", `Retired asset ${asset.id} due to: ${reason}`);
    addToast("Asset Retired", `Asset ${asset.id} marked as Disposed.`, "success");
  };

  // Manage Invoice status
  const handleInvoicePaymentStatus = async (id, newStatus) => {
    if (!hasPermission('finance')) {
      addToast("Access Denied", "Only the Finance Team or Super Admins can process payments.", "error");
      return;
    }

    if (isApiConnected) {
      try {
        await api.updateInvoice(id, { paymentStatus: newStatus });
      } catch {
        addToast("Database Error", "Failed to update payment status in PostgreSQL.", "error");
        return;
      }
    }

    setInvoices(prev => prev.map(inv => {
      if (inv.id === id) {
        return { ...inv, paymentStatus: newStatus };
      }
      return inv;
    }));

    await addAuditLog("Payment Processing", `Updated invoice ${id} payment status to ${newStatus}`);
    addToast("Payment Updated", `Invoice ${id} marked as ${newStatus}.`, "success");
  };

  // Register AMC Contract
  const handleAddAMC = async (e) => {
    e.preventDefault();
    if (!hasPermission('finance')) {
      addToast("Access Denied", "Only Finance Team or Super Admins can register AMCs.", "error");
      return;
    }

    const data = new FormData(e.target);
    const cost = parseFloat(data.get('cost') || 0);
    const fileInput = e.target.agreementFile;
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    let agreementFile = "agreement.pdf";

    if (file && isApiConnected) {
      try {
        const uploadResult = await api.uploadFile(file);
        agreementFile = uploadResult.fileUrl;
      } catch {
        addToast("Upload Error", "Failed to upload contract agreement scan.", "error");
        return;
      }
    } else if (file) {
      agreementFile = file.name;
    }

    const newAmc = {
      id: `AMC-${String(amcs.length + 101).padStart(3, '0')}`,
      vendor: data.get('vendor'),
      cost,
      startDate: data.get('startDate'),
      endDate: data.get('endDate'),
      mappedAssets: [],
      serviceSchedule: data.get('serviceSchedule'),
      agreementFile,
      serviceHistory: []
    };

    if (isApiConnected) {
      try {
        await api.createAmc(newAmc);
      } catch {
        addToast("Database Error", "Failed to save AMC contract to PostgreSQL.", "error");
        return;
      }
    }

    setAmcs(prev => [newAmc, ...prev]);
    await addAuditLog("AMC Registration", `Registered AMC contract ${newAmc.id} with ${newAmc.vendor}`);
    addToast("AMC Registered", `Contract ${newAmc.id} created successfully.`, "success");
    e.target.reset();
    setNewAmcServiceSchedule('Monthly');
  };

  // Link Asset to AMC
  const handleMapAssetToAmc = async (amcId, assetId) => {
    if (!hasPermission('finance')) return;
    
    // Check if asset exists
    const asset = assets.find(a => a.id === assetId);
    if (!asset) {
      addToast("Invalid Asset", `Asset ${assetId} not found.`, "error");
      return;
    }

    if (isApiConnected) {
      try {
        await api.updateAsset(assetId, { amcId });
      } catch {
        addToast("Database Error", "Failed to map asset to AMC in PostgreSQL.", "error");
        return;
      }
    }

    setAmcs(prev => prev.map(amc => {
      if (amc.id === amcId) {
        if (amc.mappedAssets.includes(assetId)) return amc;
        return { ...amc, mappedAssets: [...amc.mappedAssets, assetId] };
      }
      return amc;
    }));

    setAssets(prev => prev.map(a => {
      if (a.id === assetId) {
        return { ...a, amcId };
      }
      return a;
    }));

    await addAuditLog("AMC Asset Mapping", `Mapped asset ${assetId} to AMC Contract ${amcId}`);
    addToast("Asset Mapped", `${assetId} linked to ${amcId}.`, "success");
  };

  // Register Invoice
  const handleAddInvoice = async (e) => {
    e.preventDefault();
    if (!hasPermission('finance')) {
      addToast("Access Denied", "Only Finance Team or Super Admins can upload invoices.", "error");
      return;
    }

    const data = new FormData(e.target);
    const amount = parseFloat(data.get('amount') || 0);
    const gst = parseFloat(data.get('gst') || 0);
    const fileInput = e.target.fileName;
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    let fileName = "invoice.pdf";
    let fileSize = "240 KB";
    let fileUrl = "";

    if (file && isApiConnected) {
      try {
        const uploadResult = await api.uploadFile(file);
        fileName = uploadResult.name;
        fileSize = uploadResult.fileSize;
        fileUrl = uploadResult.fileUrl;
      } catch {
        addToast("Upload Error", "Failed to upload file attachment.", "error");
        return;
      }
    } else if (file) {
      fileName = file.name;
      fileSize = `${(file.size / 1024).toFixed(1)} KB`;
    }

    const newInv = {
      id: `INV-${String(invoices.length + 101).padStart(3, '0')}`,
      poReference: data.get('poReference'),
      vendor: data.get('vendor'),
      amount,
      gst,
      date: data.get('date') || new Date().toISOString().split('T')[0],
      paymentStatus: "Pending",
      mappedAssets: [],
      fileName
    };

    const newDoc = {
      id: `DOC-${String(documents.length + 1).padStart(3, '0')}`,
      name: fileName,
      type: "Invoice",
      size: fileSize,
      uploadDate: newInv.date,
      association: `Invoice ${newInv.id}`,
      fileUrl
    };

    if (isApiConnected) {
      try {
        await api.createInvoice(newInv);
        await api.createDocument(newDoc);
      } catch {
        addToast("Database Error", "Failed to save invoice/document to PostgreSQL.", "error");
        return;
      }
    }

    setInvoices(prev => [newInv, ...prev]);
    setDocuments(prev => [newDoc, ...prev]);

    await addAuditLog("Invoice Registration", `Uploaded invoice ${newInv.id} from ${newInv.vendor}`);
    addToast("Invoice Registered", `Invoice ${newInv.id} uploaded. Mapped under Documents.`, "success");
    e.target.reset();
  };

  // Upload Document
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const fileInput = e.target.file;
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    let fileName = data.get('name') || "document.pdf";
    let fileSize = "1.5 MB";
    let fileUrl = "";

    if (file && isApiConnected) {
      try {
        const uploadResult = await api.uploadFile(file);
        if (!fileName) fileName = uploadResult.name;
        fileSize = uploadResult.fileSize;
        fileUrl = uploadResult.fileUrl;
      } catch {
        addToast("Upload Error", "Failed to upload file to backend.", "error");
        return;
      }
    } else if (file) {
      if (!fileName) fileName = file.name;
      fileSize = `${(file.size / 1024).toFixed(1)} KB`;
    }

    const newDoc = {
      id: `DOC-${String(documents.length + 1).padStart(3, '0')}`,
      name: fileName,
      type: data.get('type'),
      size: fileSize,
      uploadDate: new Date().toISOString().split('T')[0],
      association: data.get('association') || "General",
      fileUrl
    };

    if (isApiConnected) {
      try {
        await api.createDocument(newDoc);
      } catch {
        addToast("Database Error", "Failed to save document to PostgreSQL.", "error");
        return;
      }
    }

    setDocuments(prev => [newDoc, ...prev]);
    await addAuditLog("Document Upload", `Uploaded document ${newDoc.name} (${newDoc.type})`);
    addToast("Document Uploaded", `${newDoc.name} stored in repository.`, "success");
    e.target.reset();
    setNewDocCategory('Invoice');
  };

  // Add AMC service history
  const handleAddAMCServiceRecord = async (e, amcId) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const date = data.get('date');
    const type = data.get('type');
    const notes = data.get('notes');

    const amc = amcs.find(a => a.id === amcId);
    if (!amc) return;

    const updatedServiceHistory = [
      { date, type, notes },
      ...(amc.serviceHistory || [])
    ];

    if (isApiConnected) {
      try {
        await api.updateAmc(amcId, { serviceHistory: updatedServiceHistory });
      } catch {
        addToast("Database Error", "Failed to save service record in PostgreSQL.", "error");
        return;
      }
    }

    setAmcs(prev => prev.map(amc => {
      if (amc.id === amcId) {
        return {
          ...amc,
          serviceHistory: updatedServiceHistory
        };
      }
      return amc;
    }));

    await addAuditLog("AMC Maintenance", `Logged service record for contract ${amcId}`);
    addToast("Service Logged", "Maintenance service details saved.", "success");
    e.target.reset();
  };

  // Generate Reports
  const generateReportData = () => {
    if (reportType === 'inventory') {
      setGeneratedReport(assets);
    } else if (reportType === 'allocation') {
      setGeneratedReport(assets.filter(a => a.status === 'Assigned'));
    } else if (reportType === 'amc') {
      setGeneratedReport(amcs);
    } else if (reportType === 'invoices') {
      setGeneratedReport(invoices);
    } else if (reportType === 'disposal') {
      setGeneratedReport(assets.filter(a => a.status === 'Disposed'));
    } else if (reportType === 'movement') {
      setGeneratedReport(movements);
    }
  };

  useEffect(() => {
    generateReportData();
  }, [reportType, assets, amcs, invoices, movements]);

  // Export report to CSV helper
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (generatedReport.length === 0) return;

    // Build headers from object keys
    const headers = Object.keys(generatedReport[0]);
    csvContent += headers.join(",") + "\n";

    generatedReport.forEach(row => {
      const values = headers.map(header => {
        let val = row[header];
        if (typeof val === 'object' && val !== null) {
          val = JSON.stringify(val).replace(/"/g, '""');
        } else if (typeof val === 'string') {
          val = val.replace(/"/g, '""');
        }
        return `"${val}"`;
      });
      csvContent += values.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("Report Exported", "Downloaded CSV report sheet.", "success");
  };

  // Export report to PDF helper
  const handleExportPDF = () => {
    if (generatedReport.length === 0) {
      addToast("Export Empty", "No data to export.", "warning");
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(`AssetFlow Compliance Report - ${reportType.toUpperCase()}`, 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

    const headers = Object.keys(generatedReport[0]).filter(k => k !== 'serviceHistory' && k !== 'mappedAssets');
    let startY = 38;
    let startX = 14;
    const colWidth = Math.floor(270 / headers.length);

    doc.setFont("helvetica", "bold");
    headers.forEach((h, i) => {
      const cleanHeader = h.replace(/([A-Z])/g, ' $1').toUpperCase();
      doc.text(cleanHeader, startX + (i * colWidth), startY);
    });

    doc.line(14, startY + 2, 280, startY + 2);

    doc.setFont("helvetica", "normal");
    let currentY = startY + 8;

    generatedReport.forEach((row) => {
      if (currentY > 190) {
        doc.addPage();
        currentY = 20;
        doc.setFont("helvetica", "bold");
        headers.forEach((h, i) => {
          doc.text(h.toUpperCase(), startX + (i * colWidth), currentY);
        });
        doc.line(14, currentY + 2, 280, currentY + 2);
        doc.setFont("helvetica", "normal");
        currentY += 8;
      }

      headers.forEach((h, colIndex) => {
        let val = row[h];
        if (typeof val === 'object' && val !== null) {
          val = JSON.stringify(val);
        }
        const textVal = String(val === undefined || val === null ? '' : val);
        const truncated = textVal.length > 20 ? textVal.substring(0, 18) + '..' : textVal;
        doc.text(truncated, startX + (colIndex * colWidth), currentY);
      });

      currentY += 7;
    });

    doc.save(`${reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`);
    addToast("Report Exported", "Downloaded PDF document report.", "success");
  };

  // Export report to Excel helper
  const handleExportExcel = () => {
    if (generatedReport.length === 0) {
      addToast("Export Empty", "No data to export.", "warning");
      return;
    }

    const cleanData = generatedReport.map(item => {
      const cleanItem = {};
      Object.keys(item).forEach(key => {
        const readableKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        let val = item[key];
        if (typeof val === 'object' && val !== null) {
          val = JSON.stringify(val);
        }
        cleanItem[readableKey] = val;
      });
      return cleanItem;
    });

    const worksheet = XLSX.utils.json_to_sheet(cleanData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report Data");

    const maxCols = cleanData.reduce((acc, row) => {
      Object.keys(row).forEach((key, i) => {
        const cellLength = Math.max(String(row[key] || '').length, key.length);
        acc[i] = Math.max(acc[i] || 0, cellLength);
      });
      return acc;
    }, []);
    worksheet['!cols'] = maxCols.map(w => ({ wch: w + 2 }));

    XLSX.writeFile(workbook, `${reportType}_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    addToast("Report Exported", "Downloaded Excel spreadsheet (.xlsx).", "success");
  };

  // Simulate Scan code reader
  const handleSimulateScan = (assetId) => {
    if (!assetId) return;
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      const asset = assets.find(a => a.id === assetId);
      if (asset) {
        setAssetDetailModal(asset);
        addToast("QR Code Scanned", `Asset lookup found: ${asset.id}`, "success");
      } else {
        addToast("Scan Failed", "Asset code not matching system database.", "error");
      }
    }, 1500);
  };

  // Filter Assets selector logic
  const filteredAssets = assets.filter(asset => {
    // Role level check: Employees only see their own assigned assets
    if (currentRole === 'Employee' && asset.assignedEmployee !== 'Alice Johnson') {
      return false;
    }

    // Find mapped invoice vendor
    const mappedInvoice = invoices.find(inv => inv.id === asset.invoiceId);
    const invoiceVendor = mappedInvoice ? mappedInvoice.vendor : '';

    // Find mapped AMC vendor
    const mappedAmc = amcs.find(a => a.id === asset.amcId);
    const amcVendor = mappedAmc ? mappedAmc.vendor : '';

    // Search query matches Code, Name, Serial Number, Department, Employee, Location, Invoice, Vendor, Category, Status
    const query = searchQuery.toLowerCase();
    const matchQuery =
      (asset.id || '').toLowerCase().includes(query) ||
      (asset.name || '').toLowerCase().includes(query) ||
      (asset.serialNumber || '').toLowerCase().includes(query) ||
      (asset.department || '').toLowerCase().includes(query) ||
      (asset.assignedEmployee || '').toLowerCase().includes(query) ||
      (asset.location || '').toLowerCase().includes(query) ||
      (asset.invoiceId || '').toLowerCase().includes(query) ||
      (asset.category || '').toLowerCase().includes(query) ||
      (asset.status || '').toLowerCase().includes(query) ||
      invoiceVendor.toLowerCase().includes(query) ||
      amcVendor.toLowerCase().includes(query);

    const matchCategory = assetFilterCategory === 'All' || asset.category === assetFilterCategory;
    const matchStatus = assetFilterStatus === 'All' || asset.status === assetFilterStatus;
    const matchDept = assetFilterDept === 'All' || asset.department === assetFilterDept;

    return matchQuery && matchCategory && matchStatus && matchDept;
  });

  // Derived dashboard stats
  const totalAssetsCount = currentRole === 'Employee' ? assets.filter(a => a.assignedEmployee === 'Alice Johnson').length : assets.length;
  const assignedCount = assets.filter(a => a.status === 'Assigned' && (currentRole !== 'Employee' || a.assignedEmployee === 'Alice Johnson')).length;
  const availableCount = currentRole === 'Employee' ? 0 : assets.filter(a => a.status === 'Available').length;
  const maintenanceCount = currentRole === 'Employee' ? 0 : assets.filter(a => a.status === 'Under Maintenance').length;
  const disposedCount = currentRole === 'Employee' ? 0 : assets.filter(a => a.status === 'Disposed').length;

  const expiringAMCsCount = amcs.filter(amc => {
    const diff = new Date(amc.endDate) - new Date();
    return diff > 0 && diff < (30 * 24 * 60 * 60 * 1000);
  }).length;

  const expiringWarrantiesCount = assets.filter(a => {
    const diff = new Date(a.warrantyExpiry) - new Date();
    return diff > 0 && diff < (90 * 24 * 60 * 60 * 1000);
  }).length;

  const pendingPaymentsCount = invoices.filter(inv => inv.paymentStatus === 'Pending' || inv.paymentStatus === 'Overdue').length;

  // Clear unread notifications
  const handleClearNotifications = async () => {
    if (isApiConnected) {
      try {
        await api.markAllNotificationsRead();
      } catch (err) {
        console.error("Failed to clear notifications in DB:", err);
      }
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    addToast("Notifications Cleared", "All notifications marked read.", "info");
  };

  const selectedEmail = emails.find(e => e.id === selectedEmailId) || emails[0];

  if (activeTab === 'login') {
    return (
      <div className="login-page-wrapper">
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>
              <div className="toast-content">
                <div className="toast-title">{t.title}</div>
                <div className="toast-message">{t.message}</div>
              </div>
              <button className="icon-button" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <LoginView
          onLoginSuccess={(session) => {
            setCurrentUser(session);
            setCurrentRole(session.role);
            window.location.hash = '#/dashboard';
            setActiveTab('dashboard');
            addToast("Welcome back", `Authenticated as ${session.name}.`, "success");
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Toast Alert Drawer */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="toast-content">
              <div className="toast-title">{t.title}</div>
              <div className="toast-message">{t.message}</div>
            </div>
            <button className="icon-button" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Sidebar Menu Drawer */}
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">AF</div>
          <span className="logo-text">AssetFlow</span>
        </div>

        <nav className="nav-links">
          <button onClick={() => navigate('dashboard')} className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
            <LayoutDashboard className="nav-icon" />
            Dashboard
          </button>
          
          <button onClick={() => navigate('assets')} className={`nav-item ${activeTab === 'assets' ? 'active' : ''}`}>
            <Package className="nav-icon" />
            Asset Directory
          </button>

          {currentRole !== 'Employee' && (
            <button onClick={() => navigate('allocations')} className={`nav-item ${activeTab === 'allocations' ? 'active' : ''}`}>
              <UserCheck className="nav-icon" />
              Allocations & Movements
            </button>
          )}

          {currentRole !== 'Employee' && (
            <button onClick={() => navigate('amc')} className={`nav-item ${activeTab === 'amc' ? 'active' : ''}`}>
              <RefreshCw className="nav-icon" />
              AMC Contracts
            </button>
          )}

          {currentRole !== 'Employee' && (
            <button onClick={() => navigate('finance')} className={`nav-item ${activeTab === 'finance' ? 'active' : ''}`}>
              <FileText className="nav-icon" />
              Finance & Invoices
            </button>
          )}

          <button onClick={() => navigate('documents')} className={`nav-item ${activeTab === 'documents' ? 'active' : ''}`}>
            <FolderOpen className="nav-icon" />
            Document Repository
          </button>

          <button onClick={() => navigate('qr_lookup')} className={`nav-item ${activeTab === 'qr_lookup' ? 'active' : ''}`}>
            <QrCode className="nav-icon" />
            QR Stickers & Scan
          </button>

          {currentRole !== 'Employee' && (
            <button onClick={() => navigate('reports')} className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}>
              <ClipboardList className="nav-icon" />
              Reports & Logs
            </button>
          )}

          <button onClick={() => navigate('emails')} className={`nav-item ${activeTab === 'emails' ? 'active' : ''}`}>
            <Mail className="nav-icon" />
            Email Alerts Inbox
          </button>

          {currentRole === 'Super Admin' && (
            <button onClick={() => navigate('users')} className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}>
              <Users className="nav-icon" />
              User Directory
            </button>
          )}
        </nav>

        {/* User profile details bottom element */}
        <div className="user-profile-section">
          <div className="user-profile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div className="avatar">
                {currentUser ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase() : (currentRole === 'Employee' ? 'AJ' : currentRole.substring(0, 2).toUpperCase())}
              </div>
              <div className="user-info" style={{ minWidth: 0 }}>
                <div className="user-name" title={currentUser ? currentUser.name : (currentRole === 'Employee' ? 'Alice Johnson' : 'Admin Operations')}>
                  {currentUser ? currentUser.name : (currentRole === 'Employee' ? 'Alice Johnson' : 'Admin Operations')}
                </div>
                <div className="user-role-badge">{currentRole}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="icon-button logout-btn"
              title="Logout"
              style={{
                padding: '4px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Panel Viewport */}
      <main className="main-content">
        {/* Header toolbar */}
        <header className="top-header">
          <div className="header-left">
            <div className="search-bar-container">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search the register — asset ID, serial, employee, department…"
                className="search-bar"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val && activeTab !== 'assets') {
                    navigate('assets');
                  }
                }}
              />
            </div>
          </div>

          <div className="header-right">
            {/* Dark Light Theme Toggle */}
            <button
              className="icon-button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notification bell */}
            <div style={{ position: 'relative' }}>
              <button className="icon-button" onClick={() => setShowNotifications(!showNotifications)}>
                <Bell size={18} />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="badge-count">{notifications.filter(n => !n.read).length}</span>
                )}
              </button>

              {showNotifications && (
                <div className="notif-popover">
                  <div className="notif-header">
                    <span className="notif-title">System Alerts</span>
                    <button className="notif-clear-btn" onClick={handleClearNotifications}>
                      Mark all read
                    </button>
                  </div>
                  <div className="notif-body">
                    {notifications.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        No new notifications.
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className={`notif-item ${!n.read ? 'unread' : ''}`}>
                          <div className={`notif-dot-active`} style={{ backgroundColor: n.type === 'error' ? 'var(--status-disposed)' : n.type === 'warning' ? 'var(--status-maintenance)' : 'var(--primary)' }}></div>
                          <div className="notif-details">
                            <span className="notif-text">{n.text}</span>
                            <span className="notif-time">{n.time}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Dynamic Pages Area */}
        <div className="page-container">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              {...silk.entrance}
              style={{ width: '100%' }}
            >
          
          {/* ==================== DASHBOARD PANEL ==================== */}
          {activeTab === 'dashboard' && (
            <>
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

                {currentRole !== 'Employee' && (
                  <div className="stat-cell">
                    <span className="stat-label">Warranties Expiring</span>
                    <span className="stat-value">{expiringWarrantiesCount}</span>
                    <span className={`stat-note ${expiringWarrantiesCount > 0 ? 'alert' : ''}`}>Within 90 days</span>
                  </div>
                )}

                {currentRole !== 'Employee' && (
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
                        <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '10px' }} onClick={() => navigate('amc')}>Renew</button>
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
                        <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '10px' }} onClick={() => navigate('finance')}>Settle</button>
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
                            <span className="log-entry-time">{log.timestamp}</span>
                          </div>
                          <span className="log-entry-detail">{log.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ==================== ASSET INVENTORY ==================== */}
          {activeTab === 'assets' && (
            <>
              <div className="page-header">
                <div className="page-title-section">
                  <span className="page-kicker">Asset Register</span>
                  <h1 className="page-title">Organizational Assets</h1>
                  <span className="page-subtitle">Comprehensive lifecycle register and specifications catalog</span>
                </div>
                <div className="page-actions">
                  {hasPermission('write') && (
                    <button className="btn btn-primary" onClick={() => setAddAssetModal(true)}>
                      <Plus size={16} />
                      Register New Asset
                    </button>
                  )}
                </div>
              </div>

              {/* Filters toolbar */}
              <div className="filters-row">
                <div className="filters-left">
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Filter Category:</span>
                  <CustomSelect
                    options={[
                      { value: "All", label: "All Categories" },
                      { value: "IT", label: "IT Assets" },
                      { value: "Office", label: "Office Infrastructure" }
                    ]}
                    value={assetFilterCategory}
                    onChange={(e) => setAssetFilterCategory(e.target.value)}
                    style={{ width: '160px' }}
                  />

                  <span style={{ fontSize: '13px', fontWeight: '600', marginLeft: '12px' }}>Status:</span>
                  <CustomSelect
                    options={[
                      { value: "All", label: "All Statuses" },
                      { value: "Available", label: "Available" },
                      { value: "Assigned", label: "Assigned" },
                      { value: "Under Maintenance", label: "Under Maintenance" },
                      { value: "Disposed", label: "Disposed" }
                    ]}
                    value={assetFilterStatus}
                    onChange={(e) => setAssetFilterStatus(e.target.value)}
                    style={{ width: '160px' }}
                  />

                  <span style={{ fontSize: '13px', fontWeight: '600', marginLeft: '12px' }}>Department:</span>
                  <CustomSelect
                    options={[
                      { value: "All", label: "All Departments" },
                      { value: "Engineering", label: "Engineering" },
                      { value: "HR", label: "HR" },
                      { value: "Sales", label: "Sales" },
                      { value: "Finance", label: "Finance" },
                      { value: "Operations", label: "Operations" },
                      { value: "IT", label: "IT" }
                    ]}
                    value={assetFilterDept}
                    onChange={(e) => setAssetFilterDept(e.target.value)}
                    style={{ width: '170px' }}
                  />
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Showing {filteredAssets.length} of {assets.length} assets
                </div>
              </div>

              {/* Data Table */}
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Asset Code</th>
                      <th>Name / Model</th>
                      <th>Category</th>
                      <th>Serial Number</th>
                      <th>Location / Dept</th>
                      <th>Assigned To</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                          No assets matched the current search/filter parameters.
                        </td>
                      </tr>
                    ) : (
                      filteredAssets.map(asset => (
                        <tr key={asset.id}>
                          <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{asset.id}</td>
                          <td>
                            <div className="asset-meta-cell">
                              <div className="asset-image-placeholder">
                                <Package size={18} />
                              </div>
                              <div className="asset-name-meta">
                                <span style={{ fontWeight: '600' }}>{asset.name}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Type: {asset.type}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge" style={{ backgroundColor: asset.category === 'IT' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(236, 72, 153, 0.15)', color: asset.category === 'IT' ? 'var(--primary)' : 'var(--secondary)' }}>
                              {asset.category}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: '12px' }}>{asset.serialNumber}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{asset.location}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Dept: {asset.department}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: '500' }}>
                            {asset.assignedEmployee ? asset.assignedEmployee : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>}
                          </td>
                          <td>
                            <span className={`badge badge-${asset.status.toLowerCase().replace(' ', '-')}`}>
                              {asset.status}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button className="btn-table-action" onClick={() => setAssetDetailModal(asset)} title="View Specs & Timeline">
                                <Eye size={15} />
                              </button>
                              {hasPermission('write', asset.category) && (
                                <button className="btn-table-action" onClick={() => setEditAssetModal(asset)} title="Edit Specifications">
                                  <Edit2 size={15} />
                                </button>
                              )}
                              {hasPermission('allocate', asset.category) && asset.status === 'Available' && (
                                <button className="btn-table-action" style={{ color: 'var(--status-assigned)' }} onClick={() => setAllocateModal(asset)} title="Allocate Asset">
                                  <UserCheck size={15} />
                                </button>
                              )}
                              {hasPermission('allocate', asset.category) && asset.status === 'Assigned' && (
                                <>
                                  <button className="btn-table-action" style={{ color: 'var(--primary)' }} onClick={() => setTransferModal(asset)} title="Transfer Asset">
                                    <ArrowLeftRight size={15} />
                                  </button>
                                  <button className="btn-table-action" style={{ color: 'var(--status-available)' }} onClick={() => setReturnModal(asset)} title="Record return / deallocate">
                                    <RefreshCw size={15} />
                                  </button>
                                </>
                              )}
                              {hasPermission('write', asset.category) && asset.status !== 'Disposed' && (
                                <button className="btn-table-action" style={{ color: 'var(--status-maintenance)' }} onClick={() => {
                                  const reason = prompt("Enter asset retirement / disposal reason:");
                                  if (reason) handleDisposeAsset(asset, reason);
                                }} title="Mark as Disposed">
                                  <AlertTriangle size={15} />
                                </button>
                              )}
                              <button className="btn-table-action" onClick={() => setQrStickerModal(asset)} title="View QR Label sticker">
                                <QrCode size={15} />
                              </button>
                              {hasPermission('delete', asset.category) && (
                                <button className="btn-table-action delete" onClick={() => handleDeleteAsset(asset)} title="Delete Asset Record">
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ==================== ALLOCATIONS & MOVEMENTS ==================== */}
          {activeTab === 'allocations' && (
            <>
              <div className="page-header">
                <div className="page-title-section">
                  <span className="page-kicker">Custody & Allocations</span>
                  <h1 className="page-title">Fleet Allocation & Movements</h1>
                  <span className="page-subtitle">Track custodian assignments, internal branch relocations, and handovers</span>
                </div>
              </div>

              <div className="dashboard-grid-secondary">
                {/* Allocations Form */}
                <div className="card">
                  <span className="card-title">
                    <ArrowLeftRight size={18} style={{ color: 'var(--primary)' }} />
                    Quick Operations Desk
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                      <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Assign Available Asset</h4>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <CustomSelect
                          options={[
                            { value: "", label: "-- Select Available Asset --" },
                            ...assets.filter(a => a.status === 'Available').map(a => ({
                              value: a.id,
                              label: `${a.id} - ${a.name} (${a.category})`
                            }))
                          ]}
                          value={quickAllocAssetId}
                          onChange={(e) => setQuickAllocAssetId(e.target.value)}
                          style={{ flexGrow: 1 }}
                        />
                        <button className="btn btn-primary" onClick={() => {
                          const asset = assets.find(a => a.id === quickAllocAssetId);
                          if (asset) {
                            setAllocateModal(asset);
                            setQuickAllocAssetId('');
                          } else {
                            addToast("Selection Error", "Please pick an asset from the list", "warning");
                          }
                        }}>
                          Assign
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Custodian Handovers & Moves</h4>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <CustomSelect
                          options={[
                            { value: "", label: "-- Select Assigned Asset --" },
                            ...assets.filter(a => a.status === 'Assigned').map(a => ({
                              value: a.id,
                              label: `${a.id} - ${a.name} (Held by: ${a.assignedEmployee})`
                            }))
                          ]}
                          value={quickTransferAssetId}
                          onChange={(e) => setQuickTransferAssetId(e.target.value)}
                          style={{ flexGrow: 1 }}
                        />
                        <button className="btn btn-primary" onClick={() => {
                          const asset = assets.find(a => a.id === quickTransferAssetId);
                          if (asset) {
                            setTransferModal(asset);
                            setQuickTransferAssetId('');
                          } else {
                            addToast("Selection Error", "Please select an assigned asset", "warning");
                          }
                        }}>
                          Transfer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <span className="card-title">
                    <UserCheck size={18} style={{ color: 'var(--status-available)' }} />
                    Active Fleet Statistics
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span>IT Equipment Assigned:</span>
                      <span style={{ fontWeight: '700' }}>{assets.filter(a => a.category === 'IT' && a.status === 'Assigned').length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span>Office Infrastructure Assigned:</span>
                      <span style={{ fontWeight: '700' }}>{assets.filter(a => a.category === 'Office' && a.status === 'Assigned').length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span>Assets Under Servicing / Repair:</span>
                      <span style={{ fontWeight: '700', color: 'var(--status-maintenance)' }}>{assets.filter(a => a.status === 'Under Maintenance').length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Movements history */}
              <div className="table-container" style={{ marginTop: '16px' }}>
                <div style={{ padding: '16px 20px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Asset Movement & Custody History Ledger</span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Transaction ID</th>
                      <th>Asset Code</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Source Location / Custodian</th>
                      <th>Target Location / Custodian</th>
                      <th>Authorized By</th>
                      <th>Transaction Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map(mvt => (
                      <tr key={mvt.id}>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: '600' }}>{mvt.id}</td>
                        <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{mvt.assetId}</td>
                        <td style={{ fontSize: '12px' }}>{mvt.date}</td>
                        <td>
                          <span className={`badge`} style={{
                            backgroundColor: mvt.type === 'Procurement' ? 'var(--status-available-bg)' : mvt.type === 'Allocation' ? 'var(--status-assigned-bg)' : mvt.type === 'Disposal' ? 'var(--status-disposed-bg)' : 'var(--primary-glow)',
                            color: mvt.type === 'Procurement' ? 'var(--status-available)' : mvt.type === 'Allocation' ? 'var(--status-assigned)' : mvt.type === 'Disposal' ? 'var(--status-disposed)' : 'var(--primary)'
                          }}>
                            {mvt.type}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{mvt.from}</td>
                        <td style={{ fontSize: '12px', fontWeight: '600' }}>{mvt.to}</td>
                        <td style={{ fontSize: '12px' }}>{mvt.actor}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mvt.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ==================== AMC MANAGEMENT ==================== */}
          {activeTab === 'amc' && (
            <>
              <div className="page-header">
                <div className="page-title-section">
                  <span className="page-kicker">Maintenance Agreements</span>
                  <h1 className="page-title">Annual Maintenance Contracts</h1>
                  <span className="page-subtitle">Track vendor support contracts, SLA agreements, and servicing histories</span>
                </div>
              </div>

              <div className="stat-strip" style={{ marginBottom: '24px' }}>
                <div className="stat-cell">
                  <span className="stat-label">Active AMC Contracts</span>
                  <span className="stat-value">{amcs.length}</span>
                  <span className="stat-note">Vendor support contracts</span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">Total AMC Spend</span>
                  <span className="stat-value">${amcs.reduce((acc, curr) => acc + Number(curr.cost || 0), 0).toLocaleString()}</span>
                  <span className="stat-note">Annual cost total</span>
                </div>
                <div className="stat-cell">
                  <span className="stat-label">Service Actions Logged</span>
                  <span className="stat-value">{amcs.reduce((acc, curr) => acc + (curr.serviceHistory || []).length, 0)}</span>
                  <span className="stat-note">Maintenance logs</span>
                </div>
              </div>

              <div className="dashboard-grid-secondary">
                {/* Register contract */}
                <div className="card">
                  <span className="card-title">Register Maintenance Agreement</span>
                  {hasPermission('finance') ? (
                    <form onSubmit={handleAddAMC} className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Support Vendor Partner</label>
                        <input type="text" name="vendor" placeholder="e.g. Carrier CoolCare" className="form-input" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Annual Cost ($)</label>
                        <input type="number" name="cost" placeholder="e.g. 500" className="form-input" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Contract Start Date</label>
                        <input type="date" name="startDate" className="form-input" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Contract End Date</label>
                        <input type="date" name="endDate" className="form-input" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Service Interval Schedule</label>
                        <CustomSelect
                          name="serviceSchedule"
                          options={[
                            { value: "Monthly", label: "Monthly" },
                            { value: "Quarterly", label: "Quarterly" },
                            { value: "Bi-Annual", label: "Bi-Annual" },
                            { value: "Annual", label: "Annual" }
                          ]}
                          value={newAmcServiceSchedule}
                          onChange={(e) => setNewAmcServiceSchedule(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">SLA Agreement Document</label>
                        <input type="file" name="agreementFile" className="form-input" required />
                      </div>
                      <div className="form-group full-width" style={{ marginTop: '8px' }}>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                          Save & Register AMC
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
                      Only Finance Team and Admin roles are authorized to create support contracts.
                    </div>
                  )}
                </div>

                {/* Map asset to contract */}
                <div className="card">
                  <span className="card-title">Map Asset to Contract</span>
                  {hasPermission('finance') ? (
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const amcId = e.target.amcId.value;
                      const assetId = e.target.assetId.value;
                      handleMapAssetToAmc(amcId, assetId);
                    }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label">Select Support Contract</label>
                        <CustomSelect
                          name="amcId"
                          options={amcs.map(amc => ({ value: amc.id, label: `${amc.id} - ${amc.vendor}` }))}
                          value={mapAmcId || amcs[0]?.id || ''}
                          onChange={(e) => setMapAmcId(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Select Asset to Map</label>
                        <CustomSelect
                          name="assetId"
                          options={assets.filter(a => a.status !== 'Disposed').map(a => ({ value: a.id, label: `${a.id} - ${a.name}` }))}
                          value={mapAssetId || assets.filter(a => a.status !== 'Disposed')[0]?.id || ''}
                          onChange={(e) => setMapAssetId(e.target.value)}
                          required
                        />
                      </div>
                      <button type="submit" className="btn btn-secondary" style={{ marginTop: '8px' }}>
                        Link Asset
                      </button>
                    </form>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
                      Only Finance and Admins can bind assets to maintenance agreements.
                    </div>
                  )}
                </div>
              </div>

              {/* AMC Contracts List */}
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {amcs.map(amc => {
                  const isExpiring = (new Date(amc.endDate) - new Date()) < (30 * 24 * 60 * 60 * 1000);
                  return (
                    <div key={amc.id} className="card" style={{ borderLeft: isExpiring ? '4px solid var(--status-disposed)' : '4px solid var(--primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{amc.vendor}</h3>
                            <span className="badge" style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)' }}>{amc.id}</span>
                            {isExpiring && <span className="badge badge-disposed">Expiring Soon</span>}
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Agreement: {amc.agreementFile}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>${amc.cost}/year</div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Interval: {amc.serviceSchedule}</span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                        <div>
                          <span style={{ color: 'var(--text-secondary)' }}>Active Period: </span>
                          <strong>{amc.startDate} to {amc.endDate}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)' }}>Linked Assets: </span>
                          <strong>{(amc.mappedAssets || []).join(', ') || 'No mapped assets'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)' }}>Last Servicing: </span>
                          <strong>{(amc.serviceHistory || []).length > 0 ? amc.serviceHistory[0].date : 'No records'}</strong>
                        </div>
                      </div>

                      {/* Log service record inside contract */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '10px' }}>
                        <div>
                          <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Record Maintenance Visit</h4>
                          <form onSubmit={(e) => handleAddAMCServiceRecord(e, amc.id)} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input type="date" name="date" className="form-input" style={{ padding: '6px 10px', fontSize: '12px' }} required />
                              <input type="text" name="type" placeholder="Service action title" className="form-input" style={{ padding: '6px 10px', fontSize: '12px', flexGrow: 1 }} required />
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input type="text" name="notes" placeholder="Technician diagnosis summary" className="form-input" style={{ padding: '6px 10px', fontSize: '12px', flexGrow: 1 }} required />
                              <button type="submit" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>Save Log</button>
                            </div>
                          </form>
                        </div>

                        <div>
                          <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Maintenance Service Logs</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
                            {amc.serviceHistory.length === 0 ? (
                              <span style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--text-muted)' }}>No service visits logged yet.</span>
                            ) : (
                              amc.serviceHistory.map((history, idx) => (
                                <div key={idx} style={{ fontSize: '11px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                                  <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{history.date}</span> - <strong>{history.type}</strong>
                                  <div style={{ color: 'var(--text-secondary)' }}>{history.notes}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ==================== FINANCE & INVOICES ==================== */}
          {activeTab === 'finance' && (
            <>
              <div className="page-header">
                <div className="page-title-section">
                  <span className="page-kicker">Financial Ledger</span>
                  <h1 className="page-title">Procurement, Invoices & Finance</h1>
                  <span className="page-subtitle">Map equipment purchases, tax calculations, and process vendor settlements</span>
                </div>
              </div>

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
                        <label className="form-label">Base Invoice Cost ($)</label>
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
                        <label className="form-label">PDF Invoice Scan File</label>
                        <input type="file" name="fileName" className="form-input" required />
                      </div>
                      <div className="form-group full-width" style={{ marginTop: '8px' }}>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                          Upload and File Invoice
                        </button>
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
                        ${invoices.reduce((acc, curr) => acc + Number(curr.amount || 0) + (Number(curr.amount || 0) * (Number(curr.gst || 0) / 100)), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span>Pending Settlements:</span>
                      <span style={{ fontWeight: '700', color: 'var(--status-maintenance)' }}>
                        ${invoices.filter(i => i.paymentStatus !== 'Paid').reduce((acc, curr) => acc + Number(curr.amount || 0) + (Number(curr.amount || 0) * (Number(curr.gst || 0) / 100)), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span>Estimated Accrued Taxes (GST):</span>
                      <span style={{ fontWeight: '700', color: 'var(--primary)' }}>
                        ${invoices.reduce((acc, curr) => acc + (Number(curr.amount || 0) * (Number(curr.gst || 0) / 100)), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoices List */}
              <div className="table-container" style={{ marginTop: '16px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
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
                    {invoices.map(inv => {
                      const amountNum = Number(inv.amount || 0);
                      const gstNum = Number(inv.gst || 0);
                      const total = amountNum + (amountNum * (gstNum / 100));
                      return (
                        <tr key={inv.id}>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: '700', color: 'var(--primary)' }}>{inv.id}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{inv.poReference}</td>
                          <td style={{ fontWeight: '600' }}>{inv.vendor}</td>
                          <td style={{ fontSize: '12px' }}>{inv.date}</td>
                          <td>${amountNum.toLocaleString()}</td>
                          <td>{inv.gst}%</td>
                          <td style={{ fontWeight: '700' }}>${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{(inv.mappedAssets || []).join(', ') || 'No mapped assets'}</td>
                          <td>
                            <span className={`badge`} style={{
                              backgroundColor: inv.paymentStatus === 'Paid' ? 'var(--status-available-bg)' : inv.paymentStatus === 'Pending' ? 'var(--status-maintenance-bg)' : inv.paymentStatus === 'Overdue' ? 'var(--status-disposed-bg)' : 'var(--status-assigned-bg)',
                              color: inv.paymentStatus === 'Paid' ? 'var(--status-available)' : inv.paymentStatus === 'Pending' ? 'var(--status-maintenance)' : inv.paymentStatus === 'Overdue' ? 'var(--status-disposed)' : 'var(--status-assigned)'
                            }}>
                              {inv.paymentStatus}
                            </span>
                          </td>
                          <td>
                            {hasPermission('finance') ? (
                              <CustomSelect
                                options={['Pending', 'Partially Paid', 'Paid', 'Overdue']}
                                value={inv.paymentStatus}
                                onChange={(e) => handleInvoicePaymentStatus(inv.id, e.target.value)}
                                style={{ width: '130px' }}
                              />
                            ) : (
                              <span style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--text-muted)' }}>Authorized only</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ==================== DOCUMENT REPOSITORY ==================== */}
          {activeTab === 'documents' && (
            <>
              <div className="page-header">
                <div className="page-title-section">
                  <span className="page-kicker">Document Archive</span>
                  <h1 className="page-title">Digital Document Repository</h1>
                  <span className="page-subtitle">Unified safehouse for invoices, warranty certificates, and SLA documents</span>
                </div>
              </div>

              <div className="dashboard-grid-secondary">
                {/* File Upload component */}
                <div className="card">
                  <span className="card-title">Upload Official Agreement / Scan</span>
                  <form onSubmit={handleUploadDocument} className="form-grid">
                    <div className="form-group">
                      <label className="form-label">File Descriptor Name</label>
                      <input type="text" name="name" placeholder="e.g. Server Warranty Certificate" className="form-input" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Document Category</label>
                      <CustomSelect
                        name="type"
                        options={[
                          { value: "Invoice", label: "Invoice" },
                          { value: "Warranty Certificate", label: "Warranty Certificate" },
                          { value: "AMC Agreement", label: "AMC Agreement" },
                          { value: "Vendor Contract", label: "Vendor Contract" },
                          { value: "Service Report", label: "Service Report" }
                        ]}
                        value={newDocCategory}
                        onChange={(e) => setNewDocCategory(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Attach File Scan</label>
                      <input type="file" name="file" className="form-input" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Map Association Reference</label>
                      <input type="text" name="association" placeholder="e.g. Asset AST-002, AMC AMC-101" className="form-input" required />
                    </div>
                    <div className="form-group full-width" style={{ marginTop: '8px' }}>
                      <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                        <FileUp size={16} />
                        Upload Attachment Scan
                      </button>
                    </div>
                  </form>
                </div>

                <div className="card">
                  <span className="card-title">Repository Vault Statistics</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span>Stored Scan Records:</span>
                      <span style={{ fontWeight: '700' }}>{documents.length} Files</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span>System Storage Capacity:</span>
                      <span style={{ fontWeight: '700', color: 'var(--status-available)' }}>99.9% Available</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Documents Card Grid */}
              <div className="doc-grid" style={{ marginTop: '16px' }}>
                {documents.map(doc => (
                  <div key={doc.id} className="doc-card" onClick={() => {
                    if (doc.fileUrl) {
                      window.open(`http://localhost:5000${doc.fileUrl}`, '_blank');
                      addToast("Opening Document", `Displaying file: ${doc.name}`, "info");
                    } else {
                      alert(`Initiating secure mock download for: ${doc.name}`);
                      addToast("Secure Download", `File ${doc.name} download started.`, "success");
                    }
                  }}>
                    <div className="doc-type-icon">
                      <FileText size={20} />
                    </div>
                    <div className="doc-title-section">
                      <span className="doc-title" title={doc.name}>{doc.name}</span>
                      <span className="doc-meta">{doc.type}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ref: {doc.association}</div>
                    <div className="doc-footer">
                      <span className="doc-size">{doc.size}</span>
                      <span className="doc-action">
                        <Download size={13} style={{ display: 'inline', marginRight: '4px' }} />
                        Download
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ==================== QR STICKERS & SCAN LOOKUP ==================== */}
          {activeTab === 'qr_lookup' && (
            <>
              <div className="page-header">
                <div className="page-title-section">
                  <span className="page-kicker">Asset Identification</span>
                  <h1 className="page-title">QR Security Stickers</h1>
                  <span className="page-subtitle">Print individual barcode tags or scan code labels to trace items</span>
                </div>
              </div>

              <div className="dashboard-grid-secondary">
                {/* QR Scanner */}
                <div className="card">
                  <span className="card-title">Secure Mobile QR Scanner</span>
                  <div className="qr-scanner-box">
                    {isWebcamScanning ? (
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <div id="reader" style={{ width: '100%', maxWidth: '350px', background: 'var(--border)', borderRadius: '8px', overflow: 'hidden' }}></div>
                        <button className="btn btn-secondary" onClick={() => setIsWebcamScanning(false)} style={{ width: '100%' }}>
                          Cancel Camera Scan
                        </button>
                      </div>
                    ) : (
                      <>
                        {isScanning && <div className="scanner-laser"></div>}
                        <QrCode size={64} style={{ color: isScanning ? 'var(--secondary)' : 'var(--primary)' }} />
                        <p style={{ fontSize: '13px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          {isScanning ? "Scanning simulated camera feed..." : "Scan with camera, or select an asset below to test:"}
                        </p>

                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <button className="btn btn-primary" onClick={() => setIsWebcamScanning(true)} style={{ width: '100%', marginBottom: '4px' }}>
                            Activate Webcam Scanner
                          </button>
                          
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <CustomSelect
                              options={[
                                { value: "", label: "-- Choose Asset Tag to Scan --" },
                                ...assets.map(a => ({ value: a.id, label: `${a.id} - ${a.name}` }))
                              ]}
                              value={scannerSelectedAssetId}
                              onChange={(e) => setScannerSelectedAssetId(e.target.value)}
                              disabled={isScanning}
                              style={{ flexGrow: 1 }}
                            />
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleSimulateScan(scannerSelectedAssetId)}
                              disabled={isScanning || !scannerSelectedAssetId}
                            >
                              Simulate Scan
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="card">
                  <span className="card-title">Barcode Specifications</span>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    AssetFlow security tags feature unique QR codes embedded with cryptographic JSON specs for quick asset lookup, and high-contrast CSS barcode arrays for handheld scanner compatibility.
                  </p>
                  <button className="btn btn-secondary" onClick={() => window.print()}>
                    Print Tag Inventory Sheets
                  </button>
                </div>
              </div>

              {/* Printable stickers preview list */}
              <div className="card" style={{ marginTop: '16px' }}>
                <span className="card-title">Tag Sticker Sheet Layout (Printable)</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', padding: '12px' }}>
                  {assets.filter(a => a.status !== 'Disposed').map(asset => (
                    <QRCodeSticker key={asset.id} asset={asset} />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ==================== REPORTS & AUDIT TRAIL ==================== */}
          {activeTab === 'reports' && (
            <>
              <div className="page-header">
                <div className="page-title-section">
                  <span className="page-kicker">Analytical Reports</span>
                  <h1 className="page-title">Compliance Reports & Audit Logs</h1>
                  <span className="page-subtitle">Extract spreadsheets for audit, or review secure historical system logs</span>
                </div>
              </div>

              {/* Report selector */}
              <div className="tabs-container">
                <button className={`tab-btn ${reportType === 'inventory' ? 'active' : ''}`} onClick={() => setReportType('inventory')}>
                  Asset Inventory
                </button>
                <button className={`tab-btn ${reportType === 'allocation' ? 'active' : ''}`} onClick={() => setReportType('allocation')}>
                  Employee Allocations
                </button>
                <button className={`tab-btn ${reportType === 'amc' ? 'active' : ''}`} onClick={() => setReportType('amc')}>
                  AMC Contracts
                </button>
                <button className={`tab-btn ${reportType === 'invoices' ? 'active' : ''}`} onClick={() => setReportType('invoices')}>
                  Invoices & Taxes
                </button>
                <button className={`tab-btn ${reportType === 'disposal' ? 'active' : ''}`} onClick={() => setReportType('disposal')}>
                  Disposed Assets
                </button>
                <button className={`tab-btn ${reportType === 'movement' ? 'active' : ''}`} onClick={() => setReportType('movement')}>
                  Asset Movement Ledger
                </button>
              </div>

              <div className="page-actions" style={{ justifyContent: 'flex-end', margin: '0', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={handleExportCSV}>
                  <Download size={16} />
                  CSV
                </button>
                <button className="btn btn-secondary" onClick={handleExportExcel}>
                  <Download size={16} />
                  Excel (.xlsx)
                </button>
                <button className="btn btn-secondary" onClick={handleExportPDF}>
                  <Download size={16} />
                  PDF
                </button>
                <button className="btn btn-primary" onClick={() => window.print()}>
                  Print Page
                </button>
              </div>

              {/* Report Render Table */}
              <div className="table-container">
                <table className="data-table">
                  {reportType === 'inventory' && (
                    <>
                      <thead>
                        <tr>
                          <th>Asset ID</th>
                          <th>Name</th>
                          <th>Serial #</th>
                          <th>Cost</th>
                          <th>Purchase Date</th>
                          <th>Warranty End</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedReport.map(r => (
                          <tr key={r.id}>
                            <td style={{ fontWeight: '700' }}>{r.id}</td>
                            <td>{r.name}</td>
                            <td>{r.serialNumber}</td>
                            <td>${r.cost}</td>
                            <td>{r.purchaseDate}</td>
                            <td>{r.warrantyExpiry}</td>
                            <td>{r.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {reportType === 'allocation' && (
                    <>
                      <thead>
                        <tr>
                          <th>Asset ID</th>
                          <th>Name</th>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Branch Location</th>
                          <th>Warranty Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedReport.map(r => (
                          <tr key={r.id}>
                            <td style={{ fontWeight: '700' }}>{r.id}</td>
                            <td>{r.name}</td>
                            <td style={{ fontWeight: '600' }}>{r.assignedEmployee}</td>
                            <td>{r.department}</td>
                            <td>{r.location}</td>
                            <td>{r.warrantyExpiry}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {reportType === 'amc' && (
                    <>
                      <thead>
                        <tr>
                          <th>Contract ID</th>
                          <th>Vendor Partner</th>
                          <th>Annual Premium</th>
                          <th>SLA Period</th>
                          <th>Frequency</th>
                          <th>Active Fleet Links</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedReport.map(r => (
                          <tr key={r.id}>
                            <td style={{ fontWeight: '700' }}>{r.id}</td>
                            <td>{r.vendor}</td>
                            <td>${r.cost}</td>
                            <td>{r.startDate} to {r.endDate}</td>
                            <td>{r.serviceSchedule}</td>
                            <td>{(r.mappedAssets || []).join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {reportType === 'invoices' && (
                    <>
                      <thead>
                        <tr>
                          <th>Invoice Ref</th>
                          <th>PO Code</th>
                          <th>Vendor Partner</th>
                          <th>Tax (GST %)</th>
                          <th>Base Amount</th>
                          <th>Payment Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedReport.map(r => (
                          <tr key={r.id}>
                            <td style={{ fontWeight: '700' }}>{r.id}</td>
                            <td>{r.poReference}</td>
                            <td>{r.vendor}</td>
                            <td>{r.gst}%</td>
                            <td>${r.amount}</td>
                            <td>{r.paymentStatus}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}

                  {reportType === 'disposal' && (
                    <>
                      <thead>
                        <tr>
                          <th>Asset ID</th>
                          <th>Name</th>
                          <th>Serial #</th>
                          <th>Original Cost</th>
                          <th>Disposal Date</th>
                          <th>Disposal Reason / Diagnosis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedReport.length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
                              No disposed assets recorded in ledger.
                            </td>
                          </tr>
                        ) : (
                          generatedReport.map(r => (
                            <tr key={r.id}>
                              <td style={{ fontWeight: '700' }}>{r.id}</td>
                              <td>{r.name}</td>
                              <td>{r.serialNumber}</td>
                              <td>${r.cost}</td>
                              <td>{r.disposalDate}</td>
                              <td>{r.disposalReason}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </>
                  )}

                  {reportType === 'movement' && (
                    <>
                      <thead>
                        <tr>
                          <th>Mvt Ref</th>
                          <th>Asset ID</th>
                          <th>Date</th>
                          <th>Event Action</th>
                          <th>Source Custodian</th>
                          <th>Destination Target</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedReport.map(r => (
                          <tr key={r.id}>
                            <td style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{r.id}</td>
                            <td style={{ fontWeight: '700' }}>{r.assetId}</td>
                            <td>{r.date}</td>
                            <td>{r.type}</td>
                            <td>{r.from}</td>
                            <td>{r.to}</td>
                            <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                </table>
              </div>

              {/* Complete audit trails log entries */}
              <div className="table-container" style={{ marginTop: '24px' }}>
                <div style={{ padding: '16px 20px', fontWeight: '700', borderBottom: '1px solid var(--border-color)' }}>
                  Crypto System Audit Trails Ledger
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Log ID</th>
                      <th>Timestamp</th>
                      <th>Operator Role</th>
                      <th>Action Type</th>
                      <th>Audit Trail Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id}>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{log.id}</td>
                        <td style={{ fontSize: '12px' }}>{log.timestamp}</td>
                        <td>
                          <span className="badge" style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: 'var(--primary)' }}>
                            {log.actor}
                          </span>
                        </td>
                        <td style={{ fontWeight: '600' }}>{log.action}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{log.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ==================== MOCK EMAILS INBOX ==================== */}
          {activeTab === 'emails' && (
            <>
              <div className="page-header">
                <div className="page-title-section">
                  <span className="page-kicker">Stakeholder Alerts</span>
                  <h1 className="page-title">Email Alerts Inbox</h1>
                  <span className="page-subtitle">Auditable log of outgoing warnings sent to procurement and operations stakeholders</span>
                </div>
              </div>

              <div className="email-inbox-grid">
                <div className="email-list">
                  {emails.map((eml) => (
                    <div
                      key={eml.id}
                      className={`email-item ${selectedEmailId === eml.id ? 'active' : ''}`}
                      onClick={() => setSelectedEmailId(eml.id)}
                    >
                      <div className="email-header-row">
                        <span className="email-sender">{eml.sender}</span>
                        <span className="email-date">{eml.date}</span>
                      </div>
                      <div className="email-subj">{eml.subject}</div>
                      <div className="email-body-preview">{eml.body}</div>
                    </div>
                  ))}
                </div>

                <div className="email-detail-view">
                  {selectedEmail ? (
                    <>
                      <div className="email-detail-header">
                        <h2 className="email-detail-subject">{selectedEmail.subject}</h2>
                        <div className="email-detail-meta">
                          <span>From: <strong>{selectedEmail.sender}</strong></span>
                          <span>{selectedEmail.date}</span>
                        </div>
                      </div>
                      <div className="email-detail-body">
                        {selectedEmail.body}
                      </div>
                    </>
                  ) : (
                    <div className="email-detail-empty">No email selected</div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ==================== USER DIRECTORY TAB ==================== */}
          {activeTab === 'users' && currentRole === 'Super Admin' && (
            <UserManagementPage
              usersList={usersList}
              setUsersList={setUsersList}
              isApiConnected={isApiConnected}
              rolePermissions={rolePermissions}
              setRolePermissions={setRolePermissions}
            />
          )}
            </motion.div>
          </AnimatePresence>

        </div>
      </main>

      {/* ==================== DIALOG MODALS VIEWPORTS ==================== */}
      
      {/* 1. Register Asset Modal */}
      {addAssetModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Register Organization Asset</h3>
              <button className="modal-close-btn" onClick={() => setAddAssetModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddAsset}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Asset Classification</label>
                    <CustomSelect
                      name="category"
                      options={[
                        { value: "IT", label: "IT Hardware" },
                        { value: "Office", label: "Office Infrastructure" }
                      ]}
                      value={addAssetCategory}
                      onChange={(e) => setAddAssetCategory(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Equipment Model Name</label>
                    <input type="text" name="name" placeholder="e.g. ThinkPad L14" className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Asset Tag Subtype</label>
                    <input type="text" name="type" placeholder="e.g. Laptops, Chairs, AC Units" className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Manufacturer Serial Number</label>
                    <input type="text" name="serialNumber" placeholder="e.g. S/N-982180" className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Purchase Expense Cost ($)</label>
                    <input type="number" name="cost" placeholder="1000" className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Purchase Date</label>
                    <input type="date" name="purchaseDate" className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Warranty Expiry Date</label>
                    <input type="date" name="warrantyExpiry" className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Procured Invoice Ref</label>
                    <CustomSelect
                      name="invoiceId"
                      options={[
                        { value: "", label: "-- No associated invoice --" },
                        ...invoices.map(i => ({ value: i.id, label: `${i.id} - ${i.vendor}` }))
                      ]}
                      value={addAssetInvoiceId}
                      onChange={(e) => setAddAssetInvoiceId(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Initial Location Branch</label>
                    <input type="text" name="location" placeholder="e.g. London HQ" className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Associated Office Dept</label>
                    <input type="text" name="department" placeholder="e.g. Engineering" className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Useful Lifespan (Depreciation Years)</label>
                    <input type="number" name="depreciationLifeYears" placeholder="5" className="form-input" required />
                  </div>
                  <div className="form-group full-width">
                    <label className="form-label">Administrative Notes</label>
                    <textarea name="notes" placeholder="Write any asset configurations, tags, or repairs logs here..." className="form-input"></textarea>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAddAssetModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">File Asset Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Asset Modal */}
      {editAssetModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Edit Asset {editAssetModal.id} Specs</h3>
              <button className="modal-close-btn" onClick={() => setEditAssetModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditAsset}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Equipment Model Name</label>
                    <input type="text" name="name" defaultValue={editAssetModal.name} className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Asset Tag Subtype</label>
                    <input type="text" name="type" defaultValue={editAssetModal.type} className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Manufacturer Serial Number</label>
                    <input type="text" name="serialNumber" defaultValue={editAssetModal.serialNumber} className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Purchase Expense Cost ($)</label>
                    <input type="number" name="cost" defaultValue={editAssetModal.cost} className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Purchase Date</label>
                    <input type="date" name="purchaseDate" defaultValue={editAssetModal.purchaseDate} className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Warranty Expiry Date</label>
                    <input type="date" name="warrantyExpiry" defaultValue={editAssetModal.warrantyExpiry} className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Procured Invoice Ref</label>
                    <CustomSelect
                      name="invoiceId"
                      options={[
                        { value: "", label: "-- No associated invoice --" },
                        ...invoices.map(i => ({ value: i.id, label: `${i.id} - ${i.vendor}` }))
                      ]}
                      value={editAssetInvoiceId}
                      onChange={(e) => setEditAssetInvoiceId(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location Branch</label>
                    <input type="text" name="location" defaultValue={editAssetModal.location} className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Associated Office Dept</label>
                    <input type="text" name="department" defaultValue={editAssetModal.department} className="form-input" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Useful Lifespan (Depreciation Years)</label>
                    <input type="number" name="depreciationLifeYears" defaultValue={editAssetModal.depreciationLifeYears} className="form-input" required />
                  </div>
                  <div className="form-group full-width">
                    <label className="form-label">Administrative Notes</label>
                    <textarea name="notes" defaultValue={editAssetModal.notes} className="form-input"></textarea>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditAssetModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Allocate Asset Modal */}
      {allocateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Allocate Asset {allocateModal.id}</h3>
              <button className="modal-close-btn" onClick={() => setAllocateModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAllocate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Employee Custodian</label>
                  <CustomSelect
                    name="employee"
                    options={[
                      { value: "Alice Johnson", label: "Alice Johnson (HR)" },
                      { value: "Bob Smith", label: "Bob Smith (Engineering)" },
                      { value: "Charlie Brown", label: "Charlie Brown (HR)" },
                      { value: "Diana Prince", label: "Diana Prince (Finance)" }
                    ]}
                    value={allocateEmployee}
                    onChange={(e) => setAllocateEmployee(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Allocation Department</label>
                  <input type="text" name="department" defaultValue={allocateModal.department} className="form-input" required />
                </div>
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Assignment Date</label>
                  <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="form-input" required />
                </div>
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Allocation Notes / SLA terms</label>
                  <textarea name="notes" placeholder="e.g. Device assigned for remote engineering duties." className="form-input"></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAllocateModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Authorize Allocation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Transfer Asset Modal */}
      {transferModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Transfer Asset {transferModal.id}</h3>
              <button className="modal-close-btn" onClick={() => setTransferModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleTransfer}>
              <div className="modal-body">
                <div style={{ padding: '10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>
                  Current Custodian: <strong>{transferModal.assignedEmployee || "Inventory"}</strong> ({transferModal.department})
                </div>

                <div className="form-group">
                  <label className="form-label">Transfer Target Destination</label>
                  <CustomSelect
                    name="targetType"
                    options={[
                      { value: "employee", label: "Another Employee Custodian" },
                      { value: "department", label: "Back to Department Inventory" }
                    ]}
                    value={transferTargetType}
                    onChange={(e) => setTransferTargetType(e.target.value)}
                    required
                  />
                </div>

                {transferTargetType !== 'department' && (
                  <div className="form-group" style={{ marginTop: '12px' }}>
                    <label className="form-label">New Employee Custodian</label>
                    <CustomSelect
                      name="employee"
                      options={[
                        { value: "Alice Johnson", label: "Alice Johnson (HR)" },
                        { value: "Bob Smith", label: "Bob Smith (Engineering)" },
                        { value: "Charlie Brown", label: "Charlie Brown (HR)" },
                        { value: "Diana Prince", label: "Diana Prince (Finance)" }
                      ]}
                      value={transferEmployee}
                      onChange={(e) => setTransferEmployee(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Target Department</label>
                  <input type="text" name="department" defaultValue={transferModal.department} className="form-input" required />
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Target Branch / Location</label>
                  <input type="text" name="location" defaultValue={transferModal.location} className="form-input" required />
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Transfer / Movement Date</label>
                  <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="form-input" required />
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Transfer Rationale</label>
                  <textarea name="notes" placeholder="Reason for custodian shift or branch relocation..." className="form-input" required></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setTransferModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Authorize Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Return Asset Modal */}
      {returnModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Return Asset {returnModal.id}</h3>
              <button className="modal-close-btn" onClick={() => setReturnModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReturn}>
              <div className="modal-body">
                <div style={{ padding: '10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>
                  Returning from Custodian: <strong>{returnModal.assignedEmployee}</strong> ({returnModal.department})
                </div>
                <div className="form-group">
                  <label className="form-label">Return Location / Warehouse</label>
                  <input type="text" name="location" defaultValue={returnModal.location} className="form-input" required />
                </div>
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Return Log Date</label>
                  <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="form-input" required />
                </div>
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Asset Condition Notes on Return</label>
                  <textarea name="notes" placeholder="Verify physical status (e.g. Scratch-free, Charger returned)..." className="form-input" required></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setReturnModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Return</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. QR Sticker Modal */}
      {qrStickerModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Security tag {qrStickerModal.id}</h3>
              <button className="modal-close-btn" onClick={() => setQrStickerModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ alignItems: 'center', backgroundColor: 'var(--bg-app)' }}>
              <QRCodeSticker asset={qrStickerModal} />
              <p style={{ fontSize: '11px', textAlign: 'center', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Printable label contains encrypted validation payload and dual barcode patterns.
              </p>
            </div>
            <div className="modal-footer" style={{ width: '100%' }}>
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => window.print()}>
                Print Sticker Label
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Asset Details / Custody Timeline Modal */}
      {assetDetailModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Lifecycle & Timeline: {assetDetailModal.id}</h3>
              <button className="modal-close-btn" onClick={() => setAssetDetailModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {/* Core Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{assetDetailModal.name}</h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Serial: {assetDetailModal.serialNumber}</span>
                  <div style={{ marginTop: '8px' }}>
                    <span className={`badge badge-${assetDetailModal.status.toLowerCase().replace(' ', '-')}`}>
                      {assetDetailModal.status}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>Category:</strong> {assetDetailModal.category} ({assetDetailModal.type})</div>
                  <div><strong>Value Cost:</strong> ${assetDetailModal.cost}</div>
                  <div><strong>Purchase:</strong> {assetDetailModal.purchaseDate}</div>
                  <div><strong>Warranty Exp:</strong> {assetDetailModal.warrantyExpiry}</div>
                  {assetDetailModal.amcId && <div><strong>AMC Linked:</strong> {assetDetailModal.amcId}</div>}
                  {assetDetailModal.invoiceId && <div><strong>Invoice Map:</strong> {assetDetailModal.invoiceId}</div>}
                </div>
              </div>

              {/* Depreciation calculation widget */}
              <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px' }}>
                <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px' }}>Depreciation & Asset Value Lifespan</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span>Calculated useful life:</span>
                  <span><strong>{assetDetailModal.depreciationLifeYears} Years</strong></span>
                </div>
                {/* Straight line depreciation mockup */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
                  <span>Current Residual Value:</span>
                  <span style={{ color: 'var(--status-available)', fontWeight: '700' }}>
                    ${Math.max(0, assetDetailModal.cost - (assetDetailModal.cost / assetDetailModal.depreciationLifeYears) * (new Date().getFullYear() - new Date(assetDetailModal.purchaseDate).getFullYear())).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* Timeline nodes mapping */}
              <div>
                <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-primary)' }}>Custody & Movement History Log</h4>
                <div className="timeline-container">
                  {movements.filter(m => m.assetId === assetDetailModal.id).map(mvt => (
                    <div key={mvt.id} className="timeline-node">
                      <div className={`timeline-dot ${mvt.type === 'Procurement' ? 'success' : mvt.type === 'Allocation' ? 'info' : mvt.type === 'Disposal' ? 'danger' : 'warning'}`}></div>
                      <div className="timeline-content">
                        <div className="timeline-date-row">
                          <span className="timeline-date">{mvt.date}</span>
                          <span className="timeline-actor">By: {mvt.actor}</span>
                        </div>
                        <span className="timeline-title">{mvt.type} Event</span>
                        <span className="timeline-desc">From: <strong>{mvt.from}</strong> → To: <strong>{mvt.to}</strong></span>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', borderTop: '1px dashed var(--border-color)', paddingTop: '4px' }}>
                          Notes: {mvt.notes}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setAssetDetailModal(null)}>
                Dismiss Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App
