const DB_NAME = 'ofori-water-offline';
const DB_VERSION = 1;

const STORES = {
  pendingReads: 'pending_meter_reads',
  pendingCustomers: 'pending_customers'
};

export async function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.pendingReads)) {
        db.createObjectStore(STORES.pendingReads, {
          keyPath: 'local_id'
        });
      }

      if (!db.objectStoreNames.contains(STORES.pendingCustomers)) {
        db.createObjectStore(STORES.pendingCustomers, {
          keyPath: 'local_id'
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePendingRead(payload) {
  return saveRecord(STORES.pendingReads, {
    ...payload,
    local_id: payload.local_id || crypto.randomUUID(),
    sync_status: 'pending',
    created_offline_at: new Date().toISOString()
  });
}

export async function getPendingReads() {
  return getAllRecords(STORES.pendingReads);
}

export async function deletePendingRead(localId) {
  return deleteRecord(STORES.pendingReads, localId);
}

export async function savePendingCustomer(payload) {
  return saveRecord(STORES.pendingCustomers, {
    ...payload,
    local_id: payload.local_id || crypto.randomUUID(),
    sync_status: 'pending',
    created_offline_at: new Date().toISOString()
  });
}

export async function getPendingCustomers() {
  return getAllRecords(STORES.pendingCustomers);
}

export async function deletePendingCustomer(localId) {
  return deleteRecord(STORES.pendingCustomers, localId);
}

async function saveRecord(storeName, payload) {
  const db = await openOfflineDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    store.put(payload);

    tx.oncomplete = () => resolve(payload);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllRecords(storeName) {
  const db = await openOfflineDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function deleteRecord(storeName, key) {
  const db = await openOfflineDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    store.delete(key);

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}