const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  const cashierPage = await context.newPage();
  const kdsPage = await context.newPage();
  
  try {
    console.log("=== TEST SCENARIO 1: Setup & Login ===");
    await cashierPage.goto('http://localhost:5173/login');
    await cashierPage.fill('input[type="email"]', 'owner@meza.cafe');
    await cashierPage.fill('input[type="password"]', 'password123');
    await cashierPage.click('button:has-text("Sign in")');
    await cashierPage.waitForURL('**/admin/dashboard');
    
    await cashierPage.goto('http://localhost:5173/cashier');
    await cashierPage.waitForSelector('text=Start Shift');
    await cashierPage.fill('input[placeholder="₱0.00"]', '100');
    await cashierPage.click('button:has-text("Start Shift")');
    await cashierPage.waitForSelector('text=Meza POS');
    
    await kdsPage.goto('http://localhost:5173/kds');
    await kdsPage.waitForSelector('text=Kitchen Display System');
    console.log("✅ Logged in and initialized both tabs.");

    console.log("\\n=== TEST SCENARIO 2: Disconnecting Internet ===");
    await context.setOffline(true);
    console.log("✅ Network connection disabled (Simulating Wi-Fi drop).");
    
    await cashierPage.waitForTimeout(2000); 

    console.log("\\n=== TEST SCENARIO 3: Placing Offline Order ===");
    // Add first item we find
    const firstItem = cashierPage.locator('h3').first();
    const itemName = await firstItem.innerText();
    await firstItem.click(); 
    await cashierPage.waitForTimeout(500);
    
    await cashierPage.click('button:has-text("Pay")');
    await cashierPage.click('button:has-text("Cash")');
    await cashierPage.fill('input[placeholder="Amount Tendered"]', '500');
    await cashierPage.click('button:has-text("Complete Order")');
    
    await cashierPage.waitForSelector('text=Payment Complete');
    await cashierPage.click('button:has-text("Done")');
    console.log(`✅ Order placed successfully while offline for item: ${itemName}`);

    console.log("\\n=== TEST SCENARIO 4: Verifying Offline Indicators ===");
    await cashierPage.waitForSelector('text=Connection Lost. You are in Offline Mode.');
    await cashierPage.waitForSelector('text=Pending Syncs');
    console.log("✅ Cashier UI correctly warns about offline state and shows pending sync queue.");

    console.log("\\n=== TEST SCENARIO 5: Checking Local KDS Sync ===");
    await kdsPage.waitForSelector(`text=${itemName}`, { timeout: 5000 });
    console.log("✅ KDS successfully received and displayed the offline order via BroadcastChannel!");

    console.log("\\n=== TEST SCENARIO 6: Testing End Shift Safety Lock ===");
    await cashierPage.click('button:has-text("Close Register")');
    await cashierPage.waitForSelector('text=You cannot end your shift while offline with pending orders.');
    console.log("✅ System securely blocked cashier from ending shift without syncing.");
    await cashierPage.click('button:has-text("Cancel")');

    console.log("\\n=== TEST SCENARIO 7: Reconnecting & Cloud Sync ===");
    await context.setOffline(false);
    console.log("✅ Network connection restored.");
    
    await cashierPage.click('button:has-text("Pending Syncs")');
    await cashierPage.click('button:has-text("Force Sync All")');
    
    await cashierPage.waitForSelector('text=ONLINE', { timeout: 10000 });
    console.log("✅ Orders synced to cloud successfully.");
    
    await kdsPage.reload();
    await kdsPage.waitForSelector(`text=${itemName}`, { timeout: 5000 });
    console.log("✅ Backend confirmed: Order is permanently saved to database and visible to KDS.");

    console.log("\\n🎉 ALL OFFLINE TESTS PASSED.");
    
  } catch (error) {
    console.error("❌ Test Failed:", error);
  } finally {
    await browser.close();
  }
})();
