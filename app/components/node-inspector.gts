import Component from '@glimmer/component';
import { service } from '@ember/service';
import { on } from '@ember/modifier';
import NodePanel from 'emberjs/components/node-panel';
import type FlowService from 'emberjs/services/flow';
import type { Selection } from 'emberjs/services/flow';
import type { FlowEdge, FlowNode } from 'emberjs/utils/flow-graph';

/**
 * 캔버스 바깥에 뜨는 세 가지 모드를 담당합니다: 드로어 · 모달 · 고정 패널.
 *
 * 팝오버는 캔버스 좌표가 필요해 FlowCanvas 가, 인라인은 노드 안이라
 * FlowNode 가 각각 그립니다. 좌표계를 가진 쪽이 그리는 원칙입니다.
 */
export default class NodeInspector extends Component {
  @service declare flow: FlowService;

  get isDrawer(): boolean {
    return this.flow.panelMode === 'drawer';
  }

  get isModal(): boolean {
    return this.flow.panelMode === 'modal';
  }

  get isDocked(): boolean {
    return this.flow.panelMode === 'docked';
  }

  get isOpen(): boolean {
    return Boolean(this.flow.selection);
  }

  /**
   * 드로어·모달은 닫히는 동안에도 직전 선택을 그립니다. 그러지 않으면
   * 슬라이드가 끝나기 전에 내용이 먼저 비어서 깜빡입니다.
   * 고정 패널은 애니메이션이 없으므로 현재 선택만 봅니다(없으면 빈 상태).
   */
  get shown(): Selection | null {
    if (this.isDocked) return this.flow.selection;
    return this.flow.selection ?? this.flow.lastSelection;
  }

  get node(): FlowNode | null {
    if (this.shown?.kind !== 'node') return null;
    return this.flow.nodeById(this.shown.id);
  }

  get edge(): FlowEdge | null {
    if (this.shown?.kind !== 'edge') return null;
    return this.flow.edgeById(this.shown.id);
  }

  close = (): void => this.flow.clearSelection();

  <template>
    {{#if this.isDrawer}}
      <aside
        class="shell-drawer {{if this.isOpen 'is-open'}}"
        aria-label="선택한 항목 설정"
      >
        <NodePanel
          @node={{this.node}}
          @edge={{this.edge}}
          @onClose={{this.close}}
        />
      </aside>

    {{else if this.isModal}}
      <div class="shell-modal {{if this.isOpen 'is-open'}}">
        <button
          type="button"
          class="shell-modal__scrim"
          aria-label="설정 닫기"
          {{on "click" this.close}}
        ></button>
        <aside class="shell-modal__panel" aria-label="선택한 항목 설정">
          <NodePanel
            @node={{this.node}}
            @edge={{this.edge}}
            @onClose={{this.close}}
          />
        </aside>
      </div>

    {{else if this.isDocked}}
      <aside class="shell-docked" aria-label="선택한 항목 설정">
        {{! 고정 패널에는 닫기 버튼이 없습니다 — 늘 자리를 지키는 게 목적이라. }}
        <NodePanel @node={{this.node}} @edge={{this.edge}} />
      </aside>
    {{/if}}
  </template>
}
