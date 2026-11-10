// Draft privacy policy. Have a lawyer check it against Pakistan's current data protection rules and PECA.
export default function Privacy() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px", lineHeight: 1.7 }}>
      <h1>Privacy policy</h1>
      <p className="muted">Draft, version 2026-11. To be reviewed by legal counsel before launch.</p>
      <h2>What we collect</h2>
      <p>Name, email or mobile number, university, campus, department, program, semester, section and roll number. Optional: city, gender, leaderboard nickname. Your answers, test results, time taken, and test integrity signals (tab switches, full-screen exits, device and network identifiers). We do not collect CNIC numbers. We do not use webcams.</p>
      <h2>How we use it</h2>
      <ul>
        <li>To run tests, give feedback, build your study plan and issue certificates.</li>
        <li>Your university's focal person, campus admin and head of department see the records of their own students to verify accounts and support preparation.</li>
        <li>HEC and government users see only anonymised group figures from students who consented. No names or contact details are shared, and no group smaller than 20 students is shown.</li>
        <li>Employers see your scores and certificates only if you join the talent pool. They contact you through the platform and never see your phone or email.</li>
        <li>Sponsors see only aggregate usage and improvement figures.</li>
      </ul>
      <h2>Your choices and rights</h2>
      <p>You can change your leaderboard and talent pool choices at any time, download all your data, or delete your account and every record about you from your profile page.</p>
      <h2>Security</h2>
      <p>Data is encrypted in transit and at rest, access is limited by role and university, staff use two-factor authentication, every staff action is logged, and backups are taken daily.</p>
      <h2>Retention</h2>
      <p>Account data is kept while your account is open. Deleted accounts are removed from the live database immediately and from backups within 35 days. Anonymised statistics may be kept.</p>
      <h2>Contact</h2>
      <p>Send privacy requests through the support page.</p>
    </main>
  );
}
