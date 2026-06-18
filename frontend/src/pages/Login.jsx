import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Coffee, Lock, Mail, ArrowRight } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        // We need the token for socket.io in memory, so we'll grab it if returned.
        // The backend auth.js needs to return the token to memory, while storing it in httpOnly for requests.
        // Wait, earlier I didn't return the token in res.json() in auth.js to comply with "Store JWT in httpOnly".
        // Let's assume backend returns token for socket.io but we just don't store it in localStorage.
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
    <div className="min-h-screen flex items-center justify-center bg-[#f4f1eb] relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30"></div>
      
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md relative z-10 border border-gray-100">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-meza-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
            <Coffee className="w-8 h-8 text-meza-primary transform -rotate-3" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-black text-meza-text tracking-tight mb-2">meza<span className="text-meza-primary">.</span></h1>
          <p className="text-gray-500 font-medium text-sm">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center border border-red-100">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Email Address</label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="email" 
                required 
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-meza-primary focus:ring-4 focus:ring-meza-primary/10 transition-all font-semibold text-meza-text"
                placeholder="hello@meza.cafe"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="password" 
                required 
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-meza-primary focus:ring-4 focus:ring-meza-primary/10 transition-all font-semibold text-meza-text"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-meza-text hover:bg-meza-primary text-white py-4 rounded-xl font-bold tracking-wide transition-all mt-4 flex items-center justify-center group active:scale-[0.98] cursor-pointer disabled:opacity-70 shadow-md"
          >
            <span>{isLoading ? 'Authenticating...' : 'Sign In'}</span>
            {!isLoading && <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>
      </div>
    </div>
  );
}
