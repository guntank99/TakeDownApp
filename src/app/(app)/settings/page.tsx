import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badges";
import { Card, KeyValue, Notice, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { can } from "@/lib/auth/permissions";
import { getProvider } from "@/lib/providers";
import { listPolicyRules } from "@/lib/toc/rules";
import { PLATFORM_LABEL } from "@/lib/utils/platforms";
import pkg from "../../../../package.json";

export const metadata: Metadata = { title: "Settings" };

/** Only reports WHETHER a variable is set. Values are never read into the page. */
const configured = (...names: string[]) => names.every((n) => Boolean(process.env[n]));

const PROVIDERS = [
  { name: "Facebook", vars: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"], active: false },
  { name: "X", vars: ["X_CLIENT_ID", "X_CLIENT_SECRET"], active: false },
  { name: "Instagram", vars: ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET"], active: false },
  { name: "TikTok", vars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"], active: false },
  { name: "YouTube (Data API v3)", vars: ["YOUTUBE_API_KEY"], active: true },
];

export default async function SettingsPage() {
  const user = await verifySession();
  const provider = getProvider();
  const admin = can(user.role, "settings:admin");
  const rules = listPolicyRules();
  const permissions = (["case:create", "case:update", "case:verify", "evidence:create", "report:create", "report:review", "report:submit", "audit:read"] as const).filter((p) => can(user.role, p));

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Profile, security, providers and system information." mock={false} />

      <Card title="Profile">
        <KeyValue items={[
          { label: "Name", value: user.name },
          { label: "Username", value: user.username },
          { label: "Role", value: ROLE_LABELS[user.role] },
          { label: "Permissions", value: permissions.join(", ") || "read-only" },
        ]} />
      </Card>

      <Card title="Security">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>Signed session cookie: HttpOnly, SameSite=Lax, Secure in production. “Remember me” keeps it for 7 days; otherwise 8 hours.</li>
          <li>Roles are enforced on the server for every page, action and API route.</li>
          <li>Verification and approval need a reviewer other than the preparing analyst (four-eyes).</li>
          <li>Password change is not available in the prototype; accounts come from the demo user store.</li>
        </ul>
      </Card>

      <Card title="API providers" description="Whether credentials are present in the environment. Values are never displayed.">
        {admin ? (
          <>
            <ul className="space-y-2 text-sm">
              {PROVIDERS.map((p) => (
                <li key={p.name} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                  <span className="text-slate-200">{p.name}</span>
                  <span className="flex items-center gap-2">
                    {configured(...p.vars) ? <Badge tone="success">CREDENTIALS SET</Badge> : <Badge>NOT CONFIGURED</Badge>}
                    {p.active ? <Badge tone="info">PROVIDER AVAILABLE</Badge> : <Badge>INTEGRATION PENDING</Badge>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Set <code>DATA_PROVIDER=youtube</code> together with <code>YOUTUBE_API_KEY</code> to use the official YouTube provider. Other platforms are integrated one at a time, only through official APIs with proper permissions.</p>
          </>
        ) : <Notice>Only administrators can view provider configuration.</Notice>}
      </Card>

      <Card title="Notification">
        <p className="text-sm text-slate-400">Notifications are not configured in the prototype.</p>
      </Card>

      <Card title="Analysis settings" description="Fixed for this version">
        <KeyValue items={[
          { label: "Engine", value: "lexicon-v1 (keyword rules, English + Indonesian)" },
          { label: "Risk levels", value: "0–24 LOW · 25–49 MEDIUM · 50–74 HIGH · 75–100 CRITICAL" },
          { label: "Risk components", value: "Content 40 · Behavior 25 · Network 20 · Coordination 15" },
          { label: "Coordination", value: "≥3 accounts, ≥80% text similarity, within 48 hours" },
          { label: "Review", value: "All indicators require human review" },
        ]} />
      </Card>

      <Card title="ToC rules">
        <p className="text-sm text-slate-300">
          {rules.length} rules, {rules.filter((r) => r.verification === "verified_against_official_source").length} verified against official sources.{" "}
          <Link href="/toc" className="text-sky-400 hover:underline">Open the policy database</Link>
        </p>
      </Card>

      <Card title="Data sources">
        <KeyValue items={[
          { label: "Active provider", value: `${provider.id} — ${provider.label}` },
          { label: "Data type", value: provider.isMock ? "Simulated (not live content)" : "Official API" },
          { label: "Platforms covered", value: Object.values(PLATFORM_LABEL).join(", ") },
          { label: "Workspace store", value: "In-memory prototype store (resets on restart)" },
        ]} />
      </Card>

      <Card title="System information">
        {admin ? (
          <KeyValue items={[
            { label: "Application", value: `${pkg.name} ${pkg.version}` },
            { label: "Next.js", value: pkg.dependencies.next },
            { label: "Node.js", value: process.version },
            { label: "Environment", value: process.env.NODE_ENV ?? "unknown" },
          ]} />
        ) : <Notice>Only administrators can view system information.</Notice>}
      </Card>
    </div>
  );
}
