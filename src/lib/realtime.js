import { supabase } from './supabaseClient';

/**
 * Subscribes to live changes on listings/bids (scoped by RLS to whatever the
 * current session can already see) and calls `onChange` on any insert/update.
 * Returns an unsubscribe function. Used by store.js's useApp() so pages don't
 * need to know about channels at all — replaces the old `storage`-event sync.
 */
export function subscribeRealtime(onChange) {
  const channel = supabase
    .channel('agribid-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, onChange)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
