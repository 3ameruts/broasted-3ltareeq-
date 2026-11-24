# «جوعان؟» — فيديو تعريفي للطلب الأونلاين (Instagram / Facebook)

‏1080×1920، ‏30 ثانية، مقصوص على إيقاع الموسيقى (الدروب على 2.4 ثانية؛ كل حركة على `b(n)` بـ `src/theme.ts`).

| الوقت | المشهد |
|---|---|
| 0–2.4 | «جوعان؟» على خلفية غامقة، وعضّة بالكلمة مع صوت قرمشة وفتافيت |
| 2.4–7.5 | الدروب: الأكل بينفجر من النص، «ولا يهمّك!»، «اطلب أونلاين»، «بـ 3 خطوات بس» والجوال بيطلع 3D |
| 7.5–20 | ① اختار وجبتك ② حار ولا عادي؟ / قسّمها (8 حار + 4 عادي) ③ أكّد طلبك ④ تابع طلبك |
| 20–25 | مونتاج أكل: whip-pan + motion blur + parallax: مقرمش · فريش · على كيفك · وبيوصلك سخن |
| 25–30 | الشعار بيرسم حاله (vector من الشعار الحقيقي)، «اطلب هلأ!»، الرابط، توصيل أو استلام |

## التشغيل
```bash
npm ci
bash assets/build.sh          # تلوين صور الأكل + قص الخلفيات (rembg) + الشعار vector
npm run sound                 # تنزيل الأصوات والموسيقى من Mixkit + الميكس والماستر (-14 LUFS)
REMOTION_BROWSER=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell npm run render
```
الأدوات من `video/studio-kit` (`bash video/studio-kit/install.sh`).

## المصادر والتراخيص
- الموسيقى: «Arab Nights» من Mixkit (Mixkit Stock Music Free License). المؤثرات: Mixkit Sound Effects Free License (القائمة بـ `audio/mixkit_sources.tsv`). الملفات الخام ما بتنحفظ بالريبو لأن الترخيص بيمنع إعادة توزيعها.
- صور الأكل وشاشات الموقع والشعار: ملك المطعم.
