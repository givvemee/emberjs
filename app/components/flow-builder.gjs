import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { on } from '@ember/modifier';
import NodePalette from 'emberjs/components/node-palette';
import FlowCanvas from 'emberjs/components/flow-canvas';
import NodeInspector from 'emberjs/components/node-inspector';
import windowKeydown from 'emberjs/modifiers/window-keydown';
import { PANEL_MODES } from 'emberjs/utils/panel-modes';

const EDITABLE = ['INPUT', 'TEXTAREA', 'SELECT'];

/** 팔레트 · 캔버스 · 인스펙터를 묶는 껍데기. 상단 툴바와 단축키를 담당합니다. */
export default class FlowBuilder extends Component {
  @service flow;

  @tracked copied = false;

  get summary() {
    const nodes = this.flow.nodes.length;
    const edges = this.flow.edges.length;
    return `노드 ${nodes}개 · 연결 ${edges}개`;
  }

  get panelModes() {
    return PANEL_MODES.map((mode) => ({
      ...mode,
      selected: mode.value === this.flow.panelMode,
    }));
  }

  get panelModeHint() {
    return PANEL_MODES.find((mode) => mode.value === this.flow.panelMode)?.hint;
  }

  onPanelModeChange = (event) => this.flow.setPanelMode(event.target.value);

  get statusClass() {
    if (this.flow.errorCount > 0) return 'status status--error';
    if (this.flow.issues.length > 0) return 'status status--warn';
    return 'status status--ok';
  }

  get statusLabel() {
    if (this.flow.errorCount > 0) return `오류 ${this.flow.errorCount}개`;
    if (this.flow.issues.length > 0) return `경고 ${this.flow.issues.length}개`;
    return '이상 없음';
  }

  onKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (this.flow.exported) this.flow.hideExport();
      else this.flow.clearSelection();
      return;
    }

    // 폼에 입력 중일 때는 단축키가 끼어들면 안 됩니다.
    const target = event.target;
    if (target instanceof HTMLElement) {
      if (target.isContentEditable || EDITABLE.includes(target.tagName)) return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!this.flow.selection) return;
      event.preventDefault();
      this.flow.deleteSelection();
      return;
    }

    if (event.key.toLowerCase() === 'd' && (event.metaKey || event.ctrlKey)) {
      const node = this.flow.selectedNode;
      if (!node) return;
      event.preventDefault();
      this.flow.duplicateNode(node.id);
    }
  };

  showExport = () => {
    this.copied = false;
    this.flow.showExport();
  };

  hideExport = () => this.flow.hideExport();

  copyExport = async () => {
    try {
      await navigator.clipboard.writeText(this.flow.exported);
      this.copied = true;
    } catch {
      this.copied = false;
    }
  };

  clearAll = () => {
    if (confirm('시작 노드만 남기고 모두 지울까요?')) this.flow.clear();
  };

  restoreSample = () => {
    if (confirm('현재 플로우를 버리고 예시 플로우로 되돌릴까요?'))
      this.flow.reset();
  };

  <template>
    <div class="builder" {{windowKeydown this.onKeyDown}}>
      <header class="builder__bar">
        <div class="builder__brand">
          <span class="builder__logo">⇅</span>
          <div>
            <h1>플로우 빌더</h1>
            <p>{{this.summary}}</p>
          </div>
        </div>

        <div class="builder__tools">
          <div class="mode" title={{this.panelModeHint}}>
            <span class="mode__label">설정 패널</span>
            <select
              class="mode__select"
              aria-label="설정 패널 표시 방식"
              {{on "change" this.onPanelModeChange}}
            >
              {{#each this.panelModes key="value" as |choice|}}
                <option value={{choice.value}} selected={{choice.selected}}>
                  {{choice.label}}
                </option>
              {{/each}}
            </select>
          </div>

          <span class={{this.statusClass}}>{{this.statusLabel}}</span>
          <button type="button" class="btn" {{on "click" this.showExport}}>JSON
            보기</button>
          <button
            type="button"
            class="btn"
            {{on "click" this.restoreSample}}
          >예시로</button>
          <button
            type="button"
            class="btn"
            {{on "click" this.clearAll}}
          >비우기</button>
        </div>
      </header>

      <div class="builder__body">
        <NodePalette />
        <FlowCanvas />
        <NodeInspector />
      </div>

      {{#if this.flow.exported}}
        <div class="modal">
          {{! 배경 닫기는 진짜 버튼으로 둡니다 — div 에 클릭만 붙이면
              키보드로는 닫을 수 없습니다. }}
          <button
            type="button"
            class="modal__backdrop"
            aria-label="닫기"
            {{on "click" this.hideExport}}
          ></button>
          <div
            class="modal__box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="flow-json-title"
          >
            <div class="modal__head">
              <h2 id="flow-json-title">플로우 JSON</h2>
              <p>localStorage 에 저장되는 형태 그대로입니다.</p>
            </div>
            <pre class="modal__code">{{this.flow.exported}}</pre>
            <footer class="modal__foot">
              <button type="button" class="btn" {{on "click" this.copyExport}}>
                {{if this.copied "복사됨" "복사"}}
              </button>
              <button
                type="button"
                class="btn btn--primary"
                {{on "click" this.hideExport}}
              >
                닫기
              </button>
            </footer>
          </div>
        </div>
      {{/if}}
    </div>
  </template>
}
