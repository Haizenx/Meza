import { API_URL } from '../../config';
import React, { useState, useEffect } from 'react';
import { PackageCheck, AlertTriangle, Search, ArrowUp, ArrowDown, X, Layers, Tag, Beaker, Upload, History, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import MenuItemModal from '../../components/admin/MenuItemModal';
import Papa from 'papaparse';

export default function InventoryManagement() {
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState('finished'); // 'finished' | 'raw' | 'history'

  const [menuItems, setMenuItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = React.useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);

  const [currentItem, setCurrentItem] = useState(null);
  const [recipeData, setRecipeData] = useState(null);

  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState('add');
  const [adjustReason, setAdjustReason] = useState('Count Correction');
  const [deliveryData, setDeliveryData] = useState({ quantity: '', totalCost: '', supplier: '', invoiceId: '' });
  const [createData, setCreateData] = useState({});

  const fetchData = () => {
    fetch(`${API_URL}/api/menu`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
      .then(setMenuItems)
      .catch(console.error);

    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/inventory`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
      .then(setIngredients)
      .catch(console.error);

    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/inventory/history`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
      .then(setHistoryData)
      .catch(console.error);
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const openAdjustModal = (item) => {
    setCurrentItem(item);
    setAdjustAmount('');
    setAdjustType('add');
    setAdjustReason('Count Correction');
    setIsModalOpen(true);
  };

  const openDeliveryModal = (item) => {
    setCurrentItem(item);
    setDeliveryData({ quantity: '', totalCost: '', supplier: '', invoiceId: '' });
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
    setIsMenuModalOpen(false);
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
    const endpoint = isRaw ? `${import.meta.env.VITE_API_URL || `${API_URL}`}/api/inventory/${currentItem._id}` : `${import.meta.env.VITE_API_URL || `${API_URL}`}/api/menu/${currentItem._id}`;

    try {
      const payload = isRaw ? {
        name: currentItem.name,
        purchaseUnit: currentItem.purchaseUnit,
        unitCost: currentItem.unitCost,
        currency: currentItem.currency || 'PHP',
        lowStockThreshold: currentItem.lowStockThreshold || 5,
        stockQuantity: newStock,
        reason: adjustReason
      } : { stockQuantity: newStock, reason: adjustReason };

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
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
      const res = await fetch(`${API_URL}/api/inventory/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ingredientId: currentItem._id,
          quantityReceived: qty,
          totalCostPaid: cost,
          supplierName: deliveryData.supplier,
          invoiceId: deliveryData.invoiceId
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

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to delete ${item.name}?`)) return;
    const isRaw = activeTab === 'raw';
    const endpoint = isRaw ? `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/inventory/${item._id}` : `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/menu/${item._id}`;
    
    try {
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchData();
      } else {
        alert("Failed to delete item.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const isRaw = activeTab === 'raw';
    const endpoint = isRaw ? `${API_URL}/api/inventory` : `${API_URL}/api/menu`;

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
        const errorData = await res.json();
        alert(`Failed to create: ${errorData.message || 'Unknown error'}`);
      }
    } catch (err) { console.error(err); }
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const items = results.data.map(row => ({
          name: row['Name'] || row['name'],
          purchaseUnit: row['Purchase Unit'] || row['purchaseUnit'] || row['Unit'] || 'pcs',
          unitCost: parseFloat(row['Unit Cost'] || row['unitCost'] || 0),
          stockQuantity: parseFloat(row['Initial Stock'] || row['stockQuantity'] || 0),
          lowStockThreshold: parseFloat(row['Low Par Alert'] || row['lowStockThreshold'] || 5)
        })).filter(i => i.name);

        if (items.length === 0) {
          return alert('No valid items found in CSV. Please check headers.');
        }

        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/inventory/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ items })
          });
          if (res.ok) {
            const data = await res.json();
            alert(`Import complete: ${data.added} added, ${data.updated} updated. Errors: ${data.errors.length}`);
            fetchData();
          } else {
            alert('Import failed.');
          }
        } catch (err) {
          console.error(err);
          alert('Import failed due to server error.');
        }
      }
    });
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openRecipeCosting = async (item) => {
    setCurrentItem(item);
    setIsRecipeModalOpen(true);
    setRecipeData(null); // loading state
    
    let sizeQuery = '';
    if (item.sizes && item.sizes.length > 0) {
      sizeQuery = `?size=${encodeURIComponent(item.sizes[0].name)}`;
    }
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/menu/${item._id}/recipe-costing${sizeQuery}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecipeData(data);
      } else {
        setRecipeData({ error: true, status: res.status });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Processing Data for view
  const currentList = activeTab === 'finished' ? menuItems : ingredients;
  const filteredItems = currentList.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Grouping for Finished Goods
  const groupedMenu = menuItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).reduce((acc, item) => {
    const cat = item.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const uniqueUnits = [...new Set(ingredients.map(i => i.purchaseUnit).filter(Boolean))];

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-meza-text)] tracking-tight">Inventory Management</h2>
          <p className="text-[var(--color-meza-muted)] text-sm mt-1">Track both event-ready finished goods and raw back-of-house ingredients.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 bg-[var(--color-meza-surface)] p-1 rounded-sm shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-[var(--color-meza-border)] w-max">
        <button
          onClick={() => { setActiveTab('finished'); setSearchQuery(''); }}
          className={`px-5 py-2.5 rounded-sm flex items-center space-x-2 font-bold text-sm transition-all ${activeTab === 'finished' ? 'bg-meza-text text-white ' : 'text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-bg)]'}`}
        >
          <Layers className="w-4 h-4" />
          <span>Event Stock (Menu Items)</span>
        </button>
        <button
          onClick={() => { setActiveTab('raw'); setSearchQuery(''); }}
          className={`px-5 py-2.5 rounded-sm flex items-center space-x-2 font-bold text-sm transition-all ${activeTab === 'raw' ? 'bg-meza-text text-white ' : 'text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-bg)]'}`}
        >
          <Beaker className="w-4 h-4" />
          <span>Raw Ingredients</span>
        </button>
        <button
          onClick={() => { setActiveTab('history'); setSearchQuery(''); }}
          className={`px-5 py-2.5 rounded-sm flex items-center space-x-2 font-bold text-sm transition-all ${activeTab === 'history' ? 'bg-meza-text text-white ' : 'text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-bg)]'}`}
        >
          <History className="w-4 h-4" />
          <span>Audit & History</span>
        </button>
      </div>

      <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportCSV} hidden />

      <div className="bg-[var(--color-meza-surface)] rounded-sm shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-[var(--color-meza-border)] overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-5 border-b border-[var(--color-meza-border)] flex justify-between items-center bg-[var(--color-meza-bg)]">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-meza-muted)]" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'finished' ? 'menu items' : 'ingredients'}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] rounded-sm text-sm outline-none focus:border-[var(--color-meza-primary)] focus:ring-2 focus:ring-[var(--color-meza-primary)]/10 transition-all font-medium text-[var(--color-meza-text)]"
            />
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-xs text-[var(--color-meza-muted)] font-bold uppercase tracking-wider bg-[var(--color-meza-surface)] px-3 py-1.5 rounded-sm border border-[var(--color-meza-border)] hidden md:block">
              Total Items: {activeTab === 'history' ? historyData.length : filteredItems.length}
            </div>
            {activeTab === 'raw' && (
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-[var(--color-meza-bg)] text-[var(--color-meza-text)] rounded-sm text-sm font-bold  hover:bg-[var(--color-meza-border)] transition-colors flex items-center space-x-2">
                <Upload className="w-4 h-4" /><span>Import CSV</span>
              </button>
            )}
            {activeTab !== 'history' && (
              <button onClick={openCreateModal} className="px-4 py-2 bg-[var(--color-meza-primary)] text-white rounded-sm text-sm font-bold  hover:bg-[var(--color-meza-primary)]-hover transition-colors">
                + New {activeTab === 'finished' ? 'Menu Item' : 'Ingredient'}
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Table based on Tab */}
        <div className="overflow-x-auto">
          {activeTab === 'history' ? (
            <div className="p-4">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-meza-surface)] border-b border-[var(--color-meza-border)] text-[var(--color-meza-muted)] text-[11px] font-bold uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Ingredient</th>
                    <th className="px-6 py-4 text-right">Quantity</th>
                    <th className="px-6 py-4 text-right">Details/Cost</th>
                    <th className="px-6 py-4">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historyData.map(record => (
                    <tr key={record._id} className="hover:bg-[var(--color-meza-bg)]/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-[var(--color-meza-muted)]">
                        {record.createdAt ? new Date(record.createdAt).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-bold">
                        <span className={`px-2 py-1 rounded-sm text-[10px] uppercase tracking-wider ${record.type === 'DELIVERY' ? 'bg-[var(--color-meza-primary)]/10 text-[var(--color-meza-primary)]' : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'}`}>
                          {record.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-[var(--color-meza-text)]">
                        {record.ingredientName}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-[var(--color-meza-text)]">
                        {record.type === 'DELIVERY' ? (
                          <span className="text-[var(--color-success)]">+{record.quantityReceived}</span>
                        ) : (
                          <span>{record.oldValue} → {record.newValue}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-[var(--color-meza-muted)] text-sm">
                        {record.type === 'DELIVERY' ? (
                          <>
                            <span className="font-bold text-[var(--color-meza-text)]">₱{(record.totalCostPaid || 0).toFixed(2)}</span>
                            <br/>
                            <span className="text-[10px] uppercase">{record.supplierName}</span>
                          </>
                        ) : (
                          <span className="text-xs">{record.reason}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[var(--color-meza-muted)]">
                        {record.actorName}
                      </td>
                    </tr>
                  ))}
                  {historyData.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-16 text-center text-[var(--color-meza-muted)] font-bold text-sm">
                        No restock history available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'finished' ? (
            // FINISHED GOODS VIEW
            <div className="p-4 space-y-8">
              {Object.keys(groupedMenu).map(category => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center space-x-2 border-b border-[var(--color-meza-border)] pb-2">
                    <Tag className="w-4 h-4 text-[var(--color-meza-primary)]" />
                    <h3 className="font-bold text-[var(--color-meza-text)] uppercase tracking-wider text-sm">{category}</h3>
                    <span className="text-xs font-bold text-[var(--color-meza-muted)] bg-[var(--color-meza-bg)] px-2 py-0.5 rounded-md">{groupedMenu[category].length} items</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedMenu[category].map(item => {
                      const stock = item.stockQuantity || 0;
                      const par = item.lowStockThreshold || 5;
                      const isLowStock = stock <= par;
                      const progressPercent = Math.min(100, Math.max(0, (stock / (par * 3)) * 100));

                      return (
                        <div key={item._id} onClick={() => openRecipeCosting(item)} className={`bg-[var(--color-meza-surface)] border ${stock === 0 ? 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10/10' : isLowStock ? 'border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10/10' : 'border-[var(--color-meza-border)]'} rounded-sm p-4 flex flex-col hover: transition-shadow cursor-pointer relative group`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <img src={item.photoUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"} alt="" className="w-12 h-12 rounded-sm object-cover bg-[var(--color-meza-bg)] " />
                              <div>
                                <h4 className="font-bold text-[var(--color-meza-text)]">{item.name}</h4>
                                <p className="text-xs font-bold text-[var(--color-meza-muted)] mt-0.5">₱{item.price.toFixed(2)}</p>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteItem(item); }} 
                              className="p-1.5 text-[var(--color-meza-muted)] hover:text-[var(--color-danger)] bg-[var(--color-meza-bg)] rounded-sm transition-colors z-10"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex flex-col space-y-2 flex-1 justify-end mt-4">
                            <div className="flex justify-between items-end">
                              <div className="flex items-baseline space-x-1">
                                <span className={`font-bold text-2xl tracking-tight leading-none ${item.calculatedStock === 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-meza-text)]'}`}>
                                  {item.calculatedStock !== null ? item.calculatedStock.toLocaleString() : '-'}
                                </span>
                                <span className="text-[var(--color-meza-muted)] font-bold text-[10px] uppercase">portions</span>
                              </div>
                            </div>
                            <div className="w-full h-1.5 bg-[var(--color-meza-bg)] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${item.calculatedStock === 0 ? 'bg-[var(--color-danger)]/100' : 'bg-[var(--color-success)]/100'}`} style={{ width: `${item.calculatedStock === 0 ? 100 : item.calculatedStock !== null ? 100 : 0}%` }}></div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {filteredItems.length === 0 && (
                <div className="py-16 text-center text-[var(--color-meza-muted)] font-bold text-sm">No items found in this category.</div>
              )}
            </div>
          ) : (
            // RAW INGREDIENTS VIEW
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-meza-surface)] border-b border-[var(--color-meza-border)] text-[var(--color-meza-muted)] text-[11px] font-bold uppercase tracking-widest">
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
                    <tr key={item._id} className="hover:bg-[var(--color-meza-bg)]/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-bold text-[var(--color-meza-text)]">{item.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-[var(--color-meza-primary)]">₱{avgCost.toFixed(2)}</span>
                        <span className="text-[10px] text-[var(--color-meza-muted)] font-bold ml-1 uppercase">/ {item.purchaseUnit}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-baseline space-x-1">
                            <span className={`font-bold text-lg tracking-tight ${isLowStock && stock > 0 ? 'text-[var(--color-warning)]' : stock <= 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-meza-text)]'}`}>
                              {stock.toLocaleString()}
                            </span>
                            <span className="text-[var(--color-meza-muted)] font-bold text-[10px] uppercase">{item.purchaseUnit}</span>
                          </div>
                          <div className="w-32 h-1.5 bg-[var(--color-meza-bg)] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${stock <= 0 ? 'bg-[var(--color-danger)]/100' : isLowStock ? 'bg-[var(--color-warning)]/100' : 'bg-[var(--color-success)]/100'}`} style={{ width: `${stock <= 0 ? 100 : progressPercent}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {stock <= 0 ? (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-red-100 ">
                            <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />
                            <span>Depleted</span>
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/30 ">
                            <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />
                            <span>Low (Par: {par})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-[var(--color-success)]/10 text-[var(--color-success)] border-green-100 ">
                            <PackageCheck className="w-3 h-3" strokeWidth={2.5} />
                            <span>Healthy</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openAdjustModal(item)} className="px-3 py-1.5 bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-bg)] rounded-sm text-xs font-bold transition-all ">
                            Adjust
                          </button>
                          <button onClick={() => openDeliveryModal(item)} className="px-3 py-1.5 bg-[var(--color-meza-primary)] text-white hover:bg-[var(--color-warning)] rounded-sm text-xs font-bold transition-all ">
                            Receive Delivery
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item); }} className="px-3 py-1.5 bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white rounded-sm text-xs font-bold transition-all flex items-center justify-center">
                            <Trash2 className="w-3.5 h-3.5" />
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
          <div className="bg-[var(--color-meza-surface)] rounded-sm w-full max-w-sm  overflow-hidden border border-[var(--color-meza-border)] transform transition-all">
            <div className="flex justify-between items-center p-5 border-b border-[var(--color-meza-border)] bg-[var(--color-meza-bg)]">
              <h3 className="font-bold text-[var(--color-meza-text)] text-lg">Record Stock</h3>
              <button onClick={handleCloseModal} className="p-1.5 text-[var(--color-meza-muted)] hover:text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-bg)] rounded-sm transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6">
              <div className="flex items-center space-x-4 mb-6">
                {activeTab === 'finished' && <img src={currentItem.photoUrl} alt="" className="w-16 h-16 rounded-sm object-cover  border border-[var(--color-meza-border)]" />}
                <div>
                  <h4 className="font-bold text-[var(--color-meza-text)]">{currentItem.name}</h4>
                  <p className="text-sm text-[var(--color-meza-muted)]">Current Level: <span className="font-bold text-[var(--color-meza-text)]">{currentItem.stockQuantity || 0}</span> {activeTab === 'raw' ? currentItem.purchaseUnit : 'units'}</p>
                </div>
              </div>

              <form onSubmit={handleAdjustStock} className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setAdjustType('add')} className={`py-3 rounded-sm flex items-center justify-center space-x-2 border-2 transition-all font-bold ${adjustType === 'add' ? 'border-green-500 bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'border-[var(--color-meza-border)] text-[var(--color-meza-muted)] hover:border-[var(--color-meza-border)]'}`}>
                    <ArrowUp className="w-4 h-4" /><span>Add</span>
                  </button>
                  <button type="button" onClick={() => setAdjustType('subtract')} className={`py-3 rounded-sm flex items-center justify-center space-x-2 border-2 transition-all font-bold ${adjustType === 'subtract' ? 'border-[var(--color-warning)] bg-[var(--color-warning)]/10 text-[var(--color-warning)]' : 'border-[var(--color-meza-border)] text-[var(--color-meza-muted)] hover:border-[var(--color-meza-border)]'}`}>
                    <ArrowDown className="w-4 h-4" /><span>Subtract</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Amount to {adjustType}</label>
                  <div className="relative">
                    <input type="number" step="any" min="0.1" required autoFocus value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} className="w-full pl-4 pr-16 py-3 bg-[var(--color-meza-surface)] border-2 border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] font-bold text-xl text-[var(--color-meza-text)]" placeholder="0" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--color-meza-muted)] uppercase">{activeTab === 'raw' ? currentItem.purchaseUnit : 'units'}</span>
                  </div>
                </div>

                {adjustType === 'subtract' && (
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Reason for Subtraction</label>
                    <select 
                      value={adjustReason} 
                      onChange={e => setAdjustReason(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--color-meza-surface)] border-2 border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] font-bold text-[var(--color-meza-text)]"
                    >
                      <option value="Spoilage">Spoilage / Expired</option>
                      <option value="Accident/Dropped">Accident / Dropped</option>
                      <option value="Comped">Comped / Staff Meal</option>
                      <option value="Count Correction">Inventory Count Correction</option>
                    </select>
                  </div>
                )}
                {adjustType === 'add' && (
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Reason for Addition</label>
                    <select 
                      value={adjustReason} 
                      onChange={e => setAdjustReason(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--color-meza-surface)] border-2 border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] font-bold text-[var(--color-meza-text)]"
                    >
                      <option value="Count Correction">Inventory Count Correction</option>
                      <option value="Refund/Returned">Refund / Returned</option>
                    </select>
                  </div>
                )}

                <div className="pt-2">
                  <button type="submit" className="w-full py-4 bg-meza-text text-white hover:bg-[var(--color-meza-primary)] rounded-sm font-bold tracking-wide transition-all  active:scale-[0.98]">
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
          <div className="bg-[var(--color-meza-surface)] rounded-sm w-full max-w-sm  overflow-hidden border border-[var(--color-meza-border)] transform transition-all">
            <div className="flex justify-between items-center p-5 border-b border-[var(--color-meza-border)] bg-[var(--color-meza-primary)]/5">
              <h3 className="font-bold text-[var(--color-meza-text)] text-lg">Receive Supplier Delivery</h3>
              <button onClick={handleCloseModal} className="p-1.5 text-[var(--color-meza-muted)] hover:text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-bg)] rounded-sm transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h4 className="font-bold text-[var(--color-meza-text)] text-xl">{currentItem.name}</h4>
                <p className="text-sm text-[var(--color-meza-muted)]">Current Unit Cost: <span className="font-bold text-[var(--color-meza-primary)]">₱{(currentItem.movingAverageCost || currentItem.unitCost).toFixed(2)} / {currentItem.purchaseUnit}</span></p>
              </div>

              <form onSubmit={handleReceiveDelivery} className="space-y-4">
                <div className="grid grid-cols-1">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Quantity Received</label>
                    <div className="relative">
                      <input type="number" step="any" min="0.1" required autoFocus value={deliveryData.quantity} onChange={e => setDeliveryData({...deliveryData, quantity: e.target.value})} className="w-full pl-4 pr-16 py-3 bg-[var(--color-meza-surface)] border-2 border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] font-bold text-xl text-[var(--color-meza-text)]" placeholder="0" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--color-meza-muted)] uppercase">{activeTab === 'raw' ? currentItem.purchaseUnit : 'units'}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Total Cost Paid (₱)</label>
                    <input type="number" step="any" min="0.1" required value={deliveryData.totalCost} onChange={e => setDeliveryData({...deliveryData, totalCost: e.target.value})} className="w-full px-4 py-3 bg-[var(--color-meza-surface)] border-2 border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] font-bold text-xl text-[var(--color-meza-text)]" placeholder="0.00" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Supplier Name (Optional)</label>
                    <input type="text" value={deliveryData.supplier} onChange={e => setDeliveryData({...deliveryData, supplier: e.target.value})} className="w-full px-4 py-3 bg-[var(--color-meza-surface)] border-2 border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] font-bold text-sm text-[var(--color-meza-text)]" placeholder="E.g. Sysco" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Invoice ID (Optional)</label>
                    <input type="text" value={deliveryData.invoiceId} onChange={e => setDeliveryData({...deliveryData, invoiceId: e.target.value})} className="w-full px-4 py-3 bg-[var(--color-meza-surface)] border-2 border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] font-bold text-sm text-[var(--color-meza-text)]" placeholder="E.g. INV-12345" />
                  </div>
                </div>

                {deliveryData.quantity && deliveryData.totalCost && (
                  <div className="bg-[var(--color-meza-bg)] p-3 rounded-sm border border-[var(--color-meza-border)] flex justify-between items-center mt-2">
                    <span className="text-xs font-bold text-[var(--color-meza-muted)]">New Batch Cost:</span>
                    <span className="text-sm font-bold text-[var(--color-meza-primary)]">₱{(parseFloat(deliveryData.totalCost) / parseFloat(deliveryData.quantity)).toFixed(2)} / {currentItem.purchaseUnit}</span>
                  </div>
                )}

                <div className="pt-4">
                  <button type="submit" className="w-full py-3 bg-meza-text hover:bg-black text-white rounded-sm font-bold transition-all  active:scale-[0.98]">
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
          <div className="bg-[var(--color-meza-surface)] rounded-sm w-full max-w-sm  overflow-hidden border border-[var(--color-meza-border)] transform transition-all">
            <div className="flex justify-between items-center p-5 border-b border-[var(--color-meza-border)] bg-[var(--color-meza-bg)]">
              <h3 className="font-bold text-[var(--color-meza-text)] text-lg">New {activeTab === 'finished' ? 'Menu Item' : 'Ingredient'}</h3>
              <button onClick={handleCloseModal} className="p-1.5 text-[var(--color-meza-muted)] hover:text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-bg)] rounded-sm transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Name</label>
                  <input type="text" required value={createData.name} onChange={e => setCreateData({ ...createData, name: e.target.value })} className="w-full px-4 py-2 bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] text-sm font-medium text-[var(--color-meza-text)]" placeholder="Name" />
                </div>

                {activeTab === 'finished' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Category</label>
                        <select value={createData.category} onChange={e => setCreateData({ ...createData, category: e.target.value })} className="w-full px-3 py-2 bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] text-sm font-medium text-[var(--color-meza-text)]">
                          <option value="Food">Food</option>
                          <option value="Drinks">Drinks</option>
                          <option value="Pastry">Pastry</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Sell Price</label>
                        <input type="number" step="any" min="0" required value={createData.price} onChange={e => setCreateData({ ...createData, price: e.target.value })} className="w-full px-4 py-2 bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] text-sm font-medium text-[var(--color-meza-text)]" placeholder="0.00" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Purchase Unit</label>
                        <input type="text" list="unit-options" required value={createData.purchaseUnit} onChange={e => setCreateData({ ...createData, purchaseUnit: e.target.value })} className="w-full px-4 py-2 bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] text-sm font-medium text-[var(--color-meza-text)]" placeholder="Select or type..." />
                        <datalist id="unit-options">
                          {uniqueUnits.map(unit => (
                            <option key={unit} value={unit} />
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Unit Cost</label>
                        <input type="number" step="any" min="0" required value={createData.unitCost} onChange={e => setCreateData({ ...createData, unitCost: e.target.value })} className="w-full px-4 py-2 bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] text-sm font-medium text-[var(--color-meza-text)]" placeholder="0.00" />
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Initial Stock</label>
                    <input type="number" step="any" min="0" required value={createData.stockQuantity} onChange={e => setCreateData({ ...createData, stockQuantity: e.target.value })} className="w-full px-4 py-2 bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] text-sm font-medium text-[var(--color-meza-text)]" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-meza-muted)] uppercase tracking-wider mb-1.5">Low Par Alert</label>
                    <input type="number" step="any" min="0" required value={createData.lowStockThreshold} onChange={e => setCreateData({ ...createData, lowStockThreshold: e.target.value })} className="w-full px-4 py-2 bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] text-sm font-medium text-[var(--color-meza-text)]" placeholder="5" />
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full py-3 bg-meza-text hover:bg-black text-white rounded-sm font-bold transition-all  active:scale-[0.98]">
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
          <div className="bg-[var(--color-meza-surface)] rounded-sm w-full max-w-md  overflow-hidden border border-[var(--color-meza-border)] transform transition-all">
            <div className="flex justify-between items-center p-5 border-b border-[var(--color-meza-border)] bg-[var(--color-meza-bg)]">
              <h3 className="font-bold text-[var(--color-meza-text)] text-lg">Recipe & Costing</h3>
              <button onClick={handleCloseModal} className="p-1.5 text-[var(--color-meza-muted)] hover:text-[var(--color-meza-muted)] hover:bg-[var(--color-meza-bg)] rounded-sm transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6">
              <div className="flex items-center space-x-4 mb-6">
                <img src={currentItem.photoUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"} alt="" className="w-16 h-16 rounded-sm object-cover  border border-[var(--color-meza-border)]" />
                <div>
                  <h4 className="font-bold text-[var(--color-meza-text)] text-xl">{currentItem.name}</h4>
                  <p className="text-sm font-bold text-[var(--color-meza-muted)]">Sell Price: <span className="text-[var(--color-meza-primary)]">₱{currentItem.price.toFixed(2)}</span></p>
                </div>
              </div>

              {!recipeData ? (
                <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-[var(--color-meza-primary)] border-t-transparent rounded-full animate-spin"></div></div>
              ) : recipeData.error ? (
                <div className="py-8 text-center bg-[var(--color-danger)]/10 border border-red-100 rounded-sm">
                  <p className="text-[var(--color-danger)] font-bold">Error loading recipe data. (Status: {recipeData.status})</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-[var(--color-danger)]/10 rounded-sm border border-red-100 text-center">
                      <div className="text-[10px] font-bold text-[var(--color-danger)] uppercase tracking-wider mb-1">COGS (Total Cost)</div>
                      <div className="text-xl font-bold text-[var(--color-danger)]">₱{(recipeData.cogs || 0).toFixed(2)}</div>
                    </div>
                    <div className={`p-4 rounded-sm border text-center ${recipeData.marginPercent >= 65 ? 'bg-[var(--color-success)]/10 border-green-100' : 'bg-[var(--color-warning)]/10 border-yellow-100'}`}>
                      <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${recipeData.marginPercent >= 65 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>Profit Margin</div>
                      <div className={`text-xl font-bold ${recipeData.marginPercent >= 65 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>{(recipeData.marginPercent || 0).toFixed(1)}%</div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-xs font-bold text-[var(--color-meza-muted)] uppercase tracking-wider flex items-center space-x-1.5">
                        <Beaker className="w-3.5 h-3.5" />
                        <span>Ingredients Breakdown</span>
                      </h4>
                      <button onClick={() => setIsMenuModalOpen(true)} className="text-xs font-bold text-[var(--color-meza-primary)] hover:text-[var(--color-meza-primary)]-hover transition-colors">
                        Edit Recipe
                      </button>
                    </div>
                    {recipeData.ingredientsBreakdown && recipeData.ingredientsBreakdown.length > 0 ? (
                      <div className="border border-[var(--color-meza-border)] rounded-sm overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-[var(--color-meza-bg)] border-b border-[var(--color-meza-border)] text-[var(--color-meza-muted)]">
                            <tr>
                              <th className="py-2 px-3 text-left font-bold uppercase">Ingredient</th>
                              <th className="py-2 px-3 text-right font-bold uppercase">Qty</th>
                              <th className="py-2 px-3 text-right font-bold uppercase">Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {recipeData.ingredientsBreakdown.map((ing, idx) => (
                              <tr key={idx} className="bg-[var(--color-meza-surface)]">
                                <td className="py-2.5 px-3 font-semibold text-[var(--color-meza-text)]">{ing.name}</td>
                                <td className="py-2.5 px-3 text-right text-[var(--color-meza-muted)]">{ing.quantity}{ing.unit}</td>
                                <td className="py-2.5 px-3 text-right font-bold text-[var(--color-meza-text)]">₱{ing.cost.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="bg-[var(--color-meza-bg)] p-4 rounded-sm text-center text-sm text-[var(--color-meza-muted)] italic border border-[var(--color-meza-border)]">
                        No recipe configured for this item.
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button onClick={() => { setIsRecipeModalOpen(false); openAdjustModal(currentItem); }} className="w-full py-3 bg-[var(--color-meza-bg)] hover:bg-[var(--color-meza-border)] text-[var(--color-meza-text)] rounded-sm font-bold transition-all ">
                      Adjust Stock Levels
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <MenuItemModal 
        isOpen={isMenuModalOpen} 
        onClose={() => {
          setIsMenuModalOpen(false);
          if (currentItem) openRecipeCosting(currentItem); // refresh recipe data
        }} 
        initialData={currentItem}
        rawIngredients={ingredients}
        token={token}
        onSuccess={fetchData}
      />
    </div>
  );
}
