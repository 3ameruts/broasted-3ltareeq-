import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  useContent, publishContent, mergeContent, readLegacyEdits, clearLegacyEdits, DEFAULT_CONTENT, formatPrice,
  type Content, type Item, type Category, type Stat,
} from '../lib/content';
import { supabase, IMAGE_BUCKET } from '../lib/supabase';

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

  if (session === undefined) return <AdminShell><p className="admin__wait">عم نحمّل…</p></AdminShell>;
  if (!session) return <AdminShell><Login /></AdminShell>;
  if (isAdmin === null) return <AdminShell><p className="admin__wait">عم نتأكّد من الحساب…</p></AdminShell>;
  if (!isAdmin) {
    return (
      <AdminShell>
        <section className="apanel alogin">
          <h3>هالحساب مش مسموحله يعدّل</h3>
          <p>دخلت بـ <strong dir="ltr">{session.user.email}</strong>، بس هالإيميل مش مضاف بجدول <code>admins</code> بـ Supabase.</p>
          <button className="abtn" onClick={() => supabase.auth.signOut()}>اطلع وادخل بحساب تاني</button>
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
        <a className="abtn" href="#">شوف الموقع</a>
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
    if (error) setErr(/invalid/i.test(error.message) ? 'الإيميل أو كلمة السر غلط.' : 'ما قدرنا نتصل بالسيرفر. شيّك على النت وجرّب كمان مرة.');
  };
  return (
    <form className="apanel alogin" onSubmit={submit}>
      <h3>ادخل على لوحة التحكم</h3>
      <Field label="الإيميل"><input id="login-email" type="email" dir="ltr" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
      <Field label="كلمة السر"><input id="login-password" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></Field>
      {err && <p className="afield__err" role="alert">{err}</p>}
      <button className="abtn abtn--primary" type="submit" disabled={busy}>{busy ? 'عم ندخل…' : 'ادخل'}</button>
    </form>
  );
}

type Tab = 'brand' | 'menu' | 'branches' | 'gallery';

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
      : 'ما قدرنا نحفظ. شيّك على النت وجرّب كمان مرة.';
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
            <small>{saving ? 'عم نحفظ…' : dirty ? 'في تعديلات ما انحفظت' : 'كل شي محفوظ وعلى الموقع'}</small>
          </div>
        </div>
        <div className="admin__actions">
          <a className="abtn" href="#">شوف الموقع</a>
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
        {([['menu', 'المنيو والأسعار'], ['brand', 'المعلومات والواجهة'], ['branches', 'الفروع'], ['gallery', 'الصور']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} className={'atab' + (tab === k ? ' is-active' : '')} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      <div className="admin__body">
        {tab === 'menu' && <MenuEditor draft={draft} up={up} />}
        {tab === 'brand' && <BrandEditor draft={draft} up={up} />}
        {tab === 'branches' && <BranchesEditor draft={draft} up={up} />}
        {tab === 'gallery' && <GalleryEditor draft={draft} up={up} />}

        <section className="apanel apanel--danger">
          <h3>رجّع كل شي للأصل</h3>
          <p>بيرجّع المنيو والصور والنصوص متل أول نسخة بلوحة التحكم. ما بيتغيّر شي على الموقع لحتى تكبس "احفظ وانشر".</p>
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
      setErr((x as Error).message === 'upload' ? 'ما قدرنا نرفع الصورة. شيّك على النت وجرّب كمان مرة.' : 'ما قدرنا نقرأ الصورة. جرّب صورة JPG أو PNG.');
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
          {busy ? 'عم نرفع الصورة…' : src ? 'غيّر الصورة' : 'ارفع صورة'}
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

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <div className="arow">
      <button className="abtn abtn--small abtn--danger" onClick={onConfirm}>أكيد، احذف الصنف</button>
      <button className="abtn abtn--small" onClick={() => setAsk(false)}>إلغاء</button>
    </div>
  ) : (
    <button className="abtn abtn--small abtn--ghost" onClick={() => setAsk(true)}>احذف الصنف</button>
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
            <h4 className="asub">جملة "مفتوحين هلّق" بالواجهة</h4>
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
          <ImagePicker label="اللوغو" src={b.logo} onChange={v => up(d => { d.brand.logo = v; })} />
        </div>
      </section>
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

function BranchesEditor({ draft, up }: EdProps) {
  return (
    <>
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
      <p className="apanel__hint">هدول الصور بيطلعوا بشريط الصور بالموقع.</p>
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
