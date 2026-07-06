import re

with open('/Users/apple/Meza/backend/routes/inventory.js', 'r') as f:
    content = f.read()

old_purchase = """    // Create Purchase Order Record
    const po = new PurchaseOrder({
      ingredientId,
      quantityReceived,
      totalCostPaid,
      unitCostForBatch,
      receivedBy: req.user.id,
      supplierName
    });
    await po.save();

    // Update Ingredient
    ingredient.stockQuantity = newTotalStock;
    ingredient.movingAverageCost = newMovingAverageCost;
    ingredient.unitCost = newMovingAverageCost; // Also update base unitCost for backward compatibility
    await ingredient.save();"""

new_purchase = """    // Create Purchase Order Record
    const po = new PurchaseOrder({
      ingredientId,
      quantityReceived,
      totalCostPaid,
      unitCostForBatch,
      receivedBy: req.user.id,
      supplierName
    });
    await po.save();

    // Update Ingredient using atomic $inc to prevent Read-Modify-Write data loss
    await Ingredient.findByIdAndUpdate(ingredientId, {
      $inc: { stockQuantity: quantityReceived },
      $set: { 
        movingAverageCost: newMovingAverageCost,
        unitCost: newMovingAverageCost
      }
    });
    
    // update local reference if needed for response
    ingredient.stockQuantity += quantityReceived;
    ingredient.movingAverageCost = newMovingAverageCost;
    ingredient.unitCost = newMovingAverageCost;"""

content = content.replace(old_purchase, new_purchase, 1)

with open('/Users/apple/Meza/backend/routes/inventory.js', 'w') as f:
    f.write(content)
