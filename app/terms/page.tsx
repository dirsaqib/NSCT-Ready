import Link from "next/link";

export const metadata = { title: "Terms of use | NSCT Ready" };

/** Terms of use, version 2026-11. Read together with the privacy policy. */
export default function Terms() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px", lineHeight: 1.75 }}>
      <h1>Terms of use</h1>
      <p className="muted">Version 2026-11. Effective 18 November 2026.</p>
      <h2>1. The service</h2>
      <p>NSCT Ready is a free and independent preparation platform for the National Skills Competency Test. It is not affiliated with, endorsed or sponsored by any government body, regulator, testing body, university or other organisation. Readiness scores, predictions and certificates are practice estimates, not official results.</p>
      <h2>2. Accounts</h2>
      <p>Register with your real name, CNIC or B-Form number and university details, and upload genuine proof. Giving false information or a forged document is a serious breach and may be reported to your university. Your university focal person may approve or reject your account. Keep your password private and do not share your account. Focal persons and administrators must use two-factor authentication.</p>
      <h2>3. Fair use and test integrity</h2>
      <p>Do not copy, share or publish test questions. Timed tests record events such as leaving full screen, switching tabs and the device used. Tests with unusual patterns may be reviewed and results withheld. Accounts that cheat, harass others or misuse the Platform may be suspended or blocked.</p>
      <h2>4. Content</h2>
      <p>Questions contributed by faculty and focal persons are licensed to the Platform, free of charge, for use in preparation and assessment. Contributors confirm the content is their own or properly licensed. Discussion posts must be respectful and relevant.</p>
      <h2>5. Universities and focal persons</h2>
      <p>Focal persons act on behalf of their university. They may use student data only to verify accounts, support preparation and report within their university, and must not share it with anyone outside that purpose. Misuse ends their access.</p>
      <h2>6. Availability and liability</h2>
      <p>The Platform is provided free and as is. We work to keep it available and accurate but do not guarantee uninterrupted service or error free content. To the extent allowed by law, we are not liable for official NSCT results, admissions or hiring decisions made by others, or for losses arising from use of the Platform.</p>
      <h2>7. Privacy</h2>
      <p>Our <Link href="/privacy">privacy policy</Link> explains how personal data is handled and forms part of these terms.</p>
      <h2>8. Changes and governing law</h2>
      <p>We may update these terms and will notify registered users of material changes. These terms are governed by the laws of the Islamic Republic of Pakistan, and the courts at Islamabad have jurisdiction.</p>
      <h2>9. Contact</h2>
      <p>Questions about these terms can be sent through the <Link href="/help">Help</Link> page.</p>
    </main>
  );
}
