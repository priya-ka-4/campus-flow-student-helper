# CampusFlow

A static student workspace with browser-local planner, quizzes, budget, GPA, events, and lecture notes. All seven sections and the existing `cf_*` local-storage keys are preserved. Deploy on the same site origin to retain access to previously saved browser data.

## Netlify setup

1. In Netlify project configuration, add `OPENAI_API_KEY` as a secret environment variable available to **Functions**, in each deployment context that needs AI. Use an OpenAI project with billing and audio/model access enabled. Never put the value in HTML, browser scripts, repository files, or public build variables.
2. Optionally set `OPENAI_NOTES_MODEL` for Functions. It defaults to `gpt-4.1-mini`; choose a model supporting the OpenAI Responses API.
3. Deploy from the connected repository. `netlify.toml` publishes `public/` and bundles `netlify/functions/`. No build command is required; remove an old publish-directory override if one exists. Redeploy after environment changes. Deploying only the static folder by drag-and-drop does not deploy the functions.

These integrations call OpenAI directly server-side as requested. They do not depend on AI Gateway. Transcription uses `whisper-1`; notes use Responses with `store: false`. OpenAI processing and charges follow the configured account’s terms. No keys are sent to the browser.

## Usage and limits

Record and stop a lecture, or upload MP3, MP4, MPEG, M4A, WAV, or WebM. After-class transcription accepts at most **3,000,000 bytes (3 MB)**. Trim or compress larger recordings before uploading. Recording audio is temporary; only saved transcripts and notes survive refresh. The last selected upload or new recording becomes the transcription source.

Transcription sends audio to OpenAI; AI notes send the transcript (20–40,000 characters). Review generated content before saving. **Quick local draft** remains available offline and does not send data. Browser live speech recognition may use the browser provider’s servers. Saved app data stays in local storage, does not sync across devices, and is removed if browser storage is cleared.

POST endpoints require an Origin matching the request origin and reject cross-site requests. Netlify’s deployed edge rate limits apply separately per IP: transcription **5 requests/minute**, notes **10 requests/minute**. Rate limiting is platform-enforced across function instances, not an in-memory counter. Local emulation may not enforce edge limits. Same-origin checks and IP limits are abuse controls, not user authentication; shared networks share the allowance.

Requests have a 24-second upstream timeout with no automatic retries. Slow or large inputs can require trimming. The client displays configuration, network, quota, and validation errors and retains existing editor content on failure. Actual OpenAI access, billing, model availability, and production edge-limit behavior require deployment verification.

## AI notes troubleshooting

Generate AI study notes is disabled until the editor contains 20–40,000 transcript characters, excluding outer whitespace. Recording audio does not guarantee a live transcript: if it is empty, stop the recording and select Transcribe, or paste a transcript. The character hint updates as text changes, including when opening saved lectures. Quick local draft works offline with any non-empty transcript and does not require the AI minimum.

The server classifies structured OpenAI API error code/type fields without returning provider response bodies. Account quota, credit, or spending-limit errors return an `ai_quota_exhausted` error (503); temporary request/token rate limits return `ai_rate_limited` (429). An unrecognized 429 returns `ai_limit_unknown` without asserting that billing or temporary traffic is the cause.

For exhausted account quota, the site owner must review the OpenAI project connected to the existing server-side credential: confirm API billing and available credits, and check organization/project spending limits. The owner must resolve the applicable balance or limit before retrying; repeated immediate retries do not restore credits. Temporary rate limits call for waiting and reducing concurrent requests. No billing or environment changes are made by this fix.

Local storage keys and saved records are unchanged. A preview uses a different origin and therefore cannot display the production origin's browser-local data; that does not mean the production data was removed.

## Local checks

```sh
npm ci
npm run check
netlify dev --port 8889
```

Supply the key through Netlify’s local environment integration or an ignored `.env` file; never commit it. For a deployment smoke test, upload a short permitted recording, generate notes, save the lecture, and refresh to confirm local persistence. Verify an unsupported/oversized file is rejected and the offline draft works without a network connection.
