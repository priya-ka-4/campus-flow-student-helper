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
    if (error.status === 429) return json({ error: 'OpenAI is busy or its usage quota is reached. Wait a minute and retry; the site owner may need to check billing.' }, 429);
    if (error.status === 400) return json({ error: 'OpenAI could not process this input. Try another supported audio file or a shorter transcript.' }, 422);
    if (error.status === 401 || error.status === 403 || error.status === 404) return json({ error: 'OpenAI access is unavailable. The site owner should check the API key, billing, and configured notes model.' }, 503);
  }
  return json({ error: 'Processing did not finish. Try again with a shorter input, or use Quick local draft offline.' }, 502);
}
