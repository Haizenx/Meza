import React, { useState, useEffect } from 'react';
import { PackageCheck, AlertTriangle, Search, ArrowUp, ArrowDown, X, Coffee, Layers, Tag, Beaker } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function InventoryManagement() {
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState('finished'); // 'finished' | 'raw'

  const [menuItems, setMenuItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);

  const [currentItem, setCurrentItem] = useState(null);
  const [recipeData, setRecipeData] = useState(null);

  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState('add');
  const [deliveryData, setDeliveryData] = useState({ quantity: '', totalCost: '', supplier: '' });
  const [createData, setCreateData] = useState({});

  const fetchData = () => {
    fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/menu`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(setMenuItems)
      .catch(console.error);

    fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/inventory`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(setIngredients)
      .catch(console.error);
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const openAdjustModal = (item) => {
    setCurrentItem(item);
    setAdjustAmount('');
    setAdjustType('add');
    setIsModalOpen(true);
  };

  const openDeliveryModal = (item) => {
    setCurrentItem(item);
    setDeliveryData({ quantity: '', totalCost: '', supplier: '' });
    setIsDeliveryModalOpen(true);
  };

  const openCreateModal = () => {
    setCreateData(activeTab === 'finished' ? {
      name: '', category: 'Food', price: '', stockQuantity: 0, lowStockThreshold: 5
    } : {
      name: '', purchaseUnit: 'kg', unitCost: '', stockQuantity: 0, lowStockThreshold: 5
    });
    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsDeliveryModalOpen(false);
    setIsCreateModalOpen(false);
    setIsRecipeModalOpen(false);
    setCurrentItem(null);
    setRecipeData(null);
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) return alert("Enter a valid amount.");

    const newStock = adjustType === 'add'
      ? (currentItem.stockQuantity || 0) + amount
      : (currentItem.stockQuantity || 0) - amount;

    if (newStock < 0) return alert("Stock cannot be negative.");

    const isRaw = activeTab === 'raw';
    const endpoint = isRaw ? `${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}`}/api/inventory/${currentItem._id}` : `${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}`}/api/menu/${currentItem._id}`;

    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stockQuantity: newStock })
      });
      if (res.ok) {
        fetchData();
        handleCloseModal();
      } else {
        alert("Failed to adjust stock.");
      }
    } catch (err) { console.error(err); }
  };

  const handleReceiveDelivery = async (e) => {
    e.preventDefault();
    const qty = parseFloat(deliveryData.quantity);
    const cost = parseFloat(deliveryData.totalCost);

    if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost <= 0) {
      return alert("Please enter valid quantities and costs.");
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/inventory/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ingredientId: currentItem._id,
          quantityReceived: qty,
          totalCostPaid: cost,
          supplierName: deliveryData.supplier
        })
      });
      if (res.ok) {
        fetchData();
        handleCloseModal();
      } else {
        alert("Failed to record delivery.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const isRaw = activeTab === 'raw';
    const endpoint = isRaw ? `${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/inventory` : `${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/menu`;

    const payload = { ...createData };
    if (!isRaw) payload.price = parseFloat(payload.price) || 0;
    if (isRaw) payload.unitCost = parseFloat(payload.unitCost) || 0;
    payload.stockQuantity = parseFloat(payload.stockQuantity) || 0;
    payload.lowStockThreshold = parseFloat(payload.lowStockThreshold) || 0;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchData();
        handleCloseModal();
      } else {
        alert("Failed to create.");
      }
    } catch (err) { console.error(err); }
  };

  const openRecipeCosting = async (item) => {
    setCurrentItem(item);
    setIsRecipeModalOpen(true);
    setRecipeData(null); // loading state
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}`}/api/menu/${item._id}/cost`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecipeData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Processing Data for view
  const currentList = activeTab === 'finished' ? menuItems : ingredients;
  const filteredItems = currentList.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Grouping for Finished Goods
  const groupedMenu = filteredItems.reduce((acc, item) => {
    const cat = item.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-meza-text tracking-tight">Inventory Management</h2>
          <p className="text-gray-500 text-sm mt-1">Track both event-ready finished goods and raw back-of-house ingredients.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 bg-white p-1 rounded-xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-100 w-max">
        <button
          onClick={() => { setActiveTab('finished'); setSearchQuery(''); }}
          className={`px-5 py-2.5 rounded-lg flex items-center space-x-2 font-bold text-sm transition-all ${activeTab === 'finished' ? 'bg-meza-text text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Layers className="w-4 h-4" />
          <span>Event Stock (Menu Items)</span>
        </button>
        <button
          onClick={() => { setActiveTab('raw'); setSearchQuery(''); }}
          className={`px-5 py-2.5 rounded-lg flex items-center space-x-2 font-bold text-sm transition-all ${activeTab === 'raw' ? 'bg-meza-text text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Beaker className="w-4 h-4" />
          <span>Raw Ingredients</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-[#fcf9f5]">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'finished' ? 'menu items' : 'ingredients'}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-meza-primary focus:ring-2 focus:ring-meza-primary/10 transition-all font-medium text-meza-text"
            />
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider bg-white px-3 py-1.5 rounded-lg border border-gray-200 hidden md:block">
              Total Items: {filteredItems.length}
            </div>
            <button onClick={openCreateModal} className="px-4 py-2 bg-meza-primary text-white rounded-lg text-sm font-bold shadow-md hover:bg-meza-primary-hover transition-colors">
              + New {activeTab === 'finished' ? 'Menu Item' : 'Ingredient'}
            </button>
          </div>
        </div>

        {/* Dynamic Table based on Tab */}
        <div className="overflow-x-auto">
          {activeTab === 'finished' ? (
            // FINISHED GOODS VIEW
            <div className="p-4 space-y-8">
              {Object.keys(groupedMenu).map(category => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
                    <Tag className="w-4 h-4 text-meza-primary" />
                    <h3 className="font-black text-meza-text uppercase tracking-wider text-sm">{category}</h3>
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">{groupedMenu[category].length} items</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedMenu[category].map(item => {
                      const stock = item.stockQuantity || 0;
                      const par = item.lowStockThreshold || 5;
                      const isLowStock = stock <= par;
                      const progressPercent = Math.min(100, Math.max(0, (stock / (par * 3)) * 100));

                      return (
                        <div key={item._id} onClick={() => openRecipeCosting(item)} className={`bg-white border ${stock === 0 ? 'border-red-200 bg-red-50/10' : isLowStock ? 'border-yellow-200 bg-yellow-50/10' : 'border-gray-200'} rounded-xl p-4 flex flex-col hover:shadow-md transition-shadow cursor-pointer relative group`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <img src={item.photoUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-100 shadow-sm" />
                              <div>
                                <h4 className="font-bold text-meza-text">{item.name}</h4>
                                <p className="text-xs font-bold text-gray-400 mt-0.5">₱{item.price.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col space-y-2 flex-1 justify-end mt-4">
                            <div className="flex justify-between items-end">
                              <div className="flex items-baseline space-x-1">
                                <span className={`font-black text-2xl tracking-tight leading-none ${stock === 0 ? 'text-red-600' : isLowStock ? 'text-yellow-600' : 'text-meza-text'}`}>
                                  {stock.toLocaleString()}
                                </span>
                                <span className="text-gray-400 font-bold text-[10px] uppercase">units</span>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); openAdjustModal(item); }} className="px-3 py-1.5 bg-gray-100 hover:bg-meza-primary hover:text-white text-gray-600 rounded-lg text-xs font-bold transition-colors">
                                Adjust
                              </button>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${stock === 0 ? 'bg-red-500' : isLowStock ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${stock === 0 ? 100 : progressPercent}%` }}></div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {filteredItems.length === 0 && (
                <div className="py-16 text-center text-gray-400 font-bold text-sm">No items found in this category.</div>
              )}
            </div>
          ) : (
            // RAW INGREDIENTS VIEW
            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b border-gray-100 text-gray-400 text-[11px] font-bold uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Ingredient Name</th>
                  <th className="px-6 py-4">Unit Cost (Moving Avg)</th>
                  <th className="px-6 py-4">Stock Level</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredItems.map(item => {
                  const stock = item.stockQuantity || 0;
                  const par = item.lowStockThreshold || 5;
                  const isLowStock = stock <= par;
                  const progressPercent = Math.min(100, Math.max(0, (stock / (par * 3)) * 100));
                  const avgCost = item.movingAverageCost || item.unitCost;

                  return (
                    <tr key={item._id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-bold text-meza-text">{item.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-meza-primary">₱{avgCost.toFixed(2)}</span>
                        <span className="text-[10px] text-gray-400 font-bold ml-1 uppercase">/ {item.purchaseUnit}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-baseline space-x-1">
                            <span className={`font-black text-lg tracking-tight ${isLowStock && stock > 0 ? 'text-yellow-600' : stock <= 0 ? 'text-red-600' : 'text-meza-text'}`}>
                              {stock.toLocaleString()}
                            </span>
                            <span className="text-gray-400 font-bold text-[10px] uppercase">{item.purchaseUnit}</span>
                          </div>
                          <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${stock <= 0 ? 'bg-red-500' : isLowStock ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${stock <= 0 ? 100 : progressPercent}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {stock <= 0 ? (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-red-50 text-red-600 border-red-100 shadow-sm">
                            <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />
                            <span>Depleted</span>
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-yellow-50 text-yellow-700 border-yellow-200 shadow-sm">
                            <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />
                            <span>Low (Par: {par})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-green-50 text-green-600 border-green-100 shadow-sm">
                            <PackageCheck className="w-3 h-3" strokeWidth={2.5} />
                            <span>Healthy</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openAdjustModal(item)} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-bold transition-all shadow-sm">
                            Adjust
                          </button>
                          <button onClick={() => openDeliveryModal(item)} className="px-3 py-1.5 bg-meza-primary text-white hover:bg-orange-600 rounded-lg text-xs font-bold transition-all shadow-sm">
                            Receive Delivery
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {isModalOpen && currentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-meza-text/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-gray-100 transform transition-all">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-[#fcf9f5]">
              <h3 className="font-black text-meza-text text-lg">Record Stock</h3>
              <button onClick={handleCloseModal} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6">
              <div className="flex items-center space-x-4 mb-6">
                {activeTab === 'finished' && <img src={currentItem.photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover shadow-sm border border-gray-100" />}
                <div>
                  <h4 className="font-bold text-meza-text">{currentItem.name}</h4>
                  <p className="text-sm text-gray-500">Current Level: <span className="font-black text-meza-text">{currentItem.stockQuantity || 0}</span> {activeTab === 'raw' ? currentItem.purchaseUnit : 'units'}</p>
                </div>
              </div>

              <form onSubmit={handleAdjustStock} className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setAdjustType('add')} className={`py-3 rounded-xl flex items-center justify-center space-x-2 border-2 transition-all font-bold ${adjustType === 'add' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}>
                    <ArrowUp className="w-4 h-4" /><span>Add</span>
                  </button>
                  <button type="button" onClick={() => setAdjustType('subtract')} className={`py-3 rounded-xl flex items-center justify-center space-x-2 border-2 transition-all font-bold ${adjustType === 'subtract' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}>
                    <ArrowDown className="w-4 h-4" /><span>Subtract</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Amount to {adjustType}</label>
                  <div className="relative">
                    <input type="number" step="any" min="0.1" required autoFocus value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} className="w-full pl-4 pr-16 py-3 bg-white border-2 border-gray-200 rounded-xl outline-none focus:border-meza-primary font-black text-xl text-meza-text" placeholder="0" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 uppercase">{activeTab === 'raw' ? currentItem.purchaseUnit : 'units'}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" className="w-full py-4 bg-meza-text text-white hover:bg-meza-primary rounded-xl font-bold tracking-wide transition-all shadow-md active:scale-[0.98]">
                    Confirm Stock Update
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Receive Delivery Modal */}
      {isDeliveryModalOpen && currentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-meza-text/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-gray-100 transform transition-all">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-meza-primary/5">
              <h3 className="font-black text-meza-text text-lg">Receive Supplier Delivery</h3>
              <button onClick={handleCloseModal} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h4 className="font-bold text-meza-text text-xl">{currentItem.name}</h4>
                <p className="text-sm text-gray-500">Current Unit Cost: <span className="font-black text-meza-primary">₱{(currentItem.movingAverageCost || currentItem.unitCost).toFixed(2)} / {currentItem.purchaseUnit}</span></p>
              </div>

              <form onSubmit={handleReceiveDelivery} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Supplier Name (Optional)</label>
                  <input type="text" value={deliveryData.supplier} onChange={e => setDeliveryData({ ...deliveryData, supplier: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-meza-primary text-sm font-medium" placeholder="e.g. Local Farms Inc." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Quantity Received</label>
                    <div className="relative">
                      <input type="number" step="any" min="0.1" required value={deliveryData.quantity} onChange={e => setDeliveryData({ ...deliveryData, quantity: e.target.value })} className="w-full pl-3 pr-10 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-meza-primary font-bold text-meza-text" placeholder="0" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase">{currentItem.purchaseUnit}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Total Cost Paid</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">₱</span>
                      <input type="number" step="any" min="0.1" required value={deliveryData.totalCost} onChange={e => setDeliveryData({ ...deliveryData, totalCost: e.target.value })} className="w-full pl-7 pr-3 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-meza-primary font-bold text-meza-text" placeholder="0.00" />
                    </div>
                  </div>
                </div>

                {deliveryData.quantity && deliveryData.totalCost && (
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center mt-2">
                    <span className="text-xs font-bold text-gray-500">New Batch Cost:</span>
                    <span className="text-sm font-black text-meza-primary">₱{(parseFloat(deliveryData.totalCost) / parseFloat(deliveryData.quantity)).toFixed(2)} / {currentItem.purchaseUnit}</span>
                  </div>
                )}

                <div className="pt-4">
                  <button type="submit" className="w-full py-3 bg-meza-text hover:bg-black text-white rounded-xl font-bold transition-all shadow-md active:scale-[0.98]">
                    Record Delivery & Update Costing
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-meza-text/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-gray-100 transform transition-all">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-[#fcf9f5]">
              <h3 className="font-black text-meza-text text-lg">New {activeTab === 'finished' ? 'Menu Item' : 'Ingredient'}</h3>
              <button onClick={handleCloseModal} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Name</label>
                  <input type="text" required value={createData.name} onChange={e => setCreateData({ ...createData, name: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-meza-primary text-sm font-medium text-meza-text" placeholder="Name" />
                </div>

                {activeTab === 'finished' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                        <select value={createData.category} onChange={e => setCreateData({ ...createData, category: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-meza-primary text-sm font-medium text-meza-text">
                          <option value="Food">Food</option>
                          <option value="Drinks">Drinks</option>
                          <option value="Pastry">Pastry</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Sell Price</label>
                        <input type="number" step="any" required value={createData.price} onChange={e => setCreateData({ ...createData, price: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-meza-primary text-sm font-medium text-meza-text" placeholder="0.00" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Purchase Unit</label>
                        <input type="text" required value={createData.purchaseUnit} onChange={e => setCreateData({ ...createData, purchaseUnit: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-meza-primary text-sm font-medium text-meza-text" placeholder="kg, L, box..." />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Unit Cost</label>
                        <input type="number" step="any" required value={createData.unitCost} onChange={e => setCreateData({ ...createData, unitCost: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-meza-primary text-sm font-medium text-meza-text" placeholder="0.00" />
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Initial Stock</label>
                    <input type="number" step="any" required value={createData.stockQuantity} onChange={e => setCreateData({ ...createData, stockQuantity: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-meza-primary text-sm font-medium text-meza-text" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Low Par Alert</label>
                    <input type="number" step="any" required value={createData.lowStockThreshold} onChange={e => setCreateData({ ...createData, lowStockThreshold: e.target.value })} className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-meza-primary text-sm font-medium text-meza-text" placeholder="5" />
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full py-3 bg-meza-text hover:bg-black text-white rounded-xl font-bold transition-all shadow-md active:scale-[0.98]">
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Costing Modal */}
      {isRecipeModalOpen && currentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-meza-text/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 transform transition-all">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-[#fcf9f5]">
              <h3 className="font-black text-meza-text text-lg">Recipe & Costing</h3>
              <button onClick={handleCloseModal} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6">
              <div className="flex items-center space-x-4 mb-6">
                <img src={currentItem.photoUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"} alt="" className="w-16 h-16 rounded-xl object-cover shadow-sm border border-gray-100" />
                <div>
                  <h4 className="font-bold text-meza-text text-xl">{currentItem.name}</h4>
                  <p className="text-sm font-bold text-gray-400">Sell Price: <span className="text-meza-primary">₱{currentItem.price.toFixed(2)}</span></p>
                </div>
              </div>

              {!recipeData ? (
                <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-meza-primary border-t-transparent rounded-full animate-spin"></div></div>
              ) : recipeData.error ? (
                <div className="py-8 text-center bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-red-600 font-bold">Error loading recipe data. (Status: {recipeData.status})</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                      <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">COGS (Total Cost)</div>
                      <div className="text-xl font-black text-red-700">₱{(recipeData.cogs || 0).toFixed(2)}</div>
                    </div>
                    <div className={`p-4 rounded-xl border text-center ${recipeData.marginPercent >= 65 ? 'bg-green-50 border-green-100' : 'bg-yellow-50 border-yellow-100'}`}>
                      <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${recipeData.marginPercent >= 65 ? 'text-green-600' : 'text-yellow-600'}`}>Profit Margin</div>
                      <div className={`text-xl font-black ${recipeData.marginPercent >= 65 ? 'text-green-700' : 'text-yellow-700'}`}>{(recipeData.marginPercent || 0).toFixed(1)}%</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                      <Beaker className="w-3.5 h-3.5" />
                      <span>Ingredients Breakdown</span>
                    </h4>
                    {recipeData.ingredientsBreakdown && recipeData.ingredientsBreakdown.length > 0 ? (
                      <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-b border-gray-100 text-gray-500">
                            <tr>
                              <th className="py-2 px-3 text-left font-bold uppercase">Ingredient</th>
                              <th className="py-2 px-3 text-right font-bold uppercase">Qty</th>
                              <th className="py-2 px-3 text-right font-bold uppercase">Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {recipeData.ingredientsBreakdown.map((ing, idx) => (
                              <tr key={idx} className="bg-white">
                                <td className="py-2.5 px-3 font-semibold text-gray-700">{ing.name}</td>
                                <td className="py-2.5 px-3 text-right text-gray-500">{ing.quantity}{ing.unit}</td>
                                <td className="py-2.5 px-3 text-right font-bold text-meza-text">₱{ing.cost.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-4 rounded-xl text-center text-sm text-gray-500 italic border border-gray-100">
                        No recipe configured for this item.
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button onClick={() => { setIsRecipeModalOpen(false); openAdjustModal(currentItem); }} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-meza-text rounded-xl font-bold transition-all shadow-sm">
                      Adjust Stock Levels
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
