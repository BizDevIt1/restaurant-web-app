import { redirect } from "next/navigation";

export default function KitchenTerminalPage() {
  // Scaffolding redirect to Kitchen KDS view until isolated terminal screen is deployed
  redirect("/admin/kitchen");
}
