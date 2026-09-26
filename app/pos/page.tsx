import { redirect } from "next/navigation";

export default function PosTerminalPage() {
  // Scaffolding redirect to POS view until isolated terminal screen is deployed
  redirect("/admin/pos");
}
