import React, { useState } from 'react';
import { X, User, Mail, Lock, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, token, updateUser } = useAuth();
  
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canHavePin = user?.role === 'manager' || user?.role === 'owner';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          email,
          ...(password && { password }),
          ...(pin && canHavePin && { pin })
        })
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', message: 'Profile updated successfully!' });
        updateUser(data);
        setPassword('');
        setPin('');
        setTimeout(() => {
          onClose();
          setStatus({ type: '', message: '' });
        }, 1500);
      } else {
        setStatus({ type: 'error', message: data.message || 'Failed to update profile' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-meza-text/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 transform transition-all flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-[#fcf9f5]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-meza-primary/10 text-meza-primary flex items-center justify-center font-bold uppercase text-lg">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div>
              <h3 className="font-black text-meza-text text-lg leading-tight">Profile Settings</h3>
              <p className="text-xs text-gray-500 font-medium capitalize">{user?.role} Account</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {status.message && (
            <div className={`mb-6 p-3 rounded-xl text-sm font-bold flex items-center space-x-2 border ${
              status.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
            }`}>
              {status.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{status.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" required 
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-meza-primary font-semibold text-meza-text text-sm"
                  value={name} onChange={e => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="email" required 
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-meza-primary font-semibold text-meza-text text-sm"
                  value={email} onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2 pb-1 border-b border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Security (Optional)</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">New Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="password" 
                  placeholder="Leave blank to keep current"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-meza-primary font-semibold text-meza-text text-sm"
                  value={password} onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            {canHavePin && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-purple-600 uppercase tracking-wider ml-1">Manager PIN</label>
                <div className="relative">
                  <ShieldAlert className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-purple-400" />
                  <input 
                    type="password" maxLength={4}
                    placeholder="4-Digit PIN (Leave blank to keep)"
                    className="w-full pl-10 pr-4 py-3 bg-purple-50 border border-purple-100 rounded-xl outline-none focus:border-purple-400 font-bold text-purple-700 tracking-widest text-sm"
                    value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-meza-text hover:bg-meza-primary text-white py-3.5 rounded-xl font-bold tracking-wide transition-all mt-4 active:scale-[0.98] disabled:opacity-70 shadow-md"
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
