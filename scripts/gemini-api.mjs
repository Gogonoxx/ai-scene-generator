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
  if (!candidate) {
    console.error('ai-scene-generator | Full API response:', JSON.stringify(data, null, 2));
    throw new Error('No candidates in Gemini response');
  }

  // Gemini REST API uses camelCase (inlineData) not snake_case (inline_data)
  const parts = candidate.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData || p.inline_data);
  if (!imagePart) {
    console.error('ai-scene-generator | Response parts:', JSON.stringify(parts, null, 2));
    throw new Error('No image data in Gemini response');
  }

  const imageData = imagePart.inlineData || imagePart.inline_data;
  return {
    base64: imageData.data,
    mimeType: imageData.mimeType || imageData.mime_type || 'image/png'
  };
}
