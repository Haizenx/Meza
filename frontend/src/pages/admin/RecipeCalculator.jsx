import React, { useState, useEffect } from 'react';
import { Settings2, Tag, ChevronDown, ChevronUp, Beaker } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function RecipeCalculator() {
  const { token } = useAuth();
  const [marginsData, setMarginsData] = useState([]);
  const [expandedItem, setExpandedItem] = useState(null);

  useEffect(() => {
    if (!token) return;
    
    // Fetch Server-Calculated Margins with ingredientsBreakdown
    fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/analytics/margins`, { 
      headers: { 'Authorization': `Bearer ${token}` } 
    })
      .then(r => r.json())
      .then(setMarginsData)
      .catch(console.error);
  }, [token]);

  const getMarginColor = (marginPercent) => {
    if (marginPercent >= 70) return 'bg-green-50/80 text-green-700 border-green-200/60';
    if (marginPercent >= 50) return 'bg-yellow-50/80 text-yellow-700 border-yellow-200/60';
    return 'bg-red-50/80 text-red-700 border-red-200/60';
  };

  const getMatrixCategory = (marginPercent, volume) => {
    const isHighMargin = marginPercent >= 65;
    const isHighVolume = volume >= 10; 
    
    if (isHighMargin && isHighVolume) return { label: 'Star', color: 'bg-yellow-50/80 text-yellow-700 border border-yellow-200/60', dot: 'bg-yellow-400' };
    if (!isHighMargin && isHighVolume) return { label: 'Plowhorse', color: 'bg-blue-50/80 text-blue-700 border border-blue-200/60', dot: 'bg-blue-400' };
    if (isHighMargin && !isHighVolume) return { label: 'Puzzle', color: 'bg-purple-50/80 text-purple-700 border border-purple-200/60', dot: 'bg-purple-400' };
    return { label: 'Dog', color: 'bg-gray-50/80 text-gray-700 border border-gray-200/60', dot: 'bg-gray-400' };
  };

  const maxVolume = Math.max(...marginsData.map(d => d.volume), 20);

  const toggleExpand = (id) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-meza-text tracking-tight">Recipe Cost & Margin Calculator</h2>
        <p className="text-gray-500 text-sm mt-1">Live COGS computation, pricing simulations, and menu engineering.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-200 flex flex-col">
          <h3 className="text-sm font-bold text-meza-text mb-6 flex items-center space-x-2 uppercase tracking-wider">
            <Settings2 className="w-4 h-4 text-meza-primary" />
            <span>Menu Engineering Matrix</span>
          </h3>
          <div className="flex-1 min-h-[400px] w-full relative bg-[#fcf9f5]/50 rounded-xl border border-dashed border-gray-200 p-4 flex flex-col">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">High Margin ↑</div>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Low Margin ↓</div>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-bold text-gray-400 uppercase tracking-widest origin-left whitespace-nowrap">← Low Volume</div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[10px] font-bold text-gray-400 uppercase tracking-widest origin-right whitespace-nowrap">High Volume →</div>
            
            {/* Crosshairs */}
            <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-gray-200"></div>
            <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-gray-200"></div>
            
            {/* Dynamic Plot Points */}
            {marginsData.map((item) => {
              const xPos = Math.max(5, Math.min(95, (item.volume / maxVolume) * 100));
              const yPos = Math.max(5, Math.min(95, 100 - item.marginPercent));
              const category = getMatrixCategory(item.marginPercent, item.volume);
              const isSelected = expandedItem === item._id;
              
              return (
                <div 
                  key={item._id}
                  onClick={() => toggleExpand(item._id)}
                  className={`absolute w-3 h-3 rounded-full shadow-sm cursor-pointer transition-all z-10 
                    ${category.dot} 
                    ${isSelected ? 'ring-4 ring-meza-primary/30 border-meza-primary scale-125' : 'border-2 border-white hover:scale-150'}
                  `} 
                  style={{ top: `${yPos}%`, left: `${xPos}%` }}
                  title={`${item.name} (${category.label} - Vol: ${item.volume})`}
                ></div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-sm font-bold text-meza-text flex items-center space-x-2 uppercase tracking-wider">
              <Tag className="w-4 h-4 text-meza-primary" />
              <span>Full Costing Breakdown</span>
            </h3>
          </div>
          <div className="overflow-x-auto flex-1 h-[450px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#fcf9f5] border-b border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4">Menu Item</th>
                  <th className="px-6 py-4">COGS</th>
                  <th className="px-6 py-4">Sell Price</th>
                  <th className="px-6 py-4 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {marginsData.map(item => {
                  const category = getMatrixCategory(item.marginPercent, item.volume);
                  const isExpanded = expandedItem === item._id;
                  
                  return (
                    <React.Fragment key={item._id}>
                      <tr 
                        onClick={() => toggleExpand(item._id)}
                        className={`transition-colors cursor-pointer ${isExpanded ? 'bg-meza-primary/5' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            <div>
                              <div className="font-semibold text-meza-text">{item.name}</div>
                              <div className={`mt-1.5 inline-flex text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-md ${category.color}`}>
                                {category.label} (Vol: {item.volume})
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500 font-medium">₱{item.cogs.toFixed(2)}</td>
                        <td className="px-6 py-4 font-bold text-meza-text">₱{item.sellPrice.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border ${getMarginColor(item.marginPercent)}`}>
                            {item.marginPercent.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                      {/* Expanded Ingredient Details */}
                      {isExpanded && (
                        <tr className="bg-gray-50/50">
                          <td colSpan="4" className="px-6 py-4">
                            <div className="pl-6 border-l-2 border-meza-primary/30">
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                                <Beaker className="w-3.5 h-3.5" />
                                <span>Recipe Ingredients Breakdown</span>
                              </h4>
                              {item.ingredientsBreakdown && item.ingredientsBreakdown.length > 0 ? (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-gray-400 border-b border-gray-200">
                                      <th className="pb-2 font-medium">Ingredient</th>
                                      <th className="pb-2 font-medium text-right">Quantity Used</th>
                                      <th className="pb-2 font-medium text-right">Cost Contribution</th>
                                      <th className="pb-2 font-medium text-right">% of COGS</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {item.ingredientsBreakdown.map((ing, idx) => (
                                      <tr key={idx}>
                                        <td className="py-2.5 font-semibold text-gray-700">{ing.name}</td>
                                        <td className="py-2.5 text-right text-gray-500">{ing.quantity} {ing.unit}</td>
                                        <td className="py-2.5 text-right font-medium text-meza-text">₱{ing.cost.toFixed(2)}</td>
                                        <td className="py-2.5 text-right text-gray-400 font-medium">
                                          {item.cogs > 0 ? ((ing.cost / item.cogs) * 100).toFixed(1) : 0}%
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="bg-gray-100/50">
                                      <td colSpan="2" className="py-2 px-2 text-right font-bold text-gray-500 uppercase text-[10px]">Total COGS</td>
                                      <td className="py-2 text-right font-black text-meza-text">₱{item.cogs.toFixed(2)}</td>
                                      <td></td>
                                    </tr>
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-sm text-gray-400 italic">No ingredients assigned to this recipe.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
