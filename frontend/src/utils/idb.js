import { openDB } from 'idb';

const DB_NAME = 'meza-pos';
const STORE_NAME = 'pendingOrders';

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'localUUID' });
      }
    },
  });
};

export const getPendingOrders = async () => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

export const savePendingOrder = async (order) => {
  const db = await initDB();
  await db.put(STORE_NAME, order);
};

export const deletePendingOrder = async (localUUID) => {
  const db = await initDB();
  await db.delete(STORE_NAME, localUUID);
};

export const updatePendingOrder = async (localUUID, updates) => {
  const db = await initDB();
  const order = await db.get(STORE_NAME, localUUID);
  if (order) {
    const updatedOrder = { ...order, ...updates };
    await db.put(STORE_NAME, updatedOrder);
    return updatedOrder;
  }
  return null;
};
