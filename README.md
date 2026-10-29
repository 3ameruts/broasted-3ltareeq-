# بروستد عالطريق: الموقع

موقع المطعم: المنيو والأسعار، فيديو الواجهة، قصتنا، الفروع مع زر "أقرب فرع"، زر اتصال عائم، ولوحة تحكم على `/#admin`.

مبني بـ React + Vite، مع GSAP و Lenis للحركة، ومكوّنات من React Bits.

## التشغيل على جهازك

```bash
npm install
npm run dev      # نسخة للتطوير على http://localhost:5173
npm run build    # نسخة النشر في مجلد dist
```

## النشر على Vercel

1. سجّل دخول على vercel.com بحساب GitHub.
2. **Add New → Project** واختار هالمستودع.
3. الإعدادات بيتعرّف عليها Vercel لحاله (Vite)، كبست **Deploy**.

كل تعديل بينرفع على الفرع `main` بيتنشر لحاله.

## وين كل شي

| المجلد | شو فيه |
|---|---|
| `src/data/default-content.json` | المنيو، الأسعار، النصوص، الفروع وإحداثياتها |
| `src/components/Site.tsx` | أقسام الموقع |
| `src/components/Admin.tsx` | لوحة التحكم |
| `src/styles.css` | الألوان والخطوط والتصميم |
| `public/img`, `public/video` | الصور والفيديوهات الجاهزة للويب |
| `video-src/` | مصدر فيديوهات الأنيميشن (`hero.html`, `about.html`) وسكريبت التسجيل |
| `brand/` | المنيو الأصلي والصور الأصلية واللوغو |

## إعادة توليد الفيديوهات

بيحتاج Playwright و ffmpeg:

```bash
cd video-src
node render.mjs hero 30    # فيديو الواجهة
node render.mjs about 30   # فيديو قصتنا
```

الفيديوهات بتنحفظ في `public/video`.

## لوحة التحكم

على `/admin` (والرابط القديم `/#admin` بيشتغل كمان). الدخول بإيميل وكلمة سر من Supabase، وكل تعديل بيتحفظ بقاعدة البيانات وبيطلع لكل الزوار فوراً. الصور اللي بترفعها بتنحفظ بـ Supabase Storage.

الإعداد لمرة وحدة:
1. Supabase → **SQL Editor**: الصق `supabase/setup.sql` بعد ما تغيّر الإيميل بآخره، وكبست **Run**.
2. Supabase → **Authentication → Users → Add user**: نفس الإيميل وكلمة سر، مع **Auto Confirm User**.
3. (منصوح) **Authentication → Sign In / Providers**: طفّي **Allow new users to sign up**.

لإضافة شخص تاني يعدّل: ضيف إيميله بجدول `admins` واعمله حساب من Authentication.

رابط Supabase والمفتاح العام موجودين بـ `src/lib/supabase.ts`، وبتقدر تغيّرهم بمتغيّرات `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` على Vercel.
