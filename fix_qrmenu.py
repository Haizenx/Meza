import re

with open('/Users/apple/Meza/frontend/src/pages/customer/QRMenu.jsx', 'r') as f:
    content = f.read()

old_payload = """      const payload = {
        localUUID: crypto.randomUUID(),
        items: cart.map(i => ({ menuItemId: i._id, quantity: i.quantity, note: i.note || '' })),
        paymentMethod: isPaidOnline ? 'online' : 'cash', // 'cash' means pay at counter later
        isPaidOnline,
        customerName: customerName.trim(),
        tableNumber
      };

      // Simulate payment delay if online
      if (isPaidOnline) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }"""

new_payload = """      const payload = {
        localUUID: crypto.randomUUID(),
        items: cart.map(i => ({ menuItemId: i._id, quantity: i.quantity, note: i.note || '' })),
        paymentMethod: isPaidOnline ? 'online' : 'cash', // 'cash' means pay at counter later
        isPaidOnline,
        customerName: customerName.trim(),
        tableNumber,
        clientCalculatedTotal: total
      };

      // Simulate payment delay if online
      if (isPaidOnline) {
        // MOCK PAYMENT GATEWAY: Generate a fake intent token
        payload.paymentIntentId = `pi_${crypto.randomUUID()}`;
        await new Promise(resolve => setTimeout(resolve, 1500));
      }"""

content = content.replace(old_payload, new_payload, 1)

old_error = """      } else {
        alert('Failed to place order.');
      }
    } catch (err) {
      alert('Network error.');
    } finally {"""

new_error = """      } else {
        if (res.status === 409) {
          alert('Menu prices have been updated! Please review the new prices before ordering.');
          // Refresh menu to show new prices
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/menu/public`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(data => { setMenuItems(data); setIsCheckingOut(false); })
            .catch(console.error);
        } else {
          alert('Failed to place order.');
        }
      }
    } catch (err) {
      alert('Network error.');
    } finally {"""

content = content.replace(old_error, new_error, 1)

with open('/Users/apple/Meza/frontend/src/pages/customer/QRMenu.jsx', 'w') as f:
    f.write(content)
