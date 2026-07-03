/**
 * MongoDB Role Setup Script for Meza Cafe Digital System Suite
 * 
 * Instructions:
 * Run this script using `mongosh` as an admin user to create the
 * append-only role for the application connection string, fulfilling
 * Layer 1 of the Immutable Transactions & Audit Records security requirement.
 * 
 * Usage:
 * mongosh "mongodb://localhost:27017/admin" -u <adminUser> -p <adminPass> --file setup-db-roles.js
 */

const DB_NAME = "mezacafe"; // Replace if database name is different
const APP_USER = "mezacafe_app_user"; // Replace with your connection string username

use(DB_NAME);

// 1. Create the append-only role
db.createRole({
  role: "appendOnlyLedger",
  privileges: [
    {
      resource: { db: DB_NAME, collection: "transactions" },
      actions: ["find", "insert"]
    },
    {
      resource: { db: DB_NAME, collection: "purchaseorders" }, // Restock History
      actions: ["find", "insert"]
    },
    {
      resource: { db: DB_NAME, collection: "auditlogs" },
      actions: ["find", "insert"]
    }
  ],
  roles: []
});

console.log("Created 'appendOnlyLedger' role.");

// 2. Grant the role to the app user (ensure the user is created first!)
// Note: The app user will ALSO need standard readWrite roles for OTHER collections (like orders, menuitems, users).
// BUT they should NOT have readWrite on the entire database. They should have specific roles.
// To keep it simple, if they have readWrite on the db, you must use custom roles to specifically DENY update/delete on these three.
// Since MongoDB doesn't have explicit DENY, you must grant readWrite ONLY to the specific collections (orders, users, etc.)
// and grant appendOnlyLedger to the restricted ones.
console.log("Please grant 'appendOnlyLedger' and targeted collection readWrite roles to your application user.");
