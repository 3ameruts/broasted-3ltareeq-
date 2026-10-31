// Supabase Edge Function «order-push»: sends the customer's phone a notification when their order changes.
// Called only by the database (trigger in supabase/orders/18-push.sql) with a shared secret.
// Secrets (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_HOOK_SECRET. «Verify JWT» off.
import webpush from 'npm:web-push@3.6.7';

webpush.setVapidDetails('https://order.broasted3ltareeq.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

Deno.serve(async req => {
  if (req.method !== 'POST' || req.headers.get('x-hook-secret') !== Deno.env.get('PUSH_HOOK_SECRET')) {
    return new Response('not allowed', { status: 401 });
  }
  const { subscriptions, title, body, url, tag } = await req.json() as { subscriptions: Sub[]; title: string; body: string; url: string; tag: string };
  const payload = JSON.stringify({ title, body, url, tag });
  const results = await Promise.allSettled(subscriptions.slice(0, 5).map(s => webpush.sendNotification(s, payload, { TTL: 3600, urgency: 'high' })));
  const sent = results.filter(r => r.status === 'fulfilled').length;
  return Response.json({ sent, failed: results.length - sent });
});
