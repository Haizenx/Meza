import { API_URL } from '../../config';
import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Beaker, Tag, DollarSign, Image as ImageIcon, Settings2 } from 'lucide-react';

export default function MenuItemModal({ isOpen, onClose, initialData, rawIngredients, token, onSuccess }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Food');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  
  const [hasSizes, setHasSizes] = useState(false);
  const [sizes, setSizes] = useState([{ name: 'Regular', price: '' }]);
  const [recipes, setRecipes] = useState({ 'Regular': [] });
  const [activeRecipeSize, setActiveRecipeSize] = useState('Regular');
  
  const [modifierGroups, setModifierGroups] = useState([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || '');
        setCategory(initialData.category || 'Food');
        setPrice(initialData.price || '');
        setDescription(initialData.description || '');
        setPhotoUrl(initialData.photoUrl || '');
        setIsAvailable(initialData.isAvailable !== false);
        setModifierGroups(initialData.modifierGroups || []);
        const itemHasSizes = initialData.sizes && initialData.sizes.length > 0;
        setHasSizes(itemHasSizes);
        setSizes(itemHasSizes ? initialData.sizes : [{ name: 'Regular', price: '' }]);
        
        // Fetch recipes
        setIsLoading(true);
        fetch(`${API_URL}/api/recipes?menuItemId=${initialData._id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then(data => {
          const recMap = {};
          if (data && data.length > 0) {
            data.forEach(r => {
              recMap[r.size] = r.ingredients.map(ing => ({
                ingredientId: ing.ingredientId._id || ing.ingredientId,
                quantity: ing.quantity,
                unit: ing.unit
              }));
            });
          }
          if (Object.keys(recMap).length === 0) recMap['Regular'] = [];
          setRecipes(recMap);
          setActiveRecipeSize(itemHasSizes ? initialData.sizes[0].name : 'Regular');
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));

      } else {
        setName('');
        setCategory('Food');
        setPrice('');
        setDescription('');
        setPhotoUrl('');
        setIsAvailable(true);
        setHasSizes(false);
        setSizes([{ name: 'Regular', price: '' }]);
        setRecipes({ 'Regular': [] });
        setActiveRecipeSize('Regular');
        setModifierGroups([]);
        setIsLoading(false);
      }
    }
  }, [isOpen, initialData, token]);

  // --- Sizes Handlers ---
  const handleAddSize = () => {
    const newSize = { name: '', price: '' };
    setSizes([...sizes, newSize]);
  };
  const handleRemoveSize = (index) => {
    setSizes(sizes.filter((_, i) => i !== index));
  };
  const handleSizeChange = (index, field, value) => {
    const newSizes = [...sizes];
    newSizes[index][field] = value;
    setSizes(newSizes);
  };

  // --- Recipe Handlers ---
  const handleAddIngredient = () => {
    const newRecipes = { ...recipes };
    if (!newRecipes[activeRecipeSize]) newRecipes[activeRecipeSize] = [];
    newRecipes[activeRecipeSize] = [...newRecipes[activeRecipeSize], { ingredientId: '', quantity: '', unit: 'g' }];
    setRecipes(newRecipes);
  };

  const handleRemoveIngredient = (index) => {
    const newRecipes = { ...recipes };
    newRecipes[activeRecipeSize] = newRecipes[activeRecipeSize].filter((_, i) => i !== index);
    setRecipes(newRecipes);
  };

  const handleIngredientChange = (index, field, value) => {
    const newRecipes = { ...recipes };
    if (!newRecipes[activeRecipeSize]) newRecipes[activeRecipeSize] = [];
    newRecipes[activeRecipeSize][index][field] = value;
    
    if (field === 'ingredientId') {
      const selectedRaw = rawIngredients.find(r => r._id === value);
      if (selectedRaw) {
        const pUnit = (selectedRaw.purchaseUnit || '').toLowerCase();
        if (pUnit === 'kg') newRecipes[activeRecipeSize][index].unit = 'g';
        else if (pUnit === 'l' || pUnit === 'liter') newRecipes[activeRecipeSize][index].unit = 'ml';
        else newRecipes[activeRecipeSize][index].unit = selectedRaw.purchaseUnit;
      }
    }
    setRecipes(newRecipes);
  };

  // --- Modifier Handlers ---
  const handleAddModifierGroup = () => {
    setModifierGroups([...modifierGroups, { name: '', required: false, multiSelect: false, options: [] }]);
  };

  const handleRemoveModifierGroup = (gIdx) => {
    setModifierGroups(modifierGroups.filter((_, i) => i !== gIdx));
  };

  const handleUpdateModifierGroup = (gIdx, field, value) => {
    const newGroups = [...modifierGroups];
    newGroups[gIdx][field] = value;
    setModifierGroups(newGroups);
  };

  const handleAddModifierOption = (gIdx) => {
    const newGroups = [...modifierGroups];
    newGroups[gIdx].options.push({ name: '', price: '' });
    setModifierGroups(newGroups);
  };

  const handleRemoveModifierOption = (gIdx, oIdx) => {
    const newGroups = [...modifierGroups];
    newGroups[gIdx].options.splice(oIdx, 1);
    setModifierGroups(newGroups);
  };

  const handleUpdateModifierOption = (gIdx, oIdx, field, value) => {
    const newGroups = [...modifierGroups];
    newGroups[gIdx].options[oIdx][field] = value;
    setModifierGroups(newGroups);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Cleanup modifiers data
      const cleanedModifierGroups = modifierGroups
        .filter(g => g.name.trim() !== '')
        .map(g => ({
          ...g,
          options: g.options
            .filter(o => o.name.trim() !== '')
            .map(o => ({ ...o, price: parseFloat(o.price) || 0 }))
        }));

      // 1. Save Menu Item
      const cleanedSizes = hasSizes ? sizes.filter(s => s.name.trim() !== '').map(s => ({ name: s.name, price: parseFloat(s.price) || 0 })) : [];
      const basePrice = hasSizes && cleanedSizes.length > 0 ? cleanedSizes[0].price : parseFloat(price) || 0;
      const menuPayload = { name, category, price: basePrice, sizes: cleanedSizes, description, photoUrl, isAvailable, modifierGroups: cleanedModifierGroups };
      const menuMethod = initialData ? 'PUT' : 'POST';
      const menuUrl = initialData 
        ? `${API_URL}/api/menu/${initialData._id}`
        : `${API_URL}/api/menu`;

      const menuRes = await fetch(menuUrl, {
        method: menuMethod,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(menuPayload)
      });

      if (!menuRes.ok) throw new Error('Failed to save menu item');
      const savedMenu = await menuRes.json();

      // 2. Save Recipes
      const sizesToSave = (hasSizes && cleanedSizes.length > 0) ? cleanedSizes.map(s => s.name) : ['Regular'];
      
      const recipesPayload = [];
      for (const s of sizesToSave) {
        const ingList = recipes[s] || [];
        const validIngredients = ingList.filter(i => i.ingredientId && parseFloat(i.quantity) > 0);
        if (validIngredients.length > 0) {
          recipesPayload.push({
            menuItemId: savedMenu._id,
            size: s,
            ingredients: validIngredients.map(i => ({
              ingredientId: i.ingredientId,
              quantity: parseFloat(i.quantity),
              unit: i.unit
            }))
          });
        }
      }

      if (recipesPayload.length > 0) {
        const recipeRes = await fetch(`${API_URL}/api/recipes/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ recipes: recipesPayload })
        });
        
        if (!recipeRes.ok) {
          const errText = await recipeRes.text();
          throw new Error(`Batch recipe save failed: ${errText}`);
        }
      }

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
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
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
                  <div className="md:col-span-2 space-y-3 pt-2">
                    <label className="flex items-center space-x-2 text-sm font-bold text-meza-text">
                      <input type="checkbox" checked={hasSizes} onChange={e => setHasSizes(e.target.checked)} className="rounded text-meza-primary focus:ring-meza-primary" />
                      <span>Item has multiple sizes (e.g. Regular, Large)</span>
                    </label>

                    {hasSizes ? (
                      <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                        {sizes.map((s, idx) => (
                          <div key={idx} className="flex items-center space-x-3">
                            <input 
                              type="text" required placeholder="Size Name (e.g. Large)" 
                              value={s.name} onChange={e => handleSizeChange(idx, 'name', e.target.value)}
                              className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-meza-primary font-semibold text-sm"
                            />
                            <div className="relative w-32">
                              <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input 
                                type="number" step="any" min="0" required placeholder="0.00" 
                                value={s.price} onChange={e => handleSizeChange(idx, 'price', e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-meza-primary font-semibold text-sm"
                              />
                            </div>
                            <button type="button" onClick={() => handleRemoveSize(idx)} disabled={sizes.length === 1} className="p-2 text-gray-400 hover:text-red-500 rounded-lg disabled:opacity-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={handleAddSize} className="text-xs font-bold text-meza-primary hover:text-meza-primary-hover flex items-center space-x-1">
                          <Plus className="w-3 h-3" /><span>Add another size</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5 w-1/2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Base Price</label>
                        <div className="relative">
                          <DollarSign className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input 
                            type="number" step="any" min="0" required value={price} onChange={e => setPrice(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-meza-primary font-semibold text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    )}
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
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Description (for QR Menu)</label>
                    <textarea 
                      value={description} onChange={e => setDescription(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-meza-primary font-semibold text-sm min-h-[80px] resize-y"
                      placeholder="e.g. A classic espresso-based coffee beverage..."
                    />
                  </div>
                </div>
              </div>

              {/* --- Modifiers Builder Section --- */}
              <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-200">
                <div className="flex justify-between items-end border-b border-gray-200 pb-2">
                  <div>
                    <h4 className="text-sm font-bold text-meza-text uppercase tracking-wider flex items-center space-x-2">
                      <Settings2 className="w-4 h-4 text-purple-500" />
                      <span>Add-ons & Modifiers</span>
                    </h4>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold tracking-wider">Create options like "Extra Shot" or "Oat Milk"</p>
                  </div>
                  <button type="button" onClick={handleAddModifierGroup} className="text-xs font-bold text-purple-600 hover:text-purple-700 bg-purple-100 hover:bg-purple-200 px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-colors shadow-sm">
                    <Plus className="w-3.5 h-3.5" /><span>Add Group</span>
                  </button>
                </div>

                {modifierGroups.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm font-bold text-gray-400">No modifier groups.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {modifierGroups.map((group, gIdx) => (
                      <div key={gIdx} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center space-x-3">
                          <input 
                            type="text" required placeholder="Group Name (e.g. Add-ons)" 
                            value={group.name} onChange={e => handleUpdateModifierGroup(gIdx, 'name', e.target.value)}
                            className="flex-1 px-3 py-1.5 text-sm font-bold bg-white border border-gray-200 rounded-lg outline-none focus:border-purple-400"
                          />
                          <label className="flex items-center space-x-1.5 text-xs font-bold text-gray-600">
                            <input type="checkbox" checked={group.multiSelect} onChange={e => handleUpdateModifierGroup(gIdx, 'multiSelect', e.target.checked)} className="rounded text-purple-500 focus:ring-purple-500" />
                            <span>Multiple Choice</span>
                          </label>
                          <label className="flex items-center space-x-1.5 text-xs font-bold text-gray-600">
                            <input type="checkbox" checked={group.required} onChange={e => handleUpdateModifierGroup(gIdx, 'required', e.target.checked)} className="rounded text-purple-500 focus:ring-purple-500" />
                            <span>Required</span>
                          </label>
                          <button type="button" onClick={() => handleRemoveModifierGroup(gIdx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="p-3 space-y-2">
                          {group.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center space-x-2">
                              <input 
                                type="text" required placeholder="Option Name (e.g. Vanilla Syrup)" 
                                value={opt.name} onChange={e => handleUpdateModifierOption(gIdx, oIdx, 'name', e.target.value)}
                                className="flex-1 px-3 py-1.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-purple-400"
                              />
                              <div className="relative w-32">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">₱</span>
                                <input 
                                  type="number" step="any" required placeholder="0.00" 
                                  value={opt.price} onChange={e => handleUpdateModifierOption(gIdx, oIdx, 'price', e.target.value)}
                                  className="w-full pl-7 pr-3 py-1.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-purple-400"
                                />
                              </div>
                              <button type="button" onClick={() => handleRemoveModifierOption(gIdx, oIdx)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={() => handleAddModifierOption(gIdx)} className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center space-x-1 pl-1">
                            <Plus className="w-3 h-3" /><span>Add Option</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* --- Recipe Builder Section --- */}
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                  <div>
                    <h4 className="text-sm font-bold text-meza-text uppercase tracking-wider flex items-center space-x-2">
                      <Beaker className="w-4 h-4 text-meza-primary" />
                      <span>Recipe Builder</span>
                    </h4>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold tracking-wider">Raw inventory deduction</p>
                  </div>
                  <button type="button" onClick={handleAddIngredient} className="text-xs font-bold text-meza-primary hover:text-meza-primary-hover bg-meza-primary/10 px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-colors">
                    <Plus className="w-3.5 h-3.5" /><span>Add Ingredient</span>
                  </button>
                </div>

                {hasSizes && (
                  <div className="flex space-x-2 border-b border-gray-200 pb-2 overflow-x-auto">
                    {sizes.map(s => (
                      <button 
                        key={s.name} type="button"
                        onClick={() => setActiveRecipeSize(s.name || 'Regular')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${activeRecipeSize === (s.name || 'Regular') ? 'bg-meza-text text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {s.name || 'Unnamed Size'} Recipe
                      </button>
                    ))}
                  </div>
                )}

                {(!recipes[activeRecipeSize] || recipes[activeRecipeSize].length === 0) ? (
                  <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-sm font-bold text-gray-400">No ingredients added for {activeRecipeSize}.</p>
                    <p className="text-xs text-gray-400 mt-1">This item will not deduct raw inventory when sold.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recipes[activeRecipeSize].map((ing, idx) => (
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
                            type="number" step="any" min="0" required value={ing.quantity} onChange={e => handleIngredientChange(idx, 'quantity', e.target.value)}
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
