import { generateBattlemap, generateScene, downloadImage } from './runcomfy-api.mjs';

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

  // Scene tab state
  #prompt = '';
  #sceneName = '';
  #imageData = null;
  #mimeType = 'image/png';
  #generating = false;

  // Battlemap tab state
  #activeTab = 'scene';
  #bmPrompt = '';
  #bmName = '';
  #bmImageData = null;
  #bmMimeType = 'image/png';
  #bmGenerating = false;

  _prepareContext() {
    return {
      activeTab: this.#activeTab,
      // Scene
      prompt: this.#prompt,
      sceneName: this.#sceneName,
      imageData: this.#imageData,
      mimeType: this.#mimeType,
      generating: this.#generating,
      // Battlemap
      bmPrompt: this.#bmPrompt,
      bmName: this.#bmName,
      bmImageData: this.#bmImageData,
      bmMimeType: this.#bmMimeType,
      bmGenerating: this.#bmGenerating
    };
  }

  _onRender(context, options) {
    const html = this.element;

    // Tab switching
    html.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#activeTab = btn.dataset.tab;
        this.render();
      });
    });

    // Scene tab events
    html.querySelector('[data-action="generate"]')?.addEventListener('click', () => {
      this.#onGenerateScene(html);
    });
    html.querySelector('[data-action="create-scene"]')?.addEventListener('click', () => {
      this.#onCreateScene(html);
    });
    html.querySelector('#scene-prompt')?.addEventListener('input', (e) => {
      this.#prompt = e.target.value;
    });
    html.querySelector('#scene-name')?.addEventListener('input', (e) => {
      this.#sceneName = e.target.value;
    });

    // Battlemap tab events
    html.querySelector('[data-action="generate-battlemap"]')?.addEventListener('click', () => {
      this.#onGenerateBattlemap(html);
    });
    html.querySelector('[data-action="create-battlemap-scene"]')?.addEventListener('click', () => {
      this.#onCreateBattlemapScene(html);
    });
    html.querySelector('#bm-prompt')?.addEventListener('input', (e) => {
      this.#bmPrompt = e.target.value;
    });
    html.querySelector('#bm-name')?.addEventListener('input', (e) => {
      this.#bmName = e.target.value;
    });

    // Restore focus
    if (this.#activeTab === 'scene' && this.#prompt) {
      this.#focusEnd(html.querySelector('#scene-prompt'));
    } else if (this.#activeTab === 'battlemap' && this.#bmPrompt) {
      this.#focusEnd(html.querySelector('#bm-prompt'));
    }
  }

  #focusEnd(el) {
    if (!el) return;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  #getApiToken() {
    const token = game.settings.get(MODULE_ID, 'runcomfyApiToken');
    if (!token) {
      ui.notifications.error('No RunComfy API token configured. Go to Module Settings.');
      return null;
    }
    return token;
  }

  // ═══════════════════════════════════════════
  // Scene Tab (RunComfy + Scene LoRA)
  // ═══════════════════════════════════════════

  async #onGenerateScene(html) {
    const promptInput = html.querySelector('#scene-prompt');
    const prompt = promptInput?.value?.trim();
    if (!prompt) {
      ui.notifications.warn('Please enter a scene description.');
      return;
    }

    const apiToken = this.#getApiToken();
    if (!apiToken) return;

    this.#prompt = prompt;
    this.#generating = true;
    this.render();

    try {
      const result = await generateScene(apiToken, prompt);
      const imageData = await downloadImage(result.imageUrl);
      this.#imageData = imageData.base64;
      this.#mimeType = imageData.mimeType;
      if (!this.#sceneName) {
        this.#sceneName = prompt.split(/\s+/).slice(0, 4).join(' ');
      }
      ui.notifications.info('Scene image generated!');
    } catch (err) {
      console.error(`${MODULE_ID} | Scene generation failed:`, err);
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
    await this.#uploadAndCreateScene(this.#imageData, this.#mimeType, sceneName, { gridless: true });

    this.#imageData = null;
    this.#sceneName = '';
    this.#prompt = '';
    this.render();
  }

  // ═══════════════════════════════════════════
  // Battlemap Tab (RunComfy + Battlemap LoRA)
  // ═══════════════════════════════════════════

  async #onGenerateBattlemap(html) {
    const promptInput = html.querySelector('#bm-prompt');
    const prompt = promptInput?.value?.trim();
    if (!prompt) {
      ui.notifications.warn('Please enter a battlemap description.');
      return;
    }

    const apiToken = this.#getApiToken();
    if (!apiToken) return;

    this.#bmPrompt = prompt;
    this.#bmGenerating = true;
    this.render();

    try {
      const result = await generateBattlemap(apiToken, prompt);
      const imageData = await downloadImage(result.imageUrl);
      this.#bmImageData = imageData.base64;
      this.#bmMimeType = imageData.mimeType;

      if (!this.#bmName) {
        this.#bmName = prompt.split(/\s+/).slice(0, 4).join(' ');
      }

      ui.notifications.info('Battlemap generated!');
    } catch (err) {
      console.error(`${MODULE_ID} | Battlemap generation failed:`, err);
      ui.notifications.error(`Battlemap generation failed: ${err.message}`);
    } finally {
      this.#bmGenerating = false;
      this.render();
    }
  }

  async #onCreateBattlemapScene(html) {
    if (!this.#bmImageData) {
      ui.notifications.warn('Generate a battlemap first.');
      return;
    }
    const nameInput = html.querySelector('#bm-name');
    const sceneName = nameInput?.value?.trim() || 'AI Battlemap';
    await this.#uploadAndCreateScene(this.#bmImageData, this.#bmMimeType, sceneName, {
      gridless: false,
      width: 2800,
      height: 2100,
      gridSize: 140
    });

    this.#bmImageData = null;
    this.#bmName = '';
    this.#bmPrompt = '';
    this.render();
  }

  // ═══════════════════════════════════════════
  // Shared: Upload + Scene Creation
  // ═══════════════════════════════════════════

  async #uploadAndCreateScene(base64, mimeType, sceneName, options = {}) {
    const { gridless = true, width, height, gridSize = 100 } = options;

    try {
      const byteString = atob(base64);
      const bytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
      const fileName = `${sceneName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-')}-${Date.now()}.${ext}`;
      const file = new File([blob], fileName, { type: mimeType });

      const uploadDir = gridless ? 'ai-scenes' : 'ai-battlemaps';
      try {
        await FilePicker.browse('data', uploadDir);
      } catch {
        await FilePicker.createDirectory('data', uploadDir);
      }

      const uploadResult = await FilePicker.upload('data', uploadDir, file);
      if (!uploadResult?.path) throw new Error('Upload failed');

      const sceneData = {
        name: sceneName,
        background: { src: uploadResult.path },
        tokenVision: false,
        globalLight: true,
        padding: 0
      };

      if (gridless) {
        sceneData.grid = { type: 0 };
        sceneData.initial = { x: 960, y: 540, scale: 0.5 };
      } else {
        sceneData.grid = { type: 1, size: gridSize };
        sceneData.width = width;
        sceneData.height = height;
        sceneData.initial = { x: Math.round(width / 2), y: Math.round(height / 2), scale: 0.3 };
      }

      const scene = await Scene.create(sceneData);
      ui.notifications.info(`Scene "${sceneName}" created!`);

      const activate = await Dialog.confirm({
        title: 'Activate Scene?',
        content: `<p>Scene "<strong>${sceneName}</strong>" created. Activate now?</p>`,
        yes: () => true,
        no: () => false,
        defaultYes: true
      });
      if (activate) await scene.activate();

    } catch (err) {
      console.error(`${MODULE_ID} | Scene creation failed:`, err);
      ui.notifications.error(`Scene creation failed: ${err.message}`);
    }
  }
}
