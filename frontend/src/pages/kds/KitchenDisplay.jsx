import React, { useState, useEffect } from 'react';
import { ChefHat, Check, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useNavigate } from 'react-router-dom';

export default function KitchenDisplay() {
  const { token, user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);

  const fetchOrders = () => {
    fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/orders/kds/active`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setOrders(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (token) fetchOrders();
  }, [token]);

  useEffect(() => {
    if (!socket) return;
    
    const handleNewOrder = (order) => {
      // Audio cue
      try {
        const audio = new Audio('/bell.mp3'); // Assuming standard notification sound exists
        audio.play().catch(e=>console.log(e));
      } catch(e){}
      
      setOrders(prev => [...prev, order].sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt)));
    };

    const handleUpdate = (updatedOrder) => {
      setOrders(prev => {
        const filtered = prev.filter(o => o._id !== updatedOrder._id);
        if (['pending', 'preparing', 'ready'].includes(updatedOrder.fulfillmentStatus)) {
          return [...filtered, updatedOrder].sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
        return filtered; // If served, remove from KDS
      });
    };

    socket.on('kds:new_order', handleNewOrder);
    socket.on('kds:update_status', handleUpdate);

    return () => {
      socket.off('kds:new_order', handleNewOrder);
      socket.off('kds:update_status', handleUpdate);
    };
  }, [socket]);

  const updateStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}`}/api/orders/${orderId}/kds`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fulfillmentStatus: newStatus })
      });
      if (res.ok) {
        // Optimistic UI update handled by socket broadcast
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Group orders by status
  const pending = orders.filter(o => o.fulfillmentStatus === 'pending');
  const preparing = orders.filter(o => o.fulfillmentStatus === 'preparing');
  const ready = orders.filter(o => o.fulfillmentStatus === 'ready');

  const getTimeElapsed = (createdAt) => {
    const diff = Math.floor((new Date() - new Date(createdAt)) / 60000);
    return diff;
  };

  const OrderCard = ({ order, currentStatus }) => {
    const elapsed = getTimeElapsed(order.createdAt);
    const isOverdue = elapsed > 10; // >10 mins is overdue

    return (
      <div 
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('orderId', order._id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        className={`bg-white rounded-xl shadow-md border-t-4 overflow-hidden flex flex-col h-full cursor-grab active:cursor-grabbing transition-transform hover:-translate-y-1 ${isOverdue ? 'border-red-500' : 'border-meza-primary'}`}
      >
        <div className="p-3 bg-gray-50 flex justify-between items-center border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <span className="font-black text-gray-800 text-lg">#{order._id.slice(-4).toUpperCase()}</span>
            {order.tableNumber && (
              <span className="bg-meza-text text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                Table {order.tableNumber}
              </span>
            )}
          </div>
          <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-bold ${isOverdue ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-gray-200 text-gray-600'}`}>
            <Clock className="w-3 h-3" />
            <span>{elapsed}m</span>
          </div>
        </div>
        
        <div className="p-4 flex-1">
          <ul className="space-y-3">
            {order.items.map((item, idx) => (
              <li key={idx} className="flex items-start space-x-3">
                <span className="font-black text-meza-primary text-lg w-6 text-right">{item.quantity}x</span>
                <div className="flex flex-col">
                  <span className="font-bold text-gray-800 text-lg leading-tight">{item.nameAtSale}</span>
                  {item.note && <span className="text-sm font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded mt-1 break-words">"{item.note}"</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-3 bg-gray-50 border-t border-gray-100">
          {currentStatus === 'pending' && (
            <button 
              onClick={() => updateStatus(order._id, 'preparing')}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors text-lg"
            >
              Start Preparing
            </button>
          )}
          {currentStatus === 'preparing' && (
            <button 
              onClick={() => updateStatus(order._id, 'ready')}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors text-lg"
            >
              Mark Ready
            </button>
          )}
          {currentStatus === 'ready' && (
            <button 
              onClick={() => updateStatus(order._id, 'served')}
              className="w-full py-3 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg transition-colors text-lg"
            >
              Mark Served (Clear)
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-gray-900 text-white p-4 flex justify-between items-center shadow-lg sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-meza-primary p-2 rounded-lg">
            <ChefHat className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">KDS <span className="font-medium text-gray-400">| Meza Cafe</span></h1>
            <p className="text-xs text-gray-400">Barista View</p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          {/* App Switcher */}
          <div className="flex bg-gray-800 p-1 rounded-xl border border-gray-700 shadow-inner hidden md:flex">
            <button onClick={() => navigate('/cashier')} className="px-4 py-1.5 rounded-lg text-sm font-bold text-gray-400 hover:text-gray-200 tap-scale">Cashier</button>
            <button onClick={() => navigate('/table/Kiosk')} className="px-4 py-1.5 rounded-lg text-sm font-bold text-gray-400 hover:text-gray-200 tap-scale">Ordering</button>
            <button className="px-4 py-1.5 rounded-lg bg-gray-700 shadow-sm text-sm font-bold text-white tap-scale">KDS</button>
          </div>

          <div className="flex items-center space-x-2 bg-gray-800 px-3 py-1.5 rounded-full text-sm font-bold">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Live Sync</span>
          </div>
        </div>
      </header>

      {/* Main Board */}
      <div className="flex-1 p-4 flex gap-4 overflow-hidden">
        
        {/* Pending Column */}
        <div 
          className="flex-1 flex flex-col bg-gray-200/50 rounded-2xl overflow-hidden border border-gray-200 transition-colors duration-200"
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-gray-300'); }}
          onDragLeave={(e) => { e.currentTarget.classList.remove('bg-gray-300'); }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('bg-gray-300');
            const orderId = e.dataTransfer.getData('orderId');
            if (orderId) updateStatus(orderId, 'pending');
          }}
        >
          <div className="bg-gray-300/50 p-3 text-center border-b border-gray-300">
            <h2 className="font-black text-gray-700 uppercase tracking-widest text-sm flex justify-center items-center">
              <AlertCircle className="w-4 h-4 mr-2" /> Pending ({pending.length})
            </h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {pending.map(o => <OrderCard key={o._id} order={o} currentStatus="pending" />)}
            {pending.length === 0 && <div className="h-full flex items-center justify-center text-gray-400 font-bold">No pending orders</div>}
          </div>
        </div>

        {/* Preparing Column */}
        <div 
          className="flex-1 flex flex-col bg-blue-50/50 rounded-2xl overflow-hidden border border-blue-100 transition-colors duration-200"
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-blue-100'); }}
          onDragLeave={(e) => { e.currentTarget.classList.remove('bg-blue-100'); }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('bg-blue-100');
            const orderId = e.dataTransfer.getData('orderId');
            if (orderId) updateStatus(orderId, 'preparing');
          }}
        >
          <div className="bg-blue-100/50 p-3 text-center border-b border-blue-200">
            <h2 className="font-black text-blue-800 uppercase tracking-widest text-sm flex justify-center items-center">
              <ChefHat className="w-4 h-4 mr-2" /> Preparing ({preparing.length})
            </h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {preparing.map(o => <OrderCard key={o._id} order={o} currentStatus="preparing" />)}
            {preparing.length === 0 && <div className="h-full flex items-center justify-center text-blue-300 font-bold">No active preparation</div>}
          </div>
        </div>

        {/* Ready Column */}
        <div 
          className="flex-1 flex flex-col bg-green-50/50 rounded-2xl overflow-hidden border border-green-100 transition-colors duration-200"
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-green-100'); }}
          onDragLeave={(e) => { e.currentTarget.classList.remove('bg-green-100'); }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('bg-green-100');
            const orderId = e.dataTransfer.getData('orderId');
            if (orderId) updateStatus(orderId, 'ready');
          }}
        >
          <div className="bg-green-100/50 p-3 text-center border-b border-green-200">
            <h2 className="font-black text-green-800 uppercase tracking-widest text-sm flex justify-center items-center">
              <Check className="w-4 h-4 mr-2" /> Ready to Serve ({ready.length})
            </h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {ready.map(o => <OrderCard key={o._id} order={o} currentStatus="ready" />)}
            {ready.length === 0 && <div className="h-full flex items-center justify-center text-green-300 font-bold">No orders ready</div>}
          </div>
        </div>

      </div>
    </div>
  );
}
