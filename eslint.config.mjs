/**
 * Debugging:
 *   https://eslint.org/docs/latest/use/configure/debug
 *  ----------------------------------------------------
 *
 *   Print a file's calculated configuration
 *
 *     npx eslint --print-config path/to/file.js
 *
 *   Inspecting the config
 *
 *     npx eslint --inspect-config
 *
 */
import globals from 'globals';
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';

import ember from 'eslint-plugin-ember/recommended';
import WarpDrive from 'eslint-plugin-warp-drive/recommended';
import eslintConfigPrettier from 'eslint-config-prettier';
import qunit from 'eslint-plugin-qunit';
import n from 'eslint-plugin-n';

import babelParser from '@babel/eslint-parser/experimental-worker';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const esmParserOptions = {
  ecmaFeatures: { modules: true },
  ecmaVersion: 'latest',
};

export default defineConfig([
  globalIgnores(['dist/', 'coverage/', '!**/.*']),
  js.configs.recommended,
  eslintConfigPrettier,
  ember.configs.base,
  ember.configs.gjs,
  ...WarpDrive,
  /**
   * https://eslint.org/docs/latest/use/configure/configuration-files#configuring-linter-options
   */
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      parser: babelParser,
    },
  },
  {
    files: ['**/*.{js,gjs}'],
    languageOptions: {
      parserOptions: esmParserOptions,
      globals: {
        ...globals.browser,
      },
    },
  },
  /**
   * TypeScript. .gts 는 ember 플러그인이 템플릿 태그를 전처리하고,
   * 타입 규칙은 typescript-eslint 가 맡습니다.
   */
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,gts,tsx}'],
  })),
  {
    files: ['**/*.{ts,gts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // 쓰지 않는 인자는 밑줄로 표시하는 관례를 허용합니다.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  /**
   * .gts 는 ember-eslint-parser 로 되돌립니다. 위의 typescript-eslint 설정이
   * 파서까지 바꿔버리면 <template> 태그를 파싱하지 못합니다.
   * flat config 는 나중에 오는 쪽이 이기므로 순서가 중요합니다.
   */
  ember.configs.gts,
  /**
   * React 아일랜드 (app/react/). 훅 규칙만 켭니다.
   */
  {
    ...reactHooks.configs.flat['recommended-latest'],
    files: ['**/*.tsx'],
  },
  {
    ...qunit.configs.recommended,
    files: ['tests/**/*-test.{js,gjs,ts,gts}'],
    plugins: {
      qunit,
    },
  },
  /**
   * CJS node files
   */
  {
    ...n.configs['flat/recommended-script'],
    files: ['**/*.cjs', 'config/**/*.js'],
    plugins: {
      n,
    },

    languageOptions: {
      sourceType: 'script',
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
      },
    },
  },
  /**
   * ESM node files
   */
  {
    ...n.configs['flat/recommended-module'],
    files: ['**/*.mjs'],
    plugins: {
      n,
    },

    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      parserOptions: esmParserOptions,
      globals: {
        ...globals.node,
      },
    },
  },
]);
