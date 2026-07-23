import { API_URL } from '../../config';
import { useState, useEffect } from 'react';
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
    pending: { id: 'pending', title: 'Pending', icon: AlertCircle, color: 'border-yellow-500/50', bg: 'bg-[var(--color-warning)]/100/10' },
    preparing: { id: 'preparing', title: 'Preparing', icon: ChefHat, color: 'border-[var(--color-meza-primary)]/50', bg: 'bg-[var(--color-meza-primary)]/100/10' },
    ready: { id: 'ready', title: 'Ready to Serve', icon: Check, color: 'border-green-500/50', bg: 'bg-[var(--color-success)]/100/10' }
  });

  const fetchOrders = async () => {
    try {
      let onlineOrders = [];
      if (navigator.onLine) {
        const res = await fetch(`${API_URL}/api/orders/kds/active`, {
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

      const res = await fetch(`${API_URL}/api/orders/${orderId}/kds`, {
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
            className={`mb-4 bg-[var(--color-meza-surface)] rounded-sm overflow-hidden shadow-[0_2px_15px_rgb(0,0,0,0.04)] border transition-all ${snapshot.isDragging ? 'ring-4 ring-[var(--color-meza-primary)]/30 scale-[1.02] rotate-1 border-[var(--color-meza-primary)]' : 'border-[var(--color-meza-border)]'} ${isOverdue && !snapshot.isDragging ? 'ring-2 ring-red-500/50 border-[var(--color-danger)]/30' : ''}`}
          >
            <div className={`p-3.5 flex justify-between items-center border-b ${isOverdue ? 'bg-[var(--color-danger)]/10 border-red-100' : 'bg-[var(--color-meza-bg)]/50 border-[var(--color-meza-border)]'}`}>
              <div className="flex items-center space-x-3">
                <GripVertical className="w-5 h-5 text-[var(--color-meza-muted)] cursor-grab" />
                <span className="font-bold text-[var(--color-meza-text)] text-lg tracking-wider">#{order._id.slice(-4).toUpperCase()}</span>
                {order.tableNumber && (
                  <span className="bg-[var(--color-meza-primary)]/10 text-[var(--color-meza-primary)] border border-[var(--color-meza-primary)]/20 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-widest">
                    Table {order.tableNumber}
                  </span>
                )}
                {order.customerName && (
                  <span className="bg-orange-100 text-orange-800 border border-orange-300 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-widest">
                    {order.customerName}
                  </span>
                )}
              </div>
              <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-sm text-xs font-bold ${isOverdue ? 'bg-[var(--color-danger)]/100 text-white animate-pulse ' : 'bg-[var(--color-meza-bg)] text-[var(--color-meza-muted)] border border-[var(--color-meza-border)]'}`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{elapsed}m</span>
              </div>
            </div>
            
            <div className="p-4 bg-[var(--color-meza-surface)]">
              <ul className="space-y-4">
                {order.items.map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-3 group">
                    <span className="font-bold text-[var(--color-meza-primary)] text-xl w-8 text-right bg-[var(--color-meza-primary)]/5 py-1 rounded-sm border border-[var(--color-meza-primary)]/10">{item.quantity}x</span>
                    <div className="flex flex-col flex-1 pt-1">
                      <span className="font-bold text-[var(--color-meza-text)] text-lg leading-tight transition-colors">{item.nameAtSale}</span>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {item.modifiers.map((m, i) => (
                            <span key={i} className="bg-[var(--color-meza-primary)]/10 text-[var(--color-meza-primary)] px-2 py-1 rounded-sm border border-blue-100 text-[11px] font-bold uppercase tracking-wider leading-none ">+ {m.name}</span>
                          ))}
                        </div>
                      )}
                      {item.note && (
                        <div className="mt-2 bg-[var(--color-danger)]/10 border border-red-100 p-2.5 rounded-sm">
                          <span className="text-sm font-bold text-[var(--color-danger)] italic">Note: "{item.note}"</span>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Action Button for non-drag users */}
            <div className="flex bg-[var(--color-meza-bg)] divide-x divide-gray-100 border-t border-[var(--color-meza-border)]">
               {order.fulfillmentStatus === 'pending' && (
                <button onClick={() => updateStatus(order._id, 'preparing')} className="flex-1 py-3.5 text-xs font-bold text-[var(--color-meza-primary)] hover:bg-[var(--color-meza-primary)]/10 transition-colors uppercase tracking-widest">Start Preparing</button>
               )}
               {order.fulfillmentStatus === 'preparing' && (
                <button onClick={() => updateStatus(order._id, 'ready')} className="flex-1 py-3.5 text-xs font-bold text-[var(--color-success)] hover:bg-[var(--color-success)]/10 transition-colors uppercase tracking-widest">Mark Ready</button>
               )}
               {order.fulfillmentStatus === 'ready' && (
                <button onClick={() => updateStatus(order._id, 'served')} className="flex-1 py-3.5 text-xs font-bold text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-border)] transition-colors uppercase tracking-widest">Mark Served</button>
               )}
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--color-meza-bg)] flex flex-col font-sans text-[var(--color-meza-text)] selection:bg-[var(--color-meza-primary)]/30 selection:text-[var(--color-meza-text)]">
      {/* Premium Light Header */}
      <header className="bg-[var(--color-meza-surface)]/80 backdrop-blur-xl border-b border-[var(--color-meza-border)] p-4 flex justify-between items-center sticky top-0 z-20 ">
        <div className="flex items-center space-x-4">
          <div className="bg-gradient-to-br from-meza-primary to-orange-500 p-2.5 rounded-sm  shadow-meza-primary/20">
            <UtensilsCrossed className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-meza-text)]">meza<span className="text-[var(--color-meza-primary)]">.</span> KDS</h1>
            <p className="text-xs font-bold text-[var(--color-meza-muted)] uppercase tracking-widest mt-0.5">Kitchen Display System</p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex bg-[var(--color-meza-bg)] p-1 rounded-sm border border-[var(--color-meza-border)]  hidden md:flex">
            <button onClick={() => navigate('/cashier')} className="px-5 py-2 rounded-sm text-sm font-bold text-[var(--color-meza-muted)] hover:text-[var(--color-meza-text)] transition-colors">Cashier</button>
            <button onClick={() => navigate('/table/Kiosk')} className="px-5 py-2 rounded-sm text-sm font-bold text-[var(--color-meza-muted)] hover:text-[var(--color-meza-text)] transition-colors">Ordering</button>
            <button className="px-5 py-2 rounded-sm bg-[var(--color-meza-surface)]  border border-[var(--color-meza-border)] text-sm font-bold text-[var(--color-meza-text)]">KDS</button>
          </div>
          <div className="flex items-center space-x-2 bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 px-4 py-2 rounded-full text-sm font-bold text-[var(--color-success)] ">
            <span className="w-2 h-2 rounded-full bg-[var(--color-success)]/100 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
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
                <div className={`mb-4 p-4 rounded-sm bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)]  flex items-center justify-between`}>
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-sm ${col.bg} border ${col.color}`}>
                      <Icon className={`w-5 h-5 ${col.id === 'pending' ? 'text-[var(--color-warning)]' : col.id === 'preparing' ? 'text-[var(--color-meza-primary)]' : 'text-[var(--color-success)]'}`} />
                    </div>
                    <h2 className="font-bold text-[var(--color-meza-text)] uppercase tracking-widest text-sm">{col.title}</h2>
                  </div>
                  <span className="bg-[var(--color-meza-bg)] border border-[var(--color-meza-border)] text-[var(--color-meza-muted)] px-3 py-1 rounded-full text-xs font-bold">
                    {items.length}
                  </span>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-sm p-2 transition-colors duration-200 overflow-y-auto ${snapshot.isDraggingOver ? 'bg-[var(--color-meza-primary)]/5 border-2 border-dashed border-[var(--color-meza-primary)]/30' : 'bg-transparent border-2 border-transparent'}`}
                    >
                      {items.map((order, idx) => (
                        <OrderCard key={order._id} order={order} index={idx} />
                      ))}
                      {provided.placeholder}
                      {items.length === 0 && !snapshot.isDraggingOver && (
                        <div className="h-full flex flex-col items-center justify-center text-[var(--color-meza-muted)] opacity-70">
                          <Icon className="w-12 h-12 mb-3 text-[var(--color-meza-muted)]" />
                          <p className="font-bold text-sm uppercase tracking-widest text-[var(--color-meza-muted)]">No Orders</p>
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
