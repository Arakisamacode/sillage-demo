// Analyse statique (npx eslint src) : erreurs réelles uniquement (variables non définies, code mort, doublons…).
import js from '@eslint/js';
import globals from 'globals';
export default [
  { files: ['src/**/*.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
    rules: { ...js.configs.recommended.rules, 'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }], 'no-empty': 'off', 'no-cond-assign': 'off', 'no-sparse-arrays': 'off' } },
];
