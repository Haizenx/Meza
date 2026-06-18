import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Archive, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import MenuItemModal from '../../components/admin/MenuItemModal';

export default function MenuManagement() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [rawIngredients, setRawIngredients] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const fetchMenu = () => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/menu`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setItems)
      .catch(console.error);
      
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/inventory`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-meza-text tracking-tight">Menu Management</h2>
          <p className="text-gray-500 text-sm mt-1">Manage your items, prices, and live availability.</p>
        </div>
        <button onClick={handleAddItem} className="bg-meza-text hover:bg-meza-primary text-white px-4 py-2 rounded-lg flex items-center space-x-2 font-semibold text-sm transition-colors shadow-sm active:scale-[0.98] cursor-pointer">
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>Add Menu Item</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#fcf9f5] border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
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
              <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <img src={item.photoUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                    <span className="font-semibold text-meza-text">{item.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500 font-medium">{item.category}</td>
                <td className="px-6 py-4 font-bold text-meza-text">₱{item.price.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => handleToggleStatus(item)}
                    className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border cursor-pointer transition-all active:scale-95 ${item.isAvailable ? 'bg-green-50/80 text-green-700 border-green-200/60 hover:bg-red-50 hover:text-red-700 hover:border-red-200' : 'bg-red-50/80 text-red-700 border-red-200/60 hover:bg-green-50 hover:text-green-700 hover:border-green-200'}`}
                    title="Click to toggle availability"
                  >
                    {item.isAvailable ? <CheckCircle className="w-3 h-3" strokeWidth={3} /> : <XCircle className="w-3 h-3" strokeWidth={3} />}
                    <span>{item.isAvailable ? 'Available' : 'Sold Out'}</span>
                  </button>
                </td>
                <td className="px-6 py-4 text-right space-x-1">
                  <button onClick={() => handleEditItem(item)} className="p-1.5 text-gray-400 hover:text-meza-primary hover:bg-meza-primary/5 rounded-md transition-colors cursor-pointer">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer">
                    <Archive className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-gray-400 font-medium text-sm">
                  No menu items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <MenuItemModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialData={editingItem}
        rawIngredients={rawIngredients}
        token={token}
        onSuccess={fetchMenu}
      />
    </div>
  );
}
