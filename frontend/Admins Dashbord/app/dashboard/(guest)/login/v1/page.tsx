import { redirect } from "next/navigation";

/** Legacy slug — keep bookmarks working. */
export default function LoginV1RedirectPage() {
  redirect("/dashboard/login");
}
