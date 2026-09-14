import React, { useEffect, useState } from 'react';
import { RetroWindow } from '../retro/RetroWindow.js';
import { BevelButton } from '../retro/BevelButton.js';
import { RetroInput, RetroSelect } from '../retro/RetroInput.js';
import { RetroModal } from '../retro/RetroModal.js';
import { api } from '../../utils/api.js';
import { User, UserRole } from '../../types.js';

export const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('ANALYST');
  const [newDept, setNewDept] = useState('Data Operations');

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newPassword.trim() || !newFullName.trim()) {
      setError('Please fill in username, password, and full name.');
      return;
    }
    try {
      await api.createUser({
        username: newUsername.trim(),
        password: newPassword,
        fullName: newFullName.trim(),
        email: newEmail.trim() || `${newUsername}@dataforge95.internal`,
        role: newRole,
        department: newDept
      });
      setAddModalOpen(false);
      setSuccess(`User "${newUsername}" created successfully.`);
      // Reset form
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewEmail('');
      await loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      await api.updateUser(user.id, { status: nextStatus });
      setSuccess(`User ${user.username} status updated to ${nextStatus}.`);
      await loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRoleChange = async (user: User, role: UserRole) => {
    try {
      await api.updateUser(user.id, { role });
      setSuccess(`User ${user.username} role updated to ${role}.`);
      await loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-12">
      <RetroWindow
        title="USER ACCOUNTS &amp; ROLE PRIVILEGES [ADMINISTRATIVE CONSOLE]"
        icon="👥"
        menuItems={['User', 'Security', 'Roles', 'Help']}
      >
        <div className="p-2 bevel-inset-gray bg-[#c0c0c0] mb-3 flex justify-between items-center text-xs">
          <div>
            System Registered Operators: <strong className="font-mono text-[#000080]">{users.length}</strong>
          </div>
          <BevelButton onClick={() => setAddModalOpen(true)} variant="primary" className="text-xs py-1">
            + Provision New User Account
          </BevelButton>
        </div>

        <div className="bevel-inset bg-white overflow-x-auto">
          <table className="retro-table text-xs">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Assigned Role</th>
                <th>Account Status</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="font-mono font-bold text-[#000080]">{u.username}</td>
                  <td className="font-bold text-black">{u.fullName}</td>
                  <td className="font-mono text-[#555555]">{u.email}</td>
                  <td>{u.department || 'General'}</td>
                  <td>
                    <RetroSelect
                      value={u.role}
                      onChange={e => handleRoleChange(u, e.target.value as UserRole)}
                      className="text-xs py-0.5"
                    >
                      <option value="ADMIN">ADMIN (Full Access)</option>
                      <option value="ANALYST">ANALYST (Read / Write)</option>
                      <option value="VIEWER">VIEWER (Read Only)</option>
                    </RetroSelect>
                  </td>
                  <td>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold text-white ${
                        u.status === 'ACTIVE' ? 'bg-[#00aa00]' : 'bg-[#cc0000]'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="font-mono text-[#555555]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <BevelButton
                      onClick={() => handleToggleStatus(u)}
                      className="text-[10px] py-0.5 px-2"
                    >
                      {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </BevelButton>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-6 font-mono text-xs">
                    {loading ? 'READING USER ACCOUNTS...' : 'NO USERS REGISTERED.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </RetroWindow>

      {/* Provision User Modal */}
      <RetroModal
        isOpen={addModalOpen}
        title="PROVISION NEW OPERATOR ACCOUNT"
        onClose={() => setAddModalOpen(false)}
        footer={
          <div className="flex gap-2">
            <BevelButton onClick={() => setAddModalOpen(false)}>Cancel</BevelButton>
            <BevelButton onClick={handleCreateUser} variant="primary">
              Create Account
            </BevelButton>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <RetroInput
              label="Username (Login Handle):"
              placeholder="e.g. jsmith"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
            />
            <RetroInput
              label="Initial Password:"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <RetroInput
              label="Full Name:"
              placeholder="e.g. John Smith"
              value={newFullName}
              onChange={e => setNewFullName(e.target.value)}
            />
            <RetroInput
              label="Email Address:"
              placeholder="jsmith@dataforge95.internal"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <RetroSelect
              label="Assigned System Role:"
              value={newRole}
              onChange={e => setNewRole(e.target.value as UserRole)}
            >
              <option value="ANALYST">ANALYST (Standard Data Scientist)</option>
              <option value="ADMIN">ADMIN (System Administrator)</option>
              <option value="VIEWER">VIEWER (Read-Only Observer)</option>
            </RetroSelect>

            <RetroInput
              label="Department:"
              placeholder="Data Intelligence"
              value={newDept}
              onChange={e => setNewDept(e.target.value)}
            />
          </div>
        </div>
      </RetroModal>

      {error && (
        <RetroModal isOpen={true} title="ALERT" onClose={() => setError(null)} isError={true}>
          <div className="text-xs font-bold text-[#800000]">{error}</div>
        </RetroModal>
      )}

      {success && (
        <RetroModal isOpen={true} title="NOTICE" onClose={() => setSuccess(null)}>
          <div className="text-xs font-bold text-[#008000]">{success}</div>
        </RetroModal>
      )}
    </div>
  );
};
