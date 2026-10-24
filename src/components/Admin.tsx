import { useState, type ChangeEvent, type ReactNode } from 'react';
import { useContent, saveContent, resetContent, DEFAULT_CONTENT, formatPrice, type Content, type Item, type Category } from '../lib/content';

// Downscale an uploaded photo in the browser so it fits in demo storage.
function readImage(file: File, max = 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/webp', 0.8));
    };
    img.onerror = () => reject(new Error('bad image'));
    img.src = URL.createObjectURL(file);
  });
}

type Tab = 'brand' | 'menu' | 'branches' | 'gallery';

export default function Admin() {
  const { content, setContent } = useContent();
  const [draft, setDraft] = useState<Content>(() => structuredClone(content));
  const [tab, setTab] = useState<Tab>('menu');
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(content);

  const flash = (text: string, bad = false) => {
    setToast({ text, bad });
    setTimeout(() => setToast(null), 3200);
  };

  const save = () => {
    const r = saveContent(draft);
    if (r.ok) {
      setContent(draft);
      flash('انحفظت التعديلات');
    } else {
      flash(r.reason === 'full' ? 'المساحة امتلأت. احذف صور أو ارفع صور أصغر وجرّب مرة تانية.' : 'المتصفح منع الحفظ. جرّب من نافذة عادية مش خاصة.', true);
    }
  };

  const reset = () => {
    resetContent();
    setContent(DEFAULT_CONTENT);
    setDraft(structuredClone(DEFAULT_CONTENT));
    setConfirmReset(false);
    flash('رجع المحتوى للأصل');
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
            <small>{dirty ? 'في تعديلات ما انحفظت' : 'كل شي محفوظ'}</small>
          </div>
        </div>
        <div className="admin__actions">
          <a className="abtn" href="#">شوف الموقع</a>
          <button className="abtn abtn--primary" onClick={save} disabled={!dirty}>احفظ التعديلات</button>
        </div>
      </header>

      <p className="admin__note">
        <strong>نسخة تجريبية:</strong> التعديلات بتنحفظ على هالمتصفح بس، والزوار ما بيشوفوها. بالنسخة النهائية بتنحفظ على السيرفر وبتطلع لكل الناس، ولوحة التحكم بتكون بكلمة سر.
      </p>

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
          <p>بيمسح كل تعديلاتك ويرجّع المنيو والصور متل أول نسخة.</p>
          {confirmReset ? (
            <div className="arow">
              <button className="abtn abtn--danger" onClick={reset}>أكيد، رجّع الأصل</button>
              <button className="abtn" onClick={() => setConfirmReset(false)}>إلغاء</button>
            </div>
          ) : (
            <button className="abtn" onClick={() => setConfirmReset(true)}>رجّع الأصل</button>
          )}
        </section>
      </div>

      {toast && <div className={'atoast' + (toast.bad ? ' is-bad' : '')} role="status">{toast.text}</div>}
    </div>
  );
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
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      setErr('');
      onChange(await readImage(f));
    } catch {
      setErr('ما قدرنا نقرأ الصورة. جرّب صورة JPG أو PNG.');
    }
  };
  return (
    <div className="apick">
      <div className="apick__thumb">{src ? <img src={src} alt="" /> : <span>بدون صورة</span>}</div>
      <div className="apick__ctrls">
        <span className="afield__label">{label}</span>
        <label className="abtn abtn--small">
          {src ? 'غيّر الصورة' : 'ارفع صورة'}
          <input type="file" accept="image/*" onChange={pick} hidden />
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
          <Field label="القصة" hint="كل فقرة بسطر لحال. الأرقام تحت القصة (الفروع، الساعات، الساندويشات، الصوصات) بتنحسب لحالها من المنيو والفروع.">
            <ListInput id="a-story" multiline value={draft.about.paragraphs} join={'\n'} split={/\n/} onChange={v => up(d => { d.about.paragraphs = v; })} />
          </Field>
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
      <label className="abtn abtn--add">
        + ضيف صورة
        <input type="file" accept="image/*" hidden onChange={async e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) { const v = await readImage(f, 1400); up(d => { d.gallery.push(v); }); }
        }} />
      </label>
    </section>
  );
}
