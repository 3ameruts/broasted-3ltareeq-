import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Content } from '../lib/types';

// Admin tab: site content versions (back up and restore), call center agents, and blocked phone numbers.
type Version = { id: number; saved_at: string; saved_by: string | null };
type Agent = { user_id: string; email: string; name: string; active: boolean; today: number };
type Blocked = { phone: string; reason: string | null; branch: string | null; blocked_by: string; blocked_at: string };
type Flash = (text: string, bad?: boolean) => void;

const when = (iso: string) => new Intl.DateTimeFormat('ar-JO-u-nu-latn', { timeZone: 'Asia/Amman', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const missing = <section className="apanel"><div className="apanel__body"><p>شغّل ملف 12-admin-tools.sql بـ Supabase عشان يشتغل هالقسم.</p></div></section>;

function download(name: string, data: unknown) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 10);

export default function AdminTools({ flash, onRestore }: { flash: Flash; onRestore: (c: Content) => void }) {
  return (
    <>
      <Ratings />
      <Versions flash={flash} onRestore={onRestore} />
      <Agents flash={flash} />
      <BlockedPhones flash={flash} />
    </>
  );
}

type Summary = { branch_id: string; branch: string; ratings: number; average: number | null; five: number; low: number };
type RatingRow = { order_id: string; branch_id: string; order_number: number; order_type: string; stars: number; comment: string | null; created_at: string };

// customer ratings: each branch's average, then the latest ratings (the low ones first if you pick «الضعيفة»)
function Ratings() {
  const [days, setDays] = useState(30);
  const [sum, setSum] = useState<Summary[] | null>(null);
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'low' | 'comments'>('all');
  const [bad, setBad] = useState(false);
  useEffect(() => {
    supabase.rpc('admin_rating_summary', { p_days: days }).then(({ data, error }) => (error ? setBad(true) : setSum((data ?? []) as Summary[])));
    const since = new Date(Date.now() - days * 86400000).toISOString();
    supabase.from('order_ratings').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setRows((data ?? []) as RatingRow[]));
  }, [days]);
  if (bad) return <section className="apanel"><h3>تقييمات الزباين</h3><div className="apanel__body"><p>شغّل ملف 14-ratings.sql بـ Supabase عشان يشتغل هالقسم.</p></div></section>;
  const name = (id: string) => sum?.find(s => s.branch_id === id)?.branch ?? id;
  const shown = rows.filter(r => filter === 'all' || (filter === 'low' ? r.stars <= 2 : !!r.comment));
  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
  return (
    <section className="apanel">
      <h3>تقييمات الزباين</h3>
      <div className="apanel__body">
        <div className="arow">
          {[7, 30, 90].map(d => <button key={d} className={'abtn abtn--small' + (days === d ? ' abtn--primary' : '')} onClick={() => setDays(d)}>آخر {d} يوم</button>)}
        </div>
        {!sum ? <p>…</p> : (
          <ul className="aitems">
            {sum.map(s => (
              <li key={s.branch_id} className="aitem">
                <div className="aitem__head">
                  <strong>{s.branch}</strong>
                  {s.ratings ? <>
                    <span style={{ color: '#d99a00', fontSize: '1.1rem' }}>{stars(Math.round(Number(s.average)))}</span>
                    <b className="num">{Number(s.average).toFixed(1)}</b>
                    <span className="afield__hint">من {s.ratings} تقييم · 5 نجوم: {s.five}{s.low ? ` · ضعيفة: ${s.low}` : ''}</span>
                  </> : <span className="afield__hint">لسا ما في تقييمات</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 && <>
          <div className="arow">
            {([['all', 'الكل'], ['low', 'الضعيفة (1–2)'], ['comments', 'اللي فيها تعليق']] as const).map(([k, l]) => (
              <button key={k} className={'abtn abtn--small' + (filter === k ? ' abtn--primary' : '')} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          <details className="asubpanel" open={filter !== 'all'}>
            <summary className="asub" style={{ cursor: 'pointer' }}><strong>آخر التقييمات ({shown.length})</strong></summary>
            <ul className="aitems">
              {shown.map(r => (
                <li key={r.order_id} className="aitem">
                  <div className="aitem__head">
                    <span style={{ color: r.stars <= 2 ? '#b21017' : '#d99a00', fontSize: '1.1rem' }}>{stars(r.stars)}</span>
                    <strong>{name(r.branch_id)}</strong>
                    <span className="afield__hint">طلب #{r.order_number} · {r.order_type === 'delivery' ? 'توصيل' : 'استلام'} · {when(r.created_at)}</span>
                  </div>
                  {r.comment && <p>«{r.comment}»</p>}
                </li>
              ))}
            </ul>
          </details>
        </>}
      </div>
    </section>
  );
}

function Versions({ flash, onRestore }: { flash: Flash; onRestore: (c: Content) => void }) {
  const [list, setList] = useState<Version[] | null>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    supabase.from('site_content_history').select('id, saved_at, saved_by').order('id', { ascending: false }).limit(60)
      .then(({ data, error }) => (error ? setBad(true) : setList((data ?? []) as Version[])));
  }, []);
  const load = async (id: number) => {
    const { data, error } = await supabase.from('site_content_history').select('content').eq('id', id).single();
    if (error || !data) { flash('ما قدرنا نجيب النسخة', true); return null; }
    return data.content as Content;
  };
  const backupNow = async () => {
    const [c, s, b] = await Promise.all([
      supabase.from('site_content').select('content, updated_at').eq('id', 1).single(),
      supabase.from('order_settings').select('*').eq('id', 1).single(),
      supabase.from('order_branches').select('*').order('id'),
    ]);
    if (c.error) return flash('ما قدرنا ناخذ نسخة', true);
    download(`broasted-backup-${stamp()}.json`, { saved_at: new Date().toISOString(), site_content: c.data, order_settings: s.data, order_branches: b.data });
    flash('نزلت النسخة على جهازك. خزّنها بمكان آمن (Google Drive مثلاً).');
  };
  if (bad) return missing;
  return (
    <section className="apanel">
      <h3>النسخ الاحتياطي</h3>
      <div className="apanel__body">
        <p className="afield__hint">كل ما تكبس «احفظ وانشر» بتنحفظ نسخة من المنيو والنصوص والصور (آخر 60 نسخة). إذا صار غلط، رجّع لنسخة قبل.</p>
        <div className="arow"><button className="abtn abtn--primary" onClick={backupNow}>نزّل نسخة كاملة على جهازي</button></div>
        {!list ? <p>…</p> : !list.length ? <p>لسا ما في نسخ.</p> : (
          <ul className="aitems">
            {list.map((v, i) => (
              <li key={v.id} className="aitem">
                <div className="aitem__head">
                  <strong>{when(v.saved_at)}</strong>
                  <span className="afield__hint">{v.saved_by ?? ''}{i === 0 ? ' · النسخة الحالية' : ''}</span>
                  <div className="aitem__move">
                    <button className="abtn abtn--small" onClick={async () => { const c = await load(v.id); if (c) download(`broasted-menu-${v.saved_at.slice(0, 10)}.json`, c); }}>نزّل</button>
                    {i > 0 && <button className="abtn abtn--small" onClick={async () => { const c = await load(v.id); if (c) { onRestore(c); flash('رجّعنا هالنسخة للوحة التحكم. راجعها واكبس «احفظ وانشر» لتطلع على الموقع.'); } }}>رجّع لهالنسخة</button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Agents({ flash }: { flash: Flash }) {
  const [list, setList] = useState<Agent[] | null>(null);
  const [bad, setBad] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => {
    supabase.rpc('admin_agents').then(({ data, error }) => (error ? setBad(true) : setList((data ?? []) as Agent[])));
  }, []);
  useEffect(refresh, [refresh]);

  const add = async () => {
    const email = form.email.trim(), name = form.name.trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return flash('اكتب اسم وإيميل صحيح', true);
    setBusy(true);
    let note = '';
    // a new account is made with its own throwaway client so the admin stays signed in
    if (form.password) {
      if (form.password.length < 8) { setBusy(false); return flash('كلمة السر لازم تكون 8 أحرف أو أكثر', true); }
      const temp = createClient(import.meta.env.VITE_SUPABASE_URL || 'https://qzglmmkrnasgocuvtkut.supabase.co',
        import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_crkSQ5p2ntixzGDK5WRx6Q_2LAfmZee',
        { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'broasted-agent-signup' } });
      const { data, error } = await temp.auth.signUp({ email, password: form.password });
      if (error && !/already/i.test(error.message)) note = ` (ما قدرنا نعمل الحساب: ${error.message}. اعمله من Supabase ← Users وجرّب مرة ثانية)`;
      else if (data?.user && !data.session) note = '. لازم يأكّد إيميله من الرسالة اللي وصلته قبل أول دخول.';
    }
    const { data, error } = await supabase.rpc('admin_add_agent', { p_email: email, p_name: name });
    setBusy(false);
    const r = data as { ok: boolean; error?: string } | null;
    if (error || !r?.ok) return flash(r?.error === 'no_user' ? `ما في حساب بهالإيميل. حط كلمة سر لنعمله، أو اعمله من Supabase ← Users${note}` : 'ما انضاف', true);
    setForm({ name: '', email: '', password: '' });
    flash(`انضاف ${name} عالكول سنتر${note}`);
    refresh();
  };
  const update = async (a: Agent, patch: Partial<Agent>) => {
    const next = { ...a, ...patch };
    const { data, error } = await supabase.rpc('admin_update_agent', { p_user: a.user_id, p_name: next.name, p_active: next.active });
    if (error || !(data as { ok: boolean }).ok) return flash('ما انحفظ', true);
    flash(patch.active === false ? `${a.name} انوقف، وما بيقدر يدخل الكول سنتر` : patch.active ? `${a.name} رجع شغّال` : 'انحفظ');
    refresh();
  };

  if (bad) return missing;
  return (
    <section className="apanel">
      <h3>الكول سنتر (Agents)</h3>
      <div className="apanel__body">
        {!list ? <p>…</p> : (
          <ul className="aitems">
            {list.map(a => <AgentRow key={a.user_id} a={a} onSave={patch => update(a, patch)} />)}
          </ul>
        )}
        <div className="asubpanel">
          <p className="asub"><strong>ضيف Agent</strong></p>
          <div className="agrid">
            <label className="afield"><span className="afield__label">الاسم</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={40} /></label>
            <label className="afield"><span className="afield__label">الإيميل</span><input dir="ltr" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
            <label className="afield"><span className="afield__label">كلمة سر (لحساب جديد)</span><input dir="ltr" type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
          </div>
          <p className="afield__hint">إذا الحساب موجود أصلاً اترك كلمة السر فاضية. كلمة السر بتعطيها للـ Agent بنفسك، وما بتنحفظ هون.</p>
          <div className="arow"><button className="abtn abtn--primary" onClick={add} disabled={busy}>{busy ? 'لحظة…' : 'ضيف'}</button></div>
        </div>
      </div>
    </section>
  );
}

function AgentRow({ a, onSave }: { a: Agent; onSave: (patch: Partial<Agent>) => void }) {
  const [name, setName] = useState(a.name);
  return (
    <li className="aitem">
      <div className="aitem__head">
        <strong>{a.name}</strong>
        <span className={'astate' + (a.active ? ' astate--live' : ' astate--ended')}>{a.active ? 'شغّال' : 'موقوف'}</span>
        <span className="afield__hint" dir="ltr">{a.email}</span>
        <span className="afield__hint">أكّد اليوم: <b className="num">{a.today}</b></span>
      </div>
      <div className="arow">
        <label className="afield" style={{ flex: 1 }}><input value={name} onChange={e => setName(e.target.value)} maxLength={40} aria-label="الاسم" /></label>
        {name.trim() !== a.name && <button className="abtn abtn--small" onClick={() => onSave({ name: name.trim() })}>احفظ الاسم</button>}
        <button className={'abtn abtn--small' + (a.active ? ' abtn--danger' : '')} onClick={() => onSave({ active: !a.active })}>{a.active ? 'أوقفه' : 'رجّعه'}</button>
      </div>
    </li>
  );
}

function BlockedPhones({ flash }: { flash: Flash }) {
  const [list, setList] = useState<Blocked[] | null>(null);
  const [bad, setBad] = useState(false);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const refresh = useCallback(() => {
    supabase.rpc('admin_blocked').then(({ data, error }) => (error ? setBad(true) : setList((data ?? []) as Blocked[])));
  }, []);
  useEffect(refresh, [refresh]);
  const setBlocked = async (p: string, blocked: boolean, why?: string) => {
    const { data, error } = await supabase.rpc('set_phone_blocked', { p_phone: p, p_blocked: blocked, p_reason: why || null });
    const r = data as { ok: boolean; error?: string } | null;
    if (error || !r?.ok) return flash(r?.error === 'bad_phone' ? 'الرقم مش صحيح' : 'ما زبطت', true);
    flash(blocked ? `انحظر ${p}` : `انفك الحظر عن ${p}`);
    if (blocked) { setPhone(''); setReason(''); }
    refresh();
  };
  if (bad) return missing;
  return (
    <section className="apanel">
      <h3>الأرقام المحظورة</h3>
      <div className="apanel__body">
        <p className="afield__hint">الرقم المحظور ما بيقدر يطلب أونلاين. الكول سنتر بيحظر لما يرفض طلب وهمي.</p>
        {!list ? <p>…</p> : !list.length ? <p>ما في أرقام محظورة.</p> : (
          <ul className="aitems">
            {list.map(b => (
              <li key={b.phone} className="aitem">
                <div className="aitem__head">
                  <strong className="num" dir="ltr">{b.phone}</strong>
                  <span>{b.reason ?? 'بدون سبب'}</span>
                  <div className="aitem__move"><button className="abtn abtn--small" onClick={() => setBlocked(b.phone, false)}>فك الحظر</button></div>
                </div>
                <p className="afield__hint">حظره {b.blocked_by}{b.branch ? ` · ${b.branch}` : ''} · {when(b.blocked_at)}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="asubpanel">
          <p className="asub"><strong>احظر رقم</strong></p>
          <div className="agrid">
            <label className="afield"><span className="afield__label">الرقم</span><input dir="ltr" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0791234567" /></label>
            <label className="afield"><span className="afield__label">السبب</span><input value={reason} onChange={e => setReason(e.target.value)} maxLength={120} /></label>
          </div>
          <div className="arow"><button className="abtn abtn--danger" onClick={() => setBlocked(phone, true, reason)} disabled={!phone.trim()}>احظر</button></div>
        </div>
      </div>
    </section>
  );
}
