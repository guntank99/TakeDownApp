import { HttpError, readJson, withApi } from "@/lib/api/handler";
import { analyzeSentiment } from "@/lib/analysis/sentiment";
import { formatZodError, sentimentSchema } from "@/lib/validation/schemas";

/** POST /api/sentiment {text} or {texts: string[]} */
export const POST = withApi({}, async (req) => {
  const parsed = sentimentSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, formatZodError(parsed.error));
  const { text, texts } = parsed.data;
  return text ? analyzeSentiment(text) : { items: texts!.map((t) => ({ text: t, ...analyzeSentiment(t) })) };
});
