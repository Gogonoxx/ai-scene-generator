import { SceneGeneratorApp } from './scene-generator.mjs';

const MODULE_ID = 'ai-scene-generator';

let generatorApp;

Hooks.once('init', () => {
  // RunComfy API Token (for both scenes and battlemaps)
  game.settings.register(MODULE_ID, 'runcomfyApiToken', {
    name: 'RunComfy API Token',
    hint: 'RunComfy API token for AI image generation. Get one at runcomfy.com → Profile.',
    scope: 'world',
    config: true,
    type: String,
    default: '',
    restricted: true
  });
});

Hooks.on('getSceneControlButtons', (controls) => {
  const tokenControls = controls.tokens;
  if (tokenControls?.tools) {
    tokenControls.tools['ai-scene-generator'] = {
      name: 'ai-scene-generator',
      title: 'AI Scene Generator',
      icon: 'fas fa-wand-magic-sparkles',
      order: Object.keys(tokenControls.tools).length,
      button: true,
      visible: game.user.isGM,
      onChange: () => {
        if (!generatorApp) {
          generatorApp = new SceneGeneratorApp();
        }
        generatorApp.render(true);
      }
    };
  }
});
