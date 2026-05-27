import { supabase } from './client.js';

export async function createRoute(payload) {
  const { data, error } = await supabase
    .from('routes')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getRoutesByUtility(utilityId) {
  const { data, error } = await supabase
    .from('routes')
    .select(`
      *,
      dmas (
        name,
        code
      )
    `)
    .eq('utility_id', utilityId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addRouteStop(payload) {
  const { data, error } = await supabase
    .from('route_stops')
    .upsert(payload, {
      onConflict: 'route_id,customer_id'
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getRouteStops(routeId) {
  const { data, error } = await supabase
    .from('route_stops')
    .select(`
      *,
      customers (
        account_number,
        customer_name,
        service_address,
        meter_number,
        meter_lat,
        meter_lon,
        service_lat,
        service_lon
      )
    `)
    .eq('route_id', routeId)
    .order('stop_sequence');

  if (error) throw error;
  return data || [];
}

export async function updateRouteStop(stopId, payload) {
  const { data, error } = await supabase
    .from('route_stops')
    .update(payload)
    .eq('id', stopId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function addRouteStopsBulk(stops = []) {
  if (!stops.length) return [];

  const { data, error } = await supabase
    .from('route_stops')
    .upsert(stops, {
      onConflict: 'route_id,customer_id'
    })
    .select('*');

  if (error) throw error;
  return data || [];
}

export async function completeRouteStopByCustomer({ utilityId, customerId }) {
  const { data, error } = await supabase
    .from('route_stops')
    .update({
      status: 'completed'
    })
    .eq('utility_id', utilityId)
    .eq('customer_id', customerId)
    .neq('status', 'completed')
    .select('*');

  if (error) throw error;
  return data || [];
}