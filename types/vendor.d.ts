/*
 * 타입을 함께 배포하지 않는 패키지들의 최소 선언.
 *
 * 앱이 실제로 쓰는 표면만 좁게 적었습니다 — 넓게 any 로 열어두면 타입 검사를
 * 켜 둔 의미가 없어집니다.
 *
 * 주의: 이 파일에는 최상단 import/export 를 두면 안 됩니다. 그러면 파일이
 * 모듈이 되어 아래 `declare module` 들이 "새 모듈 선언"이 아니라 "기존 모듈
 * 증강"으로 해석되고, 존재하지 않는 모듈이라 무시됩니다.
 * 외부 타입이 필요하면 블록 안에서 import 하거나 `import(...)` 구문을 쓰세요.
 */

/**
 * Embroider 가 빌드 타임에 만들어내는 가상 모듈 (디스크에 파일이 없습니다).
 * 모듈 경로 → 그 모듈의 export 맵 형태라 중첩 Record 입니다.
 */
declare module '@embroider/virtual/compat-modules' {
  const compatModules: Record<string, Record<string, unknown>>;
  export default compatModules;
}

declare module '@embroider/config-meta-loader' {
  export default function loadConfigFromMeta(
    modulePrefix: string,
  ): Record<string, unknown>;
}

declare module '@embroider/router' {
  import type EmberRouter from '@ember/routing/router';
  const EmbroiderRouter: typeof EmberRouter;
  export default EmbroiderRouter;
}

declare module '@embroider/macros' {
  export function macroCondition(predicate: boolean): boolean;
  export function isDevelopingApp(): boolean;
  export function importSync(specifier: string): unknown;
}

declare module '@embroider/legacy-inspector-support/ember-source-4.12' {
  import type Application from '@ember/application';
  export default function setupInspector(app: Application): unknown;
}

declare module 'ember-cli-deprecation-workflow' {
  export interface DeprecationWorkflowConfig {
    throwOnUnhandled?: boolean;
    workflow?: Array<{ handler: string; matchId: string }>;
  }
  export default function setupDeprecationWorkflow(
    config: DeprecationWorkflowConfig,
  ): void;
}

/**
 * 부수효과용 CSS import (`import '@xyflow/react/dist/style.css'`).
 * Vite 가 스타일시트로 번들에 넣고, 모듈 자체는 아무것도 내보내지 않습니다.
 */
declare module '*.css';
