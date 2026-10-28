import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Online ordering switch, set from the admin panel (order_settings). The site shows its
// "order online" buttons only while ordering is on and the button is enabled.
export type Ordering = { visible: boolean; url: string };
const OFF: Ordering = { visible: false, url: '/order/' };

export function useOrdering(): Ordering {
  const [o, setO] = useState<Ordering>(OFF);
  useEffect(() => {
    let live = true;
    supabase.from('order_settings').select('enabled, show_button, order_url').eq('id', 1).maybeSingle()
      .then(({ data }) => { if (live && data) setO({ visible: !!(data.enabled && data.show_button), url: data.order_url || '/order/' }); });
    return () => { live = false; };
  }, []);
  return o;
}
