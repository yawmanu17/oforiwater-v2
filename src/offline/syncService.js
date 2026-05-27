import {
  getPendingReads,
  deletePendingRead,
  getPendingCustomers,
  deletePendingCustomer
} from './offlineStore.js';

import { saveMeterRead } from '../supabase/meterReads.js';
import { upsertCustomer } from '../supabase/customers.js';

export async function syncOfflineData() {
  if (!navigator.onLine) {
    return {
      ok: false,
      message: 'Device is offline.',
      readsSynced: 0,
      customersSynced: 0
    };
  }

  let readsSynced = 0;
  let customersSynced = 0;

  const pendingCustomers = await getPendingCustomers();

  for (const customer of pendingCustomers) {
    try {
      const { local_id, sync_status, created_offline_at, ...payload } = customer;
      await upsertCustomer(payload);
      await deletePendingCustomer(local_id);
      customersSynced += 1;
    } catch (error) {
      console.warn('Customer sync failed:', error.message);
    }
  }

  const pendingReads = await getPendingReads();

  for (const read of pendingReads) {
    try {
      const { local_id, sync_status, created_offline_at, ...payload } = read;
      await saveMeterRead(payload);
      await deletePendingRead(local_id);
      readsSynced += 1;
    } catch (error) {
      console.warn('Meter read sync failed:', error.message);
    }
  }

  return {
    ok: true,
    message: 'Offline sync complete.',
    readsSynced,
    customersSynced
  };
}