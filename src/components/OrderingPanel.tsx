import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Admin tab: online ordering on/off, the "order online" button on the site, ordering hours,
// CliQ details shown to customers, and whether each branch's printer PC is connected.
type Settings = { enabled: boolean; show_button: boolean; order_url: string; open_time: string; last_order_time: string; cliq_alias: string | null; cliq_name: string | null };
type Printer = { branch_id: string; last_seen: string | null };
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
        supabase.from('order_settings').select('enabled, show_button, order_url, open_time, last_order_time, cliq_alias, cliq_name').eq('id', 1).maybeSingle(),
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
          <div className="arow">
            <button className="abtn abtn--primary" onClick={save} disabled={!dirty || saving}>{saving ? 'بنحفظ…' : 'احفظ إعدادات الطلب'}</button>
            <a className="abtn" href="/order/" target="_blank" rel="noopener">افتح صفحة الطلب</a>
            <a className="abtn" href="/order/branch/" target="_blank" rel="noopener">شاشة الفرع</a>
          </div>
        </div>
      </section>
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
