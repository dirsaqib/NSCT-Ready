import StartButton from "@/components/StartButton";
import { BLUEPRINTS, SUBJECTS } from "@/lib/syllabus";

export default function Diagnostic() {
  return (
    <>
      <div className="top"><div><h1>Diagnostic test</h1><p className="sub">Find your strengths and weak areas across all 10 NSCT subjects.</p></div></div>
      <div className="grid g2">
        <div className="card">
          <h2>How it works</h2>
          <ul style={{ paddingLeft: 18, lineHeight: 1.9 }}>
            <li>20 questions, weighted like the syllabus</li><li>25 minutes, timed by the server</li>
            <li>Flag questions and come back to them</li><li>Answers and explanations at the end</li>
          </ul>
          <StartButton type="DIAGNOSTIC" label="Start diagnostic" />
        </div>
        <div className="card flat">
          <h2>Questions per subject</h2>
          <table><tbody>{SUBJECTS.map((s) => <tr key={s.key}><td>{s.name}</td><td style={{ textAlign: "right" }}><b>{BLUEPRINTS.DIAGNOSTIC[s.key]}</b></td></tr>)}</tbody></table>
        </div>
      </div>
    </>
  );
}
