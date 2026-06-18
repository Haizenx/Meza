import React from 'react';

// This is a hidden component designed specifically for 80mm thermal printers using @media print CSS
export default function ReceiptPrinter({ order, id = 'print-receipt-container' }) {
  if (!order) return null;

  return (
    <div id={id} className="hidden print:block font-mono text-black bg-white" style={{ width: '80mm', padding: '0 5mm', margin: 0 }}>
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="font-bold text-2xl uppercase tracking-widest">Meza Cafe</h1>
        <p className="text-xs">123 Cafe Street, Cityville</p>
        <p className="text-xs">Tel: (555) 123-4567</p>
        <div className="mt-2 text-sm border-b border-dashed border-black pb-2">
          <p>Order #{order.localUUID ? order.localUUID.split('-')[0].toUpperCase() : 'UNKNOWN'}</p>
          <p>{new Date(order.createdAtLocal || Date.now()).toLocaleString()}</p>
          {order.customerName && <p className="font-bold mt-1">Customer: {order.customerName}</p>}
        </div>
      </div>

      {/* Items */}
      <div className="mb-4 text-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dashed border-black text-left">
              <th className="font-normal pb-1">Qty Item</th>
              <th className="font-normal pb-1 text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {(order.cart || order.items || []).map((item, idx) => {
              const itemModSum = (item.modifiers || []).reduce((s, m) => s + (m.price || 0), 0);
              const basePrice = item.price || item.priceAtSale || 0;
              return (
                <React.Fragment key={idx}>
                  <tr>
                    <td className="pt-1">
                      <div className="flex">
                        <span className="w-6">{item.quantity}x</span>
                        <span className="font-bold flex-1">{item.name || 'Item'}</span>
                      </div>
                    </td>
                    <td className="pt-1 text-right align-top">
                      {((basePrice + itemModSum) * item.quantity).toFixed(2)}
                    </td>
                  </tr>
                  {(item.modifiers || []).map((mod, midx) => (
                    <tr key={`mod-${midx}`}>
                      <td className="pl-6 text-xs text-gray-700">+ {mod.name}</td>
                      <td className="text-right text-xs">{mod.price > 0 ? mod.price.toFixed(2) : ''}</td>
                    </tr>
                  ))}
                  {item.note && (
                    <tr>
                      <td colSpan="2" className="pl-6 text-xs italic">Note: {item.note}</td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="border-t border-dashed border-black pt-2 text-sm">
        <div className="flex justify-between mb-1">
          <span>Subtotal</span>
          <span>{order.total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg mb-2">
          <span>TOTAL</span>
          <span>{order.total.toFixed(2)}</span>
        </div>

        {order.paymentMethod === 'cash' && (
          <>
            <div className="flex justify-between">
              <span>Cash Tendered</span>
              <span>{order.cashTendered.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Change Due</span>
              <span>{Math.max(0, order.cashTendered - order.total).toFixed(2)}</span>
            </div>
          </>
        )}
        
        {order.paymentMethod === 'split' && (
          <div className="mt-2 border-t border-dashed border-gray-400 pt-1">
            <p className="text-xs uppercase mb-1">Split Payments:</p>
            {(order.splitPayments || []).map((p, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="capitalize">{p.method}</span>
                <span>{p.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {(order.paymentMethod === 'card' || order.paymentMethod === 'gcash') && (
          <div className="flex justify-between">
            <span className="capitalize">Paid via {order.paymentMethod}</span>
            <span>{order.total.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-xs">
        <p>Thank you for choosing</p>
        <p className="font-bold uppercase tracking-wider mb-8">Meza Cafe</p>
        <p className="text-[10px]">Powered by Antigravity POS</p>
      </div>
    </div>
  );
}
