import Link from "next/link";
import LandingFx from "@/components/LandingFx";
import ChatWidget from "@/components/ChatWidget";

import { liveStats } from "@/lib/liveStats";

// Refreshed every 5 minutes, so the dashboard stays live without touching the database on every visit.
export const revalidate = 300;

/** End point of the readiness arc for a percentage (0 to 100) on a half circle. */
function arc(p: number) {
  const a = Math.PI * (1 - Math.max(0, Math.min(100, p)) / 100);
  return `M10 50 A40 40 0 0 1 ${(50 + 40 * Math.cos(a)).toFixed(1)} ${(50 - 40 * Math.sin(a)).toFixed(1)}`;
}
const fmt = (v: number) => v.toLocaleString("en-US");

export default async function Landing() {
  const L = await liveStats();
  const c = L.questions;
  const n = (c > 0 ? Math.floor(c / 10) * 10 : 1000).toLocaleString("en-US");
  return (
<div className="lp">
<div className="lp-announce"><span className="lp-ann-tag">NEW</span> NSCT 2027 is on 23 and 24 January 2027. Free full-length mock tests are open now. <Link href="/signup">Start preparing →</Link></div>
<header className="lp-top"><div className="lp-wrap lp-nav">
<Link href="/" className="lp-brand" aria-label="TayariHub home"><img src="/tayari-icon.png" alt="" width="40" height="40" /><span className="lp-word"><b>Tayari<em>Hub</em></b><small>TEST PREP &amp; ASSESSMENT PLATFORM</small></span></Link>
<nav className="lp-links"><a href="#exams">Exams</a><a href="#features">Mock Tests</a><a href="#features">Study Materials</a><a href="#coach">AI Coach</a><Link href="/signup/focal">For Universities</Link><a href="#about">About Us</a></nav>
<div className="lp-cta"><Link href="/signin" className="lp-btn-out">Sign In</Link><Link href="/signup" className="lp-btn-grad">Register Free <span className="lp-arr">→</span></Link></div>
<button type="button" className="lp-burger" aria-label="Open menu" aria-expanded="false"><i></i><i></i><i></i></button>
</div>
<nav className="lp-mnav" aria-label="Mobile menu"><a href="#exams">Exams</a><a href="#features">Mock Tests</a><a href="#features">Study Materials</a><a href="#coach">AI Coach</a><Link href="/signup/focal">For Universities</Link><a href="#about">About Us</a><Link href="/signin">Sign In</Link><Link href="/signup" className="lp-btn-grad">Register Free →</Link></nav>
</header>
<section className="lp-hero"><svg className="lp-net" viewBox="0 0 1200 420" preserveAspectRatio="none" aria-hidden="true"><g stroke="rgba(255,255,255,.16)" strokeWidth="1" fill="none"><path d="M0 60 L180 140 L340 40 L520 120 L700 30 L880 150 L1060 60 L1200 130" /><path d="M60 380 L220 260 L400 340 L560 230 L760 330 L940 240 L1120 360" /><path d="M180 140 L220 260 M520 120 L560 230 M880 150 L940 240 M340 40 L400 340 M1060 60 L1120 360" /></g><g fill="rgba(255,255,255,.35)"><circle cx="180" cy="140" r="3" /><circle cx="340" cy="40" r="3" /><circle cx="520" cy="120" r="3" /><circle cx="700" cy="30" r="3" /><circle cx="880" cy="150" r="3" /><circle cx="1060" cy="60" r="3" /><circle cx="220" cy="260" r="3" /><circle cx="400" cy="340" r="3" /><circle cx="560" cy="230" r="3" /><circle cx="760" cy="330" r="3" /><circle cx="940" cy="240" r="3" /><circle cx="1120" cy="360" r="3" /></g></svg>
<div className="lp-particles" aria-hidden="true"><i style={{ left: "43%", top: "24%", animationDelay: "3.2s", animationDuration: "7.3s" }} /><i style={{ left: "70%", top: "17%", animationDelay: "2.9s", animationDuration: "7.4s" }} /><i style={{ left: "66%", top: "32%", animationDelay: "0.3s", animationDuration: "10.0s" }} /><i style={{ left: "10%", top: "35%", animationDelay: "0.7s", animationDuration: "10.0s" }} /><i style={{ left: "74%", top: "20%", animationDelay: "7.6s", animationDuration: "11.4s" }} /><i style={{ left: "76%", top: "12%", animationDelay: "4.6s", animationDuration: "9.8s" }} /><i style={{ left: "30%", top: "10%", animationDelay: "4.5s", animationDuration: "7.9s" }} /><i style={{ left: "55%", top: "23%", animationDelay: "4.3s", animationDuration: "11.0s" }} /><i style={{ left: "73%", top: "92%", animationDelay: "1.4s", animationDuration: "11.1s" }} /><i style={{ left: "83%", top: "29%", animationDelay: "3.0s", animationDuration: "10.8s" }} /><i style={{ left: "10%", top: "77%", animationDelay: "0.5s", animationDuration: "8.4s" }} /><i style={{ left: "89%", top: "73%", animationDelay: "3.4s", animationDuration: "9.2s" }} /><i style={{ left: "76%", top: "63%", animationDelay: "2.9s", animationDuration: "8.7s" }} /><i style={{ left: "25%", top: "94%", animationDelay: "6.2s", animationDuration: "7.6s" }} /><i style={{ left: "40%", top: "72%", animationDelay: "4.0s", animationDuration: "9.4s" }} /><i style={{ left: "59%", top: "41%", animationDelay: "4.9s", animationDuration: "7.5s" }} /><i style={{ left: "67%", top: "58%", animationDelay: "1.3s", animationDuration: "9.4s" }} /><i style={{ left: "64%", top: "58%", animationDelay: "0.3s", animationDuration: "11.7s" }} /><i style={{ left: "73%", top: "78%", animationDelay: "6.3s", animationDuration: "12.7s" }} /><i style={{ left: "45%", top: "93%", animationDelay: "2.8s", animationDuration: "10.5s" }} /><i style={{ left: "60%", top: "13%", animationDelay: "6.7s", animationDuration: "13.6s" }} /><i style={{ left: "62%", top: "94%", animationDelay: "5.3s", animationDuration: "7.4s" }} /></div>
<div className="lp-wrap lp-hero-in">
<div className="lp-hero-text">
<span className="lp-pill">🇵🇰 PAKISTAN&apos;S FREE TEST PREP HUB · 100% FREE FOR STUDENTS</span>
<h1><span className="lp-l1">Prepare for NSCT 2027, NTS &amp; Entry Tests.</span><br /><em className="lp-l2">Free, for every student in Pakistan.</em></h1>
<p>Master topic levels through gamified practice, take realistic full-length mock exams, watch expert video lectures, and let your personalized AI Coach guide your daily study path.</p>
<div className="lp-btns"><Link href="/signup" className="lp-btn-gold">Start Free Preparation <span className="lp-arr">→</span></Link><Link href="/signup/focal" className="lp-btn-white">🎓 For University Focal Persons</Link></div>
<div className="lp-already">Already have an account? <Link href="/signin">Sign in</Link></div>
<div className="lp-ticks"><span>✓ No credit card needed</span><span>✓ {n}+ Curated MCQs</span><span>✓ AI coach guidance</span></div>
</div>
<div className="lp-dash-wrap">
<div className="lp-dash">
<div className="lp-dash-head"><div className="lp-dots"><i></i><i></i><i></i></div><span className="lp-live"><i></i>Live platform data</span></div>
<div className="lp-dash-title">TayariHub Student Dashboard</div>
<div className="lp-dgrid">
<div className="lp-dc"><div className="lp-dch"><b>Full-Length Mock Test</b><span className="lp-ok">✓ Completed</span></div><small>{L.real ? <><span data-count={L.mocks}>{fmt(L.mocks)}</span> mock tests completed</> : "Completed progress"}</small><div className="lp-bar"><span style={{ width: `${L.real ? L.mockAvg : 83}%` }}></span></div><small>{L.real ? `Average score: ${L.mockAvg}%` : "Score: 83% · High Accuracy"}</small></div>
<div className="lp-dc lp-gauge"><b>Test Readiness:</b><svg viewBox="0 0 100 56" width="104"><defs><linearGradient id="lpg"><stop offset="0" stopColor="#1D55CC" /><stop offset="1" stopColor="#13A384" /></linearGradient></defs><path d="M10 50 A40 40 0 0 1 90 50" stroke="#E3E8F2" strokeWidth="9" fill="none" strokeLinecap="round" /><path d={arc(L.real ? L.readiness : 82)} stroke="url(#lpg)" strokeWidth="9" fill="none" strokeLinecap="round" /></svg><div className="lp-pct"><span data-count={L.real ? L.readiness : 82}>{L.real ? L.readiness : 82}</span>%</div><div className="lp-legend"><span><i className="c1"></i>Math{L.subj.ps ? ` ${L.subj.ps}%` : ""}</span><span><i className="c2"></i>CS{L.subj.prog ? ` ${L.subj.prog}%` : ""}</span><span><i className="c3"></i>DSA{L.subj.dsa ? ` ${L.subj.dsa}%` : ""}</span></div></div>
<div className="lp-dc lp-lvl"><b>Topic Level 4 Mastered</b><div className="lp-lvlrow"><span className="lp-trophy">🏆</span><div><div className="lp-xp">+60 XP</div><small>{L.practice ? <><span data-count={L.practice}>{fmt(L.practice)}</span> levels played</> : "Stars collected"}</small><div className="lp-bar gold"><span style={{ width: "70%" }}></span></div><small>Level Completed</small></div></div></div>
<div className="lp-dc"><b>AI Coach Insights</b><small>Next recommended:</small><div className="lp-rec">{L.weakTopic} Practice</div><small>(Estimated 12 min)</small><span className="lp-bot">🤖</span></div>
</div>
</div>
<span className="lp-chip lp-chip1">⭐ {L.answersToday ? <>+<span data-count={L.answersToday}>{fmt(L.answersToday)}</span> answers today</> : "+120 Stars"}</span>
<span className="lp-chip lp-chip2">{L.activeToday ? <><span data-count={L.activeToday}>{fmt(L.activeToday)}</span> studying today 🔥</> : "Streak: 5 Days 🔥"}</span>
</div>
</div>
</section>
<main className="lp-wrap">
<section className="lp-stats">
<div className="lp-stat" data-reveal=""><span className="lp-si s1">▤</span><div><b><span data-count={c > 0 ? Math.floor(c / 10) * 10 : 1000}>{n}</span>+ MCQs</b><small>Curated questions growing to 80,000+</small></div></div>
<div className="lp-stat" data-reveal=""><span className="lp-si s2">▦</span><div><b>3 Full Mock Tests</b><small>Timed exam simulation with feedback</small></div></div>
<div className="lp-stat" data-reveal=""><span className="lp-si s3">%</span><div><b>100% Free</b><small>Open access for every student</small></div></div>
<div className="lp-stat" data-reveal=""><span className="lp-si s4">⇄</span><div><b>Random Papers</b><small>A new paper for each student, zero copying</small></div></div>
</section>
<section id="exams"><h2 className="lp-h2" data-reveal="">Explore Exams &amp; Mock Tests</h2><p className="lp-sub" data-reveal="">Choose your exam and start practice papers instantly</p>
<div className="lp-exams">
<Link href="/signup" className="lp-exam" data-reveal=""><div className="lp-eh"><span className="lp-ei">💻</span><b>NSCT 2027</b><span className="lp-badge act">🔥 ACTIVE PREP</span></div><small>Computing test, mock tests, topic practice</small><span className="lp-elink">Start Test →</span></Link>
<Link href="/signup" className="lp-exam" data-reveal=""><div className="lp-eh"><span className="lp-ei">✏️</span><b>NTS (NAT / GAT)</b><span className="lp-badge soon">⚡ COMING SOON</span></div><small>Analytical, Quantitative &amp; Verbal reasoning</small><span className="lp-elink">🔔 Notify Me</span></Link>
<Link href="/signup" className="lp-exam" data-reveal=""><div className="lp-eh"><span className="lp-ei">⚙️</span><b>NET / ECAT</b><span className="lp-badge soon">⚡ COMING SOON</span></div><small>Engineering entry tests</small><span className="lp-elink">🔔 Notify Me</span></Link>
<Link href="/signup" className="lp-exam" data-reveal=""><div className="lp-eh"><span className="lp-ei">🏛️</span><b>MDCAT &amp; University Tests</b><span className="lp-badge soon">⚡ COMING SOON</span></div><small>Medical and general university entrance tests</small><span className="lp-elink">🔔 Notify Me</span></Link>
</div></section>
<section id="features" className="lp-feats">
<Link href="/signup" className="lp-feat f1" data-reveal=""><span className="lp-fart">🏆🎮</span><div><b>Gamified Preparation</b><small>Every subject is a world and every topic a level. Earn stars, XP, and global ranks as you learn.</small><span className="lp-flink">Explore levels →</span></div></Link>
<Link href="/signup" className="lp-feat f2" data-reveal=""><span className="lp-fart">📋</span><div><b>Full-Length Mock Tests</b><small>Realistic timed papers that get harder, with detailed diagnostic reports and AI guidance after each paper.</small><span className="lp-flink">Take a mock →</span></div></Link>
<Link href="/signup" className="lp-feat f3" data-reveal=""><span className="lp-fart">🎬📘</span><div><b>Curated Study Materials</b><small>Top video lectures from master teachers with concise revision notes for every single topic.</small><span className="lp-flink">Browse materials →</span></div></Link>
</section>
<section className="lp-path" id="path">
<h2 className="lp-h2" data-reveal="">Find Your Path</h2><p className="lp-sub" data-reveal="">One platform for everyone preparing Pakistan&apos;s computing graduates</p>
<div className="lp-paths">
<div className="lp-pc" data-reveal=""><span className="lp-pci">🎓</span><b>Students</b><ul><li>Gamified topic levels</li><li>Mock 1, 2 and 3 with guidance</li><li>Video lectures and notes</li><li>AI study coach</li></ul><Link href="/signup" className="lp-pcb">Register free →</Link></div>
<div className="lp-pc" data-reveal=""><span className="lp-pci">🏛️</span><b>University Focal Persons</b><ul><li>Register students in bulk</li><li>University question bank</li><li>Run university tests</li><li>Department-wise reports</li></ul><Link href="/signup/focal" className="lp-pcb">Join as focal person →</Link></div>
<div className="lp-pc" data-reveal=""><span className="lp-pci">👩‍🏫</span><b>Faculty and HODs</b><ul><li>Add department questions</li><li>Track class readiness</li><li>Find weak topics early</li><li>Download detailed reports</li></ul><Link href="/signup/focal" className="lp-pcb">Get staff access →</Link></div>
<div className="lp-pc" data-reveal=""><span className="lp-pci">💼</span><b>Fresh Graduates</b><ul><li>Prepare after graduating</li><li>Measure job readiness</li><li>Practise applied problems</li><li>Close your skill gaps</li></ul><Link href="/signup" className="lp-pcb">Start practising →</Link></div>
</div>
</section>
<section id="coach" className="lp-coach" data-reveal="">
<span className="lp-robot">🤖</span>
<div className="lp-bubble">Based on Mock 1, your sequence questions need 15 minutes of focused practice. Try Level 3 now!</div>
<div className="lp-coach-t"><b>Meet Your AI Study Coach</b><small>Your 24/7 personal tutor. Analyzes your mistakes, provides instant explanations, and guides what to study next.</small></div>
<Link href="/signup" className="lp-btn-out">Try AI Coach free</Link>
</section>
<section className="lp-band" data-reveal="">
<div><b>Ready to start your NSCT preparation?</b><small>Join students across Pakistan preparing for free, at their own pace.</small></div>
<div className="lp-band-btns"><Link href="/signup" className="lp-btn-gold">I&apos;m a Student <span className="lp-arr">→</span></Link><Link href="/signup/focal" className="lp-btn-white">I&apos;m a Focal Person</Link></div>
</section>
</main>
<footer id="about" className="lp-foot"><div className="lp-wrap lp-foot-in lp-foot-grid" data-reveal="">
<div><span className="lp-brand light"><img src="/tayari-icon.png" alt="" width="34" height="34" /><span className="lp-word"><b>Tayari<em>Hub</em></b><small>TEST PREP &amp; ASSESSMENT PLATFORM</small></span></span><p>TayariHub is a free preparation platform built by SimFusion (Private) Limited for every student in Pakistan. It is independent and not affiliated with any testing body or government organisation.</p></div>
<div className="lp-fcol"><b>Explore</b><a href="#exams">Exams</a><a href="#features">Mock Tests</a><a href="#features">Study Materials</a><a href="#coach">AI Coach</a></div>
<div className="lp-fcol"><b>For You</b><Link href="/signup">Students</Link><Link href="/signup/focal">Focal Persons</Link><Link href="/signin">Sign in</Link><Link href="/signup">Register</Link></div>
<div className="lp-fcol"><b>Help &amp; Policies</b><Link href="/help">Help centre</Link><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms of use</Link></div>
</div><div className="lp-copy">© 2026 SimFusion (Private) Limited. Free for every student in Pakistan.</div></footer>
<LandingFx />
<ChatWidget />
</div>

  );
}
