import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Users, Receipt, CreditCard, ArrowUpRight, ArrowDownRight, Flame, AlertTriangle, PackageCheck, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--color-meza-surface)] p-3 rounded-sm  border border-[var(--color-meza-border)] text-sm">
        <p className="font-bold text-[var(--color-meza-muted)] mb-1">{label}</p>
        <p className="font-bold text-[var(--color-meza-text)]">₱{payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { token } = useAuth();
  const socket = useSocket();
  const [timeframe, setTimeframe] = useState('daily');
  const [data, setData] = useState({
    today: { revenue: 0, orders: 0, aov: 0 },
    yesterday: { revenue: 0, orders: 0, aov: 0 },
    sevenDayTrend: [],
    topItems: [],
    lowStockItems: [],
    activeShifts: []
  });

  const fetchDashboardData = useCallback(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/analytics/dashboard?timeframe=${timeframe}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
      .then(setData)
      .catch(console.error);
  }, [token, timeframe]);

  useEffect(() => {
    if (token) fetchDashboardData();
  }, [token, timeframe, fetchDashboardData]);

  // Real-time live sync
  useEffect(() => {
    if (!socket) return;
    let timeoutId;

    const handleSync = () => {
      // Prevent aggressive re-fetching for heavy aggregations
      if (timeframe === 'yearly') return;
      
      // Debounce: wait 5 seconds before fetching to prevent DDoS during order rushes
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fetchDashboardData();
      }, 5000);
    };

    socket.on('order:created', handleSync);
    socket.on('shift:updated', handleSync);
    socket.on('inventory:low_stock', handleSync);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      socket.off('order:created', handleSync);
      socket.off('shift:updated', handleSync);
      socket.off('inventory:low_stock', handleSync);
    };
  }, [socket, token, timeframe, fetchDashboardData]);

  const calcChange = (current, previous) => {
    if (previous === 0) return current > 0 ? { val: '+100%', dir: 'up' } : { val: '0%', dir: 'neutral' };
    const pct = ((current - previous) / previous) * 100;
    return {
      val: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
      dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral'
    };
  };

  const revChange = calcChange(data.today.revenue, data.yesterday.revenue);
  const ordChange = calcChange(data.today.orders, data.yesterday.orders);
  const aovChange = calcChange(data.today.aov, data.yesterday.aov);

  const stats = [
    { name: timeframe === 'daily' ? "Today's Sales" : timeframe === 'weekly' ? "This Week's Sales" : timeframe === 'monthly' ? "This Month's Sales" : timeframe === 'yearly' ? "This Year's Sales" : "Sales", value: `₱${data.today.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: TrendingUp, change: revChange.val, trend: revChange.dir, color: 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-green-100' },
    { name: timeframe === 'daily' ? 'Total Orders' : 'Period Orders', value: data.today.orders.toString(), icon: Receipt, change: ordChange.val, trend: ordChange.dir, color: 'bg-[var(--color-meza-primary)]/10 text-[var(--color-meza-primary)] border-blue-100' },
    { name: 'Average Order Value', value: `₱${data.today.aov.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: CreditCard, change: aovChange.val, trend: aovChange.dir, color: 'bg-purple-50 text-purple-600 border-purple-100' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-meza-text)] tracking-tight">System Dashboard</h2>
          <p className="text-[var(--color-meza-muted)] text-sm mt-1">Live operational overview, sales trends, and real-time alerts.</p>
        </div>
        <div className="flex items-center space-x-3">
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
            className="text-sm font-semibold border-[var(--color-meza-border)] rounded-sm  focus:ring-[var(--color-meza-primary)] focus:border-[var(--color-meza-primary)]"
          >
            <option value="daily">Daily View</option>
            <option value="weekly">Weekly View</option>
            <option value="monthly">Monthly View</option>
            <option value="yearly">Yearly View</option>
          </select>
          <div className="flex items-center space-x-2 text-xs font-bold text-[var(--color-meza-primary)] bg-[var(--color-meza-primary)]/10 px-3 py-2 rounded-sm border border-[var(--color-meza-primary)]/20">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>Live Sync Active</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-[var(--color-meza-surface)] rounded-sm p-5 border border-[var(--color-meza-border)] shadow-[0_4px_20px_rgb(0,0,0,0.02)] relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider">{stat.name}</p>
                <p className="text-3xl font-bold text-[var(--color-meza-text)] mt-1 tracking-tight">{stat.value}</p>
              </div>
              <div className={`p-2.5 rounded-sm border ${stat.color}`}>
                <stat.icon className="w-5 h-5" strokeWidth={2.5} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-bold">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md ${stat.trend === 'up' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : stat.trend === 'down' ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' : 'bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)]'}`}>
                {stat.trend === 'up' && <ArrowUpRight className="w-3 h-3 mr-0.5" />}
                {stat.trend === 'down' && <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {stat.change}
              </span>
              <span className="text-[var(--color-meza-muted)] ml-2 font-medium">vs previous period</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Chart & Top Items */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 7-Day Trend Chart */}
          <div className="bg-[var(--color-meza-surface)] rounded-sm shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-[var(--color-meza-border)] p-5">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-[var(--color-meza-text)] tracking-tight flex items-center">
                <TrendingUp className="w-4 h-4 text-[var(--color-meza-primary)] mr-2" /> 
                {timeframe === 'daily' ? '7-Day' : timeframe === 'weekly' ? '5-Week' : timeframe === 'monthly' ? '6-Month' : '5-Year'} Revenue Trend
              </h3>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.sevenDayTrend} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af', fontWeight: 600 }} tickFormatter={v => `₱${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#d97706" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Selling Items */}
          <div className="bg-[var(--color-meza-surface)] rounded-sm shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-[var(--color-meza-border)] overflow-hidden">
            <div className="p-5 border-b border-[var(--color-meza-border)] bg-[var(--color-meza-bg)]">
              <h3 className="font-bold text-[var(--color-meza-text)] tracking-tight flex items-center">
                <Flame className="w-4 h-4 text-[var(--color-warning)] mr-2" /> Top Selling Items ({timeframe === 'daily' ? '7 Days' : timeframe === 'weekly' ? '5 Weeks' : timeframe === 'monthly' ? '6 Months' : '5 Years'})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-meza-surface)] border-b border-gray-50 text-[var(--color-meza-muted)] text-[10px] font-bold uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-3">Menu Item</th>
                    <th className="px-6 py-3 text-right">Units Sold</th>
                    <th className="px-6 py-3 text-right">Revenue Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.topItems.map((item, i) => (
                    <tr key={item._id} className="hover:bg-[var(--color-meza-bg)]/50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${i===0 ? 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]' : i===1 ? 'bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)]' : i===2 ? 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]' : 'bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)]'}`}>
                            {i + 1}
                          </div>
                          <span className="font-bold text-[var(--color-meza-text)]">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-[var(--color-meza-muted)]">{item.quantity}</td>
                      <td className="px-6 py-3 text-right font-bold text-[var(--color-meza-text)]">₱{item.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  {data.topItems.length === 0 && (
                    <tr><td colSpan="3" className="px-6 py-8 text-center text-[var(--color-meza-muted)] text-sm font-medium">No sales data yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Operational Alerts */}
        <div className="space-y-6">
          
          {/* Active Shifts */}
          <div className="bg-[var(--color-meza-surface)] rounded-sm shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-[var(--color-meza-border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-meza-border)] flex items-center space-x-2 bg-[var(--color-meza-primary)]/10/30">
              <Users className="w-4 h-4 text-[var(--color-meza-primary)]" />
              <h3 className="font-bold text-blue-900 tracking-tight text-sm">Active Staff on Duty</h3>
            </div>
            <div className="p-2">
              {data.activeShifts.length > 0 ? (
                <div className="space-y-1">
                  {data.activeShifts.map((shift, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-sm hover:bg-[var(--color-meza-bg)] transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-meza-primary)]/20 text-[var(--color-meza-primary)] flex items-center justify-center font-bold text-xs">
                          {shift.staffName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-[var(--color-meza-text)] text-sm leading-tight">{shift.staffName}</p>
                          <p className="text-[10px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider">POS Register Active</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-0.5">Exp. Cash</p>
                        <p className="font-bold text-[var(--color-meza-text)] text-sm">₱{(shift.expectedCash || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-sm font-medium text-[var(--color-meza-muted)]">No active shifts right now.</p>
                </div>
              )}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-[var(--color-meza-surface)] rounded-sm shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-[var(--color-meza-border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-meza-border)] flex justify-between items-center bg-[var(--color-danger)]/10/30">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-[var(--color-danger)]" />
                <h3 className="font-bold text-red-900 tracking-tight text-sm">Low Stock Alerts</h3>
              </div>
              {data.lowStockItems.length > 0 && (
                <span className="bg-[var(--color-danger)]/20 text-[var(--color-danger)] text-[10px] font-bold px-2 py-0.5 rounded-md">{data.lowStockItems.length} Warnings</span>
              )}
            </div>
            <div className="p-2">
              {data.lowStockItems.length > 0 ? (
                <div className="space-y-1">
                  {data.lowStockItems.map(item => (
                    <div key={item._id} className="flex items-center justify-between p-3 rounded-sm hover:bg-[var(--color-meza-bg)] transition-colors group">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${item.stock <= 0 ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'}`}>
                          <PackageCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-[var(--color-meza-text)] text-sm leading-tight">{item.name}</p>
                          <p className="text-[10px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider">{item.type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded border text-xs font-bold ${item.stock <= 0 ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/30' : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/30'}`}>
                          {item.stock} left
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <PackageCheck className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-[var(--color-meza-text)]">All Stock Healthy</p>
                  <p className="text-xs font-medium text-[var(--color-meza-muted)] mt-1">No items require reordering right now.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
