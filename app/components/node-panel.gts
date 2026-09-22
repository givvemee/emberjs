import Component from '@glimmer/component';
import { service } from '@ember/service';
import { on } from '@ember/modifier';
import { htmlSafe } from '@ember/template';
import type { SafeString } from '@ember/template';
import NodeForm from 'emberjs/components/node-form';
import type FlowService from 'emberjs/services/flow';
import type { FlowEdge, FlowNode } from 'emberjs/utils/flow-graph';

export interface NodePanelSignature {
  Args: {
    /** 둘 중 하나만 채워집니다. 둘 다 없으면 빈 상태. */
    node?: FlowNode | null;
    edge?: FlowEdge | null;
    /** 없으면 닫기 버튼을 그리지 않습니다(고정 패널). */
    onClose?: () => void;
  };
}

interface EdgeEnds {
  from: FlowNode | null;
  to: FlowNode | null;
}

/**
 * 패널 내용물: 머리말 + 폼 + 액션.
 *
 * 드로어 · 모달 · 고정 패널 · 팝오버가 이 컴포넌트를 그대로 씁니다.
 * 껍데기(위치·애니메이션)는 CSS 가, 내용은 여기가 책임집니다.
 */
export default class NodePanel extends Component<NodePanelSignature> {
  @service declare flow: FlowService;

  get themeStyle(): SafeString | null {
    const def = this.args.node?.def;
    return def
      ? htmlSafe(`--accent: ${def.accent}; --tint: ${def.tint};`)
      : null;
  }

  get edgeEnds(): EdgeEnds | null {
    const edge = this.args.edge;
    if (!edge) return null;
    return {
      from: this.flow.nodeById(edge.from),
      to: this.flow.nodeById(edge.to),
    };
  }

  /** 시작 노드는 지울 수 없습니다. 템플릿이 {{not}} 을 못 쓰므로 여기서 계산합니다. */
  get cannotRemove(): boolean {
    return !this.args.node?.def.removable;
  }

  remove = (): void => {
    if (this.args.node) this.flow.removeNode(this.args.node.id);
  };

  duplicate = (): void => {
    if (this.args.node) this.flow.duplicateNode(this.args.node.id);
  };

  removeEdge = (): void => {
    if (this.args.edge) this.flow.removeEdge(this.args.edge.id);
  };

  <template>
    {{#if @node}}
      <header class="node-panel__head" style={{this.themeStyle}}>
        <span class="node-panel__icon">{{@node.def.icon}}</span>
        <div class="node-panel__heading">
          <h2 class="node-panel__title">{{@node.def.label}}</h2>
          <p class="node-panel__hint">{{@node.def.hint}}</p>
        </div>
        {{#if @onClose}}
          <button
            type="button"
            class="node-panel__close"
            aria-label="설정 닫기"
            {{on "click" @onClose}}
          >×</button>
        {{/if}}
      </header>

      <div class="node-panel__body" style={{this.themeStyle}}>
        <NodeForm @node={{@node}} />
      </div>

      <footer class="node-panel__foot">
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
      </footer>

    {{else if this.edgeEnds}}
      <header class="node-panel__head">
        <span class="node-panel__icon">↧</span>
        <div class="node-panel__heading">
          <h2 class="node-panel__title">연결선</h2>
          <p class="node-panel__hint">노드를 잇는 경로</p>
        </div>
        {{#if @onClose}}
          <button
            type="button"
            class="node-panel__close"
            aria-label="설정 닫기"
            {{on "click" @onClose}}
          >×</button>
        {{/if}}
      </header>

      <div class="node-panel__body">
        <ul class="links">
          <li class="links__row">
            <span class="links__port">시작</span>
            <span class="links__target">{{this.edgeEnds.from.def.icon}}
              {{this.edgeEnds.from.title}}</span>
          </li>
          <li class="links__row">
            <span class="links__port">도착</span>
            <span class="links__target">{{this.edgeEnds.to.def.icon}}
              {{this.edgeEnds.to.title}}</span>
          </li>
        </ul>
      </div>

      <footer class="node-panel__foot">
        <button
          type="button"
          class="btn btn--grow btn--danger"
          {{on "click" this.removeEdge}}
        >연결 삭제</button>
      </footer>

    {{else}}
      <div class="node-panel__body node-panel__body--empty">
        <p class="panel__empty">
          노드를 선택하면 여기에서 내용을 편집할 수 있습니다.
        </p>
      </div>
    {{/if}}
  </template>
}
