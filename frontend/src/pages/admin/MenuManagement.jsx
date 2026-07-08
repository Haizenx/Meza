import { useState, useEffect } from 'react';
import { Plus, Edit2, Archive, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import MenuItemModal from '../../components/admin/MenuItemModal';

export default function MenuManagement() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [rawIngredients, setRawIngredients] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Archive Modal State
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [itemToArchive, setItemToArchive] = useState(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const fetchMenu = () => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/menu`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
      .then(setItems)
      .catch(console.error);
      
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/inventory`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
      .then(setRawIngredients)
      .catch(console.error);
  };

  useEffect(() => {
    if (token) fetchMenu();
  }, [token]);

  const handleToggleStatus = async (item) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}`}/api/menu/${item._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isAvailable: !item.isAvailable })
      });
      fetchMenu();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const openArchiveModal = (item) => {
    setItemToArchive(item);
    setIsArchiveModalOpen(true);
  };

  const confirmArchiveItem = async () => {
    if (!itemToArchive) return;
    setIsArchiving(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/menu/${itemToArchive._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Optimistic update
      setItems(items.filter(i => i._id !== itemToArchive._id));
      setIsArchiveModalOpen(false);
      setItemToArchive(null);
    } catch (err) {
      console.error(err);
      alert('Failed to archive item.');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-meza-text)] tracking-tight">Menu Management</h2>
          <p className="text-[var(--color-meza-muted)] text-sm mt-1">Manage your items, prices, and live availability.</p>
        </div>
        <button onClick={handleAddItem} className="bg-meza-text hover:bg-[var(--color-meza-primary)] text-white px-4 py-2 rounded-sm flex items-center space-x-2 font-semibold text-sm transition-colors  active:scale-[0.98] cursor-pointer">
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>Add Menu Item</span>
        </button>
      </div>

      <div className="bg-[var(--color-meza-surface)] rounded-sm shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-[var(--color-meza-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-[var(--color-meza-bg)] border-b border-[var(--color-meza-border)] text-[var(--color-meza-muted)] text-xs font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Item Name</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Price (₱)</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => (
              <tr key={item._id} className="hover:bg-[var(--color-meza-bg)] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <img src={item.photoUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"} alt="" className="w-10 h-10 rounded-sm object-cover bg-[var(--color-meza-bg)]" />
                    <span className="font-semibold text-[var(--color-meza-text)]">{item.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-[var(--color-meza-muted)] font-medium">{item.category}</td>
                <td className="px-6 py-4 font-bold text-[var(--color-meza-text)]">
                  {item.sizes && item.sizes.length > 0 ? (
                    <span>From ₱{Math.min(...item.sizes.map(s => s.price || 0)).toFixed(2)}</span>
                  ) : (
                    <span>₱{(item.price || 0).toFixed(2)}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => handleToggleStatus(item)}
                    className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border cursor-pointer transition-all active:scale-95 ${item.isAvailable ? 'bg-[var(--color-success)]/10/80 text-[var(--color-success)] border-[var(--color-success)]/30/60 hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/30' : 'bg-[var(--color-danger)]/10/80 text-[var(--color-danger)] border-[var(--color-danger)]/30/60 hover:bg-[var(--color-success)]/10 hover:text-[var(--color-success)] hover:border-[var(--color-success)]/30'}`}
                    title="Click to toggle availability"
                  >
                    {item.isAvailable ? <CheckCircle className="w-3 h-3" strokeWidth={3} /> : <XCircle className="w-3 h-3" strokeWidth={3} />}
                    <span>{item.isAvailable ? 'Available' : 'Sold Out'}</span>
                  </button>
                </td>
                <td className="px-6 py-4 text-right space-x-1">
                  <button onClick={() => handleEditItem(item)} className="p-1.5 text-[var(--color-meza-muted)] hover:text-[var(--color-meza-primary)] hover:bg-[var(--color-meza-primary)]/5 rounded-md transition-colors cursor-pointer" title="Edit Item">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => openArchiveModal(item)} className="p-1.5 text-[var(--color-meza-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded-md transition-colors cursor-pointer" title="Archive Item">
                    <Archive className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-[var(--color-meza-muted)] font-medium text-sm">
                  No menu items found.
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>

      <MenuItemModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialData={editingItem}
        rawIngredients={rawIngredients}
        token={token}
        onSuccess={fetchMenu}
      />

      {/* Archive Confirmation Modal */}
      {isArchiveModalOpen && itemToArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-danger)]/10 mx-auto mb-4">
                <Archive className="w-6 h-6 text-[var(--color-danger)]" />
              </div>
              <h3 className="text-xl font-bold text-center text-[var(--color-meza-text)] mb-2">Archive Item?</h3>
              <p className="text-center text-[var(--color-meza-muted)] text-sm mb-6">
                Are you sure you want to archive <strong>{itemToArchive.name}</strong>? It will be hidden from the menu, and its recipes will be removed.
              </p>
              <div className="flex space-x-3">
                <button 
                  onClick={() => setIsArchiveModalOpen(false)}
                  disabled={isArchiving}
                  className="flex-1 px-4 py-2 bg-[var(--color-meza-bg)] text-[var(--color-meza-text)] hover:bg-[var(--color-meza-border)] rounded-sm font-bold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmArchiveItem}
                  disabled={isArchiving}
                  className="flex-1 px-4 py-2 bg-[var(--color-danger)] text-white hover:bg-red-700 rounded-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isArchiving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Archive'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
