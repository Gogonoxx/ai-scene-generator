import { SceneGeneratorApp } from './scene-generator.mjs';

const MODULE_ID = 'ai-scene-generator';

let generatorApp;

Hooks.once('init', () => {
  game.settings.register(MODULE_ID, 'apiKey', {
    name: game.i18n?.localize('AI-SCENE.settings.apiKey.name') ?? 'Gemini API Key',
    hint: game.i18n?.localize('AI-SCENE.settings.apiKey.hint') ?? 'Your Google AI Studio API key for Nano Banana 2 image generation.',
    scope: 'world',
    config: true,
    type: String,
    default: '',
    restricted: true
  });
});

Hooks.on('getSceneControlButtons', (controls) => {
  if (!game.user.isGM) return;

  const sceneTools = controls.find(c => c.name === 'scenes');
  if (!sceneTools) return;

  sceneTools.tools.push({
    name: 'ai-scene-generator',
    title: 'AI Scene Generator',
    icon: 'fas fa-wand-magic-sparkles',
    button: true,
    onClick: () => {
      if (!generatorApp) {
        generatorApp = new SceneGeneratorApp();
      }
      generatorApp.render(true);
    }
  });
});
