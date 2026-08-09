/* Linting, from zero.
 *
 * Three files in this repo carried `// eslint-disable-next-line
 * react-hooks/exhaustive-deps` — a suppression for a rule from a tool that was
 * not installed. Somebody had looked at those dependency arrays once, decided
 * the omission was deliberate, and written it down; nothing had checked since,
 * and nothing would have caught a fourth one added by accident. Installing the
 * linter is what turns those three comments back into statements that are
 * either true or fail the build.
 *
 * Deliberately narrow. `typescript-eslint`'s type-checked presets are not on:
 * they need a second full type-check pass on every lint run, and `tsc -b` is
 * already in the build doing exactly that. What is wanted here is the class of
 * mistake the compiler structurally cannot see — hook dependencies, unhandled
 * promises at call sites — not a second opinion on types.
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'public/**'],
  },

  /* ------------------------------------------------------------ the app */
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.serviceworker },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      /* The two the linter was installed for, and the two that were being
         suppressed by hand. Errors: a missing dependency is the bug class
         that shows up as "it works until you navigate back to it", and an
         existing `eslint-disable` for it is now a claim somebody has to
         defend rather than a comment nobody can check. */
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      /* v7 of this plugin also ships the React Compiler's rules — purity,
         immutability, set-state-in-effect, ref access during render. They
         are good rules and they find real things here (twenty-two of them),
         but this app does not run the compiler, so none of them is currently
         causing a bug. Warnings, not errors: a list to work down, not a
         reason the build cannot ship. Promote them as they are cleared. */
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/use-memo': 'warn',

      /* Off, deliberately. The rule wants every module that exports a
         component to export nothing else, and this codebase repeatedly and
         reasonably exports a helper beside its screen — `DrillSummary` out of
         `Drills.tsx` is used by `Tests.tsx`. Twenty-one warnings whose only
         remedy is twenty-one new files, in exchange for slightly better hot
         reload, is not a trade worth making. */
      'react-refresh/only-export-components': 'off',

      /* `tsc` already has noUnusedLocals/noUnusedParameters on, so this only
         ever fires on things the compiler's version does not cover. Leading
         underscore is the escape hatch, same convention as the compiler's. */
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      /* `any` is effectively absent from this codebase today. This is the
         thing that keeps it that way rather than a cleanup task. */
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  /* ------------------------------------------------- build-time scripts */
  {
    files: ['scripts/**/*.mjs', '*.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    /* `vite.config.ts` is TypeScript and needs the TS parser, or the whole
       file is a parse error and nothing in it is checked at all. */
    files: ['*.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  /* Tests reach for globals the app does not have. */
  {
    files: ['src/**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
