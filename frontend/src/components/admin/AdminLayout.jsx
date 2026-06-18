import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, UtensilsCrossed, Calculator, Package, LogOut, CalendarRange, Users, FileText, UserCog } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ProfileModal from '../ProfileModal';

export default function AdminLayout() {
  const { logout, user } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Orders', path: '/admin/orders', icon: Receipt },
    { name: 'Menu', path: '/admin/menu', icon: UtensilsCrossed },
    { name: 'Cost Calculator', path: '/admin/calculator', icon: Calculator, roles: ['owner'] },
    { name: 'Inventory', path: '/admin/inventory', icon: Package },
    { name: 'Bookings', path: '/admin/bookings', icon: CalendarRange },
    { name: 'Shift Tracking', path: '/admin/shifts', icon: FileText, roles: ['owner', 'manager'] },
    { name: 'Staff Management', path: '/admin/staff', icon: Users, roles: ['owner', 'manager'] },
  ];

  return (
    <div className="flex h-screen bg-[#fcf9f5] font-sans antialiased text-meza-text">
      
      {/* Sleek Enterprise Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.01)] z-10">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <h1 className="text-2xl font-black tracking-tight text-meza-text flex items-baseline leading-none">
            meza<span className="text-meza-primary">.</span>
          </h1>
        </div>
        
        <div className="p-4 border-b border-gray-100 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-meza-primary/10 text-meza-primary flex items-center justify-center font-bold text-sm uppercase">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-tight">{user?.name || 'Admin User'}</span>
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{user?.role || 'Owner'}</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            if (item.roles && !item.roles.includes(user?.role)) return null;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin'}
                className={({ isActive }) => 
                  `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all tap-scale ${
                    isActive 
                      ? 'bg-meza-primary/10 text-meza-primary font-semibold shadow-sm' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-meza-text'
                  }`
                }
              >
                <item.icon className="w-4 h-4" strokeWidth={2.5} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-1">
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="flex w-full items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-meza-text transition-colors tap-scale cursor-pointer"
          >
            <UserCog className="w-4 h-4" strokeWidth={2.5} />
            <span>Profile Settings</span>
          </button>
          <button 
            onClick={logout}
            className="flex w-full items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors tap-scale cursor-pointer"
          >
            <LogOut className="w-4 h-4" strokeWidth={2.5} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-transparent">
        {/* Top Navbar */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center px-8 justify-between sticky top-0 z-0">
          <div className="text-sm font-medium text-gray-400">
            Meza Cafe / <span className="text-meza-text">Operations</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-md border border-green-100">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <span>System Online</span>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
}
