import { useState } from 'react'
import { can as canPerm } from '../../permissions'
import RolePermissionMatrix from '../../RolePermissionMatrix'
import UserDirectoryPage from './UserDirectoryPage'

const UserManagementPage = ({ usersList, setUsersList, isApiConnected, rolePermissions, setRolePermissions, permModel, onBulkImportClick, addToast, onUsersDeleted, currentRole, departments = [] }) => {
  const [usersSubTab, setUsersSubTab] = useState('directory');
  // The directory's create/edit/delete controls, and the role-permission editor, are
  // each gated by their own module verb. Backend enforces these too (the real boundary).
  const canManageUsers = canPerm(rolePermissions, currentRole, 'userManagement', 'edit')
    || canPerm(rolePermissions, currentRole, 'userManagement', 'create')
    || canPerm(rolePermissions, currentRole, 'userManagement', 'delete');
  const canManagePerms = canPerm(rolePermissions, currentRole, 'userManagement', 'manage');
  const subTabs = [{ id: 'directory', label: '👥  User Directory' }];
  if (canManagePerms) subTabs.push({ id: 'permissions', label: '🔐  Role Permissions' });
  const activeSubTab = usersSubTab === 'permissions' && !canManagePerms ? 'directory' : usersSubTab;
  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', background: 'var(--bg-sidebar)', padding: '4px', borderRadius: 'var(--radius-lg)', width: 'fit-content', border: '1px solid var(--border-color)' }}>
        {subTabs.map(tab => (
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
              background: activeSubTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeSubTab === tab.id ? 'var(--ink-contrast)' : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeSubTab === 'directory' && (
        <UserDirectoryPage
          usersList={usersList}
          setUsersList={setUsersList}
          isApiConnected={isApiConnected}
          onBulkImportClick={onBulkImportClick}
          addToast={addToast}
          onUsersDeleted={onUsersDeleted}
          departments={departments}
          canManage={canManageUsers}
        />
      )}
      {activeSubTab === 'permissions' && (
        <RolePermissionMatrix
          modules={permModel?.modules || []}
          verbLabels={permModel?.verbLabels || {}}
          matrix={rolePermissions}
          setMatrix={setRolePermissions}
          addToast={addToast}
          currentRole={currentRole}
        />
      )}
    </div>
  );
};

export default UserManagementPage
