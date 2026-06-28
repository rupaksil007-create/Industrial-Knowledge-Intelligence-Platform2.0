import { redirect } from "next/navigation";

export default function KnowledgeGraphPage() {
  redirect("/dashboard?tab=graph");
}
