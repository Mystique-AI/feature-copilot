import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { getCurrentUser, getUsers, updateUserRole, updateProfile } from '../services/api';

const ROLE_OPTIONS = [
  { value: 'requester', label: 'Requester', description: 'Can create and view feature requests' },
  { value: 'pm', label: 'PM', description: 'Full control over features and assignments' },
  { value: 'developer', label: 'Developer', description: 'Can work on assigned features' },
  { value: 'qa', label: 'QA', description: 'Can test and mark features complete' },
  { value: 'approver', label: 'Approver', description: 'Can only approve/reject requests' },
  { value: 'admin', label: 'Admin', description: 'Full system access' },
];

const ROLE_COLORS = {
  requester: 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400',
  pm: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400',
  developer: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-400',
  qa: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400',
  approver: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400',
  admin: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400',
};

export default function Settings() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Profile form
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
      setFullName(user.full_name || '');
      
      // Load all users if admin, pm, or env admin
      if (user.role === 'admin' || user.role === 'pm' || user.is_env_admin) {
        const allUsers = await getUsers();
        setUsers(allUsers);
      }
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await updateProfile(fullName);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async () => {
    if (!editingUser || !selectedRole) return;
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await updateUserRole(editingUser.id, selectedRole);
      setMessage({ type: 'success', text: `Role updated for ${editingUser.full_name || editingUser.email}` });
      setEditingUser(null);
      setSelectedRole('');
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to update role' });
    } finally {
      setSaving(false);
    }
  };

  const canManageUsers = currentUser?.role === 'admin' || currentUser?.role === 'pm' || currentUser?.is_env_admin;

  if (loading) {
    return (
      <div className="flex h-screen w-full">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex-1 p-8 max-w-4xl">
          {/* Page Header */}
          <h1 className="text-black dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">
            Settings
          </h1>
          
          {/* Message */}
          {message.text && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400' 
                : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400'
            }`}>
              {message.text}
            </div>
          )}

          {/* Tabs */}
          <div className="mt-6 flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-3 text-sm font-medium ${
                activeTab === 'profile'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Profile
            </button>
            {canManageUsers && (
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-3 text-sm font-medium ${
                  activeTab === 'users'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                User Management
              </button>
            )}
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="mt-6">
              <div className="bg-white dark:bg-[#111a22] rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-bold text-black dark:text-white mb-4">Your Profile</h2>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-white text-2xl font-bold">
                    {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : currentUser?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-lg font-medium text-black dark:text-white">
                      {currentUser?.full_name || 'No name set'}
                    </p>
                    <p className="text-sm text-gray-500">{currentUser?.email}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium mt-1 ${ROLE_COLORS[currentUser?.role] || ROLE_COLORS.requester}`}>
                      {ROLE_OPTIONS.find(r => r.value === currentUser?.role)?.label || currentUser?.role}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#233648] px-4 py-2 text-black dark:text-white"
                      placeholder="Enter your full name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={currentUser?.email || ''}
                      disabled
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-4 py-2 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Role
                    </label>
                    <input
                      type="text"
                      value={ROLE_OPTIONS.find(r => r.value === currentUser?.role)?.label || currentUser?.role}
                      disabled
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-4 py-2 text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {ROLE_OPTIONS.find(r => r.value === currentUser?.role)?.description}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Update Profile'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && canManageUsers && (
            <div className="mt-6">
              <div className="bg-white dark:bg-[#111a22] rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-bold text-black dark:text-white">All Users</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {(currentUser?.role === 'admin' || currentUser?.is_env_admin)
                      ? 'Manage user roles. Note: Only designated admins (ADMIN_EMAILS) can grant the Approver role.'
                      : 'View users in the system.'}
                  </p>
                </div>
                
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                      {(currentUser?.role === 'admin' || currentUser?.is_env_admin) && (
                        <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-medium">
                              {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-black dark:text-white">
                              {user.full_name || 'No name'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                          {user.email}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${ROLE_COLORS[user.role] || ROLE_COLORS.requester}`}>
                            {ROLE_OPTIONS.find(r => r.value === user.role)?.label || user.role}
                          </span>
                        </td>
                        {(currentUser?.role === 'admin' || currentUser?.is_env_admin) && (
                          <td className="py-3 px-4">
                            {user.id !== currentUser.id && (
                              <button
                                onClick={() => {
                                  setEditingUser(user);
                                  setSelectedRole(user.role);
                                }}
                                className="text-sm text-primary hover:underline"
                              >
                                Change Role
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Role Change Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingUser(null)}></div>
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white dark:bg-[#111a22] p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-2 text-black dark:text-white">Change User Role</h3>
            <p className="text-sm text-gray-500 mb-4">
              Changing role for: <span className="font-medium text-black dark:text-white">{editingUser.full_name || editingUser.email}</span>
            </p>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role.value}
                  onClick={() => setSelectedRole(role.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    selectedRole === role.value
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${ROLE_COLORS[role.value]}`}>
                      {role.label}
                    </span>
                    {selectedRole === role.value && (
                      <span className="material-symbols-outlined text-primary">check_circle</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{role.description}</p>
                </button>
              ))}
            </div>
            
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setEditingUser(null);
                  setSelectedRole('');
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleChange}
                disabled={saving || selectedRole === editingUser.role}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Update Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
