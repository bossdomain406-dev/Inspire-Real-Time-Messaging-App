import { Env, handleMediaUpload, handleDownloadUrl } from './media';
import { verifySupabaseJwt } from './auth';
import {
  handleSmartReply,
  handleTranslate,
  handleSummarize,
  handleSmartSearch,
  handleModerate,
  handleTranscribe,
  handleEmojiSuggest,
} from './ai';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const authHeader = request.headers.get('Authorization');
    const user = await verifySupabaseJwt(authHeader, env.SUPABASE_JWT_SECRET);

    if (!user) {
      return Response.json(
        { error: 'Unauthorized: Missing or invalid Supabase JWT' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    let response: Response;

    try {
      switch (url.pathname) {
        case '/api/media/upload':
          response = await handleMediaUpload(request, env, user);
          break;
        case '/api/media/download-url':
          response = await handleDownloadUrl(request, env, user);
          break;
        case '/api/ai/smart-reply':
          response = await handleSmartReply(request, env, user);
          break;
        case '/api/ai/translate':
          response = await handleTranslate(request, env, user);
          break;
        case '/api/ai/summarize':
          response = await handleSummarize(request, env, user);
          break;
        case '/api/ai/smart-search':
          response = await handleSmartSearch(request, env, user);
          break;
        case '/api/ai/moderate':
          response = await handleModerate(request, env, user);
          break;
        case '/api/ai/transcribe':
          response = await handleTranscribe(request, env, user);
          break;
        case '/api/ai/emoji-suggest':
          response = await handleEmojiSuggest(request, env, user);
          break;
        default:
          response = Response.json({ error: 'Endpoint not found' }, { status: 404 });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      response = Response.json({ error: 'Internal Worker error', details: msg }, { status: 500 });
    }

    // Attach CORS headers to response
    const newHeaders = new Headers(response.headers);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
