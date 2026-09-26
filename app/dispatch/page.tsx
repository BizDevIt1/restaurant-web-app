import { redirect } from "next/navigation";

export default function DispatchTerminalPage() {
  // Scaffolding redirect to Rider Dispatch view until isolated terminal screen is deployed
  redirect("/admin/dispatch");
}
