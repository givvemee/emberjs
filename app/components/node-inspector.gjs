import Component from '@glimmer/component';
import { service } from '@ember/service';
import { on } from '@ember/modifier';
import { eq, fn, not } from '@ember/helper';
import { htmlSafe } from '@ember/template';

/**
 * 오른쪽 사이드바: 선택된 노드의 설정 폼.
 *
 * 폼은 하드코딩되어 있지 않고 노드 타입의 `fields` 정의를 그대로 그립니다.
 * 새 노드 타입에 필드를 추가하면 여기 UI는 자동으로 따라옵니다.
 */
export default class NodeInspector extends Component {
  @service flow;

  get node() {
    return this.flow.selectedNode;
  }

  get themeStyle() {
    const def = this.node?.def;
    return def
      ? htmlSafe(`--accent: ${def.accent}; --tint: ${def.tint};`)
      : null;
  }

  /** 필드 정의 + 현재 값을 미리 합쳐 두면 템플릿이 단순해집니다. */
  get fields() {
    const node = this.node;
    if (!node) return [];

    return node.def.fields.map((field) => {
      const value = node.data[field.key] ?? '';
      return {
        ...field,
        value,
        options: field.options?.map((option) => ({
          ...option,
          selected: option.value === value,
        })),
      };
    });
  }

  /** 출력 포트별 연결 상태 */
  get connections() {
    const node = this.node;
    if (!node) return [];

    return node.def.outputs.map((port) => {
      const edge = this.flow.edges.find(
        (candidate) =>
          candidate.from === node.id && candidate.port === port.key,
      );
      return {
        key: port.key,
        label: port.label || '다음',
        edge,
        target: edge ? this.flow.nodeById(edge.to) : null,
      };
    });
  }

  update = (key, event) => {
    const target = event.target;
    const value =
      target.type === 'number' ? Number(target.value) : target.value;
    this.flow.updateNodeData(this.node, key, value);
  };

  remove = () => this.flow.removeNode(this.node.id);
  duplicate = () => this.flow.duplicateNode(this.node.id);
  disconnect = (edgeId) => this.flow.removeEdge(edgeId);
  removeSelectedEdge = () => this.flow.removeEdge(this.flow.selectedEdge.id);

  <template>
    <aside class="panel panel--right" aria-label="선택한 노드 설정">
      {{#if this.node}}
        <section class="panel__section" style={{this.themeStyle}}>
          <header class="inspector__head">
            <span class="inspector__icon">{{this.node.def.icon}}</span>
            <div>
              <h2 class="panel__title">{{this.node.def.label}}</h2>
              <p class="panel__caption">{{this.node.def.hint}}</p>
            </div>
          </header>

          <div class="form">
            {{#each this.fields key="key" as |field|}}
              <label class="form__row">
                <span class="form__label">{{field.label}}</span>

                {{#if (eq field.type "textarea")}}
                  <textarea
                    class="form__control"
                    rows="4"
                    placeholder={{field.placeholder}}
                    value={{field.value}}
                    {{on "input" (fn this.update field.key)}}
                  ></textarea>
                {{else if (eq field.type "select")}}
                  <select
                    class="form__control"
                    {{on "change" (fn this.update field.key)}}
                  >
                    {{! 블록 변수를 option 으로 두면 <option> 엘리먼트와 이름이 겹칩니다. }}
                    {{#each field.options key="value" as |choice|}}
                      <option
                        value={{choice.value}}
                        selected={{choice.selected}}
                      >
                        {{choice.label}}
                      </option>
                    {{/each}}
                  </select>
                {{else if (eq field.type "number")}}
                  <input
                    class="form__control"
                    type="number"
                    min={{field.min}}
                    value={{field.value}}
                    {{on "input" (fn this.update field.key)}}
                  />
                {{else}}
                  <input
                    class="form__control"
                    type="text"
                    placeholder={{field.placeholder}}
                    value={{field.value}}
                    {{on "input" (fn this.update field.key)}}
                  />
                {{/if}}

                {{#if field.help}}
                  <small class="form__help">{{field.help}}</small>
                {{/if}}
              </label>
            {{/each}}
          </div>
        </section>

        {{#if this.connections.length}}
          <section class="panel__section">
            <h3 class="panel__subtitle">연결</h3>
            <ul class="links">
              {{#each this.connections key="key" as |link|}}
                <li class="links__row">
                  <span class="links__port">{{link.label}}</span>
                  {{#if link.target}}
                    <span class="links__target">{{link.target.def.icon}}
                      {{link.target.title}}</span>
                    <button
                      type="button"
                      class="links__cut"
                      title="연결 끊기"
                      {{on "click" (fn this.disconnect link.edge.id)}}
                    >×</button>
                  {{else}}
                    <span class="links__target links__target--empty">연결 안 됨</span>
                  {{/if}}
                </li>
              {{/each}}
            </ul>
          </section>
        {{/if}}

        <section class="panel__section panel__actions">
          <button
            type="button"
            class="btn btn--grow"
            {{on "click" this.duplicate}}
          >복제</button>
          <button
            type="button"
            class="btn btn--grow btn--danger"
            disabled={{not this.node.def.removable}}
            {{on "click" this.remove}}
          >삭제</button>
        </section>

      {{else if this.flow.selectedEdge}}
        <section class="panel__section">
          <h2 class="panel__title">연결선</h2>
          <p class="panel__caption">
            {{this.flow.selectedEdge.from}}
            →
            {{this.flow.selectedEdge.to}}
          </p>
          <button
            type="button"
            class="btn btn--danger"
            {{on "click" this.removeSelectedEdge}}
          >연결 삭제</button>
        </section>

      {{else}}
        <section class="panel__section">
          <h2 class="panel__title">설정</h2>
          <p class="panel__empty">
            노드를 선택하면 여기에서 내용을 편집할 수 있습니다.
          </p>
        </section>
      {{/if}}
    </aside>
  </template>
}
