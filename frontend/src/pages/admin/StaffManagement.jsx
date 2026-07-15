import { API_URL } from '../../config';
import { useState, useEffect } from 'react';
import { Users, Shield, Plus, Edit2, KeyRound, Lock, UserCheck, UserX, X, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function StaffManagement() {
  const { token, user: currentUser } = useAuth();
  const [staff, setStaff] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit'
  const [editingStaff, setEditingStaff] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'cashier',
    password: '',
    pin: '',
    isActive: true
  });

  const fetchStaff = () => {
    fetch(`${API_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
      .then(data => {
        if (Array.isArray(data)) setStaff(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (token) fetchStaff();
  }, [token]);

  const openAddModal = () => {
    setModalMode('add');
    setFormData({ name: '', email: '', role: 'cashier', password: '', pin: '', isActive: true });
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setModalMode('edit');
    setEditingStaff(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      password: '', // Blank unless they want to change it
      pin: '' // Blank unless they want to change it
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingStaff(null);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    const url = modalMode === 'edit' ? `${API_URL}/api/users/${editingStaff._id}` : `${API_URL}/api/users`;
    const method = modalMode === 'edit' ? 'PUT' : 'POST';

    // Validation
    if (modalMode === 'add' && !formData.password) return alert('Password is required for new accounts.');
    if ((formData.role === 'manager' || formData.role === 'owner') && modalMode === 'add' && !formData.pin) {
      return alert('A 4-digit PIN is required for Managers and Owners.');
    }

    // Build payload (only send password/pin if they typed something)
    const payload = { ...formData };
    if (!payload.password) delete payload.password;
    if (!payload.pin) delete payload.pin;

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        fetchStaff();
        handleCloseModal();
      } else {
        const errData = await res.json();
        alert(`Failed: ${errData.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    }
  };

  const handleToggleStatus = async (user) => {
    if (user._id === currentUser.id) return alert("You cannot deactivate yourself.");
    
    try {
      const res = await fetch(`${API_URL}/api/users/${user._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !user.isActive })
      });
      if (res.ok) fetchStaff();
    } catch (err) { console.error(err); }
  };

  const getRoleBadge = (role) => {
    if (role === 'owner') return 'bg-purple-50 text-purple-700 border-purple-200';
    if (role === 'manager') return 'bg-[var(--color-meza-primary)]/10 text-[var(--color-meza-primary)] border-[var(--color-meza-primary)]/30';
    return 'bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)] border-[var(--color-meza-border)]';
  };

  const isOwner = currentUser?.role === 'owner';

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-meza-text)] tracking-tight">Staff Management</h2>
          <p className="text-[var(--color-meza-muted)] text-sm mt-1">Manage system access, roles, and authorization PINs.</p>
        </div>
        {isOwner && (
          <button onClick={openAddModal} className="bg-meza-text hover:bg-[var(--color-meza-primary)] text-white px-5 py-2.5 rounded-sm flex items-center space-x-2 font-bold text-sm transition-all  hover: active:scale-[0.98]">
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span>Add Staff Member</span>
          </button>
        )}
      </div>

      <div className="bg-[var(--color-meza-surface)] rounded-sm shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-[var(--color-meza-border)] overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-meza-bg)] border-b border-[var(--color-meza-border)] text-[var(--color-meza-muted)] text-[11px] font-bold uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Staff Member</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">System Role</th>
                <th className="px-6 py-4">Status</th>
                {isOwner && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {staff.map(user => (
                <tr key={user._id} className={`hover:bg-[var(--color-meza-bg)]/50 transition-colors group ${!user.isActive ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--color-meza-primary)]/10 text-[var(--color-meza-primary)] flex items-center justify-center font-bold text-lg">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[var(--color-meza-text)]">{user.name}</span>
                        {user._id === currentUser.id && (
                          <span className="text-[10px] font-bold text-[var(--color-meza-primary)] uppercase tracking-wider">(You)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-[var(--color-meza-muted)]">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getRoleBadge(user.role)}`}>
                      <Shield className="w-3 h-3" strokeWidth={2.5} />
                      <span>{user.role}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.isActive ? (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-[var(--color-success)]/10 text-[var(--color-success)] border-green-100">
                        <UserCheck className="w-3 h-3" strokeWidth={2.5} />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)] border-[var(--color-meza-border)]">
                        <UserX className="w-3 h-3" strokeWidth={2.5} />
                        <span>Suspended</span>
                      </span>
                    )}
                  </td>
                  {isOwner && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleToggleStatus(user)} 
                          disabled={user._id === currentUser.id}
                          className="px-3 py-1.5 bg-[var(--color-meza-bg)] hover:bg-[var(--color-meza-border)] text-[var(--color-meza-muted)] rounded-sm text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {user.isActive ? 'Suspend' : 'Reactivate'}
                        </button>
                        <button 
                          onClick={() => openEditModal(user)} 
                          className="p-1.5 bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-primary)] hover:text-white rounded-sm transition-colors "
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-meza-text/40 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-meza-surface)] rounded-sm w-full max-w-md  overflow-hidden border border-[var(--color-meza-border)] transform transition-all">
            <div className="flex justify-between items-center p-5 border-b border-[var(--color-meza-border)] bg-[var(--color-meza-bg)]">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-[var(--color-meza-primary)]" />
                <h3 className="font-bold text-[var(--color-meza-text)] text-lg">
                  {modalMode === 'add' ? 'Create Staff Account' : 'Edit Staff Member'}
                </h3>
              </div>
              <button onClick={handleCloseModal} className="p-1.5 text-[var(--color-meza-muted)] hover:text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-bg)] rounded-sm transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Full Name</label>
                <input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--color-meza-bg)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] focus:ring-2 focus:ring-[var(--color-meza-primary)]/10 font-semibold text-[var(--color-meza-text)]" placeholder="John Doe" />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Email Address (Login ID)</label>
                <input type="email" required value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--color-meza-bg)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] focus:ring-2 focus:ring-[var(--color-meza-primary)]/10 font-semibold text-[var(--color-meza-text)]" placeholder="john@meza.cafe" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">System Role</label>
                <select required value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})} className="w-full px-4 py-2.5 bg-[var(--color-meza-bg)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] focus:ring-2 focus:ring-[var(--color-meza-primary)]/10 font-semibold text-[var(--color-meza-text)] appearance-none">
                  <option value="cashier">Cashier (POS Only)</option>
                  <option value="manager">Store Manager</option>
                  <option value="owner">Owner (Full Access)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                    <KeyRound className="w-3 h-3" /> <span>Password</span>
                  </label>
                  <input type="password" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} placeholder={modalMode === 'edit' ? "Leave blank to keep" : "••••••••"} className="w-full px-4 py-2.5 bg-[var(--color-meza-bg)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] focus:ring-2 focus:ring-[var(--color-meza-primary)]/10 font-semibold text-[var(--color-meza-text)]" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                    <Lock className="w-3 h-3" /> <span>Manager PIN</span>
                  </label>
                  <input 
                    type="password" 
                    maxLength="4"
                    disabled={formData.role === 'cashier'}
                    value={formData.pin} 
                    onChange={e=>setFormData({...formData, pin: e.target.value.replace(/[^0-9]/g, '')})} 
                    placeholder={formData.role === 'cashier' ? 'N/A' : (modalMode === 'edit' ? "Leave blank to keep" : "4-Digit PIN")} 
                    className="w-full px-4 py-2.5 bg-[var(--color-meza-bg)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] focus:ring-2 focus:ring-[var(--color-meza-primary)]/10 font-semibold text-[var(--color-meza-text)] disabled:opacity-50 disabled:cursor-not-allowed" 
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--color-meza-border)] mt-6 flex justify-end space-x-3">
                <button type="button" onClick={handleCloseModal} className="px-5 py-2.5 text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-bg)] rounded-sm font-bold transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-meza-text text-white hover:bg-[var(--color-meza-primary)] rounded-sm font-bold flex items-center space-x-2 transition-colors ">
                  <Save className="w-4 h-4" /><span>{modalMode === 'add' ? 'Create Account' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
