import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, Download } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        login(data.token, data.user);
        navigate(data.user.role === 'cashier' ? '/cashier' : '/admin/dashboard');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Cannot connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--color-meza-bg)] font-sans">
      
      {/* Brand Panel (Left) */}
      <div className="flex-1 flex flex-col justify-center items-center relative overflow-hidden bg-[var(--color-meza-primary)] p-12 text-white shadow-2xl">
        {/* Subtle Grain Texture overlay */}
        <div 
          className="absolute inset-0 opacity-[0.05] mix-blend-multiply pointer-events-none" 
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
        ></div>
        
        <div className="relative z-10 flex flex-col items-center">
          <img src="/src/assets/meza-logo.png" alt="Meza Cafe" className="w-32 h-32 rounded-xl shadow-2xl mb-8 border-4 border-white/20" />
          
          <div className="w-32 receipt-divider mb-6 opacity-40 border-white"></div>
          
          <p className="font-mono text-white/80 tracking-widest uppercase text-sm">
            Digital System Suite
          </p>
        </div>
      </div>

      {/* Form Panel (Right) */}
      <div className="flex-1 flex items-center justify-center bg-[var(--color-meza-surface)] p-8 md:p-16 shadow-[-20px_0_40px_rgba(46,32,25,0.03)] z-10 relative">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <h2 className="font-display text-3xl font-semibold text-[var(--color-meza-text)] mb-2">Sign In</h2>
            <p className="text-[var(--color-meza-muted)] font-sans">Enter your credentials to access the system.</p>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50 text-[var(--color-danger)] rounded-sm text-sm font-semibold flex items-center border-l-4 border-[var(--color-danger)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--color-meza-muted)] uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-meza-border)]" />
                <input 
                  type="email" 
                  required 
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] focus:ring-1 focus:ring-[var(--color-meza-primary)] transition-all font-medium text-[var(--color-meza-text)]"
                  placeholder="hello@meza.cafe"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--color-meza-muted)] uppercase tracking-wider ml-1">Password</label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-meza-border)]" />
                <input 
                  type="password" 
                  required 
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] focus:ring-1 focus:ring-[var(--color-meza-primary)] transition-all font-medium text-[var(--color-meza-text)]"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-[var(--color-meza-primary)] hover:bg-[var(--color-meza-primary-hover)] text-white py-4 rounded-sm font-bold tracking-wide transition-all mt-6 flex items-center justify-center group active:scale-[0.98] cursor-pointer disabled:opacity-70"
            >
              <span>{isLoading ? 'Authenticating...' : 'Sign In'}</span>
              {!isLoading && <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          {/* Footer version mark */}
          <div className="mt-16 text-center">
            <p className="font-mono text-xs text-[var(--color-meza-border)]">v.2.0.4 Meza Systems</p>
          </div>
        </div>

        {/* Floating Install App Button */}
        {deferredPrompt && (
          <div className="absolute bottom-6 right-6 z-20">
            <button 
              onClick={handleInstallClick}
              className="bg-white text-[var(--color-meza-text)] hover:text-[var(--color-meza-primary)] border border-[var(--color-meza-border)] shadow-xl py-3 px-6 rounded-full font-bold tracking-wide transition-all flex items-center justify-center cursor-pointer hover:-translate-y-1 active:scale-95 text-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Install App
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
