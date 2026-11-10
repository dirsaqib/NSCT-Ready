import ProfileForm from "@/components/ProfileForm";

export default function Register() {
  return (
    <>
      <div className="top"><div><h1>Create your free profile</h1><p className="sub">Takes one minute. Then start with a short diagnostic test.</p></div></div>
      <div style={{ maxWidth: 720 }}><ProfileForm after="/dashboard" /></div>
    </>
  );
}
