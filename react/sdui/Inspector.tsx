import { useState } from 'react';
import type { XYPosition } from '@xyflow/react';
import { parseNodeLayout } from 'emberjs/utils/sdui/schema';
import type { PortStatus } from 'emberjs/utils/sdui/resolve';
import {
  FALLBACK_KEY,
  currentLayout,
  deriveForm,
  originalLayout,
  validateDocument,
  type BlockDocument,
} from 'emberjs/utils/sdui/scenario';
import { useScenario } from './context';
import { FormControl } from './FormControl';
import { JsonEditor } from './JsonEditor';

type Tab = 'form' | 'layout' | 'data';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'form', label: '편집' },
  { id: 'layout', label: '레이아웃 스키마' },
  { id: 'data', label: '블록 데이터' },
];

const STATUS_LABEL: Record<PortStatus, string> = {
  connected: '',
  open: '연결 없음',
  broken: '끊김',
};

/**
 * 선택한 노드를 편집합니다.
 *
 * - 편집: 레이아웃의 form 스키마로 그린 폼. 블록 데이터를 고칩니다.
 * - 레이아웃 스키마: 서버가 새 레이아웃을 배포하는 상황을 손으로 흉내 냅니다.
 *   같은 레이아웃을 쓰는 노드가 모두 함께 바뀝니다.
 * - 블록 데이터: 문서 JSON 을 직접 고칩니다. 폼에 없는 필드도 바꿀 수 있습니다.
 */
export function Inspector({
  selectedId,
  position,
  onMove,
  onClose,
}: {
  selectedId: string | null;
  /** 캔버스에서의 현재 위치. 문서의 editorData.x/y 로 보여 줍니다. */
  position: XYPosition | undefined;
  onMove: (id: string, position: XYPosition) => void;
  onClose: () => void;
}) {
  const { state, dispatch, blocks, blockById, original } = useScenario();
  const [tab, setTab] = useState<Tab>('form');
  // 되돌리기를 누르면 올려서 JSON 편집기를 새로 만듭니다 (draft 비우기).
  const [revision, setRevision] = useState(0);

  const block = selectedId ? blockById.get(selectedId) : undefined;
  if (!block) {
    return (
      <aside className="panel sdui-inspector">
        <div className="panel__section panel__section--grow">
          <h2 className="panel__title">인스펙터</h2>
          <p className="panel__empty">
            노드를 선택하면 데이터를 편집하거나, 그 노드를 그린 레이아웃
            스키마를 볼 수 있습니다. 출구 점을 끌어 다른 블록에 놓으면 연결이
            바뀌고, 연결선을 선택해 Backspace 를 누르면 끊깁니다.
          </p>
        </div>
      </aside>
    );
  }

  const { key: layoutKey, layout, isFallback } = block.layoutInUse;
  const originalDoc = original.docs[block.id];
  const isDataEdited = block.doc !== originalDoc;
  const isLayoutEdited =
    currentLayout(state, layoutKey) !==
    originalLayout(original.layouts, layoutKey);
  const sharedCount = blocks.filter(
    (other) => other.layoutInUse.key === layoutKey,
  ).length;

  const document: BlockDocument = position
    ? {
        ...block.doc,
        editorData: { ...block.doc.editorData, x: position.x, y: position.y },
      }
    : block.doc;

  const applyLayout = (raw: unknown): string | null => {
    const result = parseNodeLayout(raw);
    if (!result.ok) return result.error;
    dispatch({ type: 'setLayout', key: layoutKey, layout: result.layout });
    return null;
  };

  const applyData = (raw: unknown): string | null => {
    const error = validateDocument(raw, block.id);
    if (error) return error;
    const doc = raw as BlockDocument;
    dispatch({ type: 'replaceDoc', id: block.id, doc });
    const { x, y } = doc.editorData;
    if (typeof x === 'number' && typeof y === 'number')
      onMove(block.id, { x, y });
    return null;
  };

  const resetData = () => {
    if (originalDoc)
      dispatch({ type: 'replaceDoc', id: block.id, doc: originalDoc });
    setRevision((value) => value + 1);
  };

  const resetLayout = () => {
    const layout = originalLayout(original.layouts, layoutKey);
    if (layout) dispatch({ type: 'setLayout', key: layoutKey, layout });
    setRevision((value) => value + 1);
  };

  const editorKey = `${tab}:${block.id}:${revision}`;

  return (
    <aside className="panel sdui-inspector">
      <div className="panel__section">
        <div className="sdui-inspector__head">
          <h2 className="panel__title">{block.doc.name}</h2>
          <button
            type="button"
            className="sdui-inspector__close"
            aria-label="닫기"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="panel__caption">
          blockType <code>{block.doc.blockType}</code> → 레이아웃{' '}
          <code>{layoutKey === FALLBACK_KEY ? 'fallback' : layoutKey}</code>{' '}
          {isFallback && <span className="sdui-tag sdui-tag--muted">대체</span>}{' '}
          {isDataEdited && (
            <span className="sdui-tag sdui-tag--data">데이터 수정됨</span>
          )}{' '}
          {isLayoutEdited && <span className="sdui-tag">레이아웃 편집됨</span>}
        </p>

        {block.ports.length > 0 && (
          <ul className="sdui-inspector__ports">
            {block.ports.map((port) => (
              <li key={port.key} className={`is-${port.status}`}>
                <span>{port.label}</span>
                <span className="sdui-inspector__arrow">→</span>
                <span className="sdui-inspector__target">
                  {port.status === 'connected'
                    ? (blockById.get(port.target)?.doc.name ?? port.target)
                    : port.target}
                  {STATUS_LABEL[port.status] && (
                    <em>{STATUS_LABEL[port.status]}</em>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sdui-tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === tab}
            className={`sdui-tabs__tab${item.id === tab ? ' is-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="panel__section panel__section--grow sdui-inspector__body">
        {tab === 'form' && (
          <>
            <p className="panel__caption">
              이 폼도 서버 레이아웃의 <code>form</code> 스키마로 그려집니다.
              고치면 노드와 연결선에 바로 반영됩니다.
            </p>
            <FormFields blockId={block.id} />
            <button
              type="button"
              className="btn"
              disabled={!isDataEdited}
              onClick={resetData}
            >
              서버 원본 데이터로 되돌리기
            </button>
          </>
        )}

        {tab === 'layout' && (
          <>
            <p className="panel__caption">
              고치면 바로 반영됩니다. 이 레이아웃을 쓰는 노드 {sharedCount}개가
              함께 바뀝니다.
            </p>
            <JsonEditor
              key={editorKey}
              value={layout}
              apply={applyLayout}
              label="레이아웃 JSON"
            />
            <button
              type="button"
              className="btn"
              disabled={!isLayoutEdited}
              onClick={resetLayout}
            >
              서버 원본 레이아웃으로 되돌리기
            </button>
          </>
        )}

        {tab === 'data' && (
          <>
            <p className="panel__caption">
              서버가 내려준 문서입니다. 클라이언트는 이 필드들을 직접 읽지 않고
              레이아웃의 <code>{'{{경로}}'}</code> 바인딩으로만 읽습니다.{' '}
              <code>_id</code> 는 바꿀 수 없고, <code>blockType</code> 을 바꾸면
              다른 레이아웃으로 그려집니다.
            </p>
            <JsonEditor
              key={editorKey}
              value={document}
              apply={applyData}
              label="블록 데이터 JSON"
            />
            <button
              type="button"
              className="btn"
              disabled={!isDataEdited}
              onClick={resetData}
            >
              서버 원본 데이터로 되돌리기
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

/** 블록 하나의 서버 주도 편집 폼. 스키마 콘솔의 미리보기도 씁니다. */
export function FormFields({ blockId }: { blockId: string }) {
  const { state, blockById } = useScenario();
  const block = blockById.get(blockId);
  const controls = block ? deriveForm(state, block) : [];

  if (controls.length === 0) {
    return (
      <p className="panel__empty">
        이 레이아웃에는 편집 폼이 없습니다. &quot;블록 데이터&quot; 탭에서 JSON
        을 직접 고칠 수 있습니다.
      </p>
    );
  }
  return (
    <div className="sdui-form">
      {controls.map((control, index) => (
        <FormControl key={index} control={control} blockId={blockId} />
      ))}
    </div>
  );
}
