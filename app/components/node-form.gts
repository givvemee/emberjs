import Component from '@glimmer/component';
import { service } from '@ember/service';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import type FlowService from 'emberjs/services/flow';
import type { FlowEdge, FlowNode } from 'emberjs/utils/flow-graph';
import type { SelectOption } from 'emberjs/utils/node-types';

export interface NodeFormSignature {
  Args: {
    /** 편집할 노드 */
    node: FlowNode;
    /** 좁은 공간(인라인)에서 연결 목록을 생략 */
    compact?: boolean;
  };
}

/**
 * 폼에 그릴 때 쓰는 형태.
 *
 * FieldDef 는 판별 유니온이지만 여기서는 납작하게 폅니다. 템플릿의 {{#if}} 는
 * 타입을 좁혀주지 못해서, 유니온 그대로 두면 어느 분기에서도 placeholder/min 에
 * 접근할 수 없습니다. 정의 시점의 안전성(예: options 는 select 에만)은
 * node-types.ts 에서 이미 확보했고, 여기는 뷰 모델입니다.
 *
 * 분기도 헬퍼 대신 불리언 플래그로 넘깁니다 — Ember 7 의 내장 {{eq}} 는
 * Glint 1.5 가 아직 호출 가능한 것으로 인식하지 못합니다.
 */
interface ResolvedField {
  key: string;
  label: string;
  value: string | number;
  help?: string;
  placeholder?: string;
  min?: number;
  options?: Array<SelectOption & { selected: boolean }>;
  isTextarea: boolean;
  isSelect: boolean;
  isNumber: boolean;
}

interface Connection {
  key: string;
  label: string;
  edge: FlowEdge | undefined;
  target: FlowNode | null;
}

/**
 * 노드 설정 폼. 드로어 · 팝오버 · 모달 · 고정 패널 · 인라인 다섯 모드가
 * 전부 이 컴포넌트를 씁니다. 모드는 "어디에 어떻게 띄우는지"만 다릅니다.
 *
 * 필드는 하드코딩되어 있지 않고 노드 타입의 `fields` 정의를 그대로 그립니다.
 */
export default class NodeForm extends Component<NodeFormSignature> {
  @service declare flow: FlowService;

  /** 필드 정의 + 현재 값을 미리 합쳐 두면 템플릿이 단순해집니다. */
  get fields(): ResolvedField[] {
    const node = this.args.node;
    if (!node) return [];

    const data = node.data as Record<string, string | number | undefined>;

    return node.def.fields.map((field): ResolvedField => {
      const value = data[field.key] ?? '';
      return {
        key: field.key,
        label: field.label,
        value,
        help: field.help,
        placeholder:
          field.type === 'text' || field.type === 'textarea'
            ? field.placeholder
            : undefined,
        min: field.type === 'number' ? field.min : undefined,
        options:
          field.type === 'select'
            ? field.options.map((option) => ({
                ...option,
                selected: option.value === value,
              }))
            : undefined,
        isTextarea: field.type === 'textarea',
        isSelect: field.type === 'select',
        isNumber: field.type === 'number',
      };
    });
  }

  /** 출력 포트별 연결 상태 */
  get connections(): Connection[] {
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

  update = (key: string, event: Event): void => {
    const target = event.target as HTMLInputElement;
    const value =
      target.type === 'number' ? Number(target.value) : target.value;
    this.flow.updateNodeData(this.args.node, key, value);
  };

  /** 템플릿이 link.edge 의 undefined 여부를 좁혀주지 못하므로 여기서 막습니다. */
  disconnect = (edgeId: string | undefined): void => {
    if (edgeId) this.flow.removeEdge(edgeId);
  };

  <template>
    <div class="form">
      {{#each this.fields key="key" as |field|}}
        <label class="form__row">
          <span class="form__label">{{field.label}}</span>

          {{#if field.isTextarea}}
            <textarea
              class="form__control"
              rows={{if @compact "3" "4"}}
              placeholder={{field.placeholder}}
              value={{field.value}}
              {{on "input" (fn this.update field.key)}}
            ></textarea>
          {{else if field.isSelect}}
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
          {{else if field.isNumber}}
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
