import Component from '@glimmer/component';
import { service } from '@ember/service';
import { on } from '@ember/modifier';
import { eq, fn } from '@ember/helper';

/**
 * 노드 설정 폼. 드로어 · 팝오버 · 모달 · 고정 패널 · 인라인 다섯 모드가
 * 전부 이 컴포넌트를 씁니다. 모드는 "어디에 어떻게 띄우는지"만 다릅니다.
 *
 * 필드는 하드코딩되어 있지 않고 노드 타입의 `fields` 정의를 그대로 그립니다.
 *
 *   @node     편집할 노드
 *   @compact  좁은 공간(인라인)에서 연결 목록을 생략
 */
export default class NodeForm extends Component {
  @service flow;

  /** 필드 정의 + 현재 값을 미리 합쳐 두면 템플릿이 단순해집니다. */
  get fields() {
    const node = this.args.node;
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
    const node = this.args.node;
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
    this.flow.updateNodeData(this.args.node, key, value);
  };

  disconnect = (edgeId) => this.flow.removeEdge(edgeId);

  <template>
    <div class="form">
      {{#each this.fields key="key" as |field|}}
        <label class="form__row">
          <span class="form__label">{{field.label}}</span>

          {{#if (eq field.type "textarea")}}
            <textarea
              class="form__control"
              rows={{if @compact "3" "4"}}
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
                <option value={{choice.value}} selected={{choice.selected}}>
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

    {{#unless @compact}}
      {{#if this.connections.length}}
        <div class="links-block">
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
        </div>
      {{/if}}
    {{/unless}}
  </template>
}
