import { supabase } from './client.js';

export async function createCustomer(payload) {
  const { data: customer, error } = await supabase
    .from('customers')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;

  await logAuditEvent({
    action: 'customer_created',
    entityType: 'customer',
    entityId: customer.id,
    details: {
      account_number: customer.account_number,
      customer_name: customer.customer_name
    }
  });

  return customer;
}

export async function upsertCustomer(payload) {
  const { data, error } = await supabase
    .from('customers')
    .upsert(payload, {
      onConflict: 'utility_id,account_number'
    })
    .select()
    .single();

  if (error) throw error;

  await logAuditEvent({
    action: 'customer_upserted',
    entityType: 'customer',
    entityId: data.id,
    details: {
      account_number: data.account_number,
      customer_name: data.customer_name
    }
  });

  return data;
}

export async function getCustomersByUtility(utilityId) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('utility_id', utilityId)
    .order('account_number');

  if (error) throw error;
  return data || [];
}

export async function updateCustomer(customerId, payload) {
  const { data, error } = await supabase
    .from('customers')
    .update(payload)
    .eq('id', customerId)
    .select()
    .single();

  if (error) throw error;

  await logAuditEvent({
    action: 'customer_updated',
    entityType: 'customer',
    entityId: data.id,
    details: {
      account_number: data.account_number,
      customer_name: data.customer_name
    }
  });

  return data;
}