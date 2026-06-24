import React, { useState } from 'react';
import { X, User, Mail, Lock, ShieldAlert, CheckCircle, AlertTriangle, Moon, Sun, Bell, Globe, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, token, updateUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState('account');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  
  // UI Preferences (Mock states)
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotifs, setEmailNotifs] = useState(true);
  
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
          setStatus({ type: '', message: '' });
        }, 3000);
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
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-gray-100 transform transition-all flex flex-col md:flex-row h-[600px] max-h-[90vh]">
        
        {/* Left Sidebar Menu */}
        <div className="w-full md:w-64 bg-gray-50 border-r border-gray-100 flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-black text-meza-text">Settings</h2>
            <p className="text-xs text-gray-500 font-medium mt-1">Manage your personal account</p>
          </div>
          <div className="p-3 flex flex-col space-y-1 flex-1">
            <button 
              onClick={() => setActiveTab('account')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'account' ? 'bg-white text-meza-primary shadow-sm border border-gray-100' : 'text-gray-500 hover:bg-gray-100 hover:text-meza-text'}`}
            >
              <User className="w-4 h-4" />
              <span>Account Info</span>
            </button>
            <button 
              onClick={() => setActiveTab('security')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'security' ? 'bg-white text-meza-primary shadow-sm border border-gray-100' : 'text-gray-500 hover:bg-gray-100 hover:text-meza-text'}`}
            >
              <Lock className="w-4 h-4" />
              <span>Security</span>
            </button>
            <button 
              onClick={() => setActiveTab('preferences')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'preferences' ? 'bg-white text-meza-primary shadow-sm border border-gray-100' : 'text-gray-500 hover:bg-gray-100 hover:text-meza-text'}`}
            >
              <Sun className="w-4 h-4" />
              <span>Preferences</span>
            </button>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
          <div className="absolute top-4 right-4 z-10">
             <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors bg-white/80 backdrop-blur">
               <X className="w-5 h-5" />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 pt-12">
            {status.message && (
              <div className={`mb-6 p-4 rounded-xl text-sm font-bold flex items-center space-x-3 border shadow-sm animate-in fade-in slide-in-from-top-4 ${
                status.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
              }`}>
                {status.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                <span>{status.message}</span>
              </div>
            )}

            <form id="profile-form" onSubmit={handleSubmit}>
              
              {/* ACCOUNT TAB */}
              {activeTab === 'account' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                  <div>
                    <h3 className="text-2xl font-black text-meza-text">Account Information</h3>
                    <p className="text-sm text-gray-500 mt-1">Update your personal details.</p>
                  </div>

                  <div className="flex items-center space-x-6 pb-6 border-b border-gray-100">
                    <div className="relative group cursor-pointer">
                      <div className="w-20 h-20 rounded-full bg-meza-primary/10 text-meza-primary flex items-center justify-center font-black uppercase text-3xl shadow-inner border border-meza-primary/20">
                        {user?.name?.charAt(0) || 'U'}
                      </div>
                      <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-meza-primary uppercase tracking-widest bg-meza-primary/10 px-2 py-1 rounded inline-block mb-1">{user?.role}</div>
                      <div className="text-xs text-gray-400 font-medium">Click avatar to upload a new photo (soon)</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Full Name</label>
                      <div className="relative">
                        <User className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="text" required 
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-meza-primary focus:ring-4 focus:ring-meza-primary/10 font-semibold text-meza-text text-base transition-all"
                          value={name} onChange={e => setName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="email" required 
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-meza-primary focus:ring-4 focus:ring-meza-primary/10 font-semibold text-meza-text text-base transition-all"
                          value={email} onChange={e => setEmail(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECURITY TAB */}
              {activeTab === 'security' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                  <div>
                    <h3 className="text-2xl font-black text-meza-text">Security Settings</h3>
                    <p className="text-sm text-gray-500 mt-1">Keep your account secure.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Update Password</label>
                      <div className="relative">
                        <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="password" 
                          placeholder="Leave blank to keep current password"
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-meza-primary focus:ring-4 focus:ring-meza-primary/10 font-semibold text-meza-text text-base transition-all placeholder:text-gray-400 placeholder:font-normal"
                          value={password} onChange={e => setPassword(e.target.value)}
                        />
                      </div>
                    </div>

                    {canHavePin && (
                      <div className="p-5 bg-purple-50 rounded-xl border border-purple-100 space-y-3 mt-6">
                        <div className="flex items-center space-x-2 text-purple-700">
                          <ShieldAlert className="w-5 h-5" />
                          <h4 className="font-bold">Manager PIN Authorization</h4>
                        </div>
                        <p className="text-xs text-purple-600/80 leading-relaxed font-medium">
                          Used to quickly authorize voids, discounts, and high-security actions on the POS without logging out.
                        </p>
                        <div className="relative pt-2">
                          <Lock className="w-5 h-5 absolute left-4 top-[calc(50%+4px)] -translate-y-1/2 text-purple-400" />
                          <input 
                            type="password" maxLength={4}
                            placeholder="••••"
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-purple-200 rounded-xl outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 font-black text-purple-700 tracking-[0.5em] text-xl transition-all"
                            value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PREFERENCES TAB */}
              {activeTab === 'preferences' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                  <div>
                    <h3 className="text-2xl font-black text-meza-text">App Preferences</h3>
                    <p className="text-sm text-gray-500 mt-1">Customize your experience.</p>
                  </div>

                  <div className="space-y-4">
                    {/* Dark Mode Toggle */}
                    <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                          {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-meza-text text-sm">Appearance</h4>
                          <p className="text-xs text-gray-400">Toggle dark mode (Coming Soon)</p>
                        </div>
                      </div>
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
                        <div className={`block w-14 h-8 rounded-full transition-colors ${darkMode ? 'bg-meza-primary' : 'bg-gray-200'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${darkMode ? 'transform translate-x-6' : ''}`}></div>
                      </div>
                    </div>

                    {/* Email Notifs */}
                    <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                          <Bell className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-meza-text text-sm">Notifications</h4>
                          <p className="text-xs text-gray-400">Receive weekly digest emails</p>
                        </div>
                      </div>
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={emailNotifs} onChange={() => setEmailNotifs(!emailNotifs)} />
                        <div className={`block w-14 h-8 rounded-full transition-colors ${emailNotifs ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${emailNotifs ? 'transform translate-x-6' : ''}`}></div>
                      </div>
                    </div>

                    {/* Language */}
                    <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                          <Globe className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-meza-text text-sm">Language</h4>
                          <p className="text-xs text-gray-400">English (US)</p>
                        </div>
                      </div>
                      <button type="button" className="text-xs font-bold text-meza-primary bg-meza-primary/10 px-3 py-1.5 rounded-lg">Change</button>
                    </div>
                  </div>
                </div>
              )}

            </form>
          </div>

          <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button 
              type="submit" 
              form="profile-form"
              disabled={isSubmitting}
              className="px-8 py-3 bg-meza-text hover:bg-meza-primary text-white rounded-xl font-bold tracking-wide transition-all active:scale-95 disabled:opacity-70 shadow-md flex items-center justify-center"
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </div>
              ) : 'Save Changes'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
