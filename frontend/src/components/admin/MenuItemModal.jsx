import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Beaker, Tag, DollarSign, Image as ImageIcon } from 'lucide-react';

export default function MenuItemModal({ isOpen, onClose, initialData, rawIngredients, token, onSuccess }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Food');
  const [price, setPrice] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  
  const [ingredients, setIngredients] = useState([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || '');
        setCategory(initialData.category || 'Food');
        setPrice(initialData.price || '');
        setPhotoUrl(initialData.photoUrl || '');
        setIsAvailable(initialData.isAvailable !== false);
        
        // Fetch recipe if editing
        setIsLoading(true);
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/menu/${initialData._id}/cost`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
          if (data.ingredientsBreakdown) {
            setIngredients(data.ingredientsBreakdown.map(ing => ({
              ingredientId: ing.ingredientId,
              quantity: ing.quantity,
              unit: ing.unit
            })));
          }
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));

      } else {
        setName('');
        setCategory('Food');
        setPrice('');
        setPhotoUrl('');
        setIsAvailable(true);
        setIngredients([]);
        setIsLoading(false);
      }
    }
  }, [isOpen, initialData, token]);

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { ingredientId: '', quantity: '', unit: 'g' }]);
  };

  const handleRemoveIngredient = (index) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (index, field, value) => {
    const newIngredients = [...ingredients];
    newIngredients[index][field] = value;
    
    // Auto-fill unit based on selected raw ingredient if possible
    if (field === 'ingredientId') {
      const selectedRaw = rawIngredients.find(r => r._id === value);
      if (selectedRaw) {
        // Simple heuristic: if purchase unit is kg, default to g. if L, default to ml.
        const pUnit = (selectedRaw.purchaseUnit || '').toLowerCase();
        if (pUnit === 'kg') newIngredients[index].unit = 'g';
        else if (pUnit === 'l' || pUnit === 'liter') newIngredients[index].unit = 'ml';
        else newIngredients[index].unit = selectedRaw.purchaseUnit;
      }
    }
    
    setIngredients(newIngredients);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // 1. Save Menu Item
      const menuPayload = { name, category, price: parseFloat(price), photoUrl, isAvailable };
      const menuMethod = initialData ? 'PUT' : 'POST';
      const menuUrl = initialData 
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/menu/${initialData._id}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/menu`;

      const menuRes = await fetch(menuUrl, {
        method: menuMethod,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(menuPayload)
      });

      if (!menuRes.ok) throw new Error('Failed to save menu item');
      const savedMenu = await menuRes.json();

      // 2. Save Recipe (only if there are valid ingredients)
      const validIngredients = ingredients.filter(i => i.ingredientId && parseFloat(i.quantity) > 0);
      
      const recipeRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          menuItemId: savedMenu._id,
          ingredients: validIngredients.map(i => ({
            ingredientId: i.ingredientId,
            quantity: parseFloat(i.quantity),
            unit: i.unit
          }))
        })
      });

      if (!recipeRes.ok) throw new Error('Failed to save recipe');

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-meza-text/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-[#fcf9f5] shrink-0">
          <div>
            <h3 className="font-black text-meza-text text-lg leading-tight">
              {initialData ? 'Edit Menu Item & Recipe' : 'New Menu Item'}
            </h3>
            <p className="text-xs font-bold text-gray-500 tracking-wide uppercase mt-0.5">Menu & Inventory Builder</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {isLoading ? (
            <div className="py-12 flex justify-center"><div className="w-6 h-6 border-2 border-meza-primary border-t-transparent rounded-full animate-spin"></div></div>
          ) : (
            <form id="menu-form" onSubmit={handleSubmit} className="space-y-8">
              
              {/* --- Item Details Section --- */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-meza-text uppercase tracking-wider flex items-center space-x-2 border-b border-gray-100 pb-2">
                  <Tag className="w-4 h-4 text-meza-primary" />
                  <span>Item Details</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Name</label>
                    <input 
                      type="text" required value={name} onChange={e => setName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-meza-primary font-semibold text-sm"
                      placeholder="e.g. Spanish Latte"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Category</label>
                    <select 
                      value={category} onChange={e => setCategory(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-meza-primary font-semibold text-sm"
                    >
                      <option value="Food">Food</option>
                      <option value="Drinks">Drinks</option>
                      <option value="Pastries">Pastries</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Price</label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="number" step="any" required value={price} onChange={e => setPrice(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-meza-primary font-semibold text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Photo URL</label>
                    <div className="relative">
                      <ImageIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="url" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-meza-primary font-semibold text-sm"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* --- Recipe Builder Section --- */}
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                  <h4 className="text-sm font-bold text-meza-text uppercase tracking-wider flex items-center space-x-2">
                    <Beaker className="w-4 h-4 text-meza-primary" />
                    <span>Recipe Builder</span>
                  </h4>
                  <button type="button" onClick={handleAddIngredient} className="text-xs font-bold text-meza-primary hover:text-meza-primary-hover bg-meza-primary/10 px-2.5 py-1 rounded-md flex items-center space-x-1 transition-colors">
                    <Plus className="w-3 h-3" /><span>Add Ingredient</span>
                  </button>
                </div>

                {ingredients.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-sm font-bold text-gray-400">No ingredients added.</p>
                    <p className="text-xs text-gray-400 mt-1">This item will not deduct raw inventory when sold.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ingredients.map((ing, idx) => (
                      <div key={idx} className="flex items-center space-x-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex-1">
                          <select 
                            required value={ing.ingredientId} onChange={e => handleIngredientChange(idx, 'ingredientId', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-meza-primary font-semibold text-sm"
                          >
                            <option value="">-- Select Raw Ingredient --</option>
                            {rawIngredients.map(r => (
                              <option key={r._id} value={r._id}>{r.name} (Cost: ₱{(r.movingAverageCost || r.unitCost).toFixed(2)}/{r.purchaseUnit})</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <input 
                            type="number" step="any" required value={ing.quantity} onChange={e => handleIngredientChange(idx, 'quantity', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-meza-primary font-semibold text-sm text-center"
                            placeholder="Qty"
                          />
                        </div>
                        <div className="w-24">
                          <select 
                            required value={ing.unit} onChange={e => handleIngredientChange(idx, 'unit', e.target.value)}
                            className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-meza-primary font-semibold text-sm"
                          >
                            <option value="g">g</option>
                            <option value="ml">ml</option>
                            <option value="kg">kg</option>
                            <option value="L">L</option>
                            <option value="pcs">pcs</option>
                          </select>
                        </div>
                        <button type="button" onClick={() => handleRemoveIngredient(idx)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </form>
          )}
        </div>
        
        <div className="p-5 border-t border-gray-100 bg-white shrink-0 flex justify-end space-x-3">
          <button type="button" onClick={onClose} disabled={isSaving} className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button type="submit" form="menu-form" disabled={isSaving || isLoading} className="px-6 py-2.5 bg-meza-text hover:bg-black text-white rounded-xl font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-70 flex items-center space-x-2">
            {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
            <span>{isSaving ? 'Saving...' : 'Save Menu & Recipe'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
