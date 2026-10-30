import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Admin: delivery areas and fees per branch. Paste a whole list at once (one area per line with its price),
// then fix names, other names customers use, prices, or switch an area off.
type Zone = { id: number; branch_id: string; name: string; aliases: string[]; fee: number; active: boolean };
type Flash = (text: string, bad?: boolean) => void;

// «الحصن - 1»، «الحصن: 1.5»، «الحصن 0.75»، «الحصن، حصن، دوار الحصن = 1» (the names before the price, the first is the main one)
function parse(text: string) {
  const rows: { name: string; aliases: string[]; fee: number }[] = [], bad: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    if (!line) continue;
    const m = line.match(/^(.*?)[\s:=\-–—]*(\d+(?:[.,]\d+)?)\s*(?:د\.?أ|دينار|jd)?$/i);
    const names = m?.[1].split(/[،,|/]/).map(x => x.trim()).filter(Boolean) ?? [];
    const fee = m ? Number(m[2].replace(',', '.')) : NaN;
    if (!names.length || !(fee >= 0 && fee <= 20)) { bad.push(raw.trim()); continue; }
    rows.push({ name: names[0].slice(0, 60), aliases: names.slice(1), fee });
  }
  return { rows, bad };
}

export default function ZonesPanel({ flash }: { flash: Flash }) {
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branch, setBranch] = useState('');
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('delivery_zones').select('*').order('name');
    if (error) return setMissing(true);
    setZones((data ?? []).map(z => ({ ...z, fee: Number(z.fee) })) as Zone[]);
  }, []);
  useEffect(() => {
    supabase.from('order_branches').select('id, name').order('id').then(({ data }) => { setBranches(data ?? []); setBranch(b => b || data?.[0]?.id || ''); });
    refresh();
  }, [refresh]);

  if (missing) return <section className="apanel"><h3>مناطق التوصيل</h3><div className="apanel__body"><p>شغّل ملف 13-delivery-zones.sql بـ Supabase عشان يشتغل هالقسم.</p></div></section>;
  const mine = (zones ?? []).filter(z => z.branch_id === branch);
  const preview = parse(paste);

  const importList = async () => {
    if (!preview.rows.length) return;
    setBusy(true);
    const { error } = await supabase.from('delivery_zones')
      .upsert(preview.rows.map(r => ({ branch_id: branch, name: r.name, aliases: r.aliases, fee: r.fee, active: true })), { onConflict: 'branch_id,name' });
    setBusy(false);
    if (error) return flash(`ما انحفظت المناطق (${error.message})`, true);
    flash(`انحفظت ${preview.rows.length} منطقة`);
    setPaste(''); refresh();
  };
  const save = async (z: Zone, patch: Partial<Zone>) => {
    const { error } = await supabase.from('delivery_zones').update(patch).eq('id', z.id);
    if (error) return flash(`ما انحفظ (${error.message})`, true);
    flash('انحفظ'); refresh();
  };
  const remove = async (z: Zone) => {
    if (!confirm(`تمسح منطقة «${z.name}»؟`)) return;
    const { error } = await supabase.from('delivery_zones').delete().eq('id', z.id);
    if (error) return flash(`ما انمسحت (${error.message})`, true);
    flash('انمسحت'); refresh();
  };

  return (
    <section className="apanel">
      <h3>مناطق التوصيل</h3>
      <div className="apanel__body">
        <p className="afield__hint">الزبون بيختار منطقته وبيشوف سعر التوصيل والمجموع. إذا الفرع ما إله مناطق، أو الزبون كبس «منطقتي مش بالقائمة»، التوصيل بيتحدد بالاتصال.</p>
        <div className="arow">
          {branches.map(b => (
            <button key={b.id} className={'abtn abtn--small' + (branch === b.id ? ' abtn--primary' : '')} onClick={() => setBranch(b.id)}>
              {b.name} ({(zones ?? []).filter(z => z.branch_id === b.id && z.active).length})
            </button>
          ))}
        </div>

        <div className="asubpanel">
          <p className="asub"><strong>الصق قائمة المناطق</strong></p>
          <p className="afield__hint">كل سطر منطقة وسعرها، مثل: «الحصن - 1» أو «الحي الشرقي 0.75». أسماء ثانية للمنطقة بفاصلة قبل السعر: «القبة، دوار القبة - 1.25». إذا المنطقة موجودة، سعرها بيتحدّث.</p>
          <label className="afield"><textarea rows={6} value={paste} onChange={e => setPaste(e.target.value)} placeholder={'الحصن - 1\nالحي الشرقي - 0.75\nالقبة، دوار القبة - 1.25'} /></label>
          {paste.trim() && <p className="afield__hint">جاهز: <b>{preview.rows.length}</b> منطقة{preview.bad.length ? <> · <span className="afield__err">ما فهمنا: {preview.bad.join(' | ')}</span></> : null}</p>}
          <div className="arow"><button className="abtn abtn--primary" onClick={importList} disabled={busy || !preview.rows.length}>{busy ? 'بنحفظ…' : `احفظ لـ ${branches.find(b => b.id === branch)?.name ?? ''}`}</button></div>
        </div>

        {!zones ? <p>…</p> : !mine.length ? <p>ما في مناطق لهالفرع لسا (التوصيل بالاتصال).</p> : (
          <ul className="aitems">{mine.map(z => <ZoneRow key={z.id} z={z} onSave={p => save(z, p)} onRemove={() => remove(z)} />)}</ul>
        )}
      </div>
    </section>
  );
}

function ZoneRow({ z, onSave, onRemove }: { z: Zone; onSave: (p: Partial<Zone>) => void; onRemove: () => void }) {
  const [name, setName] = useState(z.name);
  const [aliases, setAliases] = useState(z.aliases.join('، '));
  const [fee, setFee] = useState(String(z.fee));
  const list = aliases.split(/[،,]/).map(x => x.trim()).filter(Boolean);
  const changed = name.trim() !== z.name || list.join('|') !== z.aliases.join('|') || Number(fee) !== z.fee;
  return (
    <li className="aitem" style={z.active ? undefined : { opacity: 0.6 }}>
      <div className="agrid">
        <label className="afield"><span className="afield__label">المنطقة</span><input value={name} onChange={e => setName(e.target.value)} maxLength={60} /></label>
        <label className="afield"><span className="afield__label">أسماء ثانية (اختياري)</span><input value={aliases} onChange={e => setAliases(e.target.value)} placeholder="بفاصلة بينهم" /></label>
        <label className="afield"><span className="afield__label">سعر التوصيل</span><input dir="ltr" inputMode="decimal" value={fee} onChange={e => setFee(e.target.value.replace(/[^\d.]/g, ''))} /></label>
      </div>
      <div className="arow">
        {changed && <button className="abtn abtn--small abtn--primary" disabled={!name.trim() || !(Number(fee) >= 0 && Number(fee) <= 20)}
          onClick={() => onSave({ name: name.trim(), aliases: list, fee: Math.round(Number(fee) * 100) / 100 })}>احفظ</button>}
        <button className="abtn abtn--small" onClick={() => onSave({ active: !z.active })}>{z.active ? 'وقّف التوصيل لهالمنطقة' : 'رجّعها'}</button>
        <button className="abtn abtn--small abtn--ghost" onClick={onRemove}>امسح</button>
      </div>
    </li>
  );
}
