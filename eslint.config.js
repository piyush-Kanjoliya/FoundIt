import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/',
      'client/dist/',
      'client/node_modules/',
      'data/',
      'playwright-report/',
      'test-results/',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      parserOptions: {ecmaFeatures: {jsx: true}},
      globals: {...globals.browser, ...globals.node},
    },
    plugins: {'react-hooks': reactHooks},
    rules: {
      // Minimal, quiet: the classic hook rules only. The newer compiler-era
      // presets (refs, set-state-in-effect, ...) flag intentional patterns in
      // this codebase and would require a refactor, not a cleanup.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Intentional empty catch blocks (optional storage, best-effort cleanup).
      'no-empty': ['error', {allowEmptyCatch: true}],
      // Express error handlers keep the arity; `_`-prefixed args are unused.
      'no-unused-vars': [
        'error',
        {argsIgnorePattern: '^_', ignoreRestSiblings: true},
      ],
    },
  },
];
