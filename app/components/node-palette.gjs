import Component from '@glimmer/component';
import { service } from '@ember/service';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import { htmlSafe } from '@ember/template';
import { DND_TYPE, NODE_TYPE_LIST } from 'emberjs/utils/node-types';

/**
 * 왼쪽 사이드바: 추가할 수 있는 노드 목록 + 플로우 검증 결과.
 *
 * 캔버스로 끌어다 놓거나(HTML5 드래그앤드롭), 그냥 클릭하면 화면 중앙에 추가됩니다.
 */
export default class NodePalette extends Component {
  @service flow;

  types = NODE_TYPE_LIST.map((def) => ({
    id: def.id,
    label: def.label,
    hint: def.hint,
    icon: def.icon,
    style: htmlSafe(`--accent: ${def.accent}; --tint: ${def.tint};`),
  }));

  onDragStart = (type, event) => {
    event.dataTransfer.setData(DND_TYPE, type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  add = (type) => this.flow.addNodeAtCenter(type);

  focusIssue = (issue) => {
    if (issue.nodeId) this.flow.focusNode(issue.nodeId);
  };

  <template>
    <aside class="panel panel--left" aria-label="노드 팔레트와 검증">
      <section class="panel__section">
        <h2 class="panel__title">노드</h2>
        <p class="panel__caption">캔버스로 끌어다 놓거나 클릭해서 추가하세요.</p>

        <ul class="palette">
          {{#each this.types key="id" as |type|}}
            <li>
              <button
                type="button"
                class="palette__item"
                style={{type.style}}
                draggable="true"
                {{on "dragstart" (fn this.onDragStart type.id)}}
                {{on "click" (fn this.add type.id)}}
              >
                <span class="palette__icon">{{type.icon}}</span>
                <span class="palette__text">
                  <strong>{{type.label}}</strong>
                  <small>{{type.hint}}</small>
                </span>
              </button>
            </li>
          {{/each}}
        </ul>
      </section>

      <section class="panel__section panel__section--grow">
        <h2 class="panel__title">
          검증
          {{#if this.flow.issues.length}}
            <span class="badge">{{this.flow.issues.length}}</span>
          {{/if}}
        </h2>

        {{#if this.flow.issues.length}}
          <ul class="issues">
            {{#each this.flow.issues key="id" as |issue|}}
              <li>
                <button
                  type="button"
                  class="issues__item issues__item--{{issue.level}}"
                  {{on "click" (fn this.focusIssue issue)}}
                >
                  <span class="issues__dot"></span>
                  {{issue.message}}
                </button>
              </li>
            {{/each}}
          </ul>
        {{else}}
          <p class="panel__empty panel__empty--ok">문제가 없습니다. 배포할
            준비가 됐어요.</p>
        {{/if}}
      </section>
    </aside>
  </template>
}
