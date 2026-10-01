import { defineConfig } from 'vite';
import { extensions, classicEmberSupport, ember } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';
import react from '@vitejs/plugin-react';

/**
 * 한 빌드 안에 Ember 와 React 가 같이 삽니다. 파일 확장자로 담당을 나눕니다.
 *
 *   .ts / .gts / .js / .gjs → Ember (아래 babel: 템플릿 컴파일, 데코레이터)
 *   .tsx                    → React (Vite 내장 oxc 로 JSX·TS 변환, Fast Refresh)
 *
 * 둘이 같은 파일을 건드리면 안 됩니다. Ember 쪽 babel 설정은 TSX 를 파싱하지
 * 않고(isTSX: false), oxc 가 .ts 를 변환하면 데코레이터(@tracked 등)가 Ember 가
 * 기대하는 방식과 다르게 컴파일됩니다.
 */
const REACT_FILES = /\.tsx$/;

export default defineConfig({
  server: {
    port: 4002,
  },
  resolve: {
    // Embroider 의 기본 목록에는 .tsx 가 없어서 `emberjs/react/...` 같은
    // 확장자 없는 import 를 개발 서버가 찾지 못합니다. 여기서 지정하면
    // Embroider 는 기본값을 덮어쓰지 않습니다.
    extensions: [...extensions, '.tsx'],
  },
  // Embroider 는 원래 oxc 를 통째로 끄는데(config.oxc = false), plugin-react 가
  // JSX 설정을 넣으면서 다시 켜집니다. 켜진 oxc 가 .tsx 만 맡도록 범위를 좁힙니다.
  oxc: {
    include: REACT_FILES,
  },
  plugins: [
    classicEmberSupport(),
    ember(),
    react({ include: REACT_FILES }),
    babel({
      babelHelpers: 'runtime',
      extensions,
      exclude: REACT_FILES,
    }),
  ],
});
