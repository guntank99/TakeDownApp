import { redirect } from "next/navigation";

// The proxy sends visitors without a session to /login before this runs.
export default function Home() {
  redirect("/dashboard");
}
