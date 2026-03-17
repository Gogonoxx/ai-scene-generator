import { generateSceneImage } from './gemini-api.mjs';

const MODULE_ID = 'ai-scene-generator';

export class SceneGeneratorApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: 'ai-scene-generator',
    tag: 'div',
    window: {
      title: 'AI Scene Generator',
      icon: 'fas fa-wand-magic-sparkles',
      resizable: true
    },
    position: {
      width: 520,
      height: 'auto'
    },
    classes: ['ai-scene-generator']
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/generator-dialog.hbs`
    }
  };

  #prompt = '';
  #sceneName = '';
  #imageData = null;
  #mimeType = 'image/png';
  #generating = false;

  _prepareContext() {
    return {
      prompt: this.#prompt,
      sceneName: this.#sceneName,
      imageData: this.#imageData,
      mimeType: this.#mimeType,
      generating: this.#generating
    };
  }

  _onRender(context, options) {
    const html = this.element;

    // Generate button
    html.querySelector('[data-action="generate"]')?.addEventListener('click', () => {
      this.#onGenerate(html);
    });

    // Create scene button
    html.querySelector('[data-action="create-scene"]')?.addEventListener('click', () => {
      this.#onCreateScene(html);
    });

    // Keep prompt/name in sync with state
    html.querySelector('#scene-prompt')?.addEventListener('input', (e) => {
      this.#prompt = e.target.value;
    });
    html.querySelector('#scene-name')?.addEventListener('input', (e) => {
      this.#sceneName = e.target.value;
    });

    // Restore focus to prompt if we have one
    if (this.#prompt) {
      const promptInput = html.querySelector('#scene-prompt');
      if (promptInput) {
        requestAnimationFrame(() => {
          promptInput.focus();
          promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
        });
      }
    }
  }

  async #onGenerate(html) {
    const promptInput = html.querySelector('#scene-prompt');
    const prompt = promptInput?.value?.trim();
    if (!prompt) {
      ui.notifications.warn('Please enter a scene description.');
      return;
    }

    const apiKey = game.settings.get(MODULE_ID, 'apiKey');
    if (!apiKey) {
      ui.notifications.error('No Gemini API key configured. Go to Module Settings.');
      return;
    }

    this.#prompt = prompt;
    this.#generating = true;
    this.render();

    try {
      const result = await generateSceneImage(apiKey, prompt);
      this.#imageData = result.base64;
      this.#mimeType = result.mimeType;

      // Auto-generate scene name from first few words of prompt
      if (!this.#sceneName) {
        this.#sceneName = prompt.split(/\s+/).slice(0, 4).join(' ');
      }

      ui.notifications.info('Image generated successfully!');
    } catch (err) {
      console.error(`${MODULE_ID} | Generation failed:`, err);
      ui.notifications.error(`Generation failed: ${err.message}`);
    } finally {
      this.#generating = false;
      this.render();
    }
  }

  async #onCreateScene(html) {
    if (!this.#imageData) {
      ui.notifications.warn('Generate an image first.');
      return;
    }

    const nameInput = html.querySelector('#scene-name');
    const sceneName = nameInput?.value?.trim() || 'AI Scene';

    try {
      // Base64 → Blob → File
      const byteString = atob(this.#imageData);
      const bytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: this.#mimeType });
      const ext = this.#mimeType === 'image/jpeg' ? 'jpg' : 'png';
      const fileName = `${sceneName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-')}-${Date.now()}.${ext}`;
      const file = new File([blob], fileName, { type: this.#mimeType });

      // Ensure upload directory exists
      const uploadDir = 'ai-scenes';
      try {
        await FilePicker.browse('data', uploadDir);
      } catch {
        await FilePicker.createDirectory('data', uploadDir);
      }

      // Upload
      const uploadResult = await FilePicker.upload('data', uploadDir, file);
      if (!uploadResult?.path) throw new Error('Upload failed — no path returned');

      // Create Scene
      const scene = await Scene.create({
        name: sceneName,
        background: { src: uploadResult.path },
        grid: { type: 0 },
        globalLight: true,
        padding: 0,
        initial: {
          x: 960,
          y: 540,
          scale: 0.5
        }
      });

      ui.notifications.info(`Scene "${sceneName}" created!`);

      // Open scene config so user can adjust
      scene.sheet.render(true);

      // Reset state for next generation
      this.#imageData = null;
      this.#sceneName = '';
      this.#prompt = '';
      this.render();

    } catch (err) {
      console.error(`${MODULE_ID} | Scene creation failed:`, err);
      ui.notifications.error(`Scene creation failed: ${err.message}`);
    }
  }
}
