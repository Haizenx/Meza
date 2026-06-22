import React, { useState, useEffect } from 'react';
import { ChefHat, Check, Clock, AlertCircle, GripVertical, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getPendingOrders, updatePendingOrder } from '../../utils/idb';

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

  const fetchOrders = async () => {
    try {
      let onlineOrders = [];
      if (navigator.onLine) {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/orders/kds/active`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) onlineOrders = await res.json();
      }

      const offlineOrders = await getPendingOrders();
      const offlineMapped = offlineOrders.map(o => ({
        ...o,
        _id: o.localUUID,
        createdAt: o.createdAtLocal || new Date().toISOString(),
        isOffline: true
      })).filter(o => ['pending', 'preparing', 'ready'].includes(o.fulfillmentStatus));

      setOrders([...onlineOrders, ...offlineMapped].sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt)));
    } catch (e) {
      console.error(e);
      // Fallback to offline only
      const offlineOrders = await getPendingOrders();
      const offlineMapped = offlineOrders.map(o => ({
        ...o,
        _id: o.localUUID,
        createdAt: o.createdAtLocal || new Date().toISOString(),
        isOffline: true
      })).filter(o => ['pending', 'preparing', 'ready'].includes(o.fulfillmentStatus));
      
      setOrders(offlineMapped.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt)));
    }
  };

  useEffect(() => {
    if (token) fetchOrders();

    const syncChannel = new BroadcastChannel('meza-offline-sync');
    syncChannel.onmessage = (event) => {
      if (event.data.type === 'NEW_OFFLINE_ORDER') {
        try {
          const audio = new Audio('/bell.mp3');
          audio.play().catch(e=>console.log(e));
        } catch(e){}
        fetchOrders();
      }
      if (event.data.type === 'SYNC_COMPLETE' || event.data.type === 'KDS_OFFLINE_UPDATE') {
        fetchOrders();
      }
    };
    return () => syncChannel.close();
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
      
      const orderToUpdate = orders.find(o => o._id === orderId);
      if (orderToUpdate?.isOffline) {
        await updatePendingOrder(orderId, { fulfillmentStatus: newStatus });
        const syncChannel = new BroadcastChannel('meza-offline-sync');
        syncChannel.postMessage({ type: 'KDS_OFFLINE_UPDATE' });
        syncChannel.close();
        return;
      }

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
            className={`mb-4 bg-white rounded-2xl overflow-hidden shadow-[0_2px_15px_rgb(0,0,0,0.04)] border transition-all ${snapshot.isDragging ? 'ring-4 ring-meza-primary/30 scale-[1.02] rotate-1 border-meza-primary' : 'border-gray-100'} ${isOverdue && !snapshot.isDragging ? 'ring-2 ring-red-500/50 border-red-200' : ''}`}
          >
            <div className={`p-3.5 flex justify-between items-center border-b ${isOverdue ? 'bg-red-50 border-red-100' : 'bg-gray-50/50 border-gray-100'}`}>
              <div className="flex items-center space-x-3">
                <GripVertical className="w-5 h-5 text-gray-300 cursor-grab" />
                <span className="font-black text-meza-text text-lg tracking-wider">#{order._id.slice(-4).toUpperCase()}</span>
                {order.tableNumber && (
                  <span className="bg-meza-primary/10 text-meza-primary border border-meza-primary/20 px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-widest">
                    Table {order.tableNumber}
                  </span>
                )}
                {order.customerName && (
                  <span className="bg-orange-100 text-orange-700 border border-orange-200 px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-widest">
                    {order.customerName}
                  </span>
                )}
              </div>
              <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${isOverdue ? 'bg-red-500 text-white animate-pulse shadow-md' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{elapsed}m</span>
              </div>
            </div>
            
            <div className="p-4 bg-white">
              <ul className="space-y-4">
                {order.items.map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-3 group">
                    <span className="font-black text-meza-primary text-xl w-8 text-right bg-meza-primary/5 py-1 rounded-xl border border-meza-primary/10">{item.quantity}x</span>
                    <div className="flex flex-col flex-1 pt-1">
                      <span className="font-bold text-meza-text text-lg leading-tight transition-colors">{item.nameAtSale}</span>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {item.modifiers.map((m, i) => (
                            <span key={i} className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100 text-[11px] font-bold uppercase tracking-wider leading-none shadow-sm">+ {m.name}</span>
                          ))}
                        </div>
                      )}
                      {item.note && (
                        <div className="mt-2 bg-red-50 border border-red-100 p-2.5 rounded-xl">
                          <span className="text-sm font-bold text-red-600 italic">Note: "{item.note}"</span>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Action Button for non-drag users */}
            <div className="flex bg-gray-50 divide-x divide-gray-100 border-t border-gray-100">
               {order.fulfillmentStatus === 'pending' && (
                <button onClick={() => updateStatus(order._id, 'preparing')} className="flex-1 py-3.5 text-xs font-black text-blue-600 hover:bg-blue-50 transition-colors uppercase tracking-widest">Start Preparing</button>
               )}
               {order.fulfillmentStatus === 'preparing' && (
                <button onClick={() => updateStatus(order._id, 'ready')} className="flex-1 py-3.5 text-xs font-black text-green-600 hover:bg-green-50 transition-colors uppercase tracking-widest">Mark Ready</button>
               )}
               {order.fulfillmentStatus === 'ready' && (
                <button onClick={() => updateStatus(order._id, 'served')} className="flex-1 py-3.5 text-xs font-black text-gray-500 hover:bg-gray-200 transition-colors uppercase tracking-widest">Mark Served</button>
               )}
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  return (
    <div className="min-h-screen bg-[#f4f1eb] flex flex-col font-sans text-meza-text selection:bg-meza-primary/30 selection:text-meza-text">
      {/* Premium Light Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="bg-gradient-to-br from-meza-primary to-orange-500 p-2.5 rounded-xl shadow-lg shadow-meza-primary/20">
            <UtensilsCrossed className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-meza-text">meza<span className="text-meza-primary">.</span> KDS</h1>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">Kitchen Display System</p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner hidden md:flex">
            <button onClick={() => navigate('/cashier')} className="px-5 py-2 rounded-lg text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Cashier</button>
            <button onClick={() => navigate('/table/Kiosk')} className="px-5 py-2 rounded-lg text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Ordering</button>
            <button className="px-5 py-2 rounded-lg bg-white shadow-sm border border-gray-200 text-sm font-black text-meza-text">KDS</button>
          </div>
          <div className="flex items-center space-x-2 bg-green-50 border border-green-200 px-4 py-2 rounded-full text-sm font-bold text-green-700 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
            <span>Live Sync</span>
          </div>
        </div>
      </header>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 p-6 flex gap-6 overflow-x-auto overflow-y-hidden">
          {Object.values(columns).map(col => {
            const items = groupedOrders[col.id];
            const Icon = col.icon;
            
            return (
              <div key={col.id} className="flex-1 min-w-[350px] max-w-lg flex flex-col">
                {/* Column Header */}
                <div className={`mb-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-between`}>
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${col.bg} border ${col.color}`}>
                      <Icon className={`w-5 h-5 ${col.id === 'pending' ? 'text-yellow-600' : col.id === 'preparing' ? 'text-blue-600' : 'text-green-600'}`} />
                    </div>
                    <h2 className="font-black text-meza-text uppercase tracking-widest text-sm">{col.title}</h2>
                  </div>
                  <span className="bg-gray-100 border border-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-black">
                    {items.length}
                  </span>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-2xl p-2 transition-colors duration-200 overflow-y-auto ${snapshot.isDraggingOver ? 'bg-meza-primary/5 border-2 border-dashed border-meza-primary/30' : 'bg-transparent border-2 border-transparent'}`}
                    >
                      {items.map((order, idx) => (
                        <OrderCard key={order._id} order={order} index={idx} />
                      ))}
                      {provided.placeholder}
                      {items.length === 0 && !snapshot.isDraggingOver && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-70">
                          <Icon className="w-12 h-12 mb-3 text-gray-300" />
                          <p className="font-black text-sm uppercase tracking-widest text-gray-400">No Orders</p>
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
