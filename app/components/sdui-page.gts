import Component from '@glimmer/component';
import { service } from '@ember/service';
import type RouterService from '@ember/routing/router-service';
import mountIsland from 'emberjs/modifiers/mount-island';
import type { ScenarioPayload } from 'emberjs/utils/sdui/scenario';

export interface SduiPageSignature {
  Args: { payload: ScenarioPayload };
}

/**
 * SDUI 화면은 React + xyflow 로 그립니다. 이 컴포넌트는 Ember 와 React 의
 * 경계일 뿐입니다: 라우트가 받아 온 payload 와, React 쪽에서 쓸 수 없는
 * Ember 라우터 이동을 넘겨줍니다.
 */
export default class SduiPage extends Component<SduiPageSignature> {
  @service declare router: RouterService;

  goHome = (): void => {
    this.router.transitionTo('index');
  };

  mountApp = async (element: HTMLElement): Promise<() => void> => {
    const { mount } = await import('emberjs/react/sdui/mount');
    return mount(element, { payload: this.args.payload, onHome: this.goHome });
  };

  <template>
    <div class="react-island" {{mountIsland this.mountApp}}></div>
  </template>
}
