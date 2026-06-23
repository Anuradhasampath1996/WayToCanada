import { redirect } from "next/navigation";

/** Legacy URL — canonical dashboard is /user-dashboard */
export default function Page() {
  redirect("/user-dashboard");
}
