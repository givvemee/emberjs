import { resolveForm, type FormControl } from 'emberjs/utils/sdui/form';
import {
  resolveBody,
  resolvePorts,
  type ResolvedPort,
  type ViewNode,
} from 'emberjs/utils/sdui/resolve';
import {
  isRecord,
  lookup,
  rootScope,
  setIn,
  type LayoutDocument,
  type NodeLayout,
} from 'emberjs/utils/sdui/schema';

/**
 * 시나리오(블록 문서들 + 레이아웃) 상태와 그 위의 순수 함수들.
 *
 * 상태는 불변 객체로 다루고 바꾸는 방법은 scenarioReducer 하나뿐입니다.
 * 프레임워크를 모르므로 React 의 useReducer 에 그대로 꽂히고, 다른 렌더러에서도
 * 같은 규칙으로 쓸 수 있습니다. 노드 위치는 캔버스(xyflow)가 따로 들고 있습니다.
 */

/** 레이아웃 편집에서 fallback 을 가리키는 키. blockType 과 겹치지 않게 $ 로 시작합니다. */
export const FALLBACK_KEY = '$fallback';

/**
 * 서버가 내려주는 블록 문서. 클라이언트가 직접 읽는 필드는 _id, name,
 * blockType, editorData.x/y 뿐이고 나머지는 레이아웃의 바인딩으로만 읽힙니다.
 */
export interface BlockDocument {
  _id: string;
  name: string;
  blockType: string;
  editorData: { x: number; y: number; [key: string]: unknown };
  [key: string]: unknown;
}

export interface ScenarioPayload {
  scenario: { _id: string; name: string; botId: string };
  blocks: BlockDocument[];
  layouts: LayoutDocument;
}

export interface ScenarioState {
  /** 블록 순서 (목록 표시용). 블록을 추가·삭제하지 않으므로 고정입니다. */
  order: string[];
  docs: Record<string, BlockDocument>;
  layouts: Record<string, NodeLayout>;
  fallback: NodeLayout;
}

export function initialState(payload: ScenarioPayload): ScenarioState {
  return {
    order: payload.blocks.map((doc) => doc._id),
    docs: Object.fromEntries(payload.blocks.map((doc) => [doc._id, doc])),
    layouts: { ...payload.layouts.layouts },
    fallback: payload.layouts.fallback,
  };
}

// ── 변경 ──────────────────────────────────────────────────────────────

export type ScenarioAction =
  | { type: 'set'; id: string; path: string; value: unknown }
  | { type: 'addItem'; id: string; path: string; item: Record<string, unknown> }
  | { type: 'removeItem'; id: string; path: string; index: number }
  | { type: 'replaceDoc'; id: string; doc: BlockDocument }
  | { type: 'setLayout'; key: string; layout: NodeLayout };

function withDoc(
  state: ScenarioState,
  id: string,
  update: (doc: BlockDocument) => BlockDocument,
): ScenarioState {
  const doc = state.docs[id];
  if (!doc) return state;
  return { ...state, docs: { ...state.docs, [id]: update(doc) } };
}

function setPath(doc: BlockDocument, path: string, value: unknown) {
  // _id 는 연결선이 기대는 키라 바꿀 수 없습니다.
  if (!path || path === '_id') return doc;
  return setIn(doc, path, value) as BlockDocument;
}

function listAt(doc: BlockDocument, path: string): unknown[] {
  const value = lookup(rootScope(doc), path);
  return Array.isArray(value) ? value : [];
}

export function scenarioReducer(
  state: ScenarioState,
  action: ScenarioAction,
): ScenarioState {
  switch (action.type) {
    case 'set':
      return withDoc(state, action.id, (doc) =>
        setPath(doc, action.path, action.value),
      );
    case 'addItem':
      return withDoc(state, action.id, (doc) =>
        setPath(doc, action.path, [
          ...listAt(doc, action.path),
          structuredClone(action.item),
        ]),
      );
    case 'removeItem':
      return withDoc(state, action.id, (doc) =>
        setPath(
          doc,
          action.path,
          listAt(doc, action.path).filter((_item, i) => i !== action.index),
        ),
      );
    case 'replaceDoc':
      return withDoc(state, action.id, () => action.doc);
    case 'setLayout':
      return action.key === FALLBACK_KEY
        ? { ...state, fallback: action.layout }
        : {
            ...state,
            layouts: { ...state.layouts, [action.key]: action.layout },
          };
  }
}

/**
 * JSON 직접 편집으로 들어온 문서를 검사합니다. 연결선이 _id 로 이어져 있으므로
 * _id 는 바꿀 수 없습니다. blockType 을 바꾸면 다른 레이아웃으로 그려집니다.
 *
 * @returns 오류 메시지. 문제가 없으면 null
 */
export function validateDocument(raw: unknown, id: string): string | null {
  if (!isRecord(raw)) return '최상위는 객체여야 합니다.';
  if (raw['_id'] !== id) return '"_id" 는 바꿀 수 없습니다.';
  if (typeof raw['name'] !== 'string') return '"name" 은 문자열이어야 합니다.';
  if (typeof raw['blockType'] !== 'string') {
    return '"blockType" 은 문자열이어야 합니다.';
  }
  if (!isRecord(raw['editorData'])) return '"editorData" 는 객체여야 합니다.';
  return null;
}

// ── 파생 ──────────────────────────────────────────────────────────────

export interface LayoutInUse {
  key: string;
  layout: NodeLayout;
  isFallback: boolean;
}

export function layoutFor(
  state: ScenarioState,
  blockType: string,
): LayoutInUse {
  const layout = Object.hasOwn(state.layouts, blockType)
    ? state.layouts[blockType]
    : undefined;
  if (layout) return { key: blockType, layout, isFallback: false };
  return { key: FALLBACK_KEY, layout: state.fallback, isFallback: true };
}

export function originalLayout(
  original: LayoutDocument,
  key: string,
): NodeLayout | undefined {
  return key === FALLBACK_KEY ? original.fallback : original.layouts[key];
}

export function currentLayout(
  state: ScenarioState,
  key: string,
): NodeLayout | undefined {
  return key === FALLBACK_KEY ? state.fallback : state.layouts[key];
}

/** 블록 하나를 그리는 데 필요한 것 전부. 레이아웃 + 데이터에서 계산됩니다. */
export interface DerivedBlock {
  id: string;
  doc: BlockDocument;
  layoutInUse: LayoutInUse;
  ports: ResolvedPort[];
  body: ViewNode[];
}

export function deriveBlocks(state: ScenarioState): DerivedBlock[] {
  const hasBlock = (id: string) => Object.hasOwn(state.docs, id);

  return state.order.flatMap((id) => {
    const doc = state.docs[id];
    if (!doc) return [];
    const layoutInUse = layoutFor(state, doc.blockType);
    const scope = rootScope(doc);
    const ports = resolvePorts(layoutInUse.layout, scope, hasBlock);
    return [
      {
        id,
        doc,
        layoutInUse,
        ports,
        body: resolveBody(layoutInUse.layout, scope, ports),
      },
    ];
  });
}

export function deriveForm(
  state: ScenarioState,
  block: DerivedBlock,
): FormControl[] {
  const blocks = state.order
    .filter((id) => id !== block.id)
    .map((id) => ({ id, name: state.docs[id]?.name ?? id }));
  return resolveForm(block.layoutInUse.layout.form, block.doc, blocks);
}

/** 데이터가 말하는 연결 하나. xyflow 의 Edge 로 그대로 옮겨집니다. */
export interface DataEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetPath: string | null;
}

export function deriveEdges(blocks: DerivedBlock[]): DataEdge[] {
  return blocks.flatMap((block) =>
    block.ports.flatMap((port) =>
      port.status === 'connected'
        ? [
            {
              id: `${block.id}/${port.key}`,
              source: block.id,
              sourceHandle: port.key,
              target: port.target,
              targetPath: port.targetPath,
            },
          ]
        : [],
    ),
  );
}
