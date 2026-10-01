import { useMemo, useReducer, useState } from 'react';
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  type NodeTypes,
} from '@xyflow/react';
import {
  FALLBACK_KEY,
  deriveBlocks,
  scenarioReducer,
  type BlockDocument,
  type ScenarioState,
} from 'emberjs/utils/sdui/scenario';
import type { NodeLayout } from 'emberjs/utils/sdui/schema';
import { ScenarioContext, type ScenarioContextValue } from '../context';
import { SduiNode, type SduiFlowNode } from '../SduiNode';
import { FormFields } from '../Inspector';

const NODE_TYPES: NodeTypes = { sdui: SduiNode };

type Tab = 'node' | 'form';

/**
 * 편집 중인 레이아웃 하나로 샘플 블록을 그려 봅니다.
 *
 * 캔버스 화면과 같은 SduiNode · FormFields 를 그대로 씁니다. 차이는
 * ScenarioContext 에 넣는 상태뿐입니다: 레이아웃 자리에 지금 편집 중인 것을
 * 넣고, 샘플 블록의 blockType 을 그 레이아웃의 키로 바꿔 끼웁니다.
 * 폼을 고치면 샘플 데이터가 바뀌어 노드에 바로 보입니다 (서버에는 안 감).
 */
export function Preview({
  layoutKey,
  layout,
  deployedTypes,
  blocks,
}: {
  layoutKey: string;
  /** 마지막으로 올바르게 파싱된 레이아웃 */
  layout: NodeLayout;
  /** 배포본에 레이아웃이 있는 blockType 들. fallback 샘플을 고를 때 씁니다. */
  deployedTypes: readonly string[];
  blocks: BlockDocument[];
}) {
  const [docs, dispatch] = useReducer(
    scenarioReducer,
    blocks,
    (initial): ScenarioState => ({
      order: initial.map((doc) => doc._id),
      docs: Object.fromEntries(initial.map((doc) => [doc._id, doc])),
      layouts: {},
      fallback: layout,
    }),
  );
  const [tab, setTab] = useState<Tab>('node');
  const [chosen, setChosen] = useState<Record<string, string>>({});

  const sampleId =
    chosen[layoutKey] ?? defaultSample(layoutKey, blocks, deployedTypes);
  const original = useMemo(
    () => Object.fromEntries(blocks.map((doc) => [doc._id, doc])),
    [blocks],
  );

  const context = useMemo<ScenarioContextValue>(() => {
    const isFallback = layoutKey === FALLBACK_KEY;
    const sample = docs.docs[sampleId];
    // fallback 미리보기는 레이아웃 맵을 비워 두면 어떤 blockType 이든 fallback 으로
    // 그려집니다. 그 밖에는 샘플의 blockType 을 지금 레이아웃 키로 바꿔 끼웁니다.
    const state: ScenarioState = {
      ...docs,
      layouts: isFallback ? {} : { [layoutKey]: layout },
      fallback: layout,
      docs:
        sample && !isFallback
          ? { ...docs.docs, [sampleId]: { ...sample, blockType: layoutKey } }
          : docs.docs,
    };
    const derived = deriveBlocks(state);
    return {
      state,
      dispatch,
      blocks: derived,
      blockById: new Map(derived.map((block) => [block.id, block])),
      original: {
        docs: original,
        layouts: { version: 0, layouts: {}, fallback: layout },
      },
    };
  }, [docs, layoutKey, layout, sampleId, original]);

  const nodes = useMemo<SduiFlowNode[]>(
    () => [
      {
        id: sampleId,
        type: 'sdui',
        position: { x: 0, y: 0 },
        data: {},
        draggable: false,
        selectable: false,
        deletable: false,
      },
    ],
    [sampleId],
  );

  const isSampleEdited = docs.docs[sampleId] !== original[sampleId];
  const resetSample = () => {
    const doc = original[sampleId];
    if (doc) dispatch({ type: 'replaceDoc', id: sampleId, doc });
  };

  return (
    <ScenarioContext.Provider value={context}>
      <aside className="panel sdui-console__preview">
        <div className="panel__section">
          <h2 className="panel__title">미리보기</h2>
          <label className="sdui-control">
            <span className="sdui-control__label">샘플 블록</span>
            <select
              className="sdui-control__input"
              value={sampleId}
              onChange={(event) =>
                setChosen((current) => ({
                  ...current,
                  [layoutKey]: event.target.value,
                }))
              }
            >
              {blocks.map((doc) => (
                <option key={doc._id} value={doc._id}>
                  {doc.name} ({doc.blockType})
                </option>
              ))}
            </select>
          </label>
          <p className="panel__caption">
            샘플 블록의 데이터를 이 레이아웃으로 그립니다.
            {layoutKey !== FALLBACK_KEY && (
              <>
                {' '}
                blockType 은 <code>{layoutKey}</code> 로 바꿔 끼웁니다.
              </>
            )}
          </p>
        </div>

        <div className="sdui-tabs" role="tablist">
          {(
            [
              ['node', '노드'],
              ['form', '편집 폼'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`sdui-tabs__tab${tab === id ? ' is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'node' ? (
          <div className="sdui-console__stage">
            {/* 키가 바뀌면 새로 만들어 fitView 를 다시 합니다. */}
            <ReactFlowProvider key={`${layoutKey}:${sampleId}`}>
              <ReactFlow
                nodes={nodes}
                edges={[]}
                nodeTypes={NODE_TYPES}
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                nodesConnectable={false}
                zoomOnScroll={false}
                preventScrolling={false}
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={20} />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        ) : (
          <div className="panel__section panel__section--grow sdui-inspector__body">
            <FormFields blockId={sampleId} />
          </div>
        )}

        <div className="panel__section">
          <button
            type="button"
            className="btn btn--grow"
            disabled={!isSampleEdited}
            onClick={resetSample}
          >
            샘플 데이터 되돌리기
          </button>
        </div>
      </aside>
    </ScenarioContext.Provider>
  );
}

/**
 * 레이아웃에 어울리는 샘플: 같은 blockType 의 블록, fallback 이면 배포본에
 * 레이아웃이 없는 타입의 블록, 그것도 없으면 첫 블록.
 */
function defaultSample(
  layoutKey: string,
  blocks: BlockDocument[],
  deployedTypes: readonly string[],
): string {
  const match =
    layoutKey === FALLBACK_KEY
      ? blocks.find((doc) => !deployedTypes.includes(doc.blockType))
      : blocks.find((doc) => doc.blockType === layoutKey);
  return (match ?? blocks[0])?._id ?? '';
}
