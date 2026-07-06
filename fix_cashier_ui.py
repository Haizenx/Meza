import re

with open('/Users/apple/Meza/frontend/src/pages/cashier/CashierMode.jsx', 'r') as f:
    content = f.read()

# 1. Add state variables
old_state = """  // Security Modal State (Manager PIN)
  const [pinModal, setPinModal] = useState({ isOpen: false, action: null, payload: null });
  const [pinInput, setPinInput] = useState('');"""

new_state = """  // Security Modal State (Manager PIN)
  const [pinModal, setPinModal] = useState({ isOpen: false, action: null, payload: null });
  const [pinInput, setPinInput] = useState('');
  const [managersList, setManagersList] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');"""

content = content.replace(old_state, new_state, 1)

# 2. Add fetch logic in useEffect
old_fetch = """    // Initial fetches
    fetchShift();
    fetchMenu();
    fetchKitchenOrders();
    fetchUnpaidOrders();"""

new_fetch = """    // Initial fetches
    fetchShift();
    fetchMenu();
    fetchKitchenOrders();
    fetchUnpaidOrders();
    
    // Fetch managers for PIN auth dropdown
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/auth/managers`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setManagersList(data);
        if (data.length > 0) setSelectedManagerId(data[0]._id);
      })
      .catch(console.error);"""

content = content.replace(old_fetch, new_fetch, 1)

# 3. Modify handlePinSubmit payload
old_submit = """      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pin: pinInput })
      });"""

new_submit = """      const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5001')}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ managerId: selectedManagerId, pin: pinInput })
      });"""

content = content.replace(old_submit, new_submit, 1)

# 4. Modify PIN Modal UI
old_modal = """        {/* PIN MODAL */}
        {pinModal.isOpen && (
          <div className="absolute inset-0 bg-meza-text/80 backdrop-blur-md z-[200] flex items-center justify-center">
            <form onSubmit={handlePinSubmit} className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100 text-center">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"><Lock className="w-6 h-6" /></div>
              <h2 className="text-xl font-black text-meza-text mb-2">Manager PIN Required</h2>
              <p className="text-sm text-gray-500 mb-6">Authorize this action.</p>
              <input type="password" required autoFocus value={pinInput} onChange={e => setPinInput(e.target.value)} className="w-full text-center tracking-widest text-2xl px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mb-6 font-bold" placeholder="••••" maxLength={4} />
              <div className="flex space-x-3">
                <button type="button" onClick={() => setPinModal({ isOpen: false })} className="flex-1 py-3 text-gray-500 hover:bg-gray-50 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold">Verify</button>
              </div>
            </form>
          </div>
        )}"""

new_modal = """        {/* PIN MODAL */}
        {pinModal.isOpen && (
          <div className="absolute inset-0 bg-meza-text/80 backdrop-blur-md z-[200] flex items-center justify-center">
            <form onSubmit={handlePinSubmit} className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100 text-center">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"><Lock className="w-6 h-6" /></div>
              <h2 className="text-xl font-black text-meza-text mb-2">Manager PIN Required</h2>
              <p className="text-sm text-gray-500 mb-4">Authorize this action.</p>
              
              <div className="text-left mb-4">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1 mb-1 block">Authorizing Manager</label>
                <select 
                  value={selectedManagerId} 
                  onChange={e => setSelectedManagerId(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-meza-primary font-bold transition-colors appearance-none"
                  required
                >
                  <option value="" disabled>Select Manager</option>
                  {managersList.map(m => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <input type="password" required autoFocus value={pinInput} onChange={e => setPinInput(e.target.value)} className="w-full text-center tracking-widest text-2xl px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mb-6 font-bold" placeholder="••••" maxLength={4} />
              <div className="flex space-x-3">
                <button type="button" onClick={() => setPinModal({ isOpen: false })} className="flex-1 py-3 text-gray-500 hover:bg-gray-50 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold">Verify</button>
              </div>
            </form>
          </div>
        )}"""

content = content.replace(old_modal, new_modal, 1)

with open('/Users/apple/Meza/frontend/src/pages/cashier/CashierMode.jsx', 'w') as f:
    f.write(content)
