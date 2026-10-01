import {
  childScope,
  evaluate,
  interpolate,
  lookupArray,
  type ElementType,
  type NodeLayout,
  type Scope,
  type SduiElement,
} from 'emberjs/utils/sdui/schema';

/**
 * 스키마(SduiElement) + 데이터(Scope) → 화면에 그릴 뷰 트리(ViewNode).
 *
 * 바인딩은 전부 여기서 풀립니다. 뷰는 완성된 문자열만 받아 그리므로
 * "어떤 경로를 읽는지"를 전혀 모릅니다.
 *
 * 이 파일과 schema.ts, form.ts 는 프레임워크를 모릅니다 (순수 TS).
 * 렌더러가 Ember 든 React 든 같은 뷰 트리를 씁니다.
 */

/**
 * connected: 시나리오 안의 블록으로 이어짐
 * open:      target 이 비어 있음 (아직 연결 안 함)
 * broken:    target 이 있지만 그런 블록이 없음 (삭제된 블록을 가리킴)
 */
export type PortStatus = 'connected' | 'open' | 'broken';

export interface ResolvedPort {
  key: string;
  label: string;
  target: string;
  status: PortStatus;
  /**
   * target 이 `{{경로}}` 하나로만 된 바인딩이면, 그 값이 문서의 어디에 있는지.
   * 캔버스에서 선을 이어 붙이거나 끊을 때 이 경로에 블록 _id 를 씁니다.
   * 템플릿이 그보다 복잡하면 되짚을 수 없으므로 null 입니다.
   */
  targetPath: string | null;
}

export type ViewNode =
  | { kind: 'header'; icon: string; title: string; caption: string }
  | {
      kind: 'text';
      text: string;
      tone: string;
      isEmpty: boolean;
      /** 최대 줄 수. 0 이면 제한 없음 */
      lines: number;
    }
  | {
      kind: 'field';
      label: string;
      value: string;
      isEmpty: boolean;
      mono: boolean;
    }
  | { kind: 'chips'; label: string; items: string[]; empty: string }
  | { kind: 'section'; title: string; children: ViewNode[] }
  | { kind: 'divider' }
  | { kind: 'ports'; ports: ResolvedPort[] }
  /** 이 클라이언트가 모르는 요소. 더 새로운 서버가 보냈을 수 있습니다. */
  | { kind: 'unknown'; type: string };

interface ResolveContext {
  scope: Scope;
  ports: ResolvedPort[];
}

type ElementOf<K extends ElementType> = Extract<SduiElement, { type: K }>;
type Resolver<K extends ElementType> = (
  element: ElementOf<K>,
  context: ResolveContext,
) => ViewNode;

/**
 * 프리미티브 레지스트리.
 *
 * mapped type 이라 schema.ts 에 요소 타입을 추가하고 여기를 빠뜨리면 컴파일
 * 에러가 납니다. 새 프리미티브 = 스키마 타입 + 여기 resolver + SduiView 분기.
 */
const RESOLVERS: { [K in ElementType]: Resolver<K> } = {
  header: (element, { scope }) => ({
    kind: 'header',
    icon: interpolate(element.icon, scope),
    title: interpolate(element.title, scope),
    caption: interpolate(element.caption, scope),
  }),

  text: (element, { scope }) => {
    const text = interpolate(element.text, scope).trim();
    const lines = Number(element.lines);
    return {
      kind: 'text',
      text: text || String(element.fallback ?? ''),
      tone: typeof element.tone === 'string' ? element.tone : 'default',
      isEmpty: text === '',
      lines: lines > 0 ? lines : 0,
    };
  },

  field: (element, { scope }) => {
    const value = interpolate(element.value, scope).trim();
    return {
      kind: 'field',
      label: interpolate(element.label, scope),
      value: value || String(element.fallback ?? '—'),
      isEmpty: value === '',
      mono: element.mono === true,
    };
  },

  chips: (element, { scope }) => ({
    kind: 'chips',
    label: interpolate(element.label, scope),
    items: lookupArray(scope, element.source)
      .map((item, index) =>
        interpolate(element.text, childScope(scope, item, index)).trim(),
      )
      .filter(Boolean),
    empty: String(element.empty ?? ''),
  }),

  section: (element, context) => ({
    kind: 'section',
    title: interpolate(element.title, context.scope),
    children: resolveElements(element.children, context),
  }),

  divider: () => ({ kind: 'divider' }),

  ports: (_element, { ports }) => ({ kind: 'ports', ports }),
};

function isElementType(type: string): type is ElementType {
  return Object.hasOwn(RESOLVERS, type);
}

export function resolveElements(
  elements: unknown,
  context: ResolveContext,
): ViewNode[] {
  if (!Array.isArray(elements)) return [];

  return elements.flatMap((element: unknown): ViewNode[] => {
    if (typeof element !== 'object' || element === null) return [];
    const raw = element as { type?: unknown; visibleIf?: unknown };
    if (typeof raw.type !== 'string') return [];
    if (!evaluate(raw.visibleIf, context.scope)) return [];
    if (!isElementType(raw.type)) return [{ kind: 'unknown', type: raw.type }];

    // 레지스트리 조회 결과는 K 별 resolver 의 유니온이라 직접 부를 수 없습니다.
    // raw.type 으로 이미 짝을 맞췄으므로 여기서 한 번만 넓힙니다.
    const resolver = RESOLVERS[raw.type] as Resolver<ElementType>;
    return [resolver(element as SduiElement, context)];
  });
}

/** `{{ next }}` 처럼 포매터 없는 바인딩 하나로만 된 템플릿 */
const SINGLE_BINDING = /^\s*\{\{\s*([\w.]+)\s*\}\}\s*$/;

/** 레이아웃의 ports 정의를 데이터에 적용해 실제 포트 목록을 만듭니다. */
export function resolvePorts(
  layout: NodeLayout,
  scope: Scope,
  hasBlock: (id: string) => boolean,
): ResolvedPort[] {
  const specs = Array.isArray(layout.ports) ? layout.ports : [];

  return specs.flatMap((spec, specIndex) =>
    lookupArray(scope, spec.source).flatMap((item, index) => {
      const itemScope = childScope(scope, item, index);
      if (!evaluate(spec.visibleIf, itemScope)) return [];

      const target = interpolate(spec.target, itemScope).trim();
      const binding = SINGLE_BINDING.exec(String(spec.target ?? ''))?.[1];
      let status: PortStatus = 'open';
      if (target) status = hasBlock(target) ? 'connected' : 'broken';

      return [
        {
          // 데이터 배열의 순번을 키로 씁니다. 숨겨진 항목이 있어도 키가 밀리지 않습니다.
          key: `${specIndex}:${index}`,
          label: interpolate(spec.label, itemScope) || `출구 ${index + 1}`,
          target,
          status,
          targetPath: binding ? `${spec.source}.${index}.${binding}` : null,
        },
      ];
    }),
  );
}

function containsPorts(nodes: ViewNode[]): boolean {
  return nodes.some(
    (node) =>
      node.kind === 'ports' ||
      (node.kind === 'section' && containsPorts(node.children)),
  );
}

/**
 * 노드 본문 전체를 풉니다.
 *
 * 레이아웃이 포트를 정의했는데 본문에 `ports` 요소가 없으면(또는 visibleIf 로
 * 숨겨졌으면) 끝에 붙입니다. 연결선이 꽂힐 자리가 화면에 없으면 안 되기 때문입니다.
 */
export function resolveBody(
  layout: NodeLayout,
  scope: Scope,
  ports: ResolvedPort[],
): ViewNode[] {
  const body = resolveElements(layout.body, { scope, ports });
  if (ports.length > 0 && !containsPorts(body)) {
    body.push({ kind: 'ports', ports });
  }
  return body;
}
