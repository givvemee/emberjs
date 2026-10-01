/**
 * SDUI 레이아웃 스키마.
 *
 * 서버는 블록 문서(데이터)와 함께 "blockType 별로 노드를 어떻게 그릴지"를
 * 이 형태의 JSON 으로 내려줍니다. 클라이언트는 blockType 이 무엇인지 모릅니다 —
 * 아래 프리미티브(header, text, field …)를 그리는 법과 `{{경로}}` 바인딩을
 * 푸는 법만 압니다. 새 블록 타입이 생겨도 서버가 레이아웃만 추가하면 되고,
 * 클라이언트 배포는 필요 없습니다.
 *
 * 스키마는 네트워크(또는 사용자의 실시간 편집)에서 오므로 신뢰하지 않습니다.
 * parseNodeLayout 이 뼈대만 검사하고, 각 필드는 resolve 단계에서 방어적으로 읽습니다.
 */

/** `{{path}}` 또는 `{{path | formatter}}` 가 섞인 문자열 */
export type Template = string;

export type ConditionOp =
  'truthy' | 'falsy' | 'empty' | 'notEmpty' | 'eq' | 'neq';

/** 요소를 보일지 말지. op 를 생략하면 truthy 입니다. */
export interface Condition {
  path: string;
  op?: ConditionOp;
  value?: unknown;
}

interface ElementBase {
  visibleIf?: Condition;
}

export interface HeaderElement extends ElementBase {
  type: 'header';
  icon?: Template;
  title: Template;
  caption?: Template;
}

export interface TextElement extends ElementBase {
  type: 'text';
  text: Template;
  tone?: 'default' | 'muted' | 'quote';
  /** 최대 줄 수. 넘치면 말줄임 */
  lines?: number;
  fallback?: string;
}

export interface FieldElement extends ElementBase {
  type: 'field';
  label: Template;
  value: Template;
  mono?: boolean;
  fallback?: string;
}

/** 배열을 칩 목록으로. text 템플릿은 각 항목을 스코프로 풀립니다. */
export interface ChipsElement extends ElementBase {
  type: 'chips';
  label?: Template;
  source: string;
  text: Template;
  empty?: string;
}

export interface SectionElement extends ElementBase {
  type: 'section';
  title?: Template;
  children: SduiElement[];
}

export interface DividerElement extends ElementBase {
  type: 'divider';
}

/** 레이아웃의 ports 정의로 만든 출력 포트를 이 자리에 그립니다. */
export interface PortsElement extends ElementBase {
  type: 'ports';
}

export type SduiElement =
  | HeaderElement
  | TextElement
  | FieldElement
  | ChipsElement
  | SectionElement
  | DividerElement
  | PortsElement;

export type ElementType = SduiElement['type'];

/**
 * 출력 포트를 데이터의 어디서 뽑을지.
 *
 * source 배열의 항목마다 포트가 하나씩 생기고, label/target 은 그 항목을
 * 스코프로 풀립니다. "버튼 = user_choice[].next" 같은 도메인 지식은 여기,
 * 즉 서버 쪽에만 있습니다.
 */
export interface PortSpec {
  source: string;
  label: Template;
  /** 연결될 블록의 _id. 비어 있으면 연결되지 않은 포트입니다. */
  target: Template;
  visibleIf?: Condition;
}

// ── 편집 폼 ───────────────────────────────────────────────────────────

/**
 * 인스펙터의 편집 폼도 서버가 정합니다.
 *
 * path 는 블록 문서 기준 경로이고, list 의 fields 안에서는 목록 항목 기준
 * 경로입니다. 어떤 필드를 고칠 수 있는지, 버튼 하나가 어떤 모양의 객체인지
 * (newItem) 같은 도메인 지식이 전부 여기 들어 있습니다.
 */
interface FormFieldBase {
  label: Template;
  help?: string;
}

export interface FormOption {
  value: string;
  label: string;
}

export type FormField =
  | (FormFieldBase & { type: 'text'; path: string; placeholder?: string })
  | (FormFieldBase & { type: 'textarea'; path: string; placeholder?: string })
  | (FormFieldBase & { type: 'number'; path: string; min?: number })
  | (FormFieldBase & { type: 'toggle'; path: string })
  | (FormFieldBase & {
      type: 'select';
      path: string;
      /** "$blocks" 면 시나리오의 다른 블록들이 선택지가 됩니다 (연결 대상 고르기). */
      options: FormOption[] | '$blocks';
    })
  | (FormFieldBase & {
      type: 'list';
      source: string;
      /** 항목 머리글. 항목을 스코프로 풀립니다. */
      itemTitle?: Template;
      fields: FormField[];
      /** "추가" 를 눌렀을 때 넣을 항목의 모양 */
      newItem?: Record<string, unknown>;
      addLabel?: string;
    });

export type FormFieldType = FormField['type'];

export interface NodeLayout {
  label: string;
  icon: string;
  accent: string;
  tint: string;
  body: SduiElement[];
  ports?: PortSpec[];
  form?: FormField[];
}

export interface LayoutDocument {
  version: number;
  layouts: Record<string, NodeLayout>;
  /** blockType 에 맞는 레이아웃이 없을 때 쓰는 기본 모양 */
  fallback: NodeLayout;
}

// ── 검증 ──────────────────────────────────────────────────────────────

export type ParseResult =
  { ok: true; layout: NodeLayout } | { ok: false; error: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 레이아웃의 뼈대만 검사합니다.
 *
 * 모르는 요소 type 은 거르지 않습니다 — 더 새로운 서버가 보낸 요소일 수 있으니
 * 렌더러가 자리표시로 그리고 넘어갑니다. 여기서 막는 건 렌더링 자체가 불가능한
 * 경우(배열이 아닌 body, type 이 없는 요소 등)뿐입니다.
 */
export function parseNodeLayout(raw: unknown): ParseResult {
  if (!isRecord(raw)) return { ok: false, error: '최상위는 객체여야 합니다.' };

  for (const key of ['label', 'icon', 'accent', 'tint'] as const) {
    if (typeof raw[key] !== 'string') {
      return { ok: false, error: `"${key}" 는 문자열이어야 합니다.` };
    }
  }

  const bodyError = checkElements(raw['body'], 'body');
  if (bodyError) return { ok: false, error: bodyError };

  const ports = raw['ports'];
  if (ports !== undefined) {
    if (!Array.isArray(ports)) {
      return { ok: false, error: '"ports" 는 배열이어야 합니다.' };
    }
    const broken = ports.findIndex(
      (port) => !isRecord(port) || typeof port['source'] !== 'string',
    );
    if (broken >= 0) {
      return { ok: false, error: `ports[${broken}] 에 "source" 가 없습니다.` };
    }
  }

  const form = raw['form'];
  if (form !== undefined) {
    const formError = checkFields(form, 'form');
    if (formError) return { ok: false, error: formError };
  }

  // 뼈대가 맞으면 나머지는 resolve 단계가 방어적으로 읽습니다.
  return { ok: true, layout: raw as unknown as NodeLayout };
}

function checkElements(value: unknown, where: string): string | null {
  if (!Array.isArray(value)) return `"${where}" 는 배열이어야 합니다.`;

  for (const [index, element] of value.entries()) {
    const path = `${where}[${index}]`;
    if (!isRecord(element) || typeof element['type'] !== 'string') {
      return `${path} 에 "type" 이 없습니다.`;
    }
    if (element['type'] === 'section') {
      const nested = checkElements(element['children'], `${path}.children`);
      if (nested) return nested;
    }
  }
  return null;
}

function checkFields(value: unknown, where: string): string | null {
  if (!Array.isArray(value)) return `"${where}" 는 배열이어야 합니다.`;

  for (const [index, field] of value.entries()) {
    const path = `${where}[${index}]`;
    if (!isRecord(field) || typeof field['type'] !== 'string') {
      return `${path} 에 "type" 이 없습니다.`;
    }
    if (field['type'] === 'list') {
      if (typeof field['source'] !== 'string') {
        return `${path} 에 "source" 가 없습니다.`;
      }
      const nested = checkFields(field['fields'], `${path}.fields`);
      if (nested) return nested;
    } else if (typeof field['path'] !== 'string') {
      return `${path} 에 "path" 가 없습니다.`;
    }
  }
  return null;
}

// ── 바인딩 ────────────────────────────────────────────────────────────

/**
 * 바인딩이 풀리는 범위.
 *
 * 최상위에서는 item 이 블록 문서 자체입니다. chips/ports 처럼 배열을 도는
 * 곳에서는 item 이 배열 항목이 되고, `$root.` 로 블록 문서에, `$index` 로
 * 순번에 접근할 수 있습니다.
 */
export interface Scope {
  item: unknown;
  root: unknown;
  index?: number;
}

export function rootScope(doc: unknown): Scope {
  return { item: doc, root: doc };
}

export function childScope(parent: Scope, item: unknown, index: number): Scope {
  return { item, root: parent.root, index };
}

/** `a.b.0.c` 형태의 경로를 따라갑니다. 중간에 끊기면 undefined. */
export function lookup(scope: Scope, path: string): unknown {
  const trimmed = path.trim();
  if (trimmed === '$index') return scope.index;

  let current: unknown = scope.item;
  let rest = trimmed;
  if (trimmed === '$root') return scope.root;
  if (trimmed.startsWith('$root.')) {
    current = scope.root;
    rest = trimmed.slice('$root.'.length);
  }
  if (rest === '') return current;

  for (const segment of rest.split('.')) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      current = current[Number(segment)];
    } else if (isRecord(current)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

export function lookupArray(scope: Scope, path: unknown): unknown[] {
  if (typeof path !== 'string') return [];
  const value = lookup(scope, path);
  return Array.isArray(value) ? value : [];
}

/** `{{ path | formatter }}` 의 formatter. 서버와 맞춰야 하는 작은 어휘입니다. */
const FORMATTERS: Record<string, (value: unknown) => string> = {
  /** ObjectId 처럼 긴 id 를 끝 6자리로 */
  short: (value) => {
    const text = stringify(value);
    return text.length > 8 ? `…${text.slice(-6)}` : text;
  },
  count: (value) => String(Array.isArray(value) ? value.length : 0),
  upper: (value) => stringify(value).toUpperCase(),
  yesno: (value) => (value ? '사용' : '안 함'),
  json: (value) => JSON.stringify(value ?? null),
};

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value as string | number | boolean);
}

const PLACEHOLDER = /\{\{\s*([^}|]+?)\s*(?:\|\s*(\w+)\s*)?\}\}/g;

/**
 * 템플릿 문자열의 `{{…}}` 를 스코프 값으로 치환합니다.
 *
 * 스키마는 신뢰할 수 없는 입력이라 template 이 문자열이 아니어도 깨지지 않고
 * 빈 문자열을 돌려줍니다. 결과는 텍스트로만 렌더되므로(HTML 아님) 값을
 * 이스케이프할 필요는 없습니다.
 */
export function interpolate(template: unknown, scope: Scope): string {
  if (typeof template !== 'string') return '';
  return template.replace(
    PLACEHOLDER,
    (_match, path: string, name?: string) => {
      const value = lookup(scope, path);
      const formatter = name ? FORMATTERS[name] : undefined;
      return formatter ? formatter(value) : stringify(value);
    },
  );
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * 경로의 값을 바꾼 새 객체를 돌려줍니다. 원본은 건드리지 않습니다.
 *
 * 지나가는 객체·배열만 얕게 복사하므로 바뀌지 않은 가지는 원래 참조를 그대로
 * 씁니다. 중간 경로가 없으면 다음 조각이 숫자인지 보고 배열/객체를 만듭니다.
 */
export function setIn(target: unknown, path: string, value: unknown): unknown {
  return setSegments(target, path.split('.').filter(Boolean), value);
}

function setSegments(
  target: unknown,
  segments: string[],
  value: unknown,
): unknown {
  const [head, ...rest] = segments;
  if (head === undefined) return value;

  if (Array.isArray(target) || (!isRecord(target) && /^\d+$/.test(head))) {
    const copy: unknown[] = Array.isArray(target) ? [...target] : [];
    const index = Number(head);
    copy[index] = setSegments(copy[index], rest, value);
    return copy;
  }

  const copy: Record<string, unknown> = isRecord(target) ? { ...target } : {};
  copy[head] = setSegments(copy[head], rest, value);
  return copy;
}

export function evaluate(condition: unknown, scope: Scope): boolean {
  if (!isRecord(condition) || typeof condition['path'] !== 'string') {
    return true;
  }
  const value = lookup(scope, condition['path']);
  switch (condition['op']) {
    case 'falsy':
      return !value;
    case 'empty':
      return isEmpty(value);
    case 'notEmpty':
      return !isEmpty(value);
    case 'eq':
      return value === condition['value'];
    case 'neq':
      return value !== condition['value'];
    default:
      return Boolean(value);
  }
}
