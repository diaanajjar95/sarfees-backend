-- ============================================================================
-- Sarfees — FAQ seed
-- ============================================================================
-- Seeds the initial set of FAQ entries that previously lived in src/faq/faq.json.
-- Run after `synchronize: true` has created the `faq_items` table.
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING means re-running won't duplicate.
-- ============================================================================

INSERT INTO faq_items (
  slug, "categoryEn", "categoryAr",
  "questionEn", "questionAr",
  "answerEn", "answerAr",
  "displayOrder", "isActive"
) VALUES
  ('account-create', 'Account', 'الحساب',
   'How do I create a Sarfees account?',
   'كيف أنشئ حساب صرفيس؟',
   'Open the app, tap Continue, and enter your phone number. We will send you a 6-digit code by SMS to verify your phone. Once verified, complete your profile (name, gender) and you are ready to book trips or send packages.',
   'افتح التطبيق واضغط متابعة، ثم أدخل رقم هاتفك. سنرسل لك رمز تحقق مكوّناً من 6 أرقام عبر رسالة نصية. بعد التحقق، أكمل ملفك (الاسم، الجنس) وستكون جاهزاً لحجز الرحلات أو إرسال الطرود.',
   10, true),

  ('account-login-otp', 'Account', 'الحساب',
   'I did not receive the OTP code. What should I do?',
   'لم يصلني رمز التحقق. ماذا أفعل؟',
   'Make sure the phone number is entered correctly. Wait 60 seconds, then tap Resend Code. If it still does not arrive after a few minutes, check that your phone has signal and that the SMS app is not blocking unknown senders.',
   'تأكد من إدخال رقم الهاتف بشكل صحيح. انتظر 60 ثانية ثم اضغط إعادة إرسال الرمز. إذا لم يصل بعد بضع دقائق، تأكد من وجود إشارة على هاتفك وأن تطبيق الرسائل لا يحجب المرسلين غير المعروفين.',
   20, true),

  ('trip-book', 'Trips', 'الرحلات',
   'How do I book an intercity trip?',
   'كيف أحجز رحلة بين المدن؟',
   'From the home screen, tap Book a Trip. Pick your departure and arrival cities, set the pickup and drop-off points on the map, choose how many seats you need, and either select an immediate trip or pick a date in the next 30 days. Confirm and we will match you with a driver.',
   'من الشاشة الرئيسية، اضغط احجز رحلة. اختر مدينتي المغادرة والوصول، حدد نقطتي الاستلام والإنزال على الخريطة، اختر عدد المقاعد، ثم اختر رحلة فورية أو حدد تاريخاً خلال الـ 30 يوماً القادمة. أكد الحجز وسنطابقك مع سائق.',
   30, true),

  ('trip-women-only', 'Trips', 'الرحلات',
   'What is a Women-Only trip?',
   'ما هي رحلة النساء فقط؟',
   'Women-Only trips are intercity shared rides reserved exclusively for female passengers and driven by female drivers. They are available to passengers whose registered gender is Female. Look for the Women-Only badge when booking.',
   'رحلات النساء فقط هي رحلات مشتركة بين المدن مخصصة حصراً للراكبات وتقودها سائقات. متاحة للراكبات اللواتي جنسهن المسجل أنثى. ابحثي عن شارة النساء فقط عند الحجز.',
   40, true),

  ('trip-cancel', 'Trips', 'الرحلات',
   'Can I cancel a trip after booking?',
   'هل يمكنني إلغاء الرحلة بعد الحجز؟',
   'Yes. You can cancel from the active-trip screen at any time before the driver picks you up. Cancellations after a driver has accepted may incur a small fee at the platform''s discretion.',
   'نعم. يمكنك الإلغاء من شاشة الرحلة النشطة في أي وقت قبل وصول السائق. قد يترتب على الإلغاء بعد قبول السائق رسم رمزي وفقاً لتقدير المنصة.',
   50, true),

  ('package-send', 'Packages', 'الطرود',
   'How do I send a package between cities?',
   'كيف أرسل طرداً بين المدن؟',
   'From the home screen, tap Send Package. Choose departure and arrival cities, set pickup and drop-off locations, pick the size (Small, Medium, Large), and add the receiver''s name and phone number. Accept the delivery terms and confirm — a driver will pick it up.',
   'من الشاشة الرئيسية، اضغط أرسل طرداً. اختر مدينتي المغادرة والوصول، حدد نقطتي الاستلام والتسليم، اختر الحجم (صغير، متوسط، كبير)، وأضف اسم المستلم ورقم هاتفه. وافق على شروط التوصيل ثم أكد — سيقوم سائق باستلامه.',
   60, true),

  ('package-sizes', 'Packages', 'الطرود',
   'What package sizes are supported?',
   'ما هي أحجام الطرود المدعومة؟',
   'Small (up to 5 kg), Medium (up to 15 kg), and Large (up to 30 kg). Packages must not contain prohibited items such as flammable goods, weapons, or perishable food without proper packaging.',
   'صغير (حتى 5 كغ)، متوسط (حتى 15 كغ)، كبير (حتى 30 كغ). يجب ألا تحتوي الطرود على مواد محظورة مثل المواد القابلة للاشتعال، الأسلحة، أو الأطعمة الفاسدة بدون تغليف مناسب.',
   70, true),

  ('payment-cash', 'Payments', 'الدفع',
   'How do I pay for a trip or package?',
   'كيف أدفع ثمن الرحلة أو الطرد؟',
   'All payments are in cash, paid directly to the driver at the end of your trip or when your package is collected at delivery. There is no in-app payment processing at this time.',
   'جميع المدفوعات نقداً، تُسدَّد مباشرةً للسائق في نهاية الرحلة أو عند استلام الطرد عند التسليم. لا توجد معالجة دفع داخل التطبيق حالياً.',
   80, true),

  ('payment-fare', 'Payments', 'الدفع',
   'How is the fare calculated?',
   'كيف تُحسب الأجرة؟',
   'Each shared trip uses a flat per-seat fare set by Sarfees for the route. Package delivery fees depend on package size. You will see the full price before you confirm the booking — no surprises later.',
   'تستخدم كل رحلة مشتركة أجرة ثابتة لكل مقعد تحددها صرفيس لكل مسار. تعتمد رسوم توصيل الطرود على حجم الطرد. سترى السعر الكامل قبل تأكيد الحجز — دون مفاجآت لاحقة.',
   90, true),

  ('support-contact', 'Support', 'الدعم',
   'How do I contact Sarfees support?',
   'كيف أتواصل مع دعم صرفيس؟',
   'Email us at support@sarfees.com with your phone number and a description of the issue. For urgent issues during a trip, use the SOS button on the active-trip screen.',
   'راسلنا على support@sarfees.com مع رقم هاتفك ووصف المشكلة. للحالات العاجلة أثناء الرحلة، استخدم زر الطوارئ على شاشة الرحلة النشطة.',
   100, true)
ON CONFLICT (slug) DO NOTHING;
