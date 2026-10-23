import type { Config } from '@netlify/functions';
import { client, failure, guard, json, limitedBody } from '../lib/security.mjs';

export default async (req: Request) => {
  const rejected = guard(req); if (rejected) return rejected;
  if (!req.headers.get('content-type')?.startsWith('multipart/form-data')) return json({ error: 'Upload an audio file using multipart form data.' }, 415);
  try {
    const body = await limitedBody(req, 3_000_000 + 16_384);
    let form: FormData;
    try { form = await new Response(body, { headers: { 'Content-Type': req.headers.get('content-type')! } }).formData(); }
    catch { return json({ error: 'Invalid upload. Select your audio file again.' }, 400); }
    const file = form.get('file');
    if (!(file instanceof File) || !file.size) return json({ error: 'Choose a non-empty audio file.' }, 400);
    if (file.size > 3_000_000) return json({ error: 'Audio must be 3 MB or smaller. Trim or compress the recording.' }, 413);
    if (!/\.(mp3|mp4|mpeg|m4a|wav|webm)$/i.test(file.name) || (file.type && !/^(audio\/(mpeg|mp3|mp4|m4a|x-m4a|wav|wave|x-wav|webm)|video\/(mp4|mpeg|webm)|application\/octet-stream)$/i.test(file.type)))
      return json({ error: 'Supported files: MP3, MP4, MPEG, M4A, WAV, or WebM.' }, 415);
    const result = await client().audio.transcriptions.create({ file, model: 'whisper-1' });
    if (!result.text?.trim()) return json({ error: 'No speech was detected. Try a clearer recording or paste a transcript.' }, 422);
    return json({ transcript: result.text });
  } catch (error) { return failure(error); }
};
export const config: Config = { rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: 'ip' } };
