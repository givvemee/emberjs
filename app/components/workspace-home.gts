import Component from '@glimmer/component';
import { LinkTo } from '@ember/routing';
import { htmlSafe } from '@ember/template';
import type { SafeString } from '@ember/template';
import {
  WORKSPACE_SECTIONS,
  type WorkspaceSection,
} from 'emberjs/utils/workspace-sections';

interface SectionCard extends WorkspaceSection {
  style: SafeString;
  isReady: boolean;
}

/**
 * 홈 화면: 기능 카드 런처.
 *
 * 카드 목록은 workspace-sections.ts 에서 옵니다. 여기에는 어떤 기능이 있는지
 * 하드코딩되어 있지 않으므로, 레지스트리에 항목을 추가하면 카드가 따라옵니다.
 */
export default class WorkspaceHome extends Component {
  get sections(): SectionCard[] {
    return WORKSPACE_SECTIONS.map((section) => ({
      ...section,
      style: htmlSafe(`--accent: ${section.accent}; --tint: ${section.tint};`),
      isReady: section.status === 'ready',
    }));
  }

  <template>
    <div class="home">
      <div class="home__inner">
        <header class="home__head">
          <span class="home__logo">⇅</span>
          <h1 class="home__title">워크스페이스</h1>
          <p class="home__subtitle">
            작업할 도구를 고르세요. 기능은 계속 추가됩니다.
          </p>
        </header>

        <ul class="cards">
          {{#each this.sections key="route" as |section|}}
            <li class="cards__item">
              {{#if section.isReady}}
                <LinkTo
                  @route={{section.route}}
                  class="card"
                  style={{section.style}}
                >
                  <span class="card__icon">{{section.icon}}</span>
                  <h2 class="card__title">{{section.title}}</h2>
                  <p class="card__desc">{{section.description}}</p>
                  <ul class="card__chips">
                    {{#each section.highlights as |highlight|}}
                      <li>{{highlight}}</li>
                    {{/each}}
                  </ul>
                  <span class="card__cta">열기 →</span>
                </LinkTo>
              {{else}}
                <div class="card card--planned" style={{section.style}}>
                  <span class="card__icon">{{section.icon}}</span>
                  <h2 class="card__title">{{section.title}}</h2>
                  <p class="card__desc">{{section.description}}</p>
                  <ul class="card__chips">
                    {{#each section.highlights as |highlight|}}
                      <li>{{highlight}}</li>
                    {{/each}}
                  </ul>
                  <span class="card__cta card__cta--muted">준비 중</span>
                </div>
              {{/if}}
            </li>
          {{/each}}
        </ul>
      </div>
    </div>
  </template>
}
