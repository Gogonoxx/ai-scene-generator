const GEMINI_MODEL = 'gemini-3.1-flash-image-preview';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const STYLE_SUFFIX = ', fantasy scene, atmospheric, cinematic lighting, establishing shot, wide angle, painted concept art, 4K';

/**
 * Generate a scene image using Nano Banana 2 (Gemini 3.1 Flash Image).
 * @param {string} apiKey - Google AI Studio API key
 * @param {string} prompt - User's scene description
 * @returns {Promise<{base64: string, mimeType: string}>}
 */
export async function generateSceneImage(apiKey, prompt) {
  const enhancedPrompt = prompt + STYLE_SUFFIX;

  const response = await fetch(
    `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: enhancedPrompt }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: '1K'
          }
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini API error: ${msg}`);
  }

  const data = await response.json();

  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error('No candidates in Gemini response');

  const imagePart = candidate.content?.parts?.find(p => p.inline_data);
  if (!imagePart) throw new Error('No image data in Gemini response');

  return {
    base64: imagePart.inline_data.data,
    mimeType: imagePart.inline_data.mime_type || 'image/png'
  };
}
