import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  useContent, publishContent, mergeContent, readLegacyEdits, clearLegacyEdits, DEFAULT_CONTENT, formatPrice,
  type Content, type Item, type Category, type Stat,
} from '../lib/content';
import OrderingPanel from './OrderingPanel';
import { supabase, IMAGE_BUCKET } from '../lib/supabase';
import { trackingValid, type Tracking } from '../lib/tracking';
import { offerState, daysLeft, todayInJordan, type Offer } from '../lib/offers';

// Downscale a photo in the browser, then store it in Supabase Storage and return its public URL.
async function uploadImage(file: File, max = 1400): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/webp', 0.82);
    };
    img.onerror = () => reject(new Error('read'));
    img.src = URL.createObjectURL(file);
  });
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' });
  if (error) throw new Error('upload');
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export default function Admin() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    supabase.rpc('is_admin').then(({ data, error }) => setIsAdmin(error ? false : Boolean(data)));
  }, [session]);

  if (session === undefined) return <AdminShell><p className="admin__wait">بنحمّل…</p></AdminShell>;
  if (!session) return <AdminShell><Login /></AdminShell>;
  if (isAdmin === null) return <AdminShell><p className="admin__wait">بنتأكّد من الحساب…</p></AdminShell>;
  if (!isAdmin) {
    return (
      <AdminShell>
        <section className="apanel alogin">
          <h3>هالحساب مش مسموحله يعدّل</h3>
          <p>دخلت بـ <strong dir="ltr">{session.user.email}</strong>، بس هالإيميل مش مضاف بجدول <code>admins</code> بـ Supabase.</p>
          <button className="abtn" onClick={() => supabase.auth.signOut()}>اطلع وادخل بحساب ثاني</button>
        </section>
      </AdminShell>
    );
  }
  return <Editor email={session.user.email ?? ''} />;
}

function AdminShell({ children }: { children: ReactNode }) {
  const { content } = useContent();
  return (
    <div className="admin">
      <header className="admin__bar">
        <div className="admin__brand">
          <img src={content.brand.logo} alt="" width={86} height={50} />
          <strong>لوحة التحكم</strong>
        </div>
        <a className="abtn" href="/">شوف الموقع</a>
      </header>
      <div className="admin__body">{children}</div>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(/invalid/i.test(error.message) ? 'الإيميل أو كلمة السر غلط.' : 'ما قدرنا نتصل بالسيرفر. شيّك على النت وجرّب مرة ثانية.');
  };
  return (
    <form className="apanel alogin" onSubmit={submit}>
      <h3>ادخل على لوحة التحكم</h3>
      <Field label="الإيميل"><input id="login-email" type="email" dir="ltr" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
      <Field label="كلمة السر"><input id="login-password" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></Field>
      {err && <p className="afield__err" role="alert">{err}</p>}
      <button className="abtn abtn--primary" type="submit" disabled={busy}>{busy ? 'بندخل…' : 'ادخل'}</button>
    </form>
  );
}

type Tab = 'offers' | 'brand' | 'menu' | 'branches' | 'gallery' | 'order';

function Editor({ email }: { email: string }) {
  const { content, setContent, loaded } = useContent();
  const [draft, setDraft] = useState<Content>(() => structuredClone(content));
  const [synced, setSynced] = useState(loaded);
  const [tab, setTab] = useState<Tab>('menu');
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [legacy, setLegacy] = useState(() => readLegacyEdits());
  const dirty = JSON.stringify(draft) !== JSON.stringify(content);

  // The live copy may arrive after the editor opens; take it once, before any edits.
  useEffect(() => {
    if (loaded && !synced) {
      setDraft(structuredClone(content));
      setSynced(true);
    }
  }, [loaded, synced, content]);

  const flash = (text: string, bad = false) => {
    setToast({ text, bad });
    setTimeout(() => setToast(null), bad ? 9000 : 4200);
  };

  const save = async () => {
    setSaving(true);
    const r = await publishContent(draft);
    setSaving(false);
    if (r.ok) {
      setContent(draft);
      if (legacy) { clearLegacyEdits(); setLegacy(null); }
      flash('انحفظت التعديلات وصارت على الموقع');
      return;
    }
    const msg = r.reason === 'not-setup' ? 'قاعدة البيانات ناقصها صلاحيات. شغّل ملف الإعداد setup.sql من جديد بـ Supabase.'
      : r.reason === 'not-admin' ? 'هالحساب مش مسموحله يحفظ. تأكّد إنه إيميلك بجدول admins.'
      : 'ما قدرنا نحفظ. شيّك على النت وجرّب مرة ثانية.';
    flash(`${msg} (${r.detail})`, true);
  };

  const up = (fn: (d: Content) => void) =>
    setDraft(prev => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  return (
    <div className="admin">
      <header className="admin__bar">
        <div className="admin__brand">
          <img src={draft.brand.logo} alt="" width={86} height={50} />
          <div>
            <strong>لوحة التحكم</strong>
            <small>{saving ? 'بنحفظ…' : dirty ? 'في تعديلات ما انحفظت' : 'كل إشي محفوظ وعلى الموقع'}</small>
          </div>
        </div>
        <div className="admin__actions">
          <a className="abtn" href="/">شوف الموقع</a>
          <button className="abtn abtn--primary" onClick={save} disabled={!dirty || saving}>احفظ وانشر</button>
        </div>
      </header>

      {legacy && (
        <div className="admin__note">
          <p><strong>لقينا تعديلات قديمة على هالجهاز</strong> من قبل ما تنربط لوحة التحكم بالسيرفر. بدك تحمّلها هون لتنشرها؟</p>
          <div className="arow">
            <button className="abtn abtn--small abtn--primary" onClick={() => { setDraft(mergeContent(legacy)); flash('حمّلنا التعديلات القديمة. راجعها واكبس احفظ وانشر.'); setLegacy(null); }}>حمّلها</button>
            <button className="abtn abtn--small" onClick={() => { clearLegacyEdits(); setLegacy(null); }}>تجاهلها</button>
          </div>
        </div>
      )}

      <nav className="admin__tabs" aria-label="أقسام لوحة التحكم">
        {([['menu', 'المنيو والأسعار'], ['offers', 'العروض'], ['order', 'الطلب الأونلاين'], ['brand', 'المعلومات والواجهة'], ['branches', 'الفروع'], ['gallery', 'الصور']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} className={'atab' + (tab === k ? ' is-active' : '')} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      <div className="admin__body">
        {tab === 'menu' && <MenuEditor draft={draft} up={up} />}
        {tab === 'brand' && <BrandEditor draft={draft} up={up} />}
        {tab === 'branches' && <BranchesEditor draft={draft} up={up} />}
        {tab === 'gallery' && <GalleryEditor draft={draft} up={up} />}
        {tab === 'offers' && <OffersEditor draft={draft} up={up} />}
        {tab === 'order' && <OrderingPanel flash={flash} />}

        <section className="apanel apanel--danger">
          <h3>رجّع كل إشي للأصل</h3>
          <p>بيرجّع المنيو والصور والنصوص متل أول نسخة بلوحة التحكم. ما بيتغيّر إشي على الموقع لحتى تكبس "احفظ وانشر".</p>
          {confirmReset ? (
            <div className="arow">
              <button className="abtn abtn--danger" onClick={() => { setDraft(structuredClone(DEFAULT_CONTENT)); setConfirmReset(false); flash('رجعت للأصل. اكبس احفظ وانشر لتطلع على الموقع.'); }}>أكيد، رجّع الأصل</button>
              <button className="abtn" onClick={() => setConfirmReset(false)}>إلغاء</button>
            </div>
          ) : (
            <button className="abtn" onClick={() => setConfirmReset(true)}>رجّع الأصل</button>
          )}
        </section>

        <section className="apanel apanel--danger">
          <p>داخل بـ <strong dir="ltr">{email}</strong></p>
          <button className="abtn abtn--small" onClick={() => supabase.auth.signOut()}>اطلع من الحساب</button>
        </section>
      </div>

      {toast && <div className={'atoast' + (toast.bad ? ' is-bad' : '')} role="status">{toast.text}</div>}
    </div>
  );
}

function autoStat(c: Content, key: Stat['key']) {
  const count = (id: string) => c.categories.find(x => x.id === id)?.items.length ?? 0;
  if (key === 'branches') return c.branches.length;
  if (key === 'hours') return (c.brand.closeHour - c.brand.openHour + 24) % 24 || 24;
  return count(key);
}

type EdProps = { draft: Content; up: (fn: (d: Content) => void) => void };

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="afield">
      <span className="afield__label">{label}</span>
      {children}
      {hint && <span className="afield__hint">{hint}</span>}
    </label>
  );
}

// Keeps the raw text while typing, so a trailing comma or blank line isn't swallowed mid-edit.
function ListInput({ id, value, join, split, onChange, multiline }: { id: string; value: string[]; join: string; split: RegExp; onChange: (v: string[]) => void; multiline?: boolean }) {
  const [text, setText] = useState(() => value.join(join));
  const change = (t: string) => {
    setText(t);
    onChange(t.split(split).map(x => x.trim()).filter(Boolean));
  };
  return multiline
    ? <textarea id={id} rows={8} value={text} onChange={e => change(e.target.value)} />
    : <input id={id} value={text} onChange={e => change(e.target.value)} />;
}

function ImagePicker({ src, onChange, onRemove, label = 'الصورة' }: { src?: string; onChange: (v: string) => void; onRemove?: () => void; label?: string }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr('');
    setBusy(true);
    try {
      onChange(await uploadImage(f));
    } catch (x) {
      setErr((x as Error).message === 'upload' ? 'ما قدرنا نرفع الصورة. شيّك على النت وجرّب مرة ثانية.' : 'ما قدرنا نقرأ الصورة. جرّب صورة JPG أو PNG.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="apick">
      <div className="apick__thumb">{src ? <img src={src} alt="" /> : <span>بدون صورة</span>}</div>
      <div className="apick__ctrls">
        <span className="afield__label">{label}</span>
        <label className={'abtn abtn--small' + (busy ? ' is-busy' : '')} aria-disabled={busy}>
          {busy ? 'بنرفع الصورة…' : src ? 'غيّر الصورة' : 'ارفع صورة'}
          <input type="file" accept="image/*" onChange={pick} hidden disabled={busy} />
        </label>
        {src && onRemove && <button className="abtn abtn--small abtn--ghost" onClick={onRemove}>شيل الصورة</button>}
        {err && <span className="afield__err">{err}</span>}
      </div>
    </div>
  );
}

function MenuEditor({ draft, up }: EdProps) {
  const [open, setOpen] = useState<string | null>(draft.categories[0]?.id ?? null);
  return (
    <>
      {draft.categories.map((cat, ci) => (
        <section key={cat.id} className="apanel">
          <button className="apanel__toggle" onClick={() => setOpen(open === cat.id ? null : cat.id)} aria-expanded={open === cat.id}>
            <span>{cat.name}</span>
            <small>{cat.items.length} صنف</small>
          </button>
          {open === cat.id && <CategoryEditor cat={cat} ci={ci} up={up} />}
        </section>
      ))}
    </>
  );
}

function CategoryEditor({ cat, ci, up }: { cat: Category; ci: number; up: EdProps['up'] }) {
  const setCat = (fn: (c: Category) => void) => up(d => fn(d.categories[ci]));
  const setItem = (ii: number, fn: (it: Item) => void) => setCat(c => fn(c.items[ii]));
  return (
    <div className="apanel__body">
      <div className="agrid">
        <Field label="اسم القسم"><input id={`cat-${cat.id}-name`} value={cat.name} onChange={e => setCat(c => { c.name = e.target.value; })} /></Field>
        <Field label="ملاحظة (اختياري)" hint="مثلاً: جميع السندويشات بسعر 2.75 د.أ"><input id={`cat-${cat.id}-note`} value={cat.note ?? ''} onChange={e => setCat(c => { c.note = e.target.value || undefined; })} /></Field>
      </div>
      <Field label="وصف القسم"><textarea id={`cat-${cat.id}-blurb`} rows={2} value={cat.blurb} onChange={e => setCat(c => { c.blurb = e.target.value; })} /></Field>
      <ImagePicker label="صورة القسم" src={cat.image} onChange={v => setCat(c => { c.image = v; })} onRemove={() => setCat(c => { delete c.image; })} />

      <h4 className="asub">الأصناف</h4>
      <ul className="aitems">
        {cat.items.map((it, ii) => (
          <li key={it.id} className="aitem">
            <div className="aitem__head">
              <strong>{it.name || 'صنف جديد'}</strong>
              <span className="num">{formatPrice(it.price)} د.أ</span>
              <div className="aitem__move">
                <button className="abtn abtn--icon" disabled={ii === 0} onClick={() => setCat(c => { [c.items[ii - 1], c.items[ii]] = [c.items[ii], c.items[ii - 1]]; })} aria-label="لفوق">↑</button>
                <button className="abtn abtn--icon" disabled={ii === cat.items.length - 1} onClick={() => setCat(c => { [c.items[ii + 1], c.items[ii]] = [c.items[ii], c.items[ii + 1]]; })} aria-label="لتحت">↓</button>
              </div>
            </div>
            <div className="agrid">
              <Field label="الاسم"><input id={`${it.id}-name`} value={it.name} onChange={e => setItem(ii, x => { x.name = e.target.value; })} /></Field>
              <Field label="السعر (د.أ)">
                <input id={`${it.id}-price`} type="number" inputMode="decimal" min="0" step="0.05" value={it.price} onChange={e => setItem(ii, x => { x.price = Number(e.target.value) || 0; })} />
              </Field>
            </div>
            <Field label="المكوّنات" hint="افصل بين المكوّنات بإشارة +"><textarea id={`${it.id}-contents`} rows={2} value={it.contents ?? ''} onChange={e => setItem(ii, x => { x.contents = e.target.value || undefined; })} /></Field>
            <ImagePicker src={it.image} onChange={v => setItem(ii, x => { x.image = v; })} onRemove={() => setItem(ii, x => { delete x.image; })} />
            <DeleteButton onConfirm={() => setCat(c => { c.items.splice(ii, 1); })} />
          </li>
        ))}
      </ul>
      <button className="abtn abtn--add" onClick={() => setCat(c => { c.items.push({ id: `${c.id}-${Date.now()}`, name: '', price: 0 }); })}>+ ضيف صنف</button>
    </div>
  );
}

function DeleteButton({ onConfirm, label = 'احذف الصنف' }: { onConfirm: () => void; label?: string }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <div className="arow">
      <button className="abtn abtn--small abtn--danger" onClick={onConfirm}>أكيد، {label}</button>
      <button className="abtn abtn--small" onClick={() => setAsk(false)}>إلغاء</button>
    </div>
  ) : (
    <button className="abtn abtn--small abtn--ghost" onClick={() => setAsk(true)}>{label}</button>
  );
}

function BrandEditor({ draft, up }: EdProps) {
  const b = draft.brand;
  const h = draft.hero;
  return (
    <>
      <section className="apanel">
        <h3>معلومات المطعم</h3>
        <div className="apanel__body">
          <div className="agrid">
            <Field label="اسم المطعم"><input id="b-name" value={b.name} onChange={e => up(d => { d.brand.name = e.target.value; })} /></Field>
            <Field label="رقم الاتصال"><input id="b-phone" inputMode="tel" value={b.phone} onChange={e => up(d => { d.brand.phone = e.target.value; })} /></Field>
          </div>
          <Field label="الشعار"><input id="b-slogan" value={b.slogan} onChange={e => up(d => { d.brand.slogan = e.target.value; })} /></Field>
          <Field label="أوقات الدوام (النص اللي بيطلع بالموقع)"><input id="b-hours" value={b.hours} onChange={e => up(d => { d.brand.hours = e.target.value; })} /></Field>
          <div className="agrid">
            <Field label="ساعة الفتح (0-23)" hint="12 يعني الظهر"><input id="b-open" type="number" min="0" max="23" value={b.openHour} onChange={e => up(d => { d.brand.openHour = Number(e.target.value); })} /></Field>
            <Field label="ساعة السكّر (0-23)" hint="3 يعني الفجر"><input id="b-close" type="number" min="0" max="23" value={b.closeHour} onChange={e => up(d => { d.brand.closeHour = Number(e.target.value); })} /></Field>
          </div>
          <div className="asubpanel">
            <h4 className="asub">جملة "فاتحين هسّا" بالواجهة</h4>
            <label className="acheck">
              <input id="b-status-show" type="checkbox" checked={b.showStatus} onChange={e => up(d => { d.brand.showStatus = e.target.checked; })} />
              اعرض الجملة بالواجهة
            </label>
            <Field label="لما نكون فاتحين" hint="بتطلع بين ساعة الفتح وساعة السكّر"><input id="b-status-open" value={b.statusOpen} onChange={e => up(d => { d.brand.statusOpen = e.target.value; })} /></Field>
            <Field label="لما نكون مسكّرين"><input id="b-status-closed" value={b.statusClosed} onChange={e => up(d => { d.brand.statusClosed = e.target.value; })} /></Field>
          </div>
          <div className="agrid">
            <Field label="رابط إنستغرام"><input id="b-ig" dir="ltr" value={b.instagram} onChange={e => up(d => { d.brand.instagram = e.target.value; })} /></Field>
            <Field label="رابط فيسبوك"><input id="b-fb" dir="ltr" value={b.facebook} onChange={e => up(d => { d.brand.facebook = e.target.value; })} /></Field>
          </div>
          <Field label="سطر تحت حقوق الملكية (آخر الموقع)" hint="بيطلع بنفس خط سطر ©. اتركه فاضي إذا ما بدك ياه.">
            <input id="b-footer-note" value={b.footerNote ?? ''} onChange={e => up(d => { d.brand.footerNote = e.target.value; })} />
          </Field>
          <ImagePicker label="اللوغو" src={b.logo} onChange={v => up(d => { d.brand.logo = v; })} />
        </div>
      </section>
      <TrackingPanel draft={draft} up={up} />
      <section className="apanel">
        <h3>الواجهة الرئيسية</h3>
        <div className="apanel__body">
          <Field label="السطر الصغير فوق العنوان"><input id="h-eyebrow" value={h.eyebrow} onChange={e => up(d => { d.hero.eyebrow = e.target.value; })} /></Field>
          <Field label="العنوان الكبير"><input id="h-title" value={h.title} onChange={e => up(d => { d.hero.title = e.target.value; })} /></Field>
          <Field label="النص تحت العنوان"><textarea id="h-sub" rows={2} value={h.subtitle} onChange={e => up(d => { d.hero.subtitle = e.target.value; })} /></Field>
          <Field label="الكلمات اللي بتمشي بالشريط" hint="افصل بينها بفاصلة">
            <ListInput id="h-marquee" value={draft.marquee} join="، " split={/[،,]/} onChange={v => up(d => { d.marquee = v; })} />
          </Field>
        </div>
      </section>
      <section className="apanel">
        <h3>قصتنا (من نحن)</h3>
        <div className="apanel__body">
          <Field label="عنوان القسم"><input id="a-title" value={draft.about.title} onChange={e => up(d => { d.about.title = e.target.value; })} /></Field>
          <Field label="الجملة الكبيرة"><input id="a-lead" value={draft.about.lead} onChange={e => up(d => { d.about.lead = e.target.value; })} /></Field>
          <Field label="القصة" hint="كل فقرة بسطر لحال.">
            <ListInput id="a-story" multiline value={draft.about.paragraphs} join={'\n'} split={/\n/} onChange={v => up(d => { d.about.paragraphs = v; })} />
          </Field>
          <h4 className="asub">الأرقام تحت القصة</h4>
          <p className="afield__hint">إذا تركت خانة الرقم فاضية، بينحسب لحاله من المنيو والفروع وأوقات الدوام.</p>
          <ul className="astats">
            {draft.about.stats.map((st, i) => (
              <li key={st.key} className="astat">
                <Field label="الرقم">
                  <input id={`stat-${st.key}-value`} type="number" min="0" inputMode="numeric" placeholder={'تلقائي: ' + autoStat(draft, st.key)} value={st.value ?? ''}
                    onChange={e => up(d => { d.about.stats[i].value = e.target.value === '' ? null : Number(e.target.value); })} />
                </Field>
                <Field label="الكلمة جنبه"><input id={`stat-${st.key}-label`} value={st.label} onChange={e => up(d => { d.about.stats[i].label = e.target.value; })} /></Field>
                <label className="acheck">
                  <input id={`stat-${st.key}-show`} type="checkbox" checked={st.show} onChange={e => up(d => { d.about.stats[i].show = e.target.checked; })} />
                  اعرضه
                </label>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function OffersEditor({ draft, up }: EdProps) {
  const t = draft.offersText;
  const offers = draft.offers ?? [];
  const setOffer = (i: number, fn: (o: Offer) => void) => up(d => { fn(d.offers[i]); });
  const label = { live: 'شغّال على الموقع', off: 'موقّف', ended: 'خلص وقته' } as const;
  return (
    <>
      <section className="apanel">
        <h3>نصوص قسم العروض</h3>
        <div className="apanel__body">
          <p className="afield__hint">القسم بيطلع تحت الواجهة، وكلمة "العروض" بتطلع بالشريط العلوي، بس لما يكون في عرض واحد شغّال على الأقل.</p>
          <Field label="العنوان"><input id="of-title" value={t.title} onChange={e => up(d => { d.offersText.title = e.target.value; })} /></Field>
          <Field label="الجملة تحت العنوان" hint="اتركها فاضية إذا ما بدك ياها."><input id="of-lead" value={t.lead} onChange={e => up(d => { d.offersText.lead = e.target.value; })} /></Field>
          <Field label="نص الشريط المتحرّك فوق القسم"><input id="of-tape" value={t.tape} onChange={e => up(d => { d.offersText.tape = e.target.value; })} /></Field>
        </div>
      </section>

      {offers.length === 0 && (
        <section className="apanel apanel--danger">
          <h3>ما في عروض لسا</h3>
          <p>كبست "ضيف عرض" تحت لتضيف أول عرض.</p>
        </section>
      )}

      {offers.map((o, i) => {
        const st = offerState(o);
        const left = daysLeft(o);
        return (
          <section key={o.id} className="apanel">
            <div className="aoffer__head">
              <strong>{o.title || 'عرض جديد'}</strong>
              <span className={'astate astate--' + st}>{label[st]}{st === 'live' && left !== null ? ` • باقي ${left} ${left === 1 ? 'يوم' : 'أيام'}` : ''}</span>
              <div className="aitem__move">
                <button className="abtn abtn--icon" disabled={i === 0} onClick={() => up(d => { [d.offers[i - 1], d.offers[i]] = [d.offers[i], d.offers[i - 1]]; })} aria-label="لفوق">↑</button>
                <button className="abtn abtn--icon" disabled={i === offers.length - 1} onClick={() => up(d => { [d.offers[i + 1], d.offers[i]] = [d.offers[i], d.offers[i + 1]]; })} aria-label="لتحت">↓</button>
              </div>
            </div>
            <div className="apanel__body">
              <label className="acheck">
                <input id={`${o.id}-active`} type="checkbox" checked={o.active} onChange={e => setOffer(i, x => { x.active = e.target.checked; })} />
                العرض شغّال
              </label>
              <Field label="اسم العرض"><input id={`${o.id}-title`} value={o.title} onChange={e => setOffer(i, x => { x.title = e.target.value; })} /></Field>
              <Field label="شو فيه" hint="افصل بين الأشياء بإشارة +، مثلاً: 12 قطعة + بطاطا + لتر ماتركس">
                <textarea id={`${o.id}-contents`} rows={2} value={o.contents} onChange={e => setOffer(i, x => { x.contents = e.target.value; })} />
              </Field>
              <div className="agrid">
                <Field label="سعر العرض (د.أ)">
                  <input id={`${o.id}-price`} type="number" inputMode="decimal" min="0" step="0.05" value={o.price} onChange={e => setOffer(i, x => { x.price = Number(e.target.value) || 0; })} />
                </Field>
                <Field label="السعر قبل العرض (اختياري)" hint="بيطلع مشطوب، ومعه قدّيش بيوفّر الزبون">
                  <input id={`${o.id}-old`} type="number" inputMode="decimal" min="0" step="0.05" value={o.oldPrice ?? ''} onChange={e => setOffer(i, x => { x.oldPrice = e.target.value === '' ? null : Number(e.target.value); })} />
                </Field>
              </div>
              <div className="agrid">
                <Field label="الكلمة على النجمة" hint="مثلاً: عرض، جديد، 2+1. فاضية = بدون نجمة">
                  <input id={`${o.id}-badge`} value={o.badge} onChange={e => setOffer(i, x => { x.badge = e.target.value; })} />
                </Field>
                <Field label="آخر يوم للعرض (اختياري)" hint="بعد هاليوم العرض بيختفي لحاله">
                  <input id={`${o.id}-ends`} type="date" min={todayInJordan()} value={o.endsAt} onChange={e => setOffer(i, x => { x.endsAt = e.target.value; })} />
                </Field>
              </div>
              <ImagePicker label="صورة العرض" src={o.image} onChange={v => setOffer(i, x => { x.image = v; })} onRemove={() => setOffer(i, x => { delete x.image; })} />
              <DeleteButton label="احذف العرض" onConfirm={() => up(d => { d.offers.splice(i, 1); })} />
            </div>
          </section>
        );
      })}

      <button className="abtn abtn--add" onClick={() => up(d => {
        d.offers = d.offers ?? [];
        d.offers.push({ id: 'offer-' + Date.now(), title: '', contents: '', price: 0, oldPrice: null, badge: 'عرض', active: true, endsAt: '' });
      })}>+ ضيف عرض</button>
    </>
  );
}

function TrackingPanel({ draft, up }: EdProps) {
  const t = draft.tracking;
  const field = (key: keyof Tracking, label: string, example: string, hint: string) => {
    const v = t[key].trim();
    const bad = v !== '' && !trackingValid[key](v);
    return (
      <Field label={label} hint={hint}>
        <input id={`tr-${key}`} dir="ltr" placeholder={example} value={t[key]} onChange={e => up(d => { d.tracking[key] = e.target.value.trim(); })} aria-invalid={bad} />
        {bad && <span className="afield__err">الرقم مش بالشكل الصح، متل {example}. ما رح يشتغل لحتى يتصلّح.</span>}
      </Field>
    );
  };
  return (
    <section className="apanel">
      <h3>الإحصائيات والإعلانات</h3>
      <div className="apanel__body">
        <p className="afield__hint">حط الرقم (ID) بس، مش الكود كامل. الخانة الفاضية ما بتشتغل. كبسات الاتصال وفتح خرائط الفروع بتنحسب لحالها.</p>
        {field('googleTag', 'Google Analytics / Google Ads', 'G-XXXXXXXXXX', 'من Google Analytics: Admin ← Data streams ← Measurement ID. أو رقم Google Ads اللي بيبلّش بـ AW-')}
        {field('metaPixel', 'Meta Pixel (فيسبوك وإنستغرام)', '123456789012345', 'من Meta Events Manager ← Data sources ← رقم البكسل (أرقام بس)')}
        {field('gtm', 'Google Tag Manager (اختياري)', 'GTM-XXXXXXX', 'إذا بتستعمل Tag Manager. ما تحطّه مع نفس رقم Google Analytics لحتى ما ينحسب الزائر مرتين.')}
      </div>
    </section>
  );
}

function BranchesEditor({ draft, up }: EdProps) {
  return (
    <>
      <section className="apanel">
        <h3>نصوص قسم الفروع</h3>
        <div className="apanel__body">
          <Field label="العنوان"><input id="br-title" value={draft.branchesText.title} onChange={e => up(d => { d.branchesText.title = e.target.value; })} /></Field>
          <Field label="الجملة تحت العنوان" hint="اتركها فاضية إذا ما بدك ياها.">
            <textarea id="br-lead" rows={2} value={draft.branchesText.lead} onChange={e => up(d => { d.branchesText.lead = e.target.value; })} />
          </Field>
          <Field label="نص زر أقرب فرع"><input id="br-button" value={draft.branchesText.button} onChange={e => up(d => { d.branchesText.button = e.target.value; })} /></Field>
        </div>
      </section>
      {draft.branches.map((br, i) => (
        <section key={br.id} className="apanel">
          <h3>{br.name}</h3>
          <div className="apanel__body">
            <Field label="اسم الفرع"><input id={`${br.id}-name`} value={br.name} onChange={e => up(d => { d.branches[i].name = e.target.value; })} /></Field>
            <Field label="رابط Google Maps"><input id={`${br.id}-maps`} dir="ltr" value={br.maps} onChange={e => up(d => { d.branches[i].maps = e.target.value; })} /></Field>
            <div className="agrid">
              <Field label="خط العرض" hint="من الرابط الطويل، الرقم بعد !3d"><input id={`${br.id}-lat`} dir="ltr" type="number" step="any" value={br.lat} onChange={e => up(d => { d.branches[i].lat = Number(e.target.value); })} /></Field>
              <Field label="خط الطول" hint="الرقم بعد !4d"><input id={`${br.id}-lng`} dir="ltr" type="number" step="any" value={br.lng} onChange={e => up(d => { d.branches[i].lng = Number(e.target.value); })} /></Field>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

function GalleryEditor({ draft, up }: EdProps) {
  return (
    <section className="apanel">
      <h3>صور المعرض</h3>
      <p className="apanel__hint">هاي الصور بتطلع بشريط الصور بالموقع.</p>
      <div className="agallery">
        {draft.gallery.map((src, i) => (
          <ImagePicker key={i} label={`صورة ${i + 1}`} src={src} onChange={v => up(d => { d.gallery[i] = v; })} onRemove={() => up(d => { d.gallery.splice(i, 1); })} />
        ))}
      </div>
      <div className="agallery">
        <ImagePicker label="ضيف صورة جديدة" onChange={v => up(d => { d.gallery.push(v); })} />
      </div>
    </section>
  );
}
