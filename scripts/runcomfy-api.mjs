/**
 * RunComfy API wrapper for battlemap and scene generation.
 * Uses Flux 2 Klein 9B with custom LoRAs via async polling.
 * All requests go through Cloudflare Worker proxy to bypass CORS.
 */

const PROXY_URL = 'https://replicate-proxy.joshua-e6f.workers.dev';

const LORA_CONFIGS = {
  battlemap: {
    path: 'rn10_klein_v1_000003500.safetensors',
    triggerWord: 'bmapx',
    networkMultiplier: 0.9
  },
  scene: {
    path: 'scn_klein_v1_000003500.safetensors',
    triggerWord: 'bscenex',
    networkMultiplier: 0.9
  }
};

/**
 * Build a battlemap prompt from user input.
 */
function buildBattlemapPrompt(userPrompt) {
  return `${LORA_CONFIGS.battlemap.triggerWord}, top-down view of ${userPrompt}, spacious layout with open areas, no characters, no creatures, terrain and furniture only`;
}

/**
 * Build a scene prompt from user input.
 */
function buildScenePrompt(userPrompt) {
  return `${LORA_CONFIGS.scene.triggerWord}, ${userPrompt}, fantasy scene, atmospheric, cinematic lighting, painted concept art`;
}

/**
 * Submit a generation request via proxy.
 * Returns a request_id for polling.
 */
async function submitRequest(apiToken, prompt, loraConfig) {
  const response = await fetch(`${PROXY_URL}/runcomfy/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-RunComfy-Token': apiToken
    },
    body: JSON.stringify({
      loras: [{
        path: loraConfig.path,
        network_multiplier: loraConfig.networkMultiplier
      }],
      prompt,
      width: 1024,
      height: 1024,
      guidance_scale: 4,
      sample_steps: 40,
      seed: Math.floor(Math.random() * 2147483647),
      sampler: 'flowmatch'
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || err?.detail || `HTTP ${response.status}`;
    throw new Error(`RunComfy API error: ${msg}`);
  }

  const data = await response.json();
  if (!data.request_id) {
    console.error('ai-scene-generator | Unexpected submit response:', JSON.stringify(data, null, 2));
    throw new Error('No request_id in RunComfy response');
  }

  return data.request_id;
}

/**
 * Poll for request completion, then retrieve the result.
 */
async function waitForResult(apiToken, requestId, maxWait = 120000) {
  const headers = { 'X-RunComfy-Token': apiToken };
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 2000));

    const statusResponse = await fetch(`${PROXY_URL}/runcomfy/status/${requestId}`, { headers });
    if (!statusResponse.ok) throw new Error(`Status poll failed: HTTP ${statusResponse.status}`);

    const statusData = await statusResponse.json();
    const status = statusData.status || statusData;

    if (status === 'completed') {
      const resultResponse = await fetch(`${PROXY_URL}/runcomfy/result/${requestId}`, { headers });
      if (!resultResponse.ok) throw new Error(`Result fetch failed: HTTP ${resultResponse.status}`);

      const resultData = await resultResponse.json();
      const imageUrl = Array.isArray(resultData) ? resultData[0] : (resultData.uri || resultData.url || resultData.image_url);

      if (!imageUrl) {
        console.error('ai-scene-generator | Unexpected result response:', JSON.stringify(resultData, null, 2));
        throw new Error('No image URL in RunComfy result');
      }
      return imageUrl;
    }

    if (status === 'cancelled' || status === 'failed') {
      throw new Error(`RunComfy request ${status}`);
    }
  }

  throw new Error('RunComfy request timed out (120s)');
}

/**
 * Generate a battlemap image.
 */
export async function generateBattlemap(apiToken, userPrompt) {
  const prompt = buildBattlemapPrompt(userPrompt);
  console.log('ai-scene-generator | RunComfy battlemap prompt:', prompt);

  const requestId = await submitRequest(apiToken, prompt, LORA_CONFIGS.battlemap);
  console.log('ai-scene-generator | Request submitted:', requestId);

  const imageUrl = await waitForResult(apiToken, requestId);
  return { imageUrl };
}

/**
 * Generate a scene image.
 */
export async function generateScene(apiToken, userPrompt) {
  const prompt = buildScenePrompt(userPrompt);
  console.log('ai-scene-generator | RunComfy scene prompt:', prompt);

  const requestId = await submitRequest(apiToken, prompt, LORA_CONFIGS.scene);
  console.log('ai-scene-generator | Request submitted:', requestId);

  const imageUrl = await waitForResult(apiToken, requestId);
  return { imageUrl };
}

/**
 * Download an image from URL and return as base64.
 */
export async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download image: HTTP ${response.status}`);

  const blob = await response.blob();
  const mimeType = blob.type || 'image/webp';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
