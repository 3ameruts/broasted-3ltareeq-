# فيديو الطلب أونلاين · بروستد عالطريق

ريل تعريفي 25 ثانية، **بدون صوت** (الموسيقى بتنضاف من إنستغرام أو تيك توك وقت النشر).
1080×1920 · 9:16 · 30fps · H.264. الفيديو الجاهز: `out/online-order-reel.mp4`.

## القصة
| الوقت | المشهد | الملف |
|---|---|---|
| 0–2.5 | الموبايل بيطير للكاميرا: «وجبتك المفضلة... صارت أقرب!» | `src/scenes/OrderFlow.tsx` |
| 2.5–9.5 | الطلب على الموقع الحقيقي: المنيو ← وجبة 12 قطعة ← قسّمها (8 حار + 4 عادي) ← السلة ← العنوان ← رمز الواتساب ← انبعت الطلب | `src/scenes/OrderFlow.tsx` |
| 9.5–12.5 | الطلب بيطلع كخط ضوئي وبيوصل لشاشة الفرع: «طلب جديد!» | `src/scenes/Transmit.tsx` |
| 12.5–16.5 | الفرع بيشوف الطلب بالتفصيل (مع التقسيم)، بيقبله، والزبون بيوصله «تم تأكيد طلبك» | `src/scenes/Branch.tsx` |
| 16.5–20.5 | المطبخ: صور الأكل الحقيقية بقطعات سريعة | `src/scenes/Kitchen.tsx` |
| 20.5–25 | الوجبة مع الموبايل وشاشة الفرع: «اطلب أونلاين... واستمتع بوجبتك!» والشعار والرابط | `src/scenes/Hero.tsx` |

## الواجهات حقيقية
صور صفحات الزبون وشاشة الفرع مأخوذة من الموقع نفسه، على نسخة محلية وببيانات تجريبية (الزبون «أحمد» والطلب #77). ما في أي طلب حقيقي.
السكربتات بـ `capture/`، والصور بـ `public/ui/`.

## الأدوات
Remotion 4 (React)، GSAP 3، Lucide React، خطوط Google (Tajawal وIBM Plex Sans Arabic وCairo) من Fontsource، Playwright للتصوير، وrembg لقص صور الأكل.

## إعادة التصدير
```bash
cd video/online-order-reel
npm install
# (اختياري) تصوير الواجهات من جديد: من جذر المشروع شغّل npm run build ثم npx vite preview --port 4173، وبعدين:
npm run capture
npm run studio                 # معاينة وتعديل
npm run render                 # out/online-order-reel.mp4
```
إذا ما في Chrome على الجهاز: `REMOTION_BROWSER=/path/to/chrome-headless-shell npm run render`.

ترخيص Remotion: مجاني للأفراد والشركات لحد 3 موظفين (https://www.remotion.dev/license).
