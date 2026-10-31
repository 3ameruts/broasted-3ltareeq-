import { ArrowRight, MapPin, MessageCircle, Phone } from 'lucide-react';
import type { Content } from '../../lib/types';
import { cn } from '../ui/cn';

// Privacy, ordering terms and contact: plain Jordanian Arabic, linked at the bottom of the order pages
export type InfoPage = 'privacy' | 'terms' | 'contact';
const TITLES: Record<InfoPage, string> = { privacy: 'الخصوصية', terms: 'شروط الطلب', contact: 'تواصل معنا' };
const wa = (p: string) => 'https://wa.me/' + p.replace(/\D/g, '').replace(/^0/, '962');

export function Info({ page, content, phone, keepDays, onPage, onBack }: {
  page: InfoPage; content: Content; phone: string; keepDays: number; onPage: (p: InfoPage) => void; onBack: () => void;
}) {
  const brand = content.brand.name || 'بروستد عالطريق';
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-4 pb-16">
      <button onClick={onBack} className="flex h-11 items-center gap-2 self-start font-bold text-soft"><ArrowRight size={20} /> رجوع للطلب</button>
      <nav className="grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 shadow-[0_0_0_2px_var(--color-line)]" aria-label="صفحات">
        {(Object.keys(TITLES) as InfoPage[]).map(p => (
          <button key={p} onClick={() => onPage(p)} aria-current={page === p ? 'page' : undefined}
            className={cn('h-11 rounded-xl text-sm font-bold', page === p ? 'bg-asphalt text-white' : 'text-ink')}>{TITLES[p]}</button>
        ))}
      </nav>
      <article className="flex flex-col gap-4 rounded-3xl bg-white p-5 leading-relaxed shadow-[0_0_0_2px_var(--color-line)] [&_h2]:font-display [&_h2]:text-xl [&_li]:ms-5 [&_li]:list-disc">
        {page === 'privacy' && <>
          <h1 className="font-display text-3xl">سياسة الخصوصية</h1>
          <p>بـ{brand} بنحترم خصوصيتك. هون بنحكيلك شو المعلومات اللي بناخدها لما تطلب أونلاين، وليش، وكم بنحتفظ فيها.</p>
          <h2>شو بناخد منك</h2>
          <ul>
            <li>اسمك ورقم موبايلك: عشان نأكّد طلبك ونتواصل معك بخصوصه.</li>
            <li>عنوان التوصيل (إذا طلبت توصيل)، وموقعك على الخريطة إذا اخترت تشاركه.</li>
            <li>تفاصيل طلبك وطريقة الدفع وأي ملاحظة بتكتبها.</li>
            <li>تقييمك للطلب إذا قيّمت (بدون اسمك ولا رقمك).</li>
          </ul>
          <h2>ليش بنستعملها</h2>
          <ul>
            <li>نجهّز طلبك ونوصّله، ونتصل فيك إذا احتجنا نتأكد من إشي.</li>
            <li>نحمي الخدمة من الطلبات الوهمية (مثلاً منع رقم بيعمل طلبات وهمية).</li>
            <li>نحسّن الخدمة من التقييمات.</li>
          </ul>
          <p><b>ما بنبيع معلوماتك ولا بنعطيها لحدا</b> لأغراض إعلانية. بنستعمل خدمات تقنية موثوقة لتشغيل الموقع وتخزين الطلبات بشكل آمن، وإذا تفعّل تأكيد الرقم، الكود بيوصلك عن طريق واتساب.</p>
          <h2>كم بنحتفظ فيها</h2>
          <p>الطلبات ومعلوماتها <b>بتنحذف تلقائياً بعد {keepDays} يوم</b>. بيضل بس ملخص مبيعات يومي بدون أي بيانات شخصية. الرقم المحظور بسبب طلبات وهمية بيضل محظور لحد ما ينفك.</p>
          <h2>على جهازك</h2>
          <p>الموقع بيحفظ على موبايلك (مش عنا) سلّتك والفرع اللي اخترته ومعلوماتك، عشان ما تكتبها كل مرة. بتقدر تمسحها من إعدادات المتصفح.</p>
          <h2>حقك</h2>
          <p>بدك تعرف شو محفوظ عنك، أو بدك نمسحه؟ تواصل معنا على <a className="num font-bold underline" href={`tel:${phone}`}>{phone}</a> وبنساعدك.</p>
        </>}
        {page === 'terms' && <>
          <h1 className="font-display text-3xl">شروط الطلب</h1>
          <h2>الطلب والتأكيد</h2>
          <ul>
            <li>بعد ما تبعت طلبك، فريقنا بيراجعه ويأكّده، وممكن نتصل فيك. الطلب بيتجهّز بعد التأكيد.</li>
            <li>بتقدر يكون عندك طلب واحد شغّال بنفس الوقت. لتعدّل طلبك أو تزيد عليه، تواصل معنا.</li>
            <li>إذا صنف خلص بعد ما طلبت، بنتصل فيك نعرض عليك بديل أو نشيله.</li>
          </ul>
          <h2>الأسعار والتوصيل</h2>
          <ul>
            <li>الأسعار بالدينار الأردني، وهي الأسعار المعروضة وقت الطلب.</li>
            <li>سعر التوصيل حسب منطقتك. بعض المناطق سعرها «من – لـ» حسب المكان بالزبط، وبنأكّده معك بالاتصال.</li>
            <li>وقت التوصيل بيختلف حسب الضغط والمسافة.</li>
          </ul>
          <h2>الدفع</h2>
          <ul>
            <li>الدفع عند الاستلام: <b>كاش</b> أو <b>كليك</b>. ما في دفع بالبطاقة على الموقع.</li>
            <li>إذا دفعت كليك، الحوالة لازم توصل قبل أو وقت الاستلام.</li>
          </ul>
          <h2>الإلغاء</h2>
          <ul>
            <li>بتقدر تلغي طلبك بالاتصال فينا قبل ما يبلّش تجهيزه.</li>
            <li>الطلبات الوهمية، أو الطلب اللي ما انستلم بدون سبب، ممكن يوقف إمكانية الطلب أونلاين من هالرقم.</li>
          </ul>
          <p className="text-sm text-soft">أي سؤال؟ <a className="num font-bold underline" href={`tel:${phone}`}>{phone}</a></p>
        </>}
        {page === 'contact' && <>
          <h1 className="font-display text-3xl">تواصل معنا</h1>
          <p>لأي سؤال عن طلبك أو تعديل أو ملاحظة:</p>
          <div className="grid grid-cols-2 gap-3">
            <a href={`tel:${phone}`} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-asphalt font-bold text-white"><Phone size={18} /> <span className="num">{phone}</span></a>
            <a href={wa(phone)} target="_blank" rel="noopener" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 font-bold text-white"><MessageCircle size={18} /> واتساب</a>
          </div>
          {content.brand.hours && <p className="text-soft">ساعات الدوام: {content.brand.hours}</p>}
          <h2>فروعنا</h2>
          <ul className="flex flex-col gap-2 [&_li]:ms-0 [&_li]:list-none">
            {content.branches.map(b => (
              <li key={b.id}>
                <a href={b.maps} target="_blank" rel="noopener" className="flex min-h-12 items-center gap-3 rounded-2xl bg-paper px-4 font-bold">
                  <MapPin size={18} className="text-brand-deep" /> {b.name}
                </a>
              </li>
            ))}
          </ul>
        </>}
      </article>
    </div>
  );
}

// small links under the order pages
export function InfoLinks({ onPage }: { onPage: (p: InfoPage) => void }) {
  return (
    <footer className="mx-auto flex max-w-lg flex-wrap justify-center gap-x-4 gap-y-1 px-4 pt-6 pb-24 text-sm text-soft lg:pb-8">
      {(Object.keys(TITLES) as InfoPage[]).map(p => <button key={p} className="underline" onClick={() => onPage(p)}>{TITLES[p]}</button>)}
    </footer>
  );
}
