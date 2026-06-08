import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/assets?view=dashboard");
}
