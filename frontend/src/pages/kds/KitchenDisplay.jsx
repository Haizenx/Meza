import React, { useState, useEffect } from 'react';
import { ChefHat, Check, Clock, AlertCircle, GripVertical, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function KitchenDisplay() {
  const { token } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [columns, setColumns] = useState({
    pending: { id: 'pending', title: 'Pending', icon: AlertCircle, color: 'border-yellow-500/50', bg: 'bg-yellow-500/10' },
    preparing: { id: 'preparing', title: 'Preparing', icon: ChefHat, color: 'border-blue-500/50', bg: 'bg-blue-500/10' },
    ready: { id: 'ready', title: 'Ready to Serve', icon: Check, color: 'border-green-500/50', bg: 'bg-green-500/10' }
  });

  const fetchOrders = () => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/orders/kds/active`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
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
      try {
        const audio = new Audio('/bell.mp3');
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
        return filtered;
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
      // Optimistic update
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, fulfillmentStatus: newStatus } : o));
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/orders/${orderId}/kds`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fulfillmentStatus: newStatus })
      });
      if (!res.ok) {
        // Revert if failed
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
      fetchOrders();
    }
  };

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    updateStatus(draggableId, destination.droppableId);
  };

  const getTimeElapsed = (createdAt) => {
    const diff = Math.floor((new Date() - new Date(createdAt)) / 60000);
    return diff;
  };

  // Group orders
  const groupedOrders = {
    pending: orders.filter(o => o.fulfillmentStatus === 'pending'),
    preparing: orders.filter(o => o.fulfillmentStatus === 'preparing'),
    ready: orders.filter(o => o.fulfillmentStatus === 'ready')
  };

  const OrderCard = ({ order, index }) => {
    const elapsed = getTimeElapsed(order.createdAt);
    const isOverdue = elapsed > 10;
    
    return (
      <Draggable draggableId={order._id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`mb-4 bg-gray-800 rounded-xl overflow-hidden shadow-xl border border-gray-700/50 transition-all ${snapshot.isDragging ? 'ring-2 ring-meza-primary scale-[1.02] rotate-1' : ''} ${isOverdue ? 'ring-1 ring-red-500/50' : ''}`}
          >
            <div className={`p-3 flex justify-between items-center border-b border-gray-700/50 ${isOverdue ? 'bg-red-500/10' : 'bg-gray-800/80'}`}>
              <div className="flex items-center space-x-3">
                <GripVertical className="w-5 h-5 text-gray-500 cursor-grab" />
                <span className="font-black text-white text-lg tracking-wider">#{order._id.slice(-4).toUpperCase()}</span>
                {order.tableNumber && (
                  <span className="bg-meza-primary/20 text-meza-primary border border-meza-primary/30 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                    Table {order.tableNumber}
                  </span>
                )}
                {order.customerName && (
                  <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                    {order.customerName}
                  </span>
                )}
              </div>
              <div className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-bold shadow-inner ${isOverdue ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-700 text-gray-300'}`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{elapsed}m</span>
              </div>
            </div>
            
            <div className="p-4 bg-gray-800/50">
              <ul className="space-y-3">
                {order.items.map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-3 group">
                    <span className="font-black text-meza-primary text-xl w-8 text-right bg-gray-900/50 py-1 rounded-lg border border-gray-700/50">{item.quantity}x</span>
                    <div className="flex flex-col flex-1 pt-1">
                      <span className="font-bold text-gray-100 text-lg leading-tight group-hover:text-white transition-colors">{item.nameAtSale}</span>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="text-sm text-gray-400 font-medium mt-1 leading-tight flex flex-wrap gap-1">
                          {item.modifiers.map((m, i) => (
                            <span key={i} className="bg-gray-700/50 px-2 py-0.5 rounded-md border border-gray-600/50">+ {m.name}</span>
                          ))}
                        </div>
                      )}
                      {item.note && (
                        <div className="mt-2 bg-red-900/20 border border-red-500/20 p-2 rounded-lg">
                          <span className="text-sm font-semibold text-red-400 italic">"{item.note}"</span>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Action Button for non-drag users */}
            <div className="flex bg-gray-900/50 divide-x divide-gray-700/50 border-t border-gray-700/50">
               {order.fulfillmentStatus === 'pending' && (
                <button onClick={() => updateStatus(order._id, 'preparing')} className="flex-1 py-3 text-sm font-bold text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-colors uppercase tracking-wider">Start Preparing</button>
               )}
               {order.fulfillmentStatus === 'preparing' && (
                <button onClick={() => updateStatus(order._id, 'ready')} className="flex-1 py-3 text-sm font-bold text-green-400 hover:bg-green-500/10 hover:text-green-300 transition-colors uppercase tracking-wider">Mark Ready</button>
               )}
               {order.fulfillmentStatus === 'ready' && (
                <button onClick={() => updateStatus(order._id, 'served')} className="flex-1 py-3 text-sm font-bold text-gray-400 hover:bg-gray-700/50 hover:text-white transition-colors uppercase tracking-wider">Mark Served</button>
               )}
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col font-sans text-gray-100 selection:bg-meza-primary/30 selection:text-white">
      {/* Premium Dark Header */}
      <header className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 p-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center space-x-4">
          <div className="bg-gradient-to-br from-meza-primary to-orange-500 p-2.5 rounded-xl shadow-lg shadow-meza-primary/20">
            <UtensilsCrossed className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">meza<span className="text-meza-primary">.</span> KDS</h1>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-0.5">Kitchen Display System</p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800 shadow-inner hidden md:flex">
            <button onClick={() => navigate('/cashier')} className="px-5 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-gray-200 transition-colors">Cashier</button>
            <button onClick={() => navigate('/table/Kiosk')} className="px-5 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-gray-200 transition-colors">Ordering</button>
            <button className="px-5 py-2 rounded-lg bg-gray-800 shadow-sm border border-gray-700 text-sm font-bold text-white">KDS</button>
          </div>
          <div className="flex items-center space-x-2 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-full text-sm font-bold text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
            <span>Live Sync</span>
          </div>
        </div>
      </header>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 p-6 flex gap-6 overflow-x-auto overflow-y-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gray-800/20 via-transparent to-transparent">
          {Object.values(columns).map(col => {
            const items = groupedOrders[col.id];
            const Icon = col.icon;
            
            return (
              <div key={col.id} className="flex-1 min-w-[350px] max-w-lg flex flex-col">
                {/* Column Header */}
                <div className={`mb-4 p-4 rounded-2xl bg-gray-900/60 backdrop-blur-md border border-gray-800 shadow-lg flex items-center justify-between`}>
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${col.bg} border ${col.color}`}>
                      <Icon className="w-5 h-5 text-gray-300" />
                    </div>
                    <h2 className="font-black text-gray-200 uppercase tracking-widest text-sm">{col.title}</h2>
                  </div>
                  <span className="bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1 rounded-full text-xs font-black">
                    {items.length}
                  </span>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-2xl p-2 transition-colors duration-200 overflow-y-auto ${snapshot.isDraggingOver ? 'bg-gray-800/40 border-2 border-dashed border-gray-600' : 'bg-transparent border-2 border-transparent'}`}
                    >
                      {items.map((order, idx) => (
                        <OrderCard key={order._id} order={order} index={idx} />
                      ))}
                      {provided.placeholder}
                      {items.length === 0 && !snapshot.isDraggingOver && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                          <Icon className="w-12 h-12 mb-3" />
                          <p className="font-bold text-sm uppercase tracking-widest">No Orders</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
