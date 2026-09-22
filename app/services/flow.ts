import Service from '@ember/service';
import type Owner from '@ember/owner';
import { tracked } from '@glimmer/tracking';
import {
  FlowEdge,
  FlowNode,
  seedGraph,
  uid,
  type SerializedEdge,
  type SerializedNode,
} from 'emberjs/utils/flow-graph';
import { Viewport } from 'emberjs/utils/flow-geometry';
import {
  GRID,
  NODE_WIDTH,
  isNodeType,
  type NodeType,
} from 'emberjs/utils/node-types';
import {
  DEFAULT_PANEL_MODE,
  isPanelMode,
  type PanelMode,
} from 'emberjs/utils/panel-modes';

const STORAGE_KEY = 'emberjs:flow-builder:v1';

/** 설정 패널 표시 방식은 문서가 아니라 사용자 취향이라 따로 저장합니다. */
const MODE_KEY = 'emberjs:flow-builder:panel-mode';

export type SelectionKind = 'node' | 'edge';

export interface Selection {
  kind: SelectionKind;
  id: string;
}

export interface Issue {
  id: string;
  level: 'error' | 'warn';
  message: string;
  nodeId?: string;
}

export interface SerializedGraph {
  version: number;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
}

/**
 * 플로우 문서 전체의 단일 소스.
 *
 * 컴포넌트는 여기에 있는 상태를 읽고 액션을 호출하기만 합니다.
 * 그래프 규칙(자기 연결 금지, 출력 포트당 1개 등)은 전부 이 안에 있습니다.
 */
export default class FlowService extends Service {
  @tracked nodes: FlowNode[] = [];
  @tracked edges: FlowEdge[] = [];

  @tracked selection: Selection | null = null;

  /**
   * 마지막으로 선택했던 대상. selection 과 달리 해제해도 비우지 않습니다.
   * 드로어가 닫히는 애니메이션 동안 내용이 먼저 사라져 깜빡이는 걸 막습니다.
   */
  @tracked lastSelection: Selection | null = null;

  /** 직렬화 후 보여줄 JSON (모달). null이면 닫힘. */
  @tracked exported: string | null = null;

  @tracked panelMode: PanelMode = DEFAULT_PANEL_MODE;

  viewport = new Viewport();

  #saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(owner: Owner) {
    super(owner);
    this.load();
    this.loadPanelMode();
  }

  // ── 패널 표시 방식 ──────────────────────────────────────────────────

  setPanelMode(mode: string): void {
    if (!isPanelMode(mode)) return;
    this.panelMode = mode;
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // 저장이 막혀도 이번 세션 동안은 바뀐 모드로 씁니다.
    }
  }

  loadPanelMode(): void {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(MODE_KEY);
    } catch {
      stored = null;
    }
    if (isPanelMode(stored)) this.panelMode = stored;
  }

  // ── 조회 ────────────────────────────────────────────────────────────

  nodeById(id: string | null | undefined): FlowNode | null {
    if (!id) return null;
    return this.nodes.find((node) => node.id === id) ?? null;
  }

  edgeById(id: string | null | undefined): FlowEdge | null {
    if (!id) return null;
    return this.edges.find((edge) => edge.id === id) ?? null;
  }

  get selectedNode(): FlowNode | null {
    return this.selection?.kind === 'node'
      ? this.nodeById(this.selection.id)
      : null;
  }

  get selectedEdge(): FlowEdge | null {
    return this.selection?.kind === 'edge'
      ? this.edgeById(this.selection.id)
      : null;
  }

  outgoing(nodeId: string): FlowEdge[] {
    return this.edges.filter((edge) => edge.from === nodeId);
  }

  isPortConnected(nodeId: string, port: string): boolean {
    return this.edges.some(
      (edge) => edge.from === nodeId && edge.port === port,
    );
  }

  /** 해당 노드가 연결을 받을 수 있는지 (드래그 중 하이라이트 판단에도 사용) */
  canConnectTo(
    fromId: string | null | undefined,
    toId: string | null | undefined,
  ): boolean {
    if (!fromId || !toId || fromId === toId) return false;
    return Boolean(this.nodeById(toId)?.def.hasInput);
  }

  // ── 편집 ────────────────────────────────────────────────────────────

  addNode(type: string, x: number, y: number): FlowNode | null {
    if (!isNodeType(type)) return null;

    const node = new FlowNode({ type, x: snap(x), y: snap(y) });
    this.nodes = [...this.nodes, node];
    this.select('node', node.id);
    this.persist();
    return node;
  }

  /** 팔레트 클릭으로 추가할 때: 현재 보이는 영역 한가운데에 놓습니다. */
  addNodeAtCenter(type: NodeType): FlowNode | null {
    const center = this.viewport.center;
    return this.addNode(type, center.x - NODE_WIDTH / 2, center.y - 52);
  }

  removeNode(id: string): void {
    const node = this.nodeById(id);
    if (!node || !node.def.removable) return;

    this.nodes = this.nodes.filter((candidate) => candidate.id !== id);
    this.edges = this.edges.filter(
      (edge) => edge.from !== id && edge.to !== id,
    );
    if (this.selection?.id === id) this.selection = null;
    this.persist();
  }

  /**
   * 연결을 만듭니다. 출력 포트 하나당 나가는 연결은 최대 1개이므로
   * 같은 포트에 이미 연결이 있으면 새 것으로 교체합니다.
   */
  connect(fromId: string, port: string, toId: string): FlowEdge | null {
    if (!this.canConnectTo(fromId, toId)) return null;

    const duplicate = this.edges.some(
      (edge) => edge.from === fromId && edge.port === port && edge.to === toId,
    );
    if (duplicate) return null;

    const kept = this.edges.filter(
      (edge) => !(edge.from === fromId && edge.port === port),
    );
    const edge = new FlowEdge({ from: fromId, port, to: toId });
    this.edges = [...kept, edge];
    this.persist();
    return edge;
  }

  removeEdge(id: string): void {
    this.edges = this.edges.filter((edge) => edge.id !== id);
    if (this.selection?.kind === 'edge' && this.selection.id === id) {
      this.selection = null;
    }
    this.persist();
  }

  updateNodeData(
    node: FlowNode | null,
    key: string,
    value: string | number,
  ): void {
    if (!node) return;
    node.update(key, value);
    this.persist();
  }

  // ── 선택 ────────────────────────────────────────────────────────────

  select(kind: SelectionKind, id: string): void {
    this.selection = { kind, id };
    this.lastSelection = this.selection;
  }

  clearSelection(): void {
    this.selection = null;
  }

  deleteSelection(): void {
    if (this.selection?.kind === 'node') this.removeNode(this.selection.id);
    else if (this.selection?.kind === 'edge') {
      this.removeEdge(this.selection.id);
    }
  }

  /** 검증 목록에서 항목을 눌렀을 때: 선택하고 화면 가운데로 옮깁니다. */
  focusNode(id: string): void {
    const node = this.nodeById(id);
    if (!node) return;
    this.select('node', id);
    this.viewport.centerOn(node);
  }

  // ── 검증 ────────────────────────────────────────────────────────────

  get issues(): Issue[] {
    const issues: Issue[] = [];
    const starts = this.nodes.filter((node) => node.type === 'start');

    if (starts.length === 0) {
      issues.push({
        id: 'no-start',
        level: 'error',
        message: '시작 노드가 없습니다.',
      });
    } else if (starts.length > 1) {
      issues.push({
        id: 'many-starts',
        level: 'error',
        message: `시작 노드가 ${starts.length}개입니다. 하나만 두세요.`,
      });
    }

    // 시작점에서 도달 가능한 노드 수집 (BFS)
    const reachable = new Set<string>();
    const queue = starts.map((node) => node.id);
    while (queue.length) {
      const id = queue.shift();
      if (!id || reachable.has(id)) continue;
      reachable.add(id);
      for (const edge of this.edges) {
        if (edge.from === id) queue.push(edge.to);
      }
    }

    for (const node of this.nodes) {
      if (node.type !== 'start' && !reachable.has(node.id)) {
        issues.push({
          id: `unreachable-${node.id}`,
          level: 'warn',
          nodeId: node.id,
          message: `"${node.title}"에 도달할 수 없습니다.`,
        });
      }

      for (const port of node.def.outputs) {
        if (this.isPortConnected(node.id, port.key)) continue;
        const where = port.label
          ? `${node.title}의 "${port.label}"`
          : node.title;
        issues.push({
          id: `open-${node.id}-${port.key}`,
          level: 'warn',
          nodeId: node.id,
          message: `${where} 출구가 연결되지 않았습니다.`,
        });
      }

      for (const field of node.def.fields) {
        if (!field.required) continue;
        const value = (node.data as Record<string, unknown>)[field.key];
        if (
          value === undefined ||
          value === null ||
          String(value).trim() === ''
        ) {
          issues.push({
            id: `empty-${node.id}-${field.key}`,
            level: 'error',
            nodeId: node.id,
            message: `"${node.title}"의 ${field.label}이(가) 비어 있습니다.`,
          });
        }
      }
    }

    return issues;
  }

  get errorCount(): number {
    return this.issues.filter((issue) => issue.level === 'error').length;
  }

  // ── 직렬화 / 저장 ───────────────────────────────────────────────────

  toJSON(): SerializedGraph {
    return {
      version: 1,
      nodes: this.nodes.map((node) => node.toJSON()),
      edges: this.edges.map((edge) => edge.toJSON()),
    };
  }

  /**
   * 저장은 debounce 합니다. 드래그 중에는 pointermove 마다 좌표가 바뀌므로
   * 매번 직렬화하면 낭비입니다.
   */
  persist(): void {
    if (this.#saveTimer) clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = null;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.toJSON()));
      } catch {
        // 시크릿 모드 등에서 저장이 막혀도 편집은 계속 되어야 합니다.
      }
    }, 250);
  }

  load(): void {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<SerializedGraph>;
        const nodes = (parsed.nodes ?? [])
          .filter((data) => isNodeType(data.type))
          .map((data) => new FlowNode(data));
        const ids = new Set(nodes.map((node) => node.id));
        // 노드가 사라진 엣지는 버립니다 (손상된 저장본 방어).
        const edges = (parsed.edges ?? [])
          .filter((edge) => ids.has(edge.from) && ids.has(edge.to))
          .map((data) => new FlowEdge(data));

        this.nodes = nodes;
        this.edges = edges;
        return;
      } catch {
        // 형식이 깨졌으면 예시 플로우로 되돌립니다.
      }
    }

    this.reset();
  }

  reset(): void {
    const { nodes, edges } = seedGraph();
    this.nodes = nodes;
    this.edges = edges;
    this.selection = null;
    this.persist();
  }

  clear(): void {
    const start = new FlowNode({ type: 'start', x: 320, y: 120 });
    this.nodes = [start];
    this.edges = [];
    this.selection = null;
    this.persist();
  }

  duplicateNode(id: string): void {
    const source = this.nodeById(id);
    if (!source) return;
    const copy = new FlowNode({
      id: uid('node'),
      type: source.type,
      x: source.x + 40,
      y: source.y + 40,
      data: { ...source.data },
    });
    this.nodes = [...this.nodes, copy];
    this.select('node', copy.id);
    this.persist();
  }

  // ── JSON 보기 ───────────────────────────────────────────────────────

  showExport(): void {
    this.exported = JSON.stringify(this.toJSON(), null, 2);
  }

  hideExport(): void {
    this.exported = null;
  }
}

function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

declare module '@ember/service' {
  interface Registry {
    flow: FlowService;
  }
}
