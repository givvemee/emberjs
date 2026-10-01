import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  babelCompatSupport,
  templateCompatSupport,
} from '@embroider/compat/babel';

export default {
  plugins: [
    [
      'babel-plugin-ember-template-compilation',
      {
        enableLegacyModules: [
          'ember-cli-htmlbars',
          'ember-cli-htmlbars-inline-precompile',
          'htmlbars-inline-precompile',
        ],
        transforms: [...templateCompatSupport()],
      },
    ],
    [
      'module:decorator-transforms',
      {
        runtime: {
          import: fileURLToPath(
            import.meta.resolve('decorator-transforms/runtime-esm'),
          ),
        },
      },
    ],
    [
      // 타입은 지우기만 합니다. 타입 검사는 glint 가 따로 담당합니다.
      '@babel/plugin-transform-typescript',
      {
        // .gts 는 content-tag 전처리를 거쳐 들어오므로 확장자로 판별할 수
        // 없습니다. 전부 TS 로 파싱합니다 (TS 는 JS 의 상위집합이라 안전).
        allExtensions: true,
        // .tsx(React)는 이 babel 을 거치지 않고 plugin-react 가 변환합니다
        // (vite.config.mjs 의 REACT_FILES). 여기서는 JSX 를 파싱하지 않습니다.
        isTSX: false,
        // `declare foo: Bar` 를 런타임 필드로 만들지 않고 지웁니다.
        // Ember 의 `@service declare flow` 패턴에 필요합니다.
        allowDeclareFields: true,
        onlyRemoveTypeImports: true,
      },
    ],
    [
      '@babel/plugin-transform-runtime',
      {
        absoluteRuntime: dirname(fileURLToPath(import.meta.url)),
        useESModules: true,
        regenerator: false,
      },
    ],
    ...babelCompatSupport(),
  ],

  generatorOpts: {
    compact: false,
  },
};
