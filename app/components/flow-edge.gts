import Component from '@glimmer/component';
import { bezierPath, type Point } from 'emberjs/utils/flow-geometry';
import type { FlowEdge, FlowNode } from 'emberjs/utils/flow-graph';

export interface FlowEdgeSignature {
  Element: SVGGElement;
  Args: {
    edge: FlowEdge;
    from: FlowNode;
    to: FlowNode;
    /** 현재 선택된 엣지 id. 비교는 이 컴포넌트가 합니다. */
    selectedId?: string | null;
  };
}

/**
 * 두 노드를 잇는 한 개의 연결선.
 *
 * source/target 은 노드의 x/y/height(@tracked)를 읽기 때문에, 노드를 드래그하면
 * 이 getter들이 무효화되면서 경로가 자동으로 다시 계산됩니다.
 * 수동으로 "엣지 다시 그리기" 같은 걸 호출할 필요가 없습니다.
 */
export default class FlowEdgeComponent extends Component<FlowEdgeSignature> {
  get source(): Point {
    return this.args.from.portPosition(this.args.edge.port);
  }

  get target(): Point {
    return this.args.to.inputPosition;
  }

  get path(): string {
    return bezierPath(this.source, this.target);
  }

  get selected(): boolean {
    return this.args.selectedId === this.args.edge.id;
  }

  <template>
    <g
      class="flow-edge {{if this.selected 'is-selected'}}"
      data-edge-id={{@edge.id}}
    >
      {{! 실제 선은 얇지만, 클릭은 어려우므로 투명한 두꺼운 선을 겹쳐 둡니다. }}
      <path class="flow-edge__hit" d={{this.path}} />
      <path
        class="flow-edge__line"
        d={{this.path}}
        marker-end="url(#flow-arrow)"
      />
    </g>
  </template>
}
