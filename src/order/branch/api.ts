import { createClient } from '@supabase/supabase-js';

// Staff sign in on this device and stay signed in; row-level security limits every query to their branch.
// Same project as the site (env vars can point a build at the test project).
const url = import.meta.env.VITE_ORDERS_SUPABASE_URL || 'https://xiforwroabkgcjcfkltr.supabase.co';
const key = import.meta.env.VITE_ORDERS_SUPABASE_KEY || 'sb_publishable_gT4u_I9M8_Fa25PJv00Ddg_TTXYAvre';
export const sb = createClient(url, key, { auth: { persistSession: true, storageKey: 'broasted-branch-auth' } });

export type OrderItem = { id: number; name: string; qty: number; options: { name: string; qty: number; price: number }[]; note: string | null; line_total: number };
export type Order = {
  id: string; branch_id: string; number: number; business_date: string; status: 'new' | 'accepted' | 'ready' | 'delivered' | 'rejected' | 'no_show';
  type: 'pickup' | 'delivery'; customer_name: string; customer_phone: string;
  address: { area?: string; street?: string; building?: string; floor?: string; landmark?: string } | null;
  location: { lat: number; lng: number } | null; note: string | null; pay_method: 'cash' | 'cliq'; change_for: number | null;
  subtotal: number; reject_reason: string | null; created_at: string; accepted_at: string | null; printed_at: string | null; print_count: number;
  paid_method: 'cash' | 'cliq' | null; paid_ref: string | null; paid_at: string | null; order_items: OrderItem[];
};

// last 30 hours covers the whole working day (12 noon to 3 at night)
export async function loadOrders(branchId: string) {
  const since = new Date(Date.now() - 30 * 3600 * 1000).toISOString();
  const { data, error } = await sb.from('orders').select('*, order_items(*)').eq('branch_id', branchId).gte('created_at', since).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Order[]).map(o => ({ ...o, order_items: [...o.order_items].sort((a, b) => a.id - b.id) }));
}

export const rpc = async <T,>(fn: string, args: Record<string, unknown>) => {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw error;
  return data as T;
};
type Res = { ok: boolean; error?: string; print?: boolean; copy?: number };
export const acceptOrder = (id: string) => rpc<Res>('accept_order', { p_order: id });
export const reprintOrder = (id: string) => rpc<Res>('reprint_order', { p_order: id });
export const rejectOrder = (id: string, reason: string, block: boolean) => rpc<Res>('reject_order', { p_order: id, p_reason: reason, p_block: block });
export const setStatus = (id: string, status: 'ready' | 'delivered' | 'no_show', block = false) => rpc<Res>('set_order_status', { p_order: id, p_status: status, p_block: block });
export const markPaid = (id: string, method: 'cash' | 'cliq', ref: string) => rpc<Res>('mark_paid', { p_order: id, p_method: method, p_ref: ref || null });
export const phoneHistory = (id: string) => rpc<{ bad: number }>('phone_history', { p_order: id });
export const setAvailability = (item: string, mode: 'on' | 'hour' | 'tomorrow' | 'manual', branch: string) => rpc<Res>('set_item_availability', { p_item: item, p_mode: mode, p_branch: branch });
export const pauseBranch = (minutes: number | null, branch: string) => rpc<Res>('pause_branch', { p_minutes: minutes, p_branch: branch });
