import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { on } from '@ember/modifier';
import { eq } from '@ember/helper';
import { htmlSafe } from '@ember/template';
import FlowNode from 'emberjs/components/flow-node';
import FlowEdge from 'emberjs/components/flow-edge';
import NodePopover from 'emberjs/components/node-popover';
import measure from 'emberjs/modifiers/measure';
import { bezierPath, EDGE_PLANE } from 'emberjs/utils/flow-geometry';
import { DND_TYPE, GRID, NODE_WIDTH } from 'emberjs/utils/node-types';

const PLANE_HALF = EDGE_PLANE / 2;

/**
 * 캔버스. 모든 포인터 상호작용이 여기 한 곳에 모여 있습니다.
 *
 * 노드/포트 각각에 리스너를 다는 대신, pointerdown 을 캔버스에서 한 번 받고
 * event.target.closest('[data-…]') 로 무엇을 눌렀는지 판별합니다.
 * 노드가 100개여도 리스너는 여전히 하나입니다.
 */
export default class FlowCanvas extends Component {
  @service flow;

  /** 연결선을 끌고 있는 중의 상태: { fromId, port, x, y, targetId } */
  @tracked draft = null;

  /** 'pan' | 'node' | 'connect' — 커서 모양에만 씁니다. */
  @tracked cursorMode = null;

  get viewport() {
    return this.flow.viewport;
  }

  // ── 렌더링용 파생 상태 ──────────────────────────────────────────────

  get contentStyle() {
    const { x, y, zoom } = this.viewport;
    return htmlSafe(`transform: translate(${x}px, ${y}px) scale(${zoom});`);
  }

  /** 배경 격자도 뷰포트를 따라 움직여야 실제로 움직인다는 느낌이 납니다. */
  get gridStyle() {
    const { x, y, zoom } = this.viewport;
    const size = 20 * zoom;
    return htmlSafe(
      `background-size: ${size}px ${size}px; background-position: ${x}px ${y}px;`,
    );
  }

  planeSize = EDGE_PLANE;
  planeViewBox = `${-PLANE_HALF} ${-PLANE_HALF} ${EDGE_PLANE} ${EDGE_PLANE}`;
  planeStyle = htmlSafe(`left: ${-PLANE_HALF}px; top: ${-PLANE_HALF}px;`);

  get selectedNodeId() {
    return this.flow.selection?.kind === 'node' ? this.flow.selection.id : null;
  }

  get selectedEdgeId() {
    return this.flow.selection?.kind === 'edge' ? this.flow.selection.id : null;
  }

  /** 양쪽 노드를 미리 해석해 둡니다 — 한쪽이 사라진 엣지는 그리지 않습니다. */
  get renderableEdges() {
    return this.flow.edges
      .map((edge) => ({
        edge,
        from: this.flow.nodeById(edge.from),
        to: this.flow.nodeById(edge.to),
      }))
      .filter((item) => item.from && item.to);
  }

  get draftPath() {
    if (!this.draft) return null;
    const from = this.flow.nodeById(this.draft.fromId);
    if (!from) return null;
    return bezierPath(from.portPosition(this.draft.port), {
      x: this.draft.x,
      y: this.draft.y,
    });
  }

  get zoomLabel() {
    return `${Math.round(this.viewport.zoom * 100)}%`;
  }

  /** 팝오버는 캔버스 좌표가 필요해서 다른 모드와 달리 여기서 그립니다. */
  get isPopoverMode() {
    return this.flow.panelMode === 'popover';
  }

  get cursorClass() {
    return { pan: 'is-panning', node: 'is-moving', connect: 'is-connecting' }[
      this.cursorMode
    ];
  }

  #fitted = false;

  setViewportSize = (height, width) => {
    this.viewport.height = height;
    this.viewport.width = width;

    // 캔버스 크기를 처음 알게 된 직후 한 번만 전체 보기로 맞춥니다.
    // 노드 높이 측정이 끝난 다음 프레임에 실행해야 정확히 맞습니다.
    if (!this.#fitted && width > 0 && this.flow.nodes.length) {
      this.#fitted = true;
      requestAnimationFrame(() => this.viewport.fit(this.flow.nodes));
    }
  };

  // ── 포인터 ──────────────────────────────────────────────────────────

  onPointerDown = (event) => {
    if (event.button !== 0) return;
    const canvas = event.currentTarget;

    // 캔버스 위에 떠 있는 UI(줌 툴바 등)는 드래그 대상이 아닙니다.
    // 여기서 걸러내지 않으면 아래의 preventDefault 가 click 이벤트까지 막아버립니다.
    if (event.target.closest?.('[data-canvas-ui]')) return;

    const portEl = event.target.closest?.('[data-port]');
    if (portEl) {
      const nodeEl = portEl.closest('[data-node-id]');
      this.#beginConnect(
        event,
        canvas,
        nodeEl.dataset.nodeId,
        portEl.dataset.port,
      );
      return;
    }

    const nodeEl = event.target.closest?.('[data-node-id]');
    if (nodeEl) {
      this.#beginNodeDrag(event, canvas, nodeEl.dataset.nodeId);
      return;
    }

    const edgeEl = event.target.closest?.('[data-edge-id]');
    if (edgeEl) {
      this.flow.select('edge', edgeEl.dataset.edgeId);
      return;
    }

    this.flow.clearSelection();
    this.#beginPan(event, canvas);
  };

  /**
   * 드래그 공통 루프. 포인터를 캔버스에 캡처해 두면 커서가 캔버스 밖으로 나가도
   * pointermove 가 계속 들어옵니다 (창 밖으로 나가도 드래그가 끊기지 않음).
   */
  #beginDrag(event, canvas, handlers) {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return;
      handlers.move(moveEvent);
    };

    const onFinish = (endEvent) => {
      if (endEvent.pointerId !== event.pointerId) return;
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onFinish);
      canvas.removeEventListener('pointercancel', onFinish);
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      handlers.end?.(endEvent);
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onFinish);
    canvas.addEventListener('pointercancel', onFinish);
  }

  #beginNodeDrag(event, canvas, nodeId) {
    const node = this.flow.nodeById(nodeId);
    if (!node) return;

    this.flow.select('node', nodeId);
    this.cursorMode = 'node';

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = node.x;
    const originY = node.y;
    let moved = false;

    this.#beginDrag(event, canvas, {
      move: (moveEvent) => {
        // 화면 픽셀 이동량을 zoom 으로 나눠 플로우 좌표 이동량으로 환산합니다.
        const zoom = this.viewport.zoom;
        const nextX = originX + (moveEvent.clientX - startX) / zoom;
        const nextY = originY + (moveEvent.clientY - startY) / zoom;
        // Alt 를 누르고 있으면 격자 스냅을 끕니다.
        node.moveTo(
          moveEvent.altKey ? nextX : snap(nextX),
          moveEvent.altKey ? nextY : snap(nextY),
        );
        moved = true;
      },
      end: () => {
        this.cursorMode = null;
        if (moved) this.flow.persist();
      },
    });
  }

  #beginPan(event, canvas) {
    this.cursorMode = 'pan';

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = this.viewport.x;
    const originY = this.viewport.y;

    this.#beginDrag(event, canvas, {
      move: (moveEvent) => {
        this.viewport.x = originX + (moveEvent.clientX - startX);
        this.viewport.y = originY + (moveEvent.clientY - startY);
      },
      end: () => {
        this.cursorMode = null;
      },
    });
  }

  #beginConnect(event, canvas, fromId, port) {
    this.cursorMode = 'connect';
    const rect = canvas.getBoundingClientRect();
    const start = this.viewport.toFlow(
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    this.draft = { fromId, port, x: start.x, y: start.y, targetId: null };

    this.#beginDrag(event, canvas, {
      move: (moveEvent) => {
        const point = this.viewport.toFlow(
          moveEvent.clientX - rect.left,
          moveEvent.clientY - rect.top,
        );
        // 포트라는 작은 과녁 대신 노드 전체를 드롭 영역으로 씁니다.
        const hovered = document
          .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
          ?.closest('[data-node-id]');
        const candidate = hovered?.dataset.nodeId ?? null;

        this.draft = {
          ...this.draft,
          x: point.x,
          y: point.y,
          targetId: this.flow.canConnectTo(fromId, candidate)
            ? candidate
            : null,
        };
      },
      end: () => {
        if (this.draft?.targetId) {
          this.flow.connect(fromId, port, this.draft.targetId);
        }
        this.draft = null;
        this.cursorMode = null;
      },
    });
  }

  onWheel = (event) => {
    // 팝오버·인라인 폼 위에서는 캔버스가 휠을 가로채지 않고 그대로 스크롤되게 둡니다.
    if (event.target.closest?.('[data-canvas-ui]')) return;

    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    if (event.ctrlKey || event.metaKey) {
      // 트랙패드 핀치와 Ctrl+휠은 커서 지점을 고정한 채 확대/축소.
      // 계수 0.002 = 일반 휠 한 칸(deltaY 120)에 약 1.27배.
      this.viewport.zoomTo(
        this.viewport.zoom * Math.exp(-event.deltaY * 0.002),
        pointerX,
        pointerY,
      );
    } else {
      this.viewport.panBy(-event.deltaX, -event.deltaY);
    }
  };

  // ── 팔레트에서 끌어다 놓기 ──────────────────────────────────────────

  onDragOver = (event) => {
    if (!Array.from(event.dataTransfer.types).includes(DND_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  onDrop = (event) => {
    const type = event.dataTransfer.getData(DND_TYPE);
    if (!type) return;
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const point = this.viewport.toFlow(
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    // 커서가 노드의 가운데 위쪽에 오도록 보정
    this.flow.addNode(type, point.x - NODE_WIDTH / 2, point.y - 40);
  };

  // ── 줌 컨트롤 ───────────────────────────────────────────────────────

  zoomIn = () => this.viewport.zoomBy(1.2);
  zoomOut = () => this.viewport.zoomBy(1 / 1.2);
  fitView = () => this.viewport.fit(this.flow.nodes);
  resetZoom = () => this.viewport.zoomTo(1);

  <template>
    {{! 드래그의 시작점을 잡아야 하므로 pointerdown 이 필수입니다.
        pointerup 으로는 "끌기"라는 동작 자체를 표현할 수 없습니다. }}
    {{! template-lint-disable no-pointer-down-event-binding }}
    <div
      class="flow-canvas {{this.cursorClass}}"
      style={{this.gridStyle}}
      {{measure this.setViewportSize}}
      {{on "pointerdown" this.onPointerDown}}
      {{on "wheel" this.onWheel passive=false}}
      {{on "dragover" this.onDragOver}}
      {{on "drop" this.onDrop}}
    >
      <div class="flow-canvas__content" style={{this.contentStyle}}>
        <svg
          class="flow-canvas__edges"
          width={{this.planeSize}}
          height={{this.planeSize}}
          viewBox={{this.planeViewBox}}
          style={{this.planeStyle}}
        >
          <defs>
            <marker
              id="flow-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="context-stroke" />
            </marker>
          </defs>

          {{#each this.renderableEdges key="edge.id" as |item|}}
            <FlowEdge
              @edge={{item.edge}}
              @from={{item.from}}
              @to={{item.to}}
              @selected={{eq this.selectedEdgeId item.edge.id}}
            />
          {{/each}}

          {{#if this.draftPath}}
            <path class="flow-canvas__draft" d={{this.draftPath}} />
          {{/if}}
        </svg>

        {{#each this.flow.nodes key="id" as |node|}}
          <FlowNode
            @node={{node}}
            @selected={{eq this.selectedNodeId node.id}}
            @draftTargetId={{this.draft.targetId}}
          />
        {{/each}}
      </div>

      {{#if this.isPopoverMode}}
        <NodePopover />
      {{/if}}

      <div class="flow-zoom" data-canvas-ui>
        <button
          type="button"
          title="축소"
          {{on "click" this.zoomOut}}
        >−</button>
        <button
          type="button"
          class="flow-zoom__level"
          title="100%로"
          {{on "click" this.resetZoom}}
        >
          {{this.zoomLabel}}
        </button>
        <button type="button" title="확대" {{on "click" this.zoomIn}}>+</button>
        <span class="flow-zoom__sep"></span>
        <button
          type="button"
          title="전체 보기"
          {{on "click" this.fitView}}
        >⤢</button>
      </div>

      <p class="flow-canvas__hint">
        빈 곳 드래그 = 이동 · Ctrl/⌘+휠 = 확대 · 포트를 끌어 연결
      </p>
    </div>
  </template>
}

function snap(value) {
  return Math.round(value / GRID) * GRID;
}
