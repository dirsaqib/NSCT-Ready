import { redirect } from "next/navigation";

/** The AI tutor is switched off. Old links go to the dashboard. */
export default function Tutor() {
  redirect("/dashboard");
}
