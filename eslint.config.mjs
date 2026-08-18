// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import * as eslintPluginImport from 'eslint-plugin-import';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/', 'node_modules/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      import: eslintPluginImport,
    },
    rules: {
      // ✅ TypeScript Best Practices
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

      // ✅ Alternative to `ban-types`
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSTypeReference[typeName.name="Function"]',
          message: 'Avoid using the `Function` type, use more specific function types instead.',
        },
        {
          selector: 'TSTypeReference[typeName.name="Object"]',
          message: 'Avoid using the `Object` type, use `Record<string, unknown>` instead.',
        },
      ],

      // ✅ Promises & Async Safety
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'error',

      // ✅ Code Cleanliness
      'prettier/prettier': 'error',
      'no-console': 'warn',
      'no-debugger': 'error',
      'eqeqeq': ['error', 'always'],

      // ✅ Import & Dependency Management
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal'],
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],

      // ✅ Enforce Key Sorting
      // 'sort-keys': ['error', 'asc', { caseSensitive: false, minKeys: 2, natural: true }],
    },
  },
);
