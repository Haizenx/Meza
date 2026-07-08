import { useState, useEffect } from 'react';
import { Tag, ChevronDown, ChevronUp, Beaker, Plus, Trash2, Save, Calculator } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function RecipeCalculator() {
  const { token } = useAuth();
  const [marginsData, setMarginsData] = useState([]);
  const [rawIngredients, setRawIngredients] = useState([]);
  const [expandedItem, setExpandedItem] = useState(null);
  
  // Sandbox State
  const [sandboxItem, setSandboxItem] = useState(null);
  const [sandboxIngredients, setSandboxIngredients] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = () => {
    if (!token) return;
    
    // Fetch Server-Calculated Margins with ingredientsBreakdown
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/analytics/margins`, { 
      headers: { 'Authorization': `Bearer ${token}` } 
    })
      .then(r => r.json())
      .then(setMarginsData)
      .catch(console.error);

    // Fetch Raw Ingredients for Sandbox
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/inventory`, { 
      headers: { 'Authorization': `Bearer ${token}` } 
    })
      .then(r => r.json())
      .then(setRawIngredients)
      .catch(console.error);
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const getMarginColor = (marginPercent) => {
    if (marginPercent >= 70) return 'bg-[var(--color-success)]/10/80 text-[var(--color-success)] border-[var(--color-success)]/30/60';
    if (marginPercent >= 50) return 'bg-[var(--color-warning)]/10/80 text-[var(--color-warning)] border-[var(--color-warning)]/30/60';
    return 'bg-[var(--color-danger)]/10/80 text-[var(--color-danger)] border-[var(--color-danger)]/30/60';
  };

  const toggleExpand = (item) => {
    if (expandedItem === item._id) {
      setExpandedItem(null);
      setSandboxItem(null);
      setSandboxIngredients([]);
    } else {
      setExpandedItem(item._id);
      setSandboxItem(item);
      if (item.ingredientsBreakdown) {
        setSandboxIngredients(item.ingredientsBreakdown.map(ing => ({
          ingredientId: ing.ingredientId,
          quantity: ing.quantity,
          unit: ing.unit,
          name: ing.name,
          cost: ing.cost
        })));
      } else {
        setSandboxIngredients([]);
      }
    }
  };

  // --- Sandbox Logic ---
  const handleAddSandboxIngredient = () => {
    setSandboxIngredients([...sandboxIngredients, { ingredientId: '', quantity: '', unit: 'g', cost: 0 }]);
  };

  const handleRemoveSandboxIngredient = (index) => {
    setSandboxIngredients(sandboxIngredients.filter((_, i) => i !== index));
  };

  const handleSandboxChange = (index, field, value) => {
    const newIngs = [...sandboxIngredients];
    newIngs[index][field] = value;

    if (field === 'ingredientId') {
      const selectedRaw = rawIngredients.find(r => r._id === value);
      if (selectedRaw) {
        newIngs[index].name = selectedRaw.name;
        const pUnit = (selectedRaw.purchaseUnit || '').toLowerCase();
        if (pUnit === 'kg') newIngs[index].unit = 'g';
        else if (pUnit === 'l' || pUnit === 'liter') newIngs[index].unit = 'ml';
        else newIngs[index].unit = selectedRaw.purchaseUnit || 'g';
      }
    }
    setSandboxIngredients(newIngs);
  };

  // Compute Live Sandbox COGS
  const computeSandboxCOGS = () => {
    let totalCogs = 0;
    sandboxIngredients.forEach(ing => {
      if (!ing.ingredientId || !ing.quantity) return;
      const raw = rawIngredients.find(r => r._id === ing.ingredientId);
      if (raw) {
        let qty = parseFloat(ing.quantity);
        if (isNaN(qty)) qty = 0;
        
        let multiplier = 1;
        const pUnit = (raw.purchaseUnit || '').toLowerCase();
        const uUnit = (ing.unit || '').toLowerCase();
        
        if (pUnit === 'kg' && uUnit === 'g') multiplier = 1/1000;
        else if ((pUnit === 'l' || pUnit === 'liter') && uUnit === 'ml') multiplier = 1/1000;
        
        const unitPrice = raw.movingAverageCost || raw.unitCost || 0;
        totalCogs += (qty * multiplier * unitPrice);
      }
    });
    return totalCogs;
  };

  const sandboxCOGS = computeSandboxCOGS();
  const sandboxMargin = sandboxItem ? (sandboxItem.sellPrice > 0 ? ((sandboxItem.sellPrice - sandboxCOGS) / sandboxItem.sellPrice) * 100 : 0) : 0;

  const handleSaveRecipe = async () => {
    if (!sandboxItem) return;
    setIsSaving(true);
    try {
      const validIngredients = sandboxIngredients.filter(i => i.ingredientId && parseFloat(i.quantity) > 0);
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          menuItemId: sandboxItem._id,
          ingredients: validIngredients.map(i => ({
            ingredientId: i.ingredientId,
            quantity: parseFloat(i.quantity),
            unit: i.unit
          }))
        })
      });

      if (!res.ok) throw new Error('Failed to save recipe');
      
      alert('Recipe Saved Successfully!');
      fetchData(); // Refresh list to get updated margins
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--color-meza-text)] tracking-tight">Recipe Cost Calculator</h2>
        <p className="text-[var(--color-meza-muted)] text-sm mt-1">Live COGS computation, interactive recipe testing, and margin analysis.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: INTERACTIVE RECIPE SANDBOX */}
        <div className="bg-[var(--color-meza-surface)] p-6 rounded-sm shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-[var(--color-meza-border)] flex flex-col h-[600px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-[var(--color-meza-text)] flex items-center space-x-2 uppercase tracking-wider">
              <Calculator className="w-4 h-4 text-[var(--color-meza-primary)]" />
              <span>Interactive Recipe Sandbox</span>
            </h3>
            {sandboxItem && (
              <button 
                onClick={handleSaveRecipe}
                disabled={isSaving}
                className="bg-meza-text hover:bg-black text-white px-3 py-1.5 rounded-sm text-xs font-bold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Recipe'}</span>
              </button>
            )}
          </div>

          {!sandboxItem ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-meza-border)] rounded-sm bg-[var(--color-meza-bg)]/50">
              <Beaker className="w-12 h-12 text-[var(--color-meza-muted)] mb-3" />
              <p className="font-bold text-[var(--color-meza-muted)]">No Item Selected</p>
              <p className="text-xs text-[var(--color-meza-muted)] mt-1">Select an item from the right to build its recipe.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--color-meza-border)] shrink-0">
                <div>
                  <h4 className="font-bold text-lg text-[var(--color-meza-text)]">{sandboxItem.name}</h4>
                  <p className="text-xs font-bold text-[var(--color-meza-muted)] uppercase tracking-widest mt-0.5">Sell Price: ₱{sandboxItem.sellPrice.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-[var(--color-meza-muted)] uppercase tracking-widest">Live COGS</div>
                  <div className="font-bold text-xl text-[var(--color-meza-text)]">₱{sandboxCOGS.toFixed(2)}</div>
                  <div className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${getMarginColor(sandboxMargin)}`}>
                    Margin: {sandboxMargin.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-3 shrink-0">
                <span className="text-xs font-bold text-[var(--color-meza-muted)] uppercase tracking-wider">Ingredients List</span>
                <button 
                  onClick={handleAddSandboxIngredient}
                  className="text-xs font-bold text-[var(--color-meza-primary)] hover:bg-[var(--color-meza-primary)]/10 px-2.5 py-1 rounded-md flex items-center space-x-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /><span>Add Ingredient</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {sandboxIngredients.length === 0 ? (
                  <p className="text-center text-sm font-medium text-[var(--color-meza-muted)] italic py-6">No ingredients added yet.</p>
                ) : (
                  sandboxIngredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center space-x-2 bg-[var(--color-meza-bg)] p-2.5 rounded-sm border border-[var(--color-meza-border)] ">
                      <div className="flex-1">
                        <select 
                          value={ing.ingredientId || ''} 
                          onChange={e => handleSandboxChange(idx, 'ingredientId', e.target.value)}
                          className="w-full px-2 py-1.5 bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] font-semibold text-xs"
                        >
                          <option value="">-- Select Raw Ingredient --</option>
                          {rawIngredients.map(r => (
                            <option key={r._id} value={r._id}>{r.name} (₱{(r.movingAverageCost || r.unitCost).toFixed(2)}/{r.purchaseUnit})</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-16">
                        <input 
                          type="number" step="any" placeholder="Qty"
                          value={ing.quantity || ''} 
                          onChange={e => handleSandboxChange(idx, 'quantity', e.target.value)}
                          className="w-full px-2 py-1.5 bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] font-semibold text-xs text-center"
                        />
                      </div>
                      <div className="w-16">
                        <select 
                          value={ing.unit || 'g'} 
                          onChange={e => handleSandboxChange(idx, 'unit', e.target.value)}
                          className="w-full px-1 py-1.5 bg-[var(--color-meza-surface)] border border-[var(--color-meza-border)] rounded-sm outline-none focus:border-[var(--color-meza-primary)] font-semibold text-xs"
                        >
                          <option value="g">g</option>
                          <option value="ml">ml</option>
                          <option value="kg">kg</option>
                          <option value="L">L</option>
                          <option value="pcs">pcs</option>
                        </select>
                      </div>
                      <button 
                        onClick={() => handleRemoveSandboxIngredient(idx)}
                        className="p-1.5 text-[var(--color-meza-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded-sm transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: ITEMS LIST */}
        <div className="bg-[var(--color-meza-surface)] rounded-sm shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-[var(--color-meza-border)] overflow-hidden flex flex-col h-[600px]">
          <div className="p-5 border-b border-[var(--color-meza-border)] shrink-0">
            <h3 className="text-sm font-bold text-[var(--color-meza-text)] flex items-center space-x-2 uppercase tracking-wider">
              <Tag className="w-4 h-4 text-[var(--color-meza-primary)]" />
              <span>Menu Items</span>
            </h3>
            <p className="text-xs text-[var(--color-meza-muted)] mt-1 font-medium">Click an item to edit its recipe.</p>
          </div>
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="w-full text-left text-sm min-w-[500px]">
              <thead className="bg-[var(--color-meza-bg)] border-b border-[var(--color-meza-border)] text-[var(--color-meza-muted)] text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4">Menu Item</th>
                  <th className="px-6 py-4">COGS</th>
                  <th className="px-6 py-4 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {marginsData.map(item => {
                  const isExpanded = expandedItem === item._id;
                  
                  return (
                    <tr 
                      key={item._id}
                      onClick={() => toggleExpand(item)}
                      className={`transition-colors cursor-pointer ${isExpanded ? 'bg-[var(--color-meza-primary)]/5' : 'hover:bg-[var(--color-meza-bg)]'}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--color-meza-primary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--color-meza-muted)]" />}
                          <div>
                            <div className={`font-semibold ${isExpanded ? 'text-[var(--color-meza-primary)]' : 'text-[var(--color-meza-text)]'}`}>{item.name}</div>
                            <div className="text-[10px] font-bold text-[var(--color-meza-muted)] uppercase tracking-widest mt-0.5">Sell: ₱{item.sellPrice.toFixed(2)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[var(--color-meza-muted)] font-medium">₱{item.cogs.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border ${getMarginColor(item.marginPercent)}`}>
                          {item.marginPercent.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
