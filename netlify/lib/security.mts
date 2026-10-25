import OpenAI from 'openai';

export function json(data: object, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
export function guard(req: Request) {
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin || req.headers.get('sec-fetch-site') === 'cross-site')
    return json({ error: 'Open CampusFlow on this site and try again. Cross-site requests are blocked.' }, 403);
}
export async function limitedBody(req: Request, max: number) {
  if (Number(req.headers.get('content-length')) > max) throw new Error('BODY_TOO_LARGE');
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export function client() {
  const apiKey = Netlify.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('NOT_CONFIGURED');
  return new OpenAI({ apiKey, baseURL: 'https://api.openai.com/v1', timeout: 24000, maxRetries: 0 });
}
export function failure(error: unknown) {
  if (error instanceof Error && error.message === 'NOT_CONFIGURED') return json({ error: 'AI processing is not configured. The site owner must set OPENAI_API_KEY for Functions and redeploy. Use Quick local draft meanwhile.' }, 503);
  if (error instanceof Error && error.message === 'BODY_TOO_LARGE') return json({ error: 'Input is too large. Use audio up to 3 MB or a transcript up to 40,000 characters.' }, 413);
  if (error instanceof OpenAI.APIError) {
    // Classify only structured SDK fields; never expose provider messages or bodies.
    const identifiers = [error.code, error.type].filter((value): value is string => typeof value === 'string').map(value => value.toLowerCase());
    const quotaCodes = new Set([
      'insufficient_quota', 'billing_hard_limit_reached', 'billing_limit_reached',
      'billing_not_active', 'credit_balance_too_low', 'insufficient_credits',
      'usage_limit_reached', 'spend_limit_reached', 'monthly_limit_exceeded',
    ]);
    if (identifiers.some(value => quotaCodes.has(value))) return json({
      code: 'ai_quota_exhausted',
      error: 'OpenAI account quota, credits, or a spending limit prevents AI processing. The site owner must check the connected OpenAI project billing, available API credits, and organization/project spending limits, then resolve the account limit before retrying. Waiting a minute will not fix an exhausted balance. Use Quick local draft meanwhile.',
    }, 503);
    if (error.status === 429) {
      const rateCodes = new Set(['rate_limit_exceeded', 'rate_limit_error', 'requests', 'tokens']);
      if (identifiers.some(value => rateCodes.has(value))) return json({
        code: 'ai_rate_limited',
        error: 'OpenAI temporarily limited requests or tokens. Wait a minute before retrying and avoid simultaneous AI requests. If this persists, the site owner should review the OpenAI project rate limits. Use Quick local draft meanwhile.',
      }, 429);
      return json({
        code: 'ai_limit_unknown',
        error: 'OpenAI rejected the request with an unclassified usage limit. Retry later; if it persists, the site owner should check OpenAI project billing, credits, spending limits, and request/token rate limits. Use Quick local draft meanwhile.',
      }, 429);
    }
    if (error.status === 400) return json({ error: 'OpenAI could not process this input. Try another supported audio file or a shorter transcript.' }, 422);
    if (error.status === 401 || error.status === 403 || error.status === 404) return json({ error: 'OpenAI access is unavailable. The site owner should check the API key, billing, and configured notes model.' }, 503);
  }
  return json({ error: 'Processing did not finish. Try again with a shorter input, or use Quick local draft offline.' }, 502);
}
