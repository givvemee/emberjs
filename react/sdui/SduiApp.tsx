import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type CSSProperties,
} from 'react';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type IsValidConnection,
  type NodeTypes,
  type XYPosition,
} from '@xyflow/react';
import {
  currentLayout,
  deriveBlocks,
  deriveEdges,
  initialState,
  originalLayout,
  scenarioReducer,
  type ScenarioPayload,
} from 'emberjs/utils/sdui/scenario';
import {
  ScenarioContext,
  useScenario,
  type ScenarioContextValue,
} from './context';
import { SduiNode, type SduiFlowNode } from './SduiNode';
import { Inspector } from './Inspector';
import type { Navigate } from './navigate';

export interface SduiAppProps {
  payload: ScenarioPayload;
  /** 다른 화면으로. 라우팅은 Ember 가 하므로 바깥에서 받습니다. */
  navigate: Navigate;
}

// 렌더마다 새 객체를 넘기면 xyflow 가 경고하고 노드를 다시 만듭니다.
const NODE_TYPES: NodeTypes = { sdui: SduiNode };

const EDITABLE = ['INPUT', 'TEXTAREA', 'SELECT'];

function toFlowNodes(payload: ScenarioPayload): SduiFlowNode[] {
  return payload.blocks.map((doc) => ({
    id: doc._id,
    type: 'sdui',
    position: {
      x: Number(doc.editorData.x) || 0,
      y: Number(doc.editorData.y) || 0,
    },
    data: {},
    // 블록 추가·삭제는 이 예시의 범위 밖입니다. 연결만 편집합니다.
    deletable: false,
  }));
}

export function SduiApp(props: SduiAppProps) {
  return (
    <ReactFlowProvider>
      <Workspace {...props} />
    </ReactFlowProvider>
  );
}

/**
 * 상태는 두 갈래입니다.
 *
 * - 시나리오(블록 문서 + 레이아웃): useReducer. 순수 TS 인 scenarioReducer 를 씁니다.
 * - 노드 위치·선택: xyflow 의 useNodesState.
 *
 * 연결선(edges)은 상태가 아닙니다. 블록 문서의 next 값에서 매번 계산합니다.
 * 캔버스에서 선을 잇거나 끊으면 문서의 next 를 바꾸고, 선은 따라서 다시 그려집니다.
 */
function Workspace({ payload, navigate }: SduiAppProps) {
  const [state, dispatch] = useReducer(scenarioReducer, payload, initialState);
  const [nodes, setNodes, onNodesChange] = useNodesState(
    useMemo(() => toFlowNodes(payload), [payload]),
  );
  const [selectedEdges, setSelectedEdges] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const { fitView } = useReactFlow();

  const blocks = useMemo(() => deriveBlocks(state), [state]);
  const blockById = useMemo(
    () => new Map(blocks.map((block) => [block.id, block])),
    [blocks],
  );
  const dataEdges = useMemo(() => deriveEdges(blocks), [blocks]);

  const context = useMemo<ScenarioContextValue>(
    () => ({
      state,
      dispatch,
      blocks,
      blockById,
      original: {
        docs: Object.fromEntries(payload.blocks.map((doc) => [doc._id, doc])),
        layouts: payload.layouts,
      },
    }),
    [state, blocks, blockById, payload],
  );

  const selectedNode = nodes.find((node) => node.selected);
  const selectedId = selectedNode?.id ?? null;

  const edges = useMemo<Edge[]>(
    () =>
      dataEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: edge.target,
        selected: selectedEdges.has(edge.id),
        // 템플릿이 복잡해 되짚을 경로가 없으면 캔버스에서 끊을 수 없습니다.
        deletable: edge.targetPath !== null,
        markerEnd: { type: MarkerType.ArrowClosed },
        className:
          edge.source === selectedId || edge.target === selectedId
            ? 'is-active'
            : undefined,
      })),
    [dataEdges, selectedEdges, selectedId],
  );

  /** 출구(source handle)의 next 를 바꿉니다. 빈 문자열이면 연결 해제. */
  const setTarget = useCallback(
    (source: string, handle: string | null | undefined, target: string) => {
      const port = blockById
        .get(source)
        ?.ports.find((candidate) => candidate.key === handle);
      if (!port?.targetPath) return;
      dispatch({
        type: 'set',
        id: source,
        path: port.targetPath,
        value: target,
      });
    },
    [blockById],
  );

  const onConnect = useCallback(
    (connection: Connection) =>
      setTarget(connection.source, connection.sourceHandle, connection.target),
    [setTarget],
  );

  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => connection.source !== connection.target,
    [],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'select') {
          setSelectedEdges((current) => {
            const next = new Set(current);
            if (change.selected) next.add(change.id);
            else next.delete(change.id);
            return next;
          });
        } else if (change.type === 'remove') {
          const edge = dataEdges.find(
            (candidate) => candidate.id === change.id,
          );
          if (edge) setTarget(edge.source, edge.sourceHandle, '');
          setSelectedEdges((current) => {
            const next = new Set(current);
            next.delete(change.id);
            return next;
          });
        }
      }
    },
    [dataEdges, setTarget],
  );

  const select = useCallback(
    (id: string | null) =>
      setNodes((current) =>
        current.map((node) =>
          node.selected === (node.id === id)
            ? node
            : { ...node, selected: node.id === id },
        ),
      ),
    [setNodes],
  );

  const focus = useCallback(
    (id: string) => {
      select(id);
      void fitView({ nodes: [{ id }], duration: 300, maxZoom: 1 });
    },
    [select, fitView],
  );

  const moveNode = useCallback(
    (id: string, position: XYPosition) =>
      setNodes((current) =>
        current.map((node) => (node.id === id ? { ...node, position } : node)),
      ),
    [setNodes],
  );

  // Escape 로 선택 해제. 폼에 입력 중일 때는 가로채지 않습니다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target;
      if (target instanceof HTMLElement && EDITABLE.includes(target.tagName)) {
        return;
      }
      select(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [select]);

  const brokenCount = blocks.reduce(
    (sum, block) =>
      sum + block.ports.filter((port) => port.status === 'broken').length,
    0,
  );

  return (
    <ScenarioContext.Provider value={context}>
      <div className="builder">
        <header className="builder__bar">
          <div className="builder__brand">
            <button
              type="button"
              className="builder__home"
              title="워크스페이스로"
              onClick={() => navigate('index')}
            >
              ←
            </button>
            <span className="builder__logo">◫</span>
            <div>
              <h1>{payload.scenario.name}</h1>
              <p>
                블록 {blocks.length}개 · 연결 {edges.length}개
              </p>
            </div>
          </div>

          <div className="builder__tools">
            {brokenCount > 0 && (
              <span className="status status--warn">
                끊긴 출구 {brokenCount}개
              </span>
            )}
            <span className="status status--ok">
              레이아웃 v{payload.layouts.version}
            </span>
            <button
              type="button"
              className="btn"
              onClick={() => navigate('sdui-schema')}
            >
              스키마 콘솔 →
            </button>
          </div>
        </header>

        <div className="builder__body">
          <BlockList selectedId={selectedId} onFocus={focus} />

          <div className="sdui-flow">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              fitView
              fitViewOptions={{ padding: 0.12 }}
              minZoom={0.3}
              maxZoom={2}
            >
              <Background gap={20} />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) =>
                  blockById.get(node.id)?.layoutInUse.layout.accent ?? '#9aa2ae'
                }
              />
            </ReactFlow>
          </div>

          <Inspector
            selectedId={selectedId}
            position={selectedNode?.position}
            onMove={moveNode}
            onClose={() => select(null)}
          />
        </div>
      </div>
    </ScenarioContext.Provider>
  );
}

function BlockList({
  selectedId,
  onFocus,
}: {
  selectedId: string | null;
  onFocus: (id: string) => void;
}) {
  const { state, blocks, original } = useScenario();

  return (
    <aside className="panel panel--left">
      <div className="panel__section">
        <h2 className="panel__title">서버 주도 노드</h2>
        <p className="panel__caption">
          노드의 모양과 편집 폼은 클라이언트 코드에 없습니다. 서버가 블록
          데이터와 함께 blockType 별 레이아웃 스키마를 내려주고, 화면은 그
          스키마를 해석해서 그립니다.
        </p>
      </div>

      <div className="panel__section panel__section--grow">
        <h3 className="panel__subtitle">블록</h3>
        <ul className="sdui-blocks">
          {blocks.map((block) => {
            const { key, layout, isFallback } = block.layoutInUse;
            const layoutEdited =
              currentLayout(state, key) !==
              originalLayout(original.layouts, key);
            const theme = {
              '--accent': layout.accent,
              '--tint': layout.tint,
            } as CSSProperties;

            return (
              <li key={block.id}>
                <button
                  type="button"
                  className={`sdui-blocks__item${block.id === selectedId ? ' is-selected' : ''}`}
                  style={theme}
                  onClick={() => onFocus(block.id)}
                >
                  <span className="sdui-blocks__icon">{layout.icon}</span>
                  <span className="sdui-blocks__text">
                    <strong>{block.doc.name}</strong>
                    <small>{block.doc.blockType}</small>
                  </span>
                  {isFallback && (
                    <span className="sdui-tag sdui-tag--muted">대체</span>
                  )}
                  {block.doc !== original.docs[block.id] && (
                    <span className="sdui-tag sdui-tag--data">수정됨</span>
                  )}
                  {layoutEdited && <span className="sdui-tag">레이아웃</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
