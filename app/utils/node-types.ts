/**
 * 노드 타입 레지스트리.
 *
 * 새 노드 타입을 추가하려면 NodeDataMap 에 형태를 적고 NODE_TYPES 에 항목을
 * 하나 더 넣으면 됩니다. 팔레트, 캔버스 렌더링, 인스펙터 폼, 검증이 모두 이
 * 정의를 읽습니다.
 *
 * 타입의 핵심은 NodeDataMap 입니다. 이것 덕분에 `summary: (data) => data.text`
 * 가 message 노드에서만 통과하고, condition 노드에서 쓰면 컴파일 에러가 납니다.
 */

export const NODE_WIDTH = 248;
export const GRID = 8;

/** 팔레트에서 캔버스로 끌어다 놓을 때 쓰는 dataTransfer MIME 타입 */
export const DND_TYPE = 'application/x-flow-node';

// ── 선택지 목록 ───────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
}

const ATTRIBUTES = [
  { value: 'plan', label: '요금제' },
  { value: 'country', label: '국가' },
  { value: 'sessions', label: '방문 횟수' },
  { value: 'replied', label: '답장 여부' },
  { value: 'email', label: '이메일' },
] as const satisfies readonly SelectOption[];

const OPERATORS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'contains', label: '포함' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
] as const satisfies readonly SelectOption[];

const TRIGGERS = [
  { value: 'page-open', label: '페이지 진입' },
  { value: 'button-click', label: '버튼 클릭' },
  { value: 'inactivity', label: '일정 시간 미활동' },
  { value: 'manual', label: '수동 실행' },
] as const satisfies readonly SelectOption[];

export type AttributeKey = (typeof ATTRIBUTES)[number]['value'];
export type OperatorKey = (typeof OPERATORS)[number]['value'];
export type TriggerKey = (typeof TRIGGERS)[number]['value'];

function labelOf(options: readonly SelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

// ── 노드 타입별 data 형태 ─────────────────────────────────────────────

export interface NodeDataMap {
  start: { trigger: TriggerKey };
  message: { text: string; delay: number };
  condition: { attribute: AttributeKey; operator: OperatorKey; value: string };
  end: { reason: string };
}

export type NodeType = keyof NodeDataMap;
export type NodeData<T extends NodeType = NodeType> = NodeDataMap[T];
export type AnyNodeData = NodeDataMap[NodeType];

// ── 폼 필드 정의 ──────────────────────────────────────────────────────

interface FieldBase {
  key: string;
  label: string;
  help?: string;
  required?: boolean;
}

/**
 * 판별 유니온이라 `options` 는 select 에만 존재합니다. text 필드에 options 를
 * 붙이면 컴파일 에러가 나고, 인스펙터의 `{{#if (eq field.type "select")}}`
 * 분기 안에서만 options 에 접근할 수 있습니다.
 */
export type FieldDef =
  | (FieldBase & { type: 'text'; placeholder?: string })
  | (FieldBase & { type: 'textarea'; placeholder?: string })
  | (FieldBase & { type: 'number'; min?: number })
  | (FieldBase & { type: 'select'; options: readonly SelectOption[] });

export interface PortDef {
  key: string;
  label: string;
}

// ── 노드 타입 정의 ────────────────────────────────────────────────────

export interface NodeTypeDef<T extends NodeType = NodeType> {
  id: T;
  label: string;
  hint: string;
  icon: string;
  accent: string;
  tint: string;
  hasInput: boolean;
  removable: boolean;
  outputs: readonly PortDef[];
  fields: readonly FieldDef[];
  defaults: NodeDataMap[T];
  summary: (data: NodeDataMap[T]) => string;
}

/** 각 항목을 자기 타입으로 좁혀서 작성하게 해주는 헬퍼 */
function defineNode<T extends NodeType>(def: NodeTypeDef<T>): NodeTypeDef<T> {
  return def;
}

export const NODE_TYPES = {
  start: defineNode({
    id: 'start',
    label: '시작',
    hint: '플로우가 시작되는 지점',
    icon: '▶',
    accent: '#059669',
    tint: '#ecfdf5',
    hasInput: false,
    removable: false,
    outputs: [{ key: 'next', label: '' }],
    fields: [
      {
        key: 'trigger',
        label: '트리거',
        type: 'select',
        options: TRIGGERS,
        help: '어떤 상황에서 이 플로우가 실행될지 정합니다.',
      },
    ],
    defaults: { trigger: 'page-open' },
    summary: (data) => labelOf(TRIGGERS, data.trigger),
  }),

  message: defineNode({
    id: 'message',
    label: '메시지 보내기',
    hint: '고객에게 메시지를 전송',
    icon: '💬',
    accent: '#2563eb',
    tint: '#eff6ff',
    hasInput: true,
    removable: true,
    outputs: [{ key: 'next', label: '' }],
    fields: [
      {
        key: 'text',
        label: '메시지 내용',
        type: 'textarea',
        placeholder: '고객에게 보낼 메시지를 입력하세요',
        required: true,
      },
      { key: 'delay', label: '전송 지연 (초)', type: 'number', min: 0 },
    ],
    defaults: { text: '', delay: 0 },
    summary: (data) => data.text.trim() || '내용이 비어 있습니다',
  }),

  condition: defineNode({
    id: 'condition',
    label: '조건 분기',
    hint: '속성값에 따라 경로를 나눔',
    icon: '⑂',
    accent: '#d97706',
    tint: '#fffbeb',
    hasInput: true,
    removable: true,
    outputs: [
      { key: 'yes', label: '예' },
      { key: 'no', label: '아니오' },
    ],
    fields: [
      { key: 'attribute', label: '속성', type: 'select', options: ATTRIBUTES },
      { key: 'operator', label: '연산자', type: 'select', options: OPERATORS },
      { key: 'value', label: '비교할 값', type: 'text', required: true },
    ],
    defaults: { attribute: 'plan', operator: 'eq', value: '' },
    summary: (data) =>
      `${labelOf(ATTRIBUTES, data.attribute)} ${labelOf(OPERATORS, data.operator)} ${
        data.value.trim() || '…'
      }`,
  }),

  end: defineNode({
    id: 'end',
    label: '종료',
    hint: '플로우를 끝냄',
    icon: '■',
    accent: '#dc2626',
    tint: '#fef2f2',
    hasInput: true,
    removable: true,
    outputs: [],
    fields: [{ key: 'reason', label: '종료 사유', type: 'text' }],
    defaults: { reason: '완료' },
    summary: (data) => data.reason.trim() || '완료',
  }),
} satisfies { [T in NodeType]: NodeTypeDef<T> };

/**
 * 소비자용 정의 타입.
 *
 * NODE_TYPES[someNodeType] 은 NodeTypeDef<'start'> | NodeTypeDef<'message'> | …
 * 라서, 그 위에서 summary 를 호출하면 인자 타입이 교집합(never)이 되어 부를 수
 * 없습니다. 작성 시점의 정밀한 타입은 위에서 이미 확보했으므로, 읽는 쪽에는
 * 통합된 형태를 노출합니다.
 */
export type ResolvedNodeDef = Omit<
  NodeTypeDef,
  'id' | 'defaults' | 'summary'
> & {
  id: NodeType;
  defaults: AnyNodeData;
  summary: (data: AnyNodeData) => string;
};

/** 팔레트에 그릴 순서 */
export const NODE_TYPE_LIST: readonly ResolvedNodeDef[] = [
  NODE_TYPES.start,
  NODE_TYPES.message,
  NODE_TYPES.condition,
  NODE_TYPES.end,
] as ResolvedNodeDef[];

export function isNodeType(value: unknown): value is NodeType {
  return typeof value === 'string' && value in NODE_TYPES;
}

export function typeDef(type: string): ResolvedNodeDef {
  // 위 단언이 유일한 캐스트 지점입니다. 정의 자체는 defineNode 로 이미 검증됐습니다.
  const def = isNodeType(type) ? NODE_TYPES[type] : NODE_TYPES.message;
  return def as ResolvedNodeDef;
}
