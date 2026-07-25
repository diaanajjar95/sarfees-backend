/* ============================================================
   Sarfees Landing — i18n + interactions
   ============================================================ */

const I18N = {
  // ---- NAV ----
  "nav.rides":   { en: "Ride types", ar: "أنواع الرحلات" },
  "nav.how":     { en: "How it works", ar: "كيف يعمل" },
  "nav.women":   { en: "Women-Only", ar: "نساء فقط" },
  "nav.safety":  { en: "Safety", ar: "الأمان" },
  "nav.cities":  { en: "Coverage", ar: "التغطية" },
  "nav.driver":  { en: "Drive", ar: "كُن سائقاً" },
  "nav.cta":     { en: "Get the app", ar: "حمّل التطبيق" },

  // ---- HERO ----
  "hero.badge":  { en: "Now live in Jordan &amp; Syria", ar: "متوفّر الآن في الأردن وسوريا" },
  "hero.title":  { en: "Smart rides for the <span class='text-amber'>Arab world</span>", ar: "تنقّل ذكي <span class='text-amber'>للعالم العربي</span>" },
  "hero.lead":   { en: "Book a Standard ride, a Women-Only trip, or send a package — all from one app. Reliable drivers and fair, upfront prices, in Arabic and English.", ar: "احجز رحلة عادية، أو رحلة للنساء فقط، أو أرسل طرداً — كل ذلك من تطبيق واحد. سائقون موثوقون وأسعار عادلة وواضحة، بالعربية والإنجليزية." },
  "hero.rating": { en: "Rated <b>4.9</b> by 50,000+ riders", ar: "تقييم <b>٤٫٩</b> من أكثر من ٥٠٬٠٠٠ راكب" },

  "sb.appstore.top":  { en: "Download on the", ar: "حمّله من" },
  "sb.appstore.main": { en: "App Store", ar: "App Store" },
  "sb.play.top":      { en: "Get it on", ar: "احصل عليه من" },
  "sb.play.main":     { en: "Google Play", ar: "Google Play" },

  "float.a.t": { en: "Driver arriving", ar: "السائق قادم" },
  "float.a.s": { en: "3 min away", ar: "خلال ٣ دقائق" },
  "float.b.t": { en: "Trip completed", ar: "اكتملت الرحلة" },
  "float.b.s": { en: "JOD 3.50", ar: "٣٫٥٠ د.أ" },

  // ---- PHONE MOCK ----
  "ph.where":   { en: "Where to?", ar: "إلى أين؟" },
  "ph.greet1":  { en: "Good morning,", ar: "صباح الخير،" },
  "ph.greet2":  { en: "Ahmad", ar: "أحمد" },
  "ph.std":     { en: "Standard", ar: "عادي" },
  "ph.women":   { en: "Women-Only", ar: "نساء فقط" },
  "ph.pkg":     { en: "Package", ar: "طرود" },

  // ---- STATS ----
  "stat.1.n": { en: "50K+", ar: "٥٠ ألف+" },
  "stat.1.l": { en: "Active riders", ar: "راكب نشِط" },
  "stat.2.n": { en: "1,200+", ar: "١٢٠٠+" },
  "stat.2.l": { en: "Verified drivers", ar: "سائق موثّق" },
  "stat.3.n": { en: "4.9", ar: "٤٫٩" },
  "stat.3.l": { en: "Average rating", ar: "متوسط التقييم" },
  "stat.4.n": { en: "3 min", ar: "٣ دقائق" },
  "stat.4.l": { en: "Avg pickup", ar: "متوسط الانتظار" },

  // ---- RIDE TYPES ----
  "rides.eyebrow": { en: "One app, three ways to move", ar: "تطبيق واحد، ثلاث طرق للتنقّل" },
  "rides.title":   { en: "Choose the ride that fits the moment", ar: "اختر الرحلة التي تناسب اللحظة" },
  "rides.lead":    { en: "Every Sarfees trip is tracked, rated, and priced upfront — whichever option you pick.", ar: "كل رحلة مع سرفيس مُتتبَّعة ومُقيَّمة وبسعر واضح مسبقاً — أياً كان خيارك." },

  "rc.std.tag":  { en: "Most popular", ar: "الأكثر طلباً" },
  "rc.std.h":    { en: "Standard", ar: "عادي" },
  "rc.std.d":    { en: "Comfortable, everyday rides at fair, upfront prices.", ar: "رحلات يومية مريحة بأسعار عادلة وواضحة." },
  "rc.std.f1":   { en: "Upfront pricing", ar: "سعر واضح مسبقاً" },
  "rc.std.f2":   { en: "Door-to-door", ar: "من الباب إلى الباب" },
  "rc.std.f3":   { en: "Cash or card", ar: "نقداً أو بالبطاقة" },

  "rc.women.tag": { en: "Women only", ar: "للنساء فقط" },
  "rc.women.h":   { en: "Women-Only", ar: "نساء فقط" },
  "rc.women.d":   { en: "Female drivers and passengers only — travel with peace of mind.", ar: "سائقات وراكبات فقط — تنقّلي براحة بال." },
  "rc.women.f1":  { en: "Verified female drivers", ar: "سائقات موثّقات" },
  "rc.women.f2":  { en: "Trusted by families", ar: "موثوق من العائلات" },
  "rc.women.f3":  { en: "Extra privacy", ar: "خصوصية أكبر" },

  "rc.pkg.tag":  { en: "Same-day", ar: "في نفس اليوم" },
  "rc.pkg.h":    { en: "Package Delivery", ar: "توصيل الطرود" },
  "rc.pkg.d":    { en: "Send parcels and documents across the city in minutes.", ar: "أرسل الطرود والمستندات عبر المدينة في دقائق." },
  "rc.pkg.f1":   { en: "Live tracking", ar: "تتبّع مباشر" },
  "rc.pkg.f2":   { en: "Proof of delivery", ar: "إثبات التسليم" },
  "rc.pkg.f3":   { en: "Affordable rates", ar: "أسعار مناسبة" },

  // ---- HOW IT WORKS ----
  "how.eyebrow": { en: "Get moving in seconds", ar: "انطلق خلال ثوانٍ" },
  "how.title":   { en: "How Sarfees works", ar: "كيف يعمل سرفيس" },
  "how.1.t": { en: "Set your destination", ar: "حدّد وجهتك" },
  "how.1.d": { en: "Open the app and tell us where to. Pin pickup and drop-off in seconds.", ar: "افتح التطبيق وأخبرنا إلى أين. حدّد نقطة الانطلاق والوصول في ثوانٍ." },
  "how.2.t": { en: "Pick your ride", ar: "اختر رحلتك" },
  "how.2.d": { en: "Choose Standard, Women-Only, or Package — see the price before you book.", ar: "اختر عادي أو نساء فقط أو طرود — وشاهد السعر قبل الحجز." },
  "how.3.t": { en: "Match with a driver", ar: "نطابقك مع سائق" },
  "how.3.d": { en: "We connect you with a nearby verified driver, fast.", ar: "نوصلك بأقرب سائق موثّق، وبسرعة." },
  "how.4.t": { en: "Track &amp; arrive", ar: "تتبّع وصِل" },
  "how.4.d": { en: "Follow your trip live, share your ride, and pay your way.", ar: "تابع رحلتك مباشرة، وشاركها، وادفع بطريقتك." },

  // ---- WHY ----
  "why.eyebrow": { en: "Why riders choose Sarfees", ar: "لماذا يختار الركّاب سرفيس" },
  "why.title":   { en: "Built for how the region really moves", ar: "مصمّم لطريقة تنقّل المنطقة فعلاً" },
  "why.lead":    { en: "Local by design — from currency and language to the way people actually get around.", ar: "محلّي في تصميمه — من العملة واللغة إلى طريقة تنقّل الناس فعلاً." },
  "why.1.t": { en: "Upfront pricing", ar: "سعر واضح مسبقاً" },
  "why.1.d": { en: "Know the fare before you book. No surge surprises, no haggling.", ar: "اعرف الأجرة قبل الحجز. لا مفاجآت في التسعير ولا مساومة." },
  "why.2.t": { en: "Bilingual &amp; RTL", ar: "لغتان ودعم كامل" },
  "why.2.d": { en: "Fully in Arabic and English — the app mirrors perfectly for both.", ar: "بالعربية والإنجليزية بالكامل — والتطبيق ينعكس بإتقان للاتجاهين." },
  "why.3.t": { en: "Local payments", ar: "وسائل دفع محلّية" },
  "why.3.d": { en: "Pay with cash or card, in your local currency.", ar: "ادفع نقداً أو بالبطاقة، وبعملتك المحلّية." },
  "why.4.t": { en: "Fast pickups", ar: "وصول سريع" },
  "why.4.d": { en: "Thousands of drivers mean shorter waits, day or night.", ar: "آلاف السائقين يعني انتظاراً أقصر، ليلاً ونهاراً." },
  "why.5.t": { en: "Live trip sharing", ar: "مشاركة الرحلة مباشرة" },
  "why.5.d": { en: "Share your route so someone always knows where you are.", ar: "شارك مسارك ليعرف أحدهم مكانك دائماً." },
  "why.6.t": { en: "24/7 support", ar: "دعم ٢٤/٧" },
  "why.6.d": { en: "Real people, ready to help in Arabic and English, any time.", ar: "أشخاص حقيقيون جاهزون للمساعدة بالعربية والإنجليزية، في أي وقت." },

  // ---- WOMEN ----
  "wm.eyebrow": { en: "Women-Only", ar: "نساء فقط" },
  "wm.title":   { en: "A ride built around women's safety", ar: "رحلة مصمّمة حول أمان المرأة" },
  "wm.lead":    { en: "Sometimes you want a ride where everyone — driver and passenger — is a woman. Sarfees makes that a tap away.", ar: "أحياناً تريدين رحلة يكون فيها الجميع — السائقة والراكبة — نساءً. سرفيس يجعل ذلك على بُعد نقرة." },
  "wm.1.t": { en: "Verified female drivers", ar: "سائقات موثّقات" },
  "wm.1.d": { en: "Every Women-Only driver is identity-verified and background-checked.", ar: "كل سائقة في خدمة النساء موثّقة الهوية وخاضعة لفحص السجلّ." },
  "wm.2.t": { en: "Private by design", ar: "خصوصية بالتصميم" },
  "wm.2.d": { en: "Your trip details stay between you and your driver.", ar: "تفاصيل رحلتك تبقى بينك وبين سائقتك." },
  "wm.3.t": { en: "Trusted by families", ar: "موثوق من العائلات" },
  "wm.3.d": { en: "Parents, students, and professionals ride with confidence.", ar: "الأهل والطالبات والموظفات يتنقّلن بثقة." },
  "wm.cta": { en: "Explore Women-Only", ar: "اكتشف خدمة النساء" },
  "wm.chip": { en: "Women-Only ride", ar: "رحلة نساء فقط" },
  "wm.chip.s": { en: "Female driver matched", ar: "تمّت مطابقة سائقة" },

  // ---- SAFETY ----
  "sf.eyebrow": { en: "Safety first", ar: "الأمان أولاً" },
  "sf.title":   { en: "Every trip, backed by real safety", ar: "كل رحلة، مدعومة بأمان حقيقي" },
  "sf.lead":    { en: "Safety isn't a feature we add later — it's built into every ride from the first tap.", ar: "الأمان ليس ميزة نضيفها لاحقاً — بل جزء من كل رحلة منذ النقرة الأولى." },
  "sf.1.t": { en: "Verified drivers", ar: "سائقون موثّقون" },
  "sf.1.d": { en: "ID checks and background screening before any driver hits the road.", ar: "تحقّق من الهوية وفحص للسجلّ قبل أن ينطلق أي سائق." },
  "sf.2.t": { en: "Live SOS button", ar: "زر الطوارئ المباشر" },
  "sf.2.d": { en: "One tap connects you to help and shares your live location.", ar: "نقرة واحدة توصلك بالمساعدة وتشارك موقعك المباشر." },
  "sf.3.t": { en: "Trip tracking", ar: "تتبّع الرحلة" },
  "sf.3.d": { en: "Share your route and ETA with trusted contacts in real time.", ar: "شارك مسارك ووقت الوصول مع جهات موثوقة لحظة بلحظة." },
  "sf.4.t": { en: "Two-way ratings", ar: "تقييم متبادل" },
  "sf.4.d": { en: "Riders and drivers rate every trip to keep standards high.", ar: "الركّاب والسائقون يقيّمون كل رحلة للحفاظ على المعايير." },

  // ---- COVERAGE ----
  "cv.eyebrow": { en: "Where we drive", ar: "أين نعمل" },
  "cv.title":   { en: "Live across Jordan &amp; Syria", ar: "نعمل في الأردن وسوريا" },
  "cv.lead":    { en: "Starting in the region's busiest cities — and expanding fast.", ar: "نبدأ من أكثر مدن المنطقة ازدحاماً — ونتوسّع بسرعة." },
  "cv.live":    { en: "Live", ar: "متوفّر" },
  "cv.soon":    { en: "Coming soon", ar: "قريباً" },
  "cv.c1": { en: "Amman", ar: "عمّان" },
  "cv.c1s": { en: "Jordan", ar: "الأردن" },
  "cv.c2": { en: "Irbid", ar: "إربد" },
  "cv.c2s": { en: "Jordan", ar: "الأردن" },
  "cv.c3": { en: "Zarqa", ar: "الزرقاء" },
  "cv.c3s": { en: "Jordan", ar: "الأردن" },
  "cv.c4": { en: "Damascus", ar: "دمشق" },
  "cv.c4s": { en: "Syria", ar: "سوريا" },
  "cv.c5": { en: "Aleppo", ar: "حلب" },
  "cv.c5s": { en: "Syria", ar: "سوريا" },

  // ---- DRIVER ----
  "dr.eyebrow": { en: "Drive with Sarfees", ar: "قُد مع سرفيس" },
  "dr.title":   { en: "Turn your car into income", ar: "حوّل سيارتك إلى دخل" },
  "dr.lead":    { en: "Set your own hours, keep more of every fare, and get paid reliably. Join thousands of drivers earning with Sarfees.", ar: "حدّد ساعاتك، واحتفظ بنصيب أكبر من كل أجرة، واحصل على أموالك بانتظام. انضمّ لآلاف السائقين الذين يكسبون مع سرفيس." },
  "dr.1.t": { en: "Keep more", ar: "اكسب أكثر" },
  "dr.1.d": { en: "Competitive commission — more of every fare stays with you.", ar: "عمولة تنافسية — نصيب أكبر من كل أجرة يبقى لك." },
  "dr.2.t": { en: "Flexible hours", ar: "ساعات مرنة" },
  "dr.2.d": { en: "Drive when you want. No shifts, no minimums.", ar: "قُد متى شئت. لا ورديات ولا حدّ أدنى." },
  "dr.3.t": { en: "Fast payouts", ar: "دفعات سريعة" },
  "dr.3.d": { en: "Get your earnings quickly and reliably.", ar: "احصل على أرباحك بسرعة وانتظام." },
  "dr.4.t": { en: "Driver support", ar: "دعم السائقين" },
  "dr.4.d": { en: "A team in your corner, in Arabic and English.", ar: "فريق إلى جانبك، بالعربية والإنجليزية." },
  "dr.cta":  { en: "Become a driver", ar: "كُن سائقاً" },
  "dr.ec.l": { en: "Top drivers earn up to", ar: "أفضل السائقين يكسبون حتى" },
  "dr.ec.a": { en: "JOD 900", ar: "٩٠٠ د.أ" },
  "dr.ec.s": { en: "per month, driving full-time", ar: "شهرياً، بدوام كامل" },

  // ---- DOWNLOAD ----
  "dl.title": { en: "Your next ride is one tap away", ar: "رحلتك القادمة على بُعد نقرة" },
  "dl.lead":  { en: "Download Sarfees free on iOS and Android. Standard, Women-Only, and Package — all in one app.", ar: "حمّل سرفيس مجاناً على iOS وأندرويد. عادي، نساء فقط، وطرود — في تطبيق واحد." },
  "dl.qr.t":  { en: "Scan to download", ar: "امسح للتحميل" },
  "dl.qr.s":  { en: "Point your camera here", ar: "وجّه الكاميرا هنا" },

  // ---- FAQ ----
  "faq.eyebrow": { en: "Questions", ar: "أسئلة" },
  "faq.title":   { en: "Frequently asked", ar: "الأسئلة الشائعة" },
  "faq.1.q": { en: "Where is Sarfees available?", ar: "أين يتوفّر سرفيس؟" },
  "faq.1.a": { en: "Sarfees is live in Amman, Irbid, and Damascus, with more cities across Jordan and Syria launching soon.", ar: "سرفيس متوفّر في عمّان وإربد ودمشق، ومدن أخرى في الأردن وسوريا قريباً." },
  "faq.2.q": { en: "How is the fare calculated?", ar: "كيف تُحسب الأجرة؟" },
  "faq.2.a": { en: "You see the full price upfront before you confirm — based on distance and time, with no hidden surge fees.", ar: "ترى السعر الكامل مسبقاً قبل التأكيد — بناءً على المسافة والوقت، دون رسوم خفية." },
  "faq.3.q": { en: "What is a Women-Only ride?", ar: "ما هي رحلة النساء فقط؟" },
  "faq.3.a": { en: "A trip where both the driver and the passenger are women. Every Women-Only driver is identity-verified and background-checked.", ar: "رحلة تكون فيها السائقة والراكبة نساءً. كل سائقة موثّقة الهوية وخاضعة لفحص السجلّ." },
  "faq.4.q": { en: "How do I pay?", ar: "كيف أدفع؟" },
  "faq.4.a": { en: "Pay with cash or card in your local currency. You choose your payment method before or after the trip.", ar: "ادفع نقداً أو بالبطاقة بعملتك المحلّية. تختار طريقة الدفع قبل الرحلة أو بعدها." },
  "faq.5.q": { en: "Can I send a package without riding?", ar: "هل يمكنني إرسال طرد دون ركوب؟" },
  "faq.5.a": { en: "Yes. Package Delivery lets you send parcels and documents across the city with live tracking and proof of delivery.", ar: "نعم. تتيح خدمة الطرود إرسال الطرود والمستندات عبر المدينة مع تتبّع مباشر وإثبات تسليم." },
  "faq.6.q": { en: "How do I become a driver?", ar: "كيف أصبح سائقاً؟" },
  "faq.6.a": { en: "Tap \u201CBecome a driver,\u201D submit your documents for verification, and start earning once you're approved — usually within a few days.", ar: "اضغط \u201Cكُن سائقاً\u201D، وقدّم مستنداتك للتحقّق، وابدأ الكسب بعد الموافقة — عادةً خلال أيام قليلة." },

  // ---- FOOTER ----
  "ft.about":  { en: "Smart travel, simplified. Sarfees brings reliable rides, women-only trips, and package delivery to the Arab world — in Arabic and English.", ar: "السفر الذكي، مبسّط. يقدّم سرفيس رحلات موثوقة، ورحلات للنساء فقط، وتوصيل طرود للعالم العربي — بالعربية والإنجليزية." },
  "ft.c1.h": { en: "Company", ar: "الشركة" },
  "ft.c1.1": { en: "About", ar: "من نحن" },
  "ft.c1.2": { en: "Careers", ar: "الوظائف" },
  "ft.c1.3": { en: "Press", ar: "الصحافة" },
  "ft.c1.4": { en: "Blog", ar: "المدوّنة" },
  "ft.c2.h": { en: "Product", ar: "المنتج" },
  "ft.c2.1": { en: "Ride types", ar: "أنواع الرحلات" },
  "ft.c2.2": { en: "Safety", ar: "الأمان" },
  "ft.c2.3": { en: "Coverage", ar: "التغطية" },
  "ft.c2.4": { en: "Pricing", ar: "الأسعار" },
  "ft.c3.h": { en: "Drivers", ar: "السائقون" },
  "ft.c3.1": { en: "Become a driver", ar: "كُن سائقاً" },
  "ft.c3.2": { en: "Driver app", ar: "تطبيق السائق" },
  "ft.c3.3": { en: "Requirements", ar: "المتطلبات" },
  "ft.c3.4": { en: "Earnings", ar: "الأرباح" },
  "ft.copy": { en: "\u00A9 2026 Sarfees. All rights reserved.", ar: "\u00A9 ٢٠٢٦ سرفيس. جميع الحقوق محفوظة." },
  "ft.l1": { en: "Privacy", ar: "الخصوصية" },
  "ft.l2": { en: "Terms", ar: "الشروط" },
  "ft.l3": { en: "Cookies", ar: "ملفات الارتباط" },
};

/* ---- apply language ---- */
function setLang(lang) {
  const rtl = lang === "ar";
  document.documentElement.lang = lang;
  document.documentElement.dir = rtl ? "rtl" : "ltr";
  document.body.dir = rtl ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const entry = I18N[key];
    if (entry && entry[lang] != null) el.innerHTML = entry[lang];
  });

  document.querySelectorAll(".lang-toggle button").forEach(b => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });

  try { localStorage.setItem("sarfees_lang", lang); } catch (e) {}
}

/* ---- init ---- */
document.addEventListener("DOMContentLoaded", () => {
  let saved = "en";
  try { saved = localStorage.getItem("sarfees_lang") || "en"; } catch (e) {}
  setLang(saved);

  document.querySelectorAll(".lang-toggle button").forEach(b => {
    b.addEventListener("click", () => setLang(b.dataset.lang));
  });

  // nav scrolled state
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // mobile menu
  const menuBtn = document.querySelector(".menu-btn");
  const mobileMenu = document.querySelector(".mobile-menu");
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener("click", () => mobileMenu.classList.toggle("open"));
    mobileMenu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => mobileMenu.classList.remove("open")));
  }

  // FAQ accordion
  document.querySelectorAll(".faq-item").forEach(item => {
    const q = item.querySelector(".faq-q");
    const a = item.querySelector(".faq-a");
    q.addEventListener("click", () => {
      const open = item.classList.contains("open");
      document.querySelectorAll(".faq-item").forEach(other => {
        other.classList.remove("open");
        other.querySelector(".faq-a").style.maxHeight = null;
      });
      if (!open) {
        item.classList.add("open");
        a.style.maxHeight = a.scrollHeight + "px";
      }
    });
  });

  // scroll reveal
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
});
