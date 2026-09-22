import Component from '@glimmer/component';
import { service } from '@ember/service';
import { on } from '@ember/modifier';
import { htmlSafe } from '@ember/template';
import type { SafeString } from '@ember/template';
import NodeForm from 'emberjs/components/node-form';
import measure from 'emberjs/modifiers/measure';
import type FlowService from 'emberjs/services/flow';
import type { FlowNode, OutputPort } from 'emberjs/utils/flow-graph';

export interface FlowNodeSignature {
  Element: HTMLDivElement;
  Args: {
    node: FlowNode;
    /** 현재 선택된 노드 id. 비교는 이 컴포넌트가 합니다. */
    selectedId?: string | null;
    /** 연결 드래그 중 유효한 도착지로 지목된 노드 id */
    draftTargetId?: string | null;
  };
}

type RenderedPort = OutputPort & { connected: boolean };

/**
 * 캔버스 위의 노드 박스.
 *
 * 포인터 이벤트는 여기서 처리하지 않습니다 — 드래그/연결/선택은 모두 부모인
 * FlowCanvas 가 data-* 속성을 보고 한 곳에서 처리합니다.
 * 이 컴포넌트는 "어떻게 보이는지"만 책임집니다.
 *
 * 예외로 인라인 모드일 때는 노드 안에 설정 폼을 직접 펼칩니다.
 */
export default class FlowNodeComponent extends Component<FlowNodeSignature> {
  @service declare flow: FlowService;

  get selected(): boolean {
    return this.args.selectedId === this.args.node.id;
  }

  get style(): SafeString {
    const { x, y } = this.args.node;
    return htmlSafe(`transform: translate(${x}px, ${y}px);`);
  }

  get themeStyle(): SafeString {
    const { accent, tint } = this.args.node.def;
    return htmlSafe(`--accent: ${accent}; --tint: ${tint};`);
  }

  get ports(): RenderedPort[] {
    const { id } = this.args.node;
    return this.args.node.outputPorts.map((port) => ({
      ...port,
      connected: this.flow.isPortConnected(id, port.key),
    }));
  }

  /** 인라인 모드에서 이 노드가 선택되어 폼을 펼쳐야 하는지 */
  get isExpanded(): boolean {
    return this.flow.panelMode === 'inline' && this.selected;
  }

  /** 연결을 드래그해 오는 중이고, 이 노드가 유효한 도착지일 때 */
  get isDropTarget(): boolean {
    return this.args.draftTargetId === this.args.node.id;
  }

  get cannotRemove(): boolean {
    return !this.args.node.def.removable;
  }

  setSize = (height: number, width: number): void => {
    // 실제 변화가 있을 때만 씁니다. 같은 값을 다시 쓰면 불필요한 리렌더가 생깁니다.
    const node = this.args.node;
    if (Math.abs(node.height - height) > 0.5) node.height = height;
    if (Math.abs(node.width - width) > 0.5) node.width = width;
  };

  close = (): void => this.flow.clearSelection();
  duplicate = (): void => this.flow.duplicateNode(this.args.node.id);
  remove = (): void => this.flow.removeNode(this.args.node.id);

  <template>
    <div
      class="flow-node flow-node--{{@node.type}}
        {{if this.selected 'is-selected'}}
        {{if this.isExpanded 'is-expanded'}}
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
          {{#if this.isExpanded}}
            <button
              type="button"
              class="flow-node__collapse"
              aria-label="편집 닫기"
              data-canvas-ui
              {{on "click" this.close}}
            >×</button>
          {{/if}}
        </header>

        {{#if this.isExpanded}}
          {{! data-canvas-ui 가 있어야 폼을 눌렀을 때 노드 드래그가 시작되지 않습니다. }}
          <div class="flow-node__editor" data-canvas-ui>
            <NodeForm @node={{@node}} @compact={{true}} />
            <div class="flow-node__actions">
              <button
                type="button"
                class="btn btn--grow"
                {{on "click" this.duplicate}}
              >복제</button>
              <button
                type="button"
                class="btn btn--grow btn--danger"
                disabled={{this.cannotRemove}}
                {{on "click" this.remove}}
              >삭제</button>
            </div>
          </div>
        {{else}}
          <p class="flow-node__summary">{{@node.summary}}</p>
        {{/if}}

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
