/**
 * 노드 타입 레지스트리.
 *
 * 새 노드 타입을 추가하려면 이 파일에만 항목을 하나 더 넣으면 됩니다.
 * 팔레트, 캔버스 렌더링, 인스펙터 폼, 검증이 모두 이 정의를 읽습니다.
 *
 *   hasInput  상단 입력 포트 유무
 *   outputs   하단 출력 포트 목록 (순서대로 좌→우 배치)
 *   fields    인스펙터에 그릴 폼 필드
 *   defaults  노드 생성 시 초기 data
 *   summary   캔버스의 노드 본문에 보여줄 한 줄 요약
 */

export const NODE_WIDTH = 248;
export const GRID = 8;

/** 팔레트에서 캔버스로 끌어다 놓을 때 쓰는 dataTransfer MIME 타입 */
export const DND_TYPE = 'application/x-flow-node';

const ATTRIBUTES = [
  { value: 'plan', label: '요금제' },
  { value: 'country', label: '국가' },
  { value: 'sessions', label: '방문 횟수' },
  { value: 'replied', label: '답장 여부' },
  { value: 'email', label: '이메일' },
];

const OPERATORS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'contains', label: '포함' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
];

const TRIGGERS = [
  { value: 'page-open', label: '페이지 진입' },
  { value: 'button-click', label: '버튼 클릭' },
  { value: 'inactivity', label: '일정 시간 미활동' },
  { value: 'manual', label: '수동 실행' },
];

function labelOf(options, value) {
  return options.find((o) => o.value === value)?.label ?? value;
}

export const NODE_TYPES = {
  start: {
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
  },

  message: {
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
    summary: (data) => data.text?.trim() || '내용이 비어 있습니다',
  },

  condition: {
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
        data.value?.trim() || '…'
      }`,
  },

  end: {
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
    summary: (data) => data.reason?.trim() || '완료',
  },
};

/** 팔레트에 그릴 순서 */
export const NODE_TYPE_LIST = ['start', 'message', 'condition', 'end'].map(
  (id) => NODE_TYPES[id],
);

export function typeDef(type) {
  return NODE_TYPES[type] ?? NODE_TYPES.message;
}
