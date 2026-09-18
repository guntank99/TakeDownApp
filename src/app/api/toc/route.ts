import { withApi } from "@/lib/api/handler";
import { listPolicyRules } from "@/lib/toc/rules";
import { PLATFORM_REPORTING } from "@/lib/toc/reporting";
import { param } from "@/lib/utils/params";

/** GET /api/toc?platform=&category=&verification= */
export const GET = withApi({}, async (req) => {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const platform = param(sp, "platform");
  const category = param(sp, "category");
  const verification = param(sp, "verification");
  const rules = listPolicyRules().filter(
    (r) => (!platform || r.platform === platform) && (!category || r.category === category) && (!verification || r.verification === verification),
  );
  return { items: rules, reporting: Object.values(PLATFORM_REPORTING), total: rules.length };
});
