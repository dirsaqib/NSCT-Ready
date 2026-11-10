// English and Urdu interface text. Add a key here, then use t("key") in a client component.
export type Locale = "en" | "ur";

const ur: Record<string, string> = {
  "nav.prepare": "تیاری",
  "nav.dashboard": "ڈیش بورڈ",
  "nav.learn": "نصاب اور اسباق",
  "nav.diagnostic": "تشخیصی ٹیسٹ",
  "nav.mock": "موک ٹیسٹ",
  "nav.practice": "مشق",
  "nav.plan": "مطالعہ کا منصوبہ",
  "nav.results": "میرے نتائج",
  "nav.mistakes": "غلطیوں کی کاپی",
  "nav.bookmarks": "محفوظ سوالات",
  "nav.tutor": "اے آئی ٹیوٹر",
  "nav.discuss": "سوال و جواب",
  "nav.leaderboard": "لیڈر بورڈ",
  "nav.messages": "پیغامات",
  "nav.pro": "پرو رسائی",
  "nav.profile": "میری پروفائل",
  "nav.help": "مدد",
  "nav.support": "سپورٹ",
  "nav.security": "سیکیورٹی",
  "status.PENDING": "تصدیق کا انتظار",
  "status.VERIFIED": "تصدیق شدہ",
  "status.ACTIVE": "فعال",
  "status.BLOCKED": "بند",
  "test.next": "اگلا",
  "test.previous": "پچھلا",
  "test.flag": "نشان لگائیں",
  "test.submit": "ٹیسٹ جمع کرائیں",
  "test.saved": "محفوظ ہو گیا",
  "test.offline": "انٹرنیٹ بند ہے۔ آپ کے جوابات اس ڈیوائس پر محفوظ ہیں۔",
  "test.selectAll": "تمام درست جوابات منتخب کریں",
  "common.save": "محفوظ کریں",
  "common.signout": "لاگ آؤٹ",
  "common.language": "English",
};

const en: Record<string, string> = Object.fromEntries(Object.keys(ur).map((k) => [k, ""]));
Object.assign(en, {
  "nav.prepare": "Prepare", "nav.dashboard": "Dashboard", "nav.learn": "Syllabus and lessons", "nav.diagnostic": "Diagnostic test", "nav.mock": "Mock tests",
  "nav.practice": "Practice", "nav.plan": "Study plan", "nav.results": "My results", "nav.mistakes": "Mistakes notebook", "nav.bookmarks": "Saved questions",
  "nav.tutor": "AI tutor", "nav.discuss": "Doubts and discussion", "nav.leaderboard": "Leaderboard", "nav.messages": "Messages", "nav.pro": "Pro access",
  "nav.profile": "My profile", "nav.help": "Help centre", "nav.support": "Support", "nav.security": "Security",
  "status.PENDING": "Waiting for verification", "status.VERIFIED": "Verified", "status.ACTIVE": "Active", "status.BLOCKED": "Blocked",
  "test.next": "Next", "test.previous": "Previous", "test.flag": "Flag for review", "test.submit": "Submit test", "test.saved": "Saved",
  "test.offline": "You are offline. Your answers are saved on this device and will sync when you reconnect.", "test.selectAll": "Select all correct answers",
  "common.save": "Save", "common.signout": "Sign out", "common.language": "اردو",
});

export const dict: Record<Locale, Record<string, string>> = { en, ur };
export const t = (locale: Locale, key: string) => dict[locale][key] || dict.en[key] || key;
