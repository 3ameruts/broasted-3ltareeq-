# فيديو الطلب أونلاين · بروستد عالطريق

ريل تعريفي 28 ثانية، **بمؤثرات صوتية بس**: بدون موسيقى وبدون صوت بشري (الموسيقى بتنضاف من إنستغرام أو تيك توك وقت النشر).
1080×1920 · 9:16 · 30fps · H.264 + AAC. الفيديو الجاهز: `out/online-order-reel.mp4`.

## القصة
| الوقت | المشهد | الملف |
|---|---|---|
| 0–5.5 | البداية: ضربة الشعار والوجبات بتتطاير، «وجبتك المفضلة... صارت أقرب!»، الموبايل بيطير مع «توصيل / استلام / كاش أو كليك» | `src/scenes/OrderFlow.tsx` |
| 5.5–12.5 | الطلب على الموقع الحقيقي: المنيو ← وجبة 12 قطعة ← قسّمها (8 حار + 4 عادي) ← السلة ← العنوان ← رمز الواتساب ← انبعت الطلب | `src/scenes/OrderFlow.tsx` |
| 12.5–15.5 | الطلب بيطلع كخط ضوئي وبيوصل لشاشة الفرع: «طلب جديد!» | `src/scenes/Transmit.tsx` |
| 15.5–19.5 | الفرع بيشوف الطلب بالتفصيل (مع التقسيم)، بيقبله، والزبون بيوصله «تم تأكيد طلبك» | `src/scenes/Branch.tsx` |
| 19.5–23.5 | المطبخ: صور الأكل الحقيقية بقطعات سريعة | `src/scenes/Kitchen.tsx` |
| 23.5–28 | الوجبة مع الموبايل وشاشة الفرع: «اطلب أونلاين... واستمتع بوجبتك!» والشعار والرابط | `src/scenes/Hero.tsx` |

## الصوت
مؤثرات مسجّلة من **Mixkit** (Sound Effects Free License: مسموح بالاستخدام التجاري والسوشال ميديا بدون ذكر المصدر).
الترخيص ما بيسمح نوزّع ملفات الصوت لحالها، فما بنحفظها بالمستودع: القائمة بـ `audio/mixkit_sources.tsv`، والسكربت `audio/get_mixkit.sh` بينزّلها،
و`audio/cues.json` فيه وقت كل مؤثر، و`audio/mix.py` بيركّبهم على `public/audio.wav`.

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
npm run sound                  # بينزّل المؤثرات وبيركّبهم (public/audio.wav)
npm run studio                 # معاينة وتعديل
npm run render                 # out/online-order-reel.mp4
```
إذا ما في Chrome على الجهاز: `REMOTION_BROWSER=/path/to/chrome-headless-shell npm run render`.

ترخيص Remotion: مجاني للأفراد والشركات لحد 3 موظفين (https://www.remotion.dev/license).
