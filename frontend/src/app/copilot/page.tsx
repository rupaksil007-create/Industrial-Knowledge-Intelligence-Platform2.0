import { redirect } from "next/navigation";

export default function ExpertKnowledgeCopilotPage() {
  redirect("/dashboard?tab=copilot");
}
