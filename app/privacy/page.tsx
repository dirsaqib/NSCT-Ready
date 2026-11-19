import Link from "next/link";

export const metadata = { title: "Privacy policy | NSCT Ready" };

const H = ({ n, children }: { n: number; children: React.ReactNode }) => <h2 style={{ marginTop: 28 }}>{n}. {children}</h2>;

/** Privacy policy, version 2026-11. Written for Pakistani law (PECA 2016) and general good practice. */
export default function Privacy() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px", lineHeight: 1.75 }}>
      <h1>Privacy policy</h1>
      <p className="muted">Version 2026-11. Effective 18 November 2026.</p>

      <p>
        NSCT Ready (&ldquo;the Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a free online preparation platform for the National Skills Competency Test (NSCT) for computing students in Pakistan.
        This policy explains what personal data we collect, why we collect it, who can see it, how we protect it and what rights you have.
        By registering or using the Platform you confirm that you have read and understood this policy.
      </p>

      <H n={1}>Independence and free service</H>
      <p>
        The Platform is independent. It is not owned, operated, endorsed or sponsored by any government body, regulator, testing body, university or other organisation.
        Test names and syllabus references are used only to help students prepare. Scores, readiness estimates and certificates issued on the Platform are practice indicators and are not official NSCT results.
        The Platform is free for students. We do not sell personal data, we do not show third party advertising, and we do not use your data to build advertising profiles.
      </p>

      <H n={2}>Data we collect</H>
      <ul>
        <li><b>Identity and contact:</b> full name, gender, CNIC or B-Form number, email address, mobile number and, if you give it, city.</li>
        <li><b>Academic details:</b> university, campus, department, program, semester, section and roll number.</li>
        <li><b>Proof documents:</b> the student ID card, fee challan, enrollment letter or appointment letter you upload so your account can be verified.</li>
        <li><b>Account security:</b> your password, stored only as a one way scrypt hash that nobody, including us, can read, and the settings of any second factor you enable.</li>
        <li><b>Learning and test data:</b> your answers, scores, time taken, study plan, mistakes list, bookmarks, questions you ask the AI tutor and posts you write in discussions.</li>
        <li><b>Test integrity signals:</b> during timed tests we record events such as leaving full screen, switching tabs, copy and paste attempts, device type, IP address and, for laboratory tests, the seat number. We do not use your camera or microphone.</li>
        <li><b>Technical logs:</b> sign-in times, IP address, browser type and error records, used to keep the service secure and working.</li>
      </ul>
      <p>We only collect what is needed for the purposes below. Optional fields are marked as optional.</p>

      <H n={3}>Why we use your data</H>
      <ul>
        <li>To create and secure your account and to stop duplicate or fake accounts. Your CNIC or B-Form number is used only for this purpose and to confirm your identity if you ask for help with your account.</li>
        <li>To let your university confirm that you are a current student.</li>
        <li>To run practice tests, mock tests and laboratory tests, to mark them and to show you detailed feedback.</li>
        <li>To give you personal guidance, including your study plan and AI coach advice, based on your own results.</li>
        <li>To help your university support its students, for example by identifying subjects where more teaching is needed.</li>
        <li>To keep tests fair, to investigate suspected cheating and to keep the Platform secure.</li>
        <li>To send you service messages such as account approval, password resets, test schedules and important announcements.</li>
        <li>To produce anonymised statistics that help universities and students understand overall preparation levels.</li>
      </ul>
      <p>
        We process your data on the basis of your consent, given when you register, and our legitimate interest in providing a safe and fair service.
        You may withdraw consent at any time by deleting your account, as described in section 9.
      </p>

      <H n={4}>Who can see your data</H>
      <ul>
        <li><b>You</b> can see all of your own data.</li>
        <li><b>Your university&rsquo;s focal person</b>, appointed by your university and approved by us, can see the profile, proof document and results of students of their own university only. They use it to verify accounts, reset passwords and prepare reports for heads of department and university management. They cannot see students of any other university and they cannot see your password or your CNIC number.</li>
        <li><b>The Platform&rsquo;s super administrators</b> can access data where needed to run, support and secure the service. Every administrative action is recorded in an audit log.</li>
        <li><b>Other students</b> see nothing about you unless you choose to appear on a leaderboard, and then only the nickname and score you choose to show.</li>
        <li><b>Anonymised statistics</b> may be shared with universities or published. They never include names, roll numbers, contact details or CNIC numbers, and no figure is shown for a group smaller than 20 students.</li>
      </ul>

      <H n={5}>Service providers</H>
      <p>
        We use trusted providers to run the Platform: cloud hosting, a managed database, email delivery and an artificial intelligence service for the tutor and coach features.
        They process data only on our instructions and only to provide their service to us. The AI service receives the question you ask and a summary of your results, not your CNIC, contact details or proof documents.
        Some of these providers store data on servers outside Pakistan, including in Singapore and the United States. By using the Platform you agree to this transfer. We choose providers that apply strong security standards.
      </p>

      <H n={6}>Legal disclosure</H>
      <p>
        We will disclose personal data to a court, law enforcement agency or regulator only where we are required to do so under the laws of Pakistan, including the Prevention of Electronic Crimes Act 2016, or where it is necessary to protect the safety of a person.
        Where the law allows, we will tell you about such a request.
      </p>

      <H n={7}>How we protect your data</H>
      <ul>
        <li>All traffic is encrypted in transit with HTTPS.</li>
        <li>CNIC numbers are encrypted with AES-256 before storage. Passwords are stored only as salted scrypt hashes.</li>
        <li>Access is limited by role and university. Focal persons and administrators must use two-factor authentication.</li>
        <li>Accounts are locked for 15 minutes after five wrong passwords.</li>
        <li>Proof documents are served only to the student, their own university&rsquo;s focal person and super administrators, and each viewing is logged.</li>
        <li>The database is backed up regularly and errors and sign-ins are monitored.</li>
      </ul>
      <p>
        No system is completely secure. If a data breach is likely to put your rights at risk, we will inform affected users and take prompt steps to contain it.
        Please keep your password private and tell us at once if you think your account has been misused.
      </p>

      <H n={8}>How long we keep data</H>
      <ul>
        <li>Account, academic and test data are kept while your account is open.</li>
        <li>Proof documents are kept only for verification and for resolving disputes about verification, and are deleted with your account.</li>
        <li>Security and audit logs are kept for up to two years.</li>
        <li>When you delete your account, your personal data is removed from the live system immediately and from backups within 35 days. Anonymised statistics that cannot identify you may be kept.</li>
      </ul>

      <H n={9}>Your rights</H>
      <p>You may at any time:</p>
      <ul>
        <li>see and download a copy of your data from your profile page,</li>
        <li>correct your details, or ask your focal person to correct academic details,</li>
        <li>change your leaderboard choice,</li>
        <li>delete your account and personal data, and</li>
        <li>complain to us about how your data is handled.</li>
      </ul>
      <p>We will respond to requests within 30 days. We may ask you to confirm your identity before acting on a request.</p>

      <H n={10}>Students under 18</H>
      <p>
        Students under 18 may register with a B-Form number. By registering, a student under 18 confirms that a parent or guardian is aware of and agrees to their use of the Platform.
        A parent or guardian may ask us to see or delete their child&rsquo;s data.
      </p>

      <H n={11}>Cookies</H>
      <p>We use only essential cookies that keep you signed in and protect your session. We do not use advertising or third party tracking cookies.</p>

      <H n={12}>Changes to this policy</H>
      <p>
        We may update this policy as the Platform or the law changes. The version and effective date at the top will change, and we will tell registered users about material changes by email or in the Platform before they take effect.
      </p>

      <H n={13}>Governing law</H>
      <p>
        This policy is governed by the laws of the Islamic Republic of Pakistan, including the Prevention of Electronic Crimes Act 2016 and any personal data protection law in force from time to time.
        The courts at Islamabad have jurisdiction over any dispute arising from it.
      </p>

      <H n={14}>Contact</H>
      <p>Send questions, requests or complaints about privacy through the <Link href="/help">Help</Link> page, or through Support once you are signed in.</p>
    </main>
  );
}
