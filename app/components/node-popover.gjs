import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { htmlSafe } from '@ember/template';
import NodePanel from 'emberjs/components/node-panel';
import measure from 'emberjs/modifiers/measure';
import { clamp } from 'emberjs/utils/flow-geometry';

const GAP = 14;
const EDGE_PAD = 8;

/**
 * 뒤집기 판단 기준. 측정 높이가 아니라 고정값을 쓰는 이유:
 * max-height 로 높이를 깎으면 측정 높이가 줄고, 그걸 다시 판단에 넣으면
 * 뒤집힘 ↔ 안 뒤집힘이 번갈아 나오며 진동할 수 있습니다.
 */
const PREFERRED_HEIGHT = 260;
const MIN_HEIGHT = 180;

/**
 * 선택한 노드에 붙어 다니는 팝오버.
 *
 * 캔버스 안(.flow-canvas)에 놓되 변환되는 래퍼 바깥에 둡니다 — 같이 scale 되면
 * 축소했을 때 글자까지 작아지기 때문입니다. 대신 노드의 플로우 좌표를 뷰포트
 * 변환으로 직접 화면 좌표로 바꿔 배치합니다.
 *
 * node.x/y/height 와 viewport.x/y/zoom 이 전부 @tracked 라서, 노드를 끌거나
 * 캔버스를 이동/확대하면 팝오버가 알아서 따라옵니다.
 */
export default class NodePopover extends Component {
  @service flow;

  /** 가로 클램프에 실제 폭이 필요해서 측정합니다. */
  @tracked width = 300;

  get isOpen() {
    return this.flow.selection?.kind === 'node';
  }

  /** 닫히는 동안 내용이 먼저 비지 않도록 직전 선택을 남겨 둡니다. */
  get shown() {
    const selection = this.flow.selection ?? this.flow.lastSelection;
    return selection?.kind === 'node' ? selection : null;
  }

  get node() {
    return this.shown ? this.flow.nodeById(this.shown.id) : null;
  }

  get placement() {
    const node = this.node;
    const viewport = this.flow.viewport;
    if (!node || !viewport.width) return null;

    const { zoom } = viewport;
    const centerX = (node.x + node.width / 2) * zoom + viewport.x;
    const nodeTop = node.y * zoom + viewport.y;
    const nodeBottom = (node.y + node.height) * zoom + viewport.y;

    const spaceBelow = viewport.height - nodeBottom - GAP - EDGE_PAD;
    const spaceAbove = nodeTop - GAP - EDGE_PAD;

    // 아래가 좁고 위가 더 넓으면 뒤집습니다.
    const flip = spaceBelow < PREFERRED_HEIGHT && spaceAbove > spaceBelow;
    // 어느 쪽에도 충분치 않으면 넘치게 두지 말고 남은 만큼으로 잘라 스크롤시킵니다.
    const available = Math.max(MIN_HEIGHT, flip ? spaceAbove : spaceBelow);

    // 뒤집힌 쪽은 bottom 으로 고정합니다. top 으로 잡으면 내용이 짧을 때
    // 팝오버가 노드에서 떨어져 붕 뜹니다.
    const vertical = flip
      ? `bottom: ${Math.round(viewport.height - nodeTop + GAP)}px;`
      : `top: ${Math.round(nodeBottom + GAP)}px;`;
    const left = clamp(
      centerX - this.width / 2,
      EDGE_PAD,
      Math.max(EDGE_PAD, viewport.width - this.width - EDGE_PAD),
    );

    return {
      flip,
      // 좌우로 밀렸더라도 꼬리는 계속 노드를 가리키게 합니다.
      style: htmlSafe(
        `left: ${Math.round(left)}px; ${vertical}` +
          ` max-height: ${Math.round(available)}px;` +
          ` --arrow-x: ${Math.round(clamp(centerX - left, 18, this.width - 18))}px;`,
      ),
    };
  }

  setSize = (height, width) => {
    if (Math.abs(this.width - width) > 0.5) this.width = width;
  };

  close = () => this.flow.clearSelection();

  <template>
    {{#if this.placement}}
      <aside
        class="shell-popover
          {{if this.isOpen 'is-open'}}
          {{if this.placement.flip 'is-flipped'}}"
        style={{this.placement.style}}
        aria-label="선택한 노드 설정"
        data-canvas-ui
        {{measure this.setSize}}
      >
        <NodePanel @node={{this.node}} @onClose={{this.close}} />
      </aside>
    {{/if}}
  </template>
}
