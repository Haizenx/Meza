import { API_URL } from '../../config';
import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Download, X, Activity, CreditCard, Banknote } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export default function ShiftHistory() {
  const { token } = useAuth();
  const socket = useSocket();
  const [shifts, setShifts] = useState([]);
  
  // Analytics Modal State
  const [selectedShift, setSelectedShift] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const fetchShifts = () => {
    fetch(`${API_URL}/api/shifts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
      .then(data => {
        if (Array.isArray(data)) setShifts(data);
        else setShifts([]);
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (token) fetchShifts();
  }, [token]);

  // Real-time socket sync
  useEffect(() => {
    if (!socket) return;
    
    const handleShiftUpdated = () => {
      fetchShifts();
      // If modal is open, we could also refresh the analytics, but simpler to just fetchShifts
    };

    socket.on('shift:updated', handleShiftUpdated);
    return () => {
      socket.off('shift:updated', handleShiftUpdated);
    };
  }, [socket, token]);

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Ongoing';
    return new Date(dateString).toLocaleString('en-PH', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const handleOpenAnalytics = async (shift) => {
    setSelectedShift(shift);
    setLoadingAnalytics(true);
    setAnalyticsData(null);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || `${API_URL}`}/api/shifts/${shift._id}/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const downloadCSV = () => {
    if (!analyticsData) return;
    const { shift, analytics } = analyticsData;
    
    let csv = `Shift Analytics Report\n`;
    csv += `Staff,${shift.staff?.name || 'Unknown'}\n`;
    csv += `Start Time,${formatDateTime(shift.startTime)}\n`;
    csv += `End Time,${formatDateTime(shift.endTime)}\n`;
    csv += `Status,${shift.status}\n\n`;
    
    csv += `Financial Summary\n`;
    csv += `Total Revenue,${analytics.totalSales.toFixed(2)}\n`;
    csv += `Total Orders,${analytics.totalOrders}\n`;
    csv += `Cash Payments,${analytics.cashSales.toFixed(2)}\n`;
    csv += `Card Payments,${analytics.cardSales.toFixed(2)}\n`;
    csv += `GCash Payments,${analytics.gcashSales.toFixed(2)}\n\n`;
    
    csv += `Register Tally\n`;
    csv += `Starting Cash Float,${shift.startingCash.toFixed(2)}\n`;
    csv += `Expected Cash in Drawer,${shift.expectedCash ? shift.expectedCash.toFixed(2) : 'Tallying'}\n`;
    csv += `Actual Cash Counted,${shift.actualCash ? shift.actualCash.toFixed(2) : 'Tallying'}\n`;
    const diff = shift.status === 'closed' ? shift.actualCash - shift.expectedCash : 0;
    csv += `Discrepancy,${diff.toFixed(2)}\n\n`;

    csv += `Items Sold\n`;
    csv += `Item Name,Quantity Sold,Revenue Generated\n`;
    analytics.topItems.forEach(item => {
      csv += `"${item.name}",${item.qty},${item.revenue.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Shift_Report_${shift._id}.csv`);
    a.click();
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-meza-text)] tracking-tight">Shift Tracking</h2>
          <p className="text-[var(--color-meza-muted)] text-sm mt-1">Real-time live cash tracking, register discrepancies, and detailed shift analytics.</p>
        </div>
      </div>

      <div className="bg-[var(--color-meza-surface)] rounded-sm shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-[var(--color-meza-border)] overflow-hidden">
        <div className="p-5 border-b border-[var(--color-meza-border)] flex items-center justify-between bg-[var(--color-meza-bg)]">
          <h3 className="font-bold text-[var(--color-meza-text)] text-sm uppercase tracking-wider">Historical Log</h3>
          <div className="flex items-center space-x-2 text-xs font-semibold text-[var(--color-meza-primary)] bg-[var(--color-meza-primary)]/10 px-2.5 py-1 rounded-md border border-[var(--color-meza-primary)]/20">
            <Activity className="w-3 h-3 animate-pulse" />
            <span>Live Sync Active</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-meza-surface)] border-b border-[var(--color-meza-border)] text-[var(--color-meza-muted)] text-[11px] font-bold uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Timeframe</th>
                <th className="px-6 py-4">Cashier</th>
                <th className="px-6 py-4">Starting Money</th>
                <th className="px-6 py-4">Expected Cash</th>
                <th className="px-6 py-4">Actual Drawer</th>
                <th className="px-6 py-4 text-right">Discrepancy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Array.isArray(shifts) && shifts.length > 0 ? shifts.map((shift) => {
                const isClosed = shift.status === 'closed';
                const expected = shift.expectedCash || 0;
                const actual = shift.actualCash || 0;
                const diff = isClosed ? actual - expected : 0;
                const hasDiscrepancy = Math.abs(diff) > 1; // Allow 1 peso wiggle room

                return (
                  <tr 
                    key={shift._id} 
                    className="hover:bg-[var(--color-meza-bg)] transition-colors cursor-pointer group"
                    onClick={() => handleOpenAnalytics(shift)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-start space-x-2">
                        <div className="flex flex-col items-center mt-1">
                          <div className="w-2 h-2 rounded-full bg-[var(--color-success)]/100"></div>
                          <div className="w-0.5 h-3 bg-[var(--color-meza-border)] my-0.5"></div>
                          <div className={`w-2 h-2 rounded-full ${isClosed ? 'bg-[var(--color-danger)]/100' : 'bg-gray-300 animate-pulse'}`}></div>
                        </div>
                        <div className="flex flex-col text-xs font-medium">
                          <span className="text-[var(--color-meza-text)]">{formatDateTime(shift.startTime)}</span>
                          <span className={`${isClosed ? 'text-[var(--color-meza-muted)]' : 'text-[var(--color-meza-primary)]'} mt-1`}>{formatDateTime(shift.endTime)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-[var(--color-meza-text)]">{shift.staff?.name || 'Unknown'}</span>
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                        isClosed ? 'bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)] border-[var(--color-meza-border)]' : 'bg-[var(--color-meza-primary)]/10 text-[var(--color-meza-primary)] border-[var(--color-meza-primary)]/20'
                      }`}>
                        {shift.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-[var(--color-meza-muted)]">
                      ₱{(shift.startingCash || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 font-medium text-[var(--color-meza-muted)]">
                      {isClosed ? `₱${expected.toFixed(2)}` : 'Tallying...'}
                    </td>
                    <td className="px-6 py-4 font-bold text-[var(--color-meza-text)]">
                      {isClosed ? `₱${actual.toFixed(2)}` : 'Register Open'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!isClosed ? (
                        <span className="text-[var(--color-meza-muted)] font-medium italic">Pending</span>
                      ) : hasDiscrepancy ? (
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border ${
                          diff < 0 ? 'bg-[var(--color-danger)]/10/80 text-[var(--color-danger)] border-[var(--color-danger)]/30/60' : 'bg-[var(--color-warning)]/10/80 text-[var(--color-warning)] border-[var(--color-warning)]/30/60'
                        }`}>
                          <AlertTriangle className="w-3 h-3" strokeWidth={3} />
                          <span>{diff < 0 ? 'Short' : 'Overage'} ₱{Math.abs(diff).toFixed(2)}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border bg-[var(--color-success)]/10/80 text-[var(--color-success)] border-[var(--color-success)]/30/60">
                          <CheckCircle className="w-3 h-3" strokeWidth={3} />
                          <span>Exact Match</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-[var(--color-meza-muted)] font-medium text-sm">
                    No shift history available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analytics Modal */}
      {selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-meza-text/40 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-meza-surface)] rounded-sm w-full max-w-2xl  overflow-hidden border border-[var(--color-meza-border)] transform transition-all flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-[var(--color-meza-border)] bg-[var(--color-meza-bg)]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-meza-primary)]/10 text-[var(--color-meza-primary)] flex items-center justify-center font-bold">
                  {selectedShift.staff?.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="font-bold text-[var(--color-meza-text)] text-lg leading-tight">Shift Analytics</h3>
                  <p className="text-xs text-[var(--color-meza-muted)] font-medium">{formatDateTime(selectedShift.startTime)} — {formatDateTime(selectedShift.endTime)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={downloadCSV}
                  disabled={loadingAnalytics || !analyticsData}
                  className="px-3 py-1.5 bg-[var(--color-meza-bg)] hover:bg-[var(--color-meza-border)] text-[var(--color-meza-text)] rounded-sm text-sm font-bold flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>
                <button onClick={() => setSelectedShift(null)} className="p-1.5 text-[var(--color-meza-muted)] hover:text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-bg)] rounded-sm transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              {loadingAnalytics ? (
                <div className="py-12 flex justify-center text-[var(--color-meza-muted)]">
                  <Activity className="w-8 h-8 animate-spin" />
                </div>
              ) : analyticsData ? (
                <div className="space-y-6">
                  
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-[var(--color-meza-bg)] rounded-sm border border-[var(--color-meza-border)] text-center">
                      <div className="text-[10px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1">Starting Money</div>
                      <div className="text-xl font-bold text-[var(--color-meza-text)]">₱{(analyticsData.shift.startingCash || 0).toFixed(2)}</div>
                    </div>
                    <div className="p-4 bg-[var(--color-success)]/10 rounded-sm border border-green-100 text-center">
                      <div className="text-[10px] font-bold text-[var(--color-success)] uppercase tracking-wider mb-1">Total Revenue</div>
                      <div className="text-xl font-bold text-[var(--color-success)]">₱{analyticsData.analytics.totalSales.toFixed(2)}</div>
                    </div>
                    <div className="p-4 bg-[var(--color-meza-primary)]/10 rounded-sm border border-blue-100 text-center">
                      <div className="text-[10px] font-bold text-[var(--color-meza-primary)] uppercase tracking-wider mb-1">Items Sold</div>
                      <div className="text-xl font-bold text-[var(--color-meza-primary)]">{analyticsData.analytics.topItems.reduce((acc, curr) => acc + curr.qty, 0)} items</div>
                    </div>
                    <div className="p-4 bg-[var(--color-warning)]/10 rounded-sm border border-yellow-100 text-center">
                      <div className="text-[10px] font-bold text-[var(--color-warning)] uppercase tracking-wider mb-1">Ending Cash</div>
                      <div className="text-xl font-bold text-[var(--color-warning)]">₱{analyticsData.shift.actualCash ? analyticsData.shift.actualCash.toFixed(2) : '--'}</div>
                    </div>
                  </div>

                  {/* Payment Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-3">Payment Methods</h4>
                    <div className="bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] rounded-sm p-4 flex justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-sm bg-[var(--color-success)]/10 text-[var(--color-success)] flex items-center justify-center"><Banknote className="w-4 h-4" /></div>
                        <div>
                          <p className="text-sm font-bold text-[var(--color-meza-text)]">Cash</p>
                          <p className="text-xs text-[var(--color-meza-muted)]">₱{analyticsData.analytics.cashSales.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-sm bg-[var(--color-meza-primary)]/10 text-[var(--color-meza-primary)] flex items-center justify-center"><CreditCard className="w-4 h-4" /></div>
                        <div>
                          <p className="text-sm font-bold text-[var(--color-meza-text)]">Card</p>
                          <p className="text-xs text-[var(--color-meza-muted)]">₱{analyticsData.analytics.cardSales.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-sm bg-indigo-50 text-indigo-600 flex items-center justify-center"><span className="font-bold text-xs">G</span></div>
                        <div>
                          <p className="text-sm font-bold text-[var(--color-meza-text)]">GCash</p>
                          <p className="text-xs text-[var(--color-meza-muted)]">₱{analyticsData.analytics.gcashSales.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Items Table */}
                  <div>
                    <h4 className="text-xs font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-3">Items Sold</h4>
                    <div className="border border-[var(--color-meza-border)] rounded-sm overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)] text-[10px] uppercase font-bold">
                          <tr>
                            <th className="px-4 py-2">Item Name</th>
                            <th className="px-4 py-2 text-right">Qty</th>
                            <th className="px-4 py-2 text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {analyticsData.analytics.topItems.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-3 font-semibold text-[var(--color-meza-text)]">{item.name}</td>
                              <td className="px-4 py-3 text-right font-medium text-[var(--color-meza-muted)]">{item.qty}</td>
                              <td className="px-4 py-3 text-right font-bold text-[var(--color-meza-text)]">₱{item.revenue.toFixed(2)}</td>
                            </tr>
                          ))}
                          {analyticsData.analytics.topItems.length === 0 && (
                            <tr><td colSpan="3" className="px-4 py-6 text-center text-[var(--color-meza-muted)]">No items sold during this shift.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Transaction History */}
                  <div>
                    <h4 className="text-xs font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-3">Transaction History</h4>
                    <div className="border border-[var(--color-meza-border)] rounded-sm overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)] text-[10px] uppercase font-bold">
                          <tr>
                            <th className="px-4 py-2">Time</th>
                            <th className="px-4 py-2">Order ID</th>
                            <th className="px-4 py-2">Items</th>
                            <th className="px-4 py-2 text-right">Method</th>
                            <th className="px-4 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {analyticsData.analytics.orders && analyticsData.analytics.orders.length > 0 ? (
                            analyticsData.analytics.orders.map(order => (
                              <tr key={order._id} className="hover:bg-[var(--color-meza-bg)]">
                                <td className="px-4 py-3 font-medium text-[var(--color-meza-muted)]">{new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-[var(--color-meza-text)]">#{order._id.slice(-4).toUpperCase()}</div>
                                  {order.customerName && <div className="text-xs text-[var(--color-meza-muted)] font-normal">{order.customerName}</div>}
                                </td>
                                <td className="px-4 py-3 text-[var(--color-meza-muted)] text-xs">
                                  {order.items.map(i => (
                                    <div key={i._id || i.menuItemId}>
                                      {i.quantity}x {i.nameAtSale} - ₱{((i.priceAtSale || 0) * (i.quantity || 1)).toFixed(2)}
                                    </div>
                                  ))}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${order.paymentMethod === 'cash' ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]' : 'bg-[var(--color-meza-primary)]/20 text-[var(--color-meza-primary)]'}`}>
                                    {order.paymentMethod}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-[var(--color-meza-text)]">₱{order.total.toFixed(2)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan="5" className="px-4 py-6 text-center text-[var(--color-meza-muted)]">No transactions recorded.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
