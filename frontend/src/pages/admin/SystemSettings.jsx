import React, { useState } from 'react';
import { Store, Receipt, Printer, CreditCard, Save, CheckCircle, Smartphone } from 'lucide-react';

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Mock Settings State
  const [settings, setSettings] = useState({
    restaurantName: 'Meza Cafe',
    address: '123 Coffee Street, Manila',
    phone: '+63 912 345 6789',
    currency: 'PHP (₱)',
    taxRate: '12',
    enableServiceCharge: true,
    serviceChargeRate: '5',
    printerIP: '192.168.1.100',
    printReceiptsAutomatically: true,
    acceptCard: true,
    acceptGcash: true,
    qrMenuLink: 'https://meza.cafe/menu'
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setIsSaving(true);
    // Mock save delay
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 1000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-meza-text tracking-tight">System Settings</h2>
          <p className="text-gray-500 text-sm mt-1">Configure your restaurant's core operations and hardware.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 bg-meza-text hover:bg-meza-primary text-white rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center space-x-2"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : saved ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        
        {/* Settings Navigation */}
        <div className="w-full md:w-64 flex flex-col space-y-2 shrink-0">
          <button 
            onClick={() => setActiveTab('general')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-white text-meza-primary shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-meza-text'}`}
          >
            <Store className="w-5 h-5" />
            <span>General Info</span>
          </button>
          <button 
            onClick={() => setActiveTab('billing')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'billing' ? 'bg-white text-meza-primary shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-meza-text'}`}
          >
            <Receipt className="w-5 h-5" />
            <span>Billing & Taxes</span>
          </button>
          <button 
            onClick={() => setActiveTab('payments')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'payments' ? 'bg-white text-meza-primary shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-meza-text'}`}
          >
            <CreditCard className="w-5 h-5" />
            <span>Payment Methods</span>
          </button>
          <button 
            onClick={() => setActiveTab('hardware')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'hardware' ? 'bg-white text-meza-primary shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-meza-text'}`}
          >
            <Printer className="w-5 h-5" />
            <span>Hardware & Printing</span>
          </button>
          <button 
            onClick={() => setActiveTab('qrmenu')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'qrmenu' ? 'bg-white text-meza-primary shadow-sm border border-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-meza-text'}`}
          >
            <Smartphone className="w-5 h-5" />
            <span>QR Menu Setup</span>
          </button>
        </div>

        {/* Settings Content Area */}
        <div className="flex-1 bg-white rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 p-8">
          
          {/* GENERAL INFO */}
          {activeTab === 'general' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-xl font-black text-meza-text border-b border-gray-100 pb-4">General Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Restaurant Name</label>
                  <input type="text" name="restaurantName" value={settings.restaurantName} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-meza-primary font-semibold text-meza-text text-sm transition-all" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Address (Printed on Receipt)</label>
                  <input type="text" name="address" value={settings.address} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-meza-primary font-semibold text-meza-text text-sm transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Phone Number</label>
                  <input type="text" name="phone" value={settings.phone} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-meza-primary font-semibold text-meza-text text-sm transition-all" />
                </div>
              </div>
            </div>
          )}

          {/* BILLING & TAXES */}
          {activeTab === 'billing' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-xl font-black text-meza-text border-b border-gray-100 pb-4">Billing & Taxes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Default Currency</label>
                  <select name="currency" value={settings.currency} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-meza-primary font-semibold text-meza-text text-sm transition-all cursor-pointer">
                    <option value="PHP (₱)">PHP (₱)</option>
                    <option value="USD ($)">USD ($)</option>
                    <option value="EUR (€)">EUR (€)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Tax Rate (%)</label>
                  <input type="number" name="taxRate" value={settings.taxRate} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-meza-primary font-semibold text-meza-text text-sm transition-all" />
                </div>
                <div className="space-y-4 md:col-span-2 pt-4 border-t border-gray-100">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" name="enableServiceCharge" checked={settings.enableServiceCharge} onChange={handleChange} className="sr-only" />
                      <div className={`block w-12 h-6 rounded-full transition-colors ${settings.enableServiceCharge ? 'bg-meza-primary' : 'bg-gray-200'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.enableServiceCharge ? 'transform translate-x-6' : ''}`}></div>
                    </div>
                    <span className="font-bold text-sm text-gray-700">Enable Service Charge</span>
                  </label>
                  {settings.enableServiceCharge && (
                    <div className="space-y-1.5 w-1/2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Service Charge (%)</label>
                      <input type="number" name="serviceChargeRate" value={settings.serviceChargeRate} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-meza-primary font-semibold text-meza-text text-sm transition-all" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PAYMENT METHODS */}
          {activeTab === 'payments' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-xl font-black text-meza-text border-b border-gray-100 pb-4">Payment Methods</h3>
              <p className="text-sm text-gray-500 mb-4">Toggle the payment options available to your cashiers.</p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                      <span className="font-black text-lg">₱</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-meza-text">Cash Payments</h4>
                      <p className="text-xs text-gray-500">Standard cash handling</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-gray-200 text-gray-600 text-xs font-bold rounded uppercase">Always On</div>
                </div>

                <label className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-meza-text">Card / Digital</h4>
                      <p className="text-xs text-gray-500">Credit, Debit, Apple Pay</p>
                    </div>
                  </div>
                  <div className="relative">
                    <input type="checkbox" name="acceptCard" checked={settings.acceptCard} onChange={handleChange} className="sr-only" />
                    <div className={`block w-12 h-6 rounded-full transition-colors ${settings.acceptCard ? 'bg-meza-primary' : 'bg-gray-200'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.acceptCard ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>

                <label className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                      <span className="font-black text-lg italic">G</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-meza-text">GCash / Maya</h4>
                      <p className="text-xs text-gray-500">Local e-wallets</p>
                    </div>
                  </div>
                  <div className="relative">
                    <input type="checkbox" name="acceptGcash" checked={settings.acceptGcash} onChange={handleChange} className="sr-only" />
                    <div className={`block w-12 h-6 rounded-full transition-colors ${settings.acceptGcash ? 'bg-meza-primary' : 'bg-gray-200'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.acceptGcash ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* HARDWARE & PRINTING */}
          {activeTab === 'hardware' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-xl font-black text-meza-text border-b border-gray-100 pb-4">Hardware & Printing</h3>
              
              <div className="space-y-1.5 md:w-2/3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Receipt Printer IP Address (ESC/POS)</label>
                <div className="flex space-x-3">
                  <input type="text" name="printerIP" value={settings.printerIP} onChange={handleChange} className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-meza-primary font-semibold text-meza-text text-sm transition-all" />
                  <button type="button" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors">Test Print</button>
                </div>
                <p className="text-xs text-gray-400 ml-1">Leave blank to use system default browser printing.</p>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <label className="flex items-center space-x-3 cursor-pointer p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="relative">
                    <input type="checkbox" name="printReceiptsAutomatically" checked={settings.printReceiptsAutomatically} onChange={handleChange} className="sr-only" />
                    <div className={`block w-12 h-6 rounded-full transition-colors ${settings.printReceiptsAutomatically ? 'bg-meza-primary' : 'bg-gray-200'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.printReceiptsAutomatically ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                  <div>
                    <span className="font-bold text-sm text-gray-700 block">Print Receipts Automatically</span>
                    <span className="text-xs text-gray-500 font-medium">Instantly open print dialog after a successful checkout.</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* QR MENU SETUP */}
          {activeTab === 'qrmenu' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-xl font-black text-meza-text border-b border-gray-100 pb-4">Table-Side QR Ordering</h3>
              
              <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col md:flex-row items-center gap-6">
                <div className="w-32 h-32 bg-white border-4 border-white shadow-sm rounded-xl p-2 shrink-0">
                  {/* Mock QR Code graphic */}
                  <div className="w-full h-full bg-blue-600 rounded" style={{
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M10 10h30v30H10zm10 10h10v10H20zm40-10h30v30H60zm10 10h10v10H70zM10 60h30v30H10zm10 10h10v10H20zm40-10h10v10H60zm20 0h10v10H80zm-20 20h10v10H60zm20 0h10v10H80z\' fill=\'%23ffffff\'/%3E%3C/svg%3E")',
                    backgroundSize: 'contain'
                  }}></div>
                </div>
                <div className="flex-1 space-y-3">
                  <h4 className="font-bold text-blue-900 text-lg">Your Live Menu URL</h4>
                  <div className="flex">
                    <input type="text" readOnly value={settings.qrMenuLink} className="flex-1 px-4 py-2 bg-white border border-blue-200 rounded-l-lg font-mono text-sm text-blue-800 outline-none" />
                    <button type="button" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-r-lg transition-colors">Copy</button>
                  </div>
                  <p className="text-xs text-blue-700">Customers can scan QR codes placed on tables to view the menu and place orders directly to the KDS.</p>
                  <button type="button" className="text-sm font-bold text-blue-600 hover:text-blue-800 underline mt-2">Generate QR Codes for Tables</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
