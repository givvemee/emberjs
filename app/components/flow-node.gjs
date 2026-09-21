import Component from '@glimmer/component';
import { service } from '@ember/service';
import { htmlSafe } from '@ember/template';
import measure from 'emberjs/modifiers/measure';

/**
 * 캔버스 위의 노드 박스.
 *
 * 포인터 이벤트는 여기서 처리하지 않습니다 — 드래그/연결/선택은 모두 부모인
 * FlowCanvas 가 data-* 속성을 보고 한 곳에서 처리합니다.
 * 이 컴포넌트는 "어떻게 보이는지"만 책임집니다.
 */
export default class FlowNodeComponent extends Component {
  @service flow;

  get style() {
    const { x, y, width } = this.args.node;
    return htmlSafe(`transform: translate(${x}px, ${y}px); width: ${width}px;`);
  }

  get themeStyle() {
    const { accent, tint } = this.args.node.def;
    return htmlSafe(`--accent: ${accent}; --tint: ${tint};`);
  }

  get ports() {
    const { id } = this.args.node;
    return this.args.node.outputPorts.map((port) => ({
      ...port,
      connected: this.flow.isPortConnected(id, port.key),
    }));
  }

  /** 연결을 드래그해 오는 중이고, 이 노드가 유효한 도착지일 때 */
  get isDropTarget() {
    return this.args.draftTargetId === this.args.node.id;
  }

  setSize = (height) => {
    // 실제 변화가 있을 때만 씁니다. 같은 값을 다시 쓰면 불필요한 리렌더가 생깁니다.
    if (Math.abs(this.args.node.height - height) > 0.5) {
      this.args.node.height = height;
    }
  };

  <template>
    <div
      class="flow-node flow-node--{{@node.type}}
        {{if @selected 'is-selected'}}
        {{if this.isDropTarget 'is-drop-target'}}"
      data-node-id={{@node.id}}
      style={{this.style}}
    >
      <div
        class="flow-node__frame"
        style={{this.themeStyle}}
        {{measure this.setSize}}
      >
        {{#if @node.def.hasInput}}
          <span class="flow-port flow-port--in" data-port-in>
            <span class="flow-port__dot"></span>
          </span>
        {{/if}}

        <header class="flow-node__head">
          <span class="flow-node__icon">{{@node.def.icon}}</span>
          <span class="flow-node__title">{{@node.def.label}}</span>
        </header>

        <p class="flow-node__summary">{{@node.summary}}</p>

        {{#each this.ports key="key" as |port|}}
          <span
            class="flow-port flow-port--out
              {{if port.connected 'is-connected'}}"
            data-port={{port.key}}
            style={{port.style}}
            title="여기를 끌어서 다음 노드에 연결하세요"
          >
            <span class="flow-port__dot"></span>
            {{#if port.label}}
              <span class="flow-port__label">{{port.label}}</span>
            {{/if}}
          </span>
        {{/each}}
      </div>
    </div>
  </template>
}
