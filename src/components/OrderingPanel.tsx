import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import ZonesPanel from './ZonesPanel';

// Admin tab: online ordering on/off, the "order online" button on the site, ordering hours,
// CliQ details shown to customers, and whether each branch's printer PC is connected.
type Settings = { enabled: boolean; show_button: boolean; order_url: string; open_time: string; last_order_time: string; cliq_alias: string | null; cliq_name: string | null; auto_complete_hours?: number };
type Printer = { branch_id: string; last_seen: string | null };
type WhatsApp = { phone_number_id: string; template: string; template_lang: string; test_phones: string; require_otp: boolean };
const SPLIT_URL = 'https://order.broasted3ltareeq.com/';

const ago = (iso: string | null) => {
  if (!iso) return 'ما اتصل أبداً';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'متصل هسّا' : m < 60 ? `آخر اتصال قبل ${m} دقيقة` : `آخر اتصال قبل ${Math.floor(m / 60)} ساعة`;
};

export default function OrderingPanel({ flash }: { flash: (text: string, bad?: boolean) => void }) {
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [a, b, p] = await Promise.all([
        supabase.from('order_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('order_branches').select('id, name').order('id'),
        supabase.from('printer_tokens').select('branch_id, last_seen'),
      ]);
      if (a.error || !a.data) return setMissing(true);
      const v = { ...(a.data as Settings), open_time: a.data.open_time.slice(0, 5), last_order_time: a.data.last_order_time.slice(0, 5) };
      setS(v); setSaved(v); setBranches(b.data ?? []); setPrinters((p.data ?? []) as Printer[]);
    })();
  }, []);

  if (missing) return <section className="apanel"><h3>الطلب الأونلاين</h3><div className="apanel__body"><p>إعدادات الطلب مش موجودة بقاعدة البيانات. شغّل ملف 08-order-button.sql بـ Supabase.</p></div></section>;
  if (!s) return <section className="apanel"><div className="apanel__body"><p>…</p></div></section>;

  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('order_settings').update({
      enabled: s.enabled, show_button: s.show_button, order_url: s.order_url, open_time: s.open_time, last_order_time: s.last_order_time,
      cliq_alias: s.cliq_alias?.trim() || null, cliq_name: s.cliq_name?.trim() || null,
      ...(s.auto_complete_hours ? { auto_complete_hours: s.auto_complete_hours } : {}),
    }).eq('id', 1);
    setSaving(false);
    if (error) return flash(`ما انحفظت إعدادات الطلب (${error.message})`, true);
    setSaved(s);
    flash(`الطلب الأونلاين ${s.enabled ? 'شغّال' : 'متوقف'}، والزر ${s.show_button ? 'ظاهر بالموقع' : 'مخفي'}`);
  };

  return (
    <>
      <section className="apanel">
        <h3>الطلب الأونلاين</h3>
        <div className="apanel__body">
          <label className="acheck"><input type="checkbox" checked={s.enabled} onChange={e => set({ enabled: e.target.checked })} /> الطلب الأونلاين شغّال</label>
          <p className="afield__hint">لما يكون مطفي، صفحة الطلب بتعرض «متوقف حالياً» وما حدا بيقدر يطلب.</p>
          <label className="acheck"><input type="checkbox" checked={s.show_button} onChange={e => set({ show_button: e.target.checked })} /> أظهر زر «اطلب أونلاين» بالموقع</label>
          <p className="afield__hint">الزر بيطلع بالهيدر وبأول الصفحة وتحت على الجوال. إذا الطلب الأونلاين متوقف، الزر بيضل ظاهر وصفحة الطلب بتحكي للزبون إنو الطلب متوقف حالياً. شيل الصح لتخفيه وتضل تجرّب الطلب برابطه.</p>
          <div className="afield">
            <span>وين بيوديك الزر؟</span>
            <label className="acheck"><input type="radio" name="ourl" checked={s.order_url === '/order/'} onChange={() => set({ order_url: '/order/' })} /> صفحة الطلب على نفس الموقع (broasted3ltareeq.com/order)</label>
            <label className="acheck"><input type="radio" name="ourl" checked={s.order_url === SPLIT_URL} onChange={() => set({ order_url: SPLIT_URL })} /> رابط الطلب المنفصل (order.broasted3ltareeq.com)</label>
          </div>
          <div className="arow">
            <label className="afield"><span>أول وقت للطلب</span><input type="time" value={s.open_time} onChange={e => set({ open_time: e.target.value })} /></label>
            <label className="afield"><span>آخر وقت للطلب</span><input type="time" value={s.last_order_time} onChange={e => set({ last_order_time: e.target.value })} /></label>
          </div>
          <div className="arow">
            <label className="afield"><span>كليك: الـ Alias</span><input dir="ltr" value={s.cliq_alias ?? ''} onChange={e => set({ cliq_alias: e.target.value })} /></label>
            <label className="afield"><span>كليك: اسم المستفيد</span><input value={s.cliq_name ?? ''} onChange={e => set({ cliq_name: e.target.value })} /></label>
          </div>
          {s.auto_complete_hours !== undefined && (
            <label className="afield"><span>الطلب المؤكد بيصير «انسلّم» لحاله بعد (ساعات)</span>
              <input type="number" min={1} max={24} dir="ltr" value={s.auto_complete_hours} onChange={e => set({ auto_complete_hours: Math.min(24, Math.max(1, Number(e.target.value) || 3)) })} />
              <span className="afield__hint">لأنو الكول سنتر ما بيعرف إمتى استلم الزبون. لحد ما ينسلّم، الزبون ما بيقدر يطلب طلب ثاني (إلا إذا الكول سنتر كبس «تم الاستلام»).</span>
            </label>
          )}
          <div className="arow">
            <button className="abtn abtn--primary" onClick={save} disabled={!dirty || saving}>{saving ? 'بنحفظ…' : 'احفظ إعدادات الطلب'}</button>
            <a className="abtn" href="/order/" target="_blank" rel="noopener">افتح صفحة الطلب</a>
            <a className="abtn" href="/order/branch/" target="_blank" rel="noopener">شاشة الفرع</a>
          </div>
        </div>
      </section>
      <ZonesPanel flash={flash} />
      <PushPanel flash={flash} />
      <WhatsAppPanel flash={flash} />
      <section className="apanel">
        <h3>طابعات الفروع</h3>
        <div className="apanel__body">
          {branches.map(b => {
            const p = printers.find(x => x.branch_id === b.id);
            const ok = p?.last_seen && Date.now() - new Date(p.last_seen).getTime() < 2 * 60000;
            return <p key={b.id}><strong>{b.name}:</strong> <span style={{ color: ok ? '#1a7f37' : '#b21017' }}>{p ? ago(p.last_seen) : 'ما في رمز طابعة'}</span></p>;
          })}
          <p className="afield__hint">كمبيوتر الكاشير بيتصل كل كم ثانية وهو شغّال. «متصل هسّا» يعني الطباعة جاهزة. حدّث الصفحة لتشوف آخر حالة.</p>
        </div>
      </section>
    </>
  );
}

// WhatsApp code check for a customer's first order on a device. The Meta key itself lives in Supabase Vault, never here.
function WhatsAppPanel({ flash }: { flash: (text: string, bad?: boolean) => void }) {
  const [w, setW] = useState<WhatsApp | null>(null);
  const [saved, setSaved] = useState<WhatsApp | null>(null);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    (async () => {
      const [c, o, r] = await Promise.all([
        supabase.from('whatsapp_config').select('phone_number_id, template, template_lang, test_phones').eq('id', 1).maybeSingle(),
        supabase.from('order_settings').select('require_otp').eq('id', 1).maybeSingle(),
        supabase.rpc('whatsapp_ready'),
      ]);
      if (c.error || !c.data || o.error) return setMissing(true);
      const v = { phone_number_id: c.data.phone_number_id ?? '', template: c.data.template, template_lang: c.data.template_lang, test_phones: (c.data.test_phones ?? []).join('، '), require_otp: !!o.data?.require_otp };
      setW(v); setSaved(v); setReady(!!r.data);
    })();
  }, []);
  if (missing) return <section className="apanel"><h3>تأكيد الرقم بالواتساب</h3><div className="apanel__body"><p>شغّل ملف 11-whatsapp-otp.sql بـ Supabase عشان يظهر هالقسم.</p></div></section>;
  if (!w) return null;
  const set = (patch: Partial<WhatsApp>) => setW({ ...w, ...patch });
  const configured = ready && /^\d{6,20}$/.test(w.phone_number_id);
  const save = async () => {
    if ((w.require_otp || w.test_phones.trim()) && !configured) return flash('عبّي Phone number ID وحط المفتاح بـ Vault قبل ما تشغّل التأكيد.', true);
    setSaving(true);
    // test phones in the stored 07XXXXXXXX form
    const tests = w.test_phones.split(/[\s,،]+/).map(x => x.replace(/\D/g, '').replace(/^(00962|962)/, '0').replace(/^7/, '07')).filter(x => /^07[789]\d{7}$/.test(x));
    const a = await supabase.from('whatsapp_config').update({ phone_number_id: w.phone_number_id.trim() || null, template: w.template.trim(), template_lang: w.template_lang.trim(), test_phones: tests }).eq('id', 1);
    const b = a.error ? a : await supabase.from('order_settings').update({ require_otp: w.require_otp }).eq('id', 1);
    setSaving(false);
    if (b.error) return flash(`ما انحفظت إعدادات الواتساب (${b.error.message})`, true);
    setW({ ...w, test_phones: tests.join('، ') }); setSaved({ ...w, test_phones: tests.join('، ') });
    flash(w.require_otp ? 'تأكيد الرقم بالواتساب شغّال للكل' : tests.length ? `التأكيد شغّال على أرقام التجربة بس (${tests.length})` : 'تأكيد الرقم بالواتساب مطفي');
  };
  return (
    <section className="apanel">
      <h3>تأكيد الرقم بالواتساب</h3>
      <div className="apanel__body">
        <p className="afield__hint">أول طلب من رقم على جهاز جديد: بيوصل الزبون كود من 6 أرقام على الواتساب وبيكتبه. بعدها الجهاز بيتذكّر الرقم.</p>
        <p><strong>مفتاح Meta بـ Vault:</strong> <span style={{ color: ready ? '#1a7f37' : '#b21017' }}>{ready ? 'موجود ✓' : 'مش موجود (Supabase ← Vault ← whatsapp_token)'}</span></p>
        <div className="arow">
          <label className="afield"><span>Phone number ID</span><input dir="ltr" inputMode="numeric" value={w.phone_number_id} onChange={e => set({ phone_number_id: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="afield"><span>اسم القالب</span><input dir="ltr" value={w.template} onChange={e => set({ template: e.target.value })} /></label>
          <label className="afield"><span>لغة القالب</span><input dir="ltr" value={w.template_lang} onChange={e => set({ template_lang: e.target.value })} /></label>
        </div>
        <label className="afield"><span>أرقام التجربة</span><input dir="ltr" placeholder="0791234567، 0781234567" value={w.test_phones} onChange={e => set({ test_phones: e.target.value })} /></label>
        <p className="afield__hint">قبل ما تشغّله للكل: التأكيد بيشتغل بس على هالأرقام، والزباين ما بيتأثروا.</p>
        <label className="acheck"><input type="checkbox" checked={w.require_otp} onChange={e => set({ require_otp: e.target.checked })} /> شغّل تأكيد الرقم بالواتساب</label>
        <div className="arow">
          <button className="abtn abtn--primary" onClick={save} disabled={JSON.stringify(w) === JSON.stringify(saved) || saving}>{saving ? 'بنحفظ…' : 'احفظ إعدادات الواتساب'}</button>
        </div>
      </div>
    </section>
  );
}

// Order notifications on the customer's phone: makes the keys once, shows the secret ones to copy into Supabase
type PushStatus = { public_key: boolean; function_url: string | null; hook_secret: boolean; subscribers: number };
const b64u = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function PushPanel({ flash }: { flash: (text: string, bad?: boolean) => void }) {
  const [st, setSt] = useState<PushStatus | null>(null);
  const [missing, setMissing] = useState(false);
  const [keys, setKeys] = useState<{ pub: string; priv: string; hook: string } | null>(null);
  const load = () => supabase.rpc('push_ready').then(({ data, error }) => (error ? setMissing(true) : setSt(data as PushStatus)));
  useEffect(() => { load(); }, []);
  if (missing) return <section className="apanel"><h3>إشعارات الموبايل</h3><div className="apanel__body"><p>شغّل ملف 18-push.sql بـ Supabase عشان يظهر هالقسم.</p></div></section>;
  if (!st) return null;
  const make = async () => {
    if (st.public_key && !confirm('في مفاتيح قبل. مفاتيح جديدة يعني لازم تحدّث الأسرار بـ Supabase، والزباين اللي فعّلوا قبل ما بيوصلهم إشي. أكيد؟')) return;
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pub = b64u(await crypto.subtle.exportKey('raw', pair.publicKey));
    const priv = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d!;
    const hook = b64u(crypto.getRandomValues(new Uint8Array(32)).buffer);
    const base = import.meta.env.VITE_SUPABASE_URL || 'https://qzglmmkrnasgocuvtkut.supabase.co';
    const a = await supabase.from('order_settings').update({ push_public_key: pub }).eq('id', 1);
    const b = a.error ? a : await supabase.from('push_config').update({ function_url: `${base}/functions/v1/order-push` }).eq('id', 1);
    if (b.error) return flash(`ما انحفظ (${b.error.message})`, true);
    setKeys({ pub, priv, hook }); load();
  };
  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => flash('انتسخ'));
  const ok = (v: boolean) => <span style={{ color: v ? '#1a7f37' : '#b21017' }}>{v ? '✓' : '✗'}</span>;
  return (
    <section className="apanel">
      <h3>إشعارات الموبايل</h3>
      <div className="apanel__body">
        <p className="afield__hint">الزبون بيفعّلها من صفحة التتبّع، وبيوصله إشعار لما يتأكّد طلبه أو يجهز أو ينلغى. مجانية.</p>
        <p>{ok(st.public_key)} المفاتيح · {ok(!!st.function_url)} رابط الدالة · {ok(st.hook_secret)} سر الربط بـ Vault · زباين مفعّلين: <b className="num">{st.subscribers}</b></p>
        {!keys ? <div className="arow"><button className="abtn abtn--primary" onClick={make}>{st.public_key ? 'اعمل مفاتيح جديدة' : 'جهّز مفاتيح الإشعارات'}</button></div> : (
          <div className="asubpanel">
            <p className="afield__err">انسخهم هلأ وحطهم بـ Supabase، ما رح يطلعوا مرة ثانية. لا تبعتهم لحدا.</p>
            {([['VAPID_PUBLIC_KEY', keys.pub], ['VAPID_PRIVATE_KEY', keys.priv], ['PUSH_HOOK_SECRET', keys.hook]] as const).map(([n, v]) => (
              <div key={n} className="arow" style={{ alignItems: 'center' }}>
                <code style={{ fontWeight: 700 }}>{n}</code>
                <input readOnly dir="ltr" value={v} style={{ flex: 1, minWidth: 0 }} onFocus={e => e.target.select()} />
                <button className="abtn abtn--small" onClick={() => copy(v)}>انسخ</button>
              </div>
            ))}
            <p className="afield__hint">الثلاثة بـ Edge Functions ← Secrets. والثالث (PUSH_HOOK_SECRET) كمان بـ Vault باسم push_hook_secret.</p>
          </div>
        )}
      </div>
    </section>
  );
}
