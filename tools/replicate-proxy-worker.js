/**
 * Cloudflare Worker: API Proxy for AI Scene Generator
 * Proxies requests to RunComfy (and legacy Replicate), bypassing CORS.
 *
 * RunComfy Routes:
 *   POST /runcomfy/generate              → submit generation request
 *   GET  /runcomfy/status/:request_id    → poll status
 *   GET  /runcomfy/result/:request_id    → get result
 *
 * Legacy Replicate Routes:
 *   POST /predictions       → create prediction
 *   GET  /predictions/:id   → poll prediction status
 *   GET  /versions/:owner/:model → get latest version ID
 */

const RUNCOMFY_BASE = 'https://model-api.runcomfy.net/v1/models/runcomfy/flux2-klein-9b';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // ═══════════════════════════════════════
      // RunComfy Routes
      // ═══════════════════════════════════════

      if (path.startsWith('/runcomfy/')) {
        const apiToken = request.headers.get('X-RunComfy-Token');
        if (!apiToken) {
          return jsonResponse({ error: 'Missing X-RunComfy-Token header' }, 401);
        }

        // POST /runcomfy/generate — submit generation
        if (request.method === 'POST' && path === '/runcomfy/generate') {
          const body = await request.json();
          const response = await fetch(RUNCOMFY_BASE, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiToken}`
            },
            body: JSON.stringify(body)
          });
          const data = await response.json();
          return jsonResponse(data, response.status);
        }

        // GET /runcomfy/status/:request_id — poll status
        if (request.method === 'GET' && path.startsWith('/runcomfy/status/')) {
          const requestId = path.replace('/runcomfy/status/', '');
          const response = await fetch(`https://model-api.runcomfy.net/v1/requests/${requestId}/status`, {
            headers: { 'Authorization': `Bearer ${apiToken}` }
          });
          const data = await response.json();
          return jsonResponse(data, response.status);
        }

        // GET /runcomfy/result/:request_id — get result
        if (request.method === 'GET' && path.startsWith('/runcomfy/result/')) {
          const requestId = path.replace('/runcomfy/result/', '');
          const response = await fetch(`https://model-api.runcomfy.net/v1/requests/${requestId}/result`, {
            headers: { 'Authorization': `Bearer ${apiToken}` }
          });
          const data = await response.json();
          return jsonResponse(data, response.status);
        }

        return jsonResponse({ error: 'Not found' }, 404);
      }

      // ═══════════════════════════════════════
      // Legacy Replicate Routes
      // ═══════════════════════════════════════

      const apiToken = request.headers.get('X-Replicate-Token');
      if (!apiToken) {
        return jsonResponse({ error: 'Missing API token header' }, 401);
      }

      if (request.method === 'GET' && path.startsWith('/versions/')) {
        const modelPath = path.replace('/versions/', '');
        const response = await fetch(`https://api.replicate.com/v1/models/${modelPath}/versions`, {
          headers: { 'Authorization': `Bearer ${apiToken}` }
        });
        const data = await response.json();
        return jsonResponse(data, response.status);
      }

      if (request.method === 'POST' && path === '/predictions') {
        const body = await request.json();
        const response = await fetch('https://api.replicate.com/v1/predictions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'wait=60'
          },
          body: JSON.stringify(body)
        });
        const data = await response.json();
        return jsonResponse(data, response.status);
      }

      if (request.method === 'GET' && path.startsWith('/predictions/')) {
        const predictionId = path.split('/predictions/')[1];
        const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: { 'Authorization': `Bearer ${apiToken}` }
        });
        const data = await response.json();
        return jsonResponse(data, response.status);
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Replicate-Token, X-RunComfy-Token',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}
