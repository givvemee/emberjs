import Component from '@glimmer/component';
import { service } from '@ember/service';
import type RouterService from '@ember/routing/router-service';
import mountIsland from 'emberjs/modifiers/mount-island';
import type { SduiRoute } from '../../react/sdui/navigate';
import type { ConsolePayload } from 'emberjs/utils/sdui/mock-api';

export interface SduiSchemaPageSignature {
  Args: { payload: ConsolePayload };
}

/** 스키마 콘솔(React)의 경계. SduiPage 와 같은 역할입니다. */
export default class SduiSchemaPage extends Component<SduiSchemaPageSignature> {
  @service declare router: RouterService;

  navigate = (to: SduiRoute): void => {
    this.router.transitionTo(to);
  };

  mountApp = async (element: HTMLElement): Promise<() => void> => {
    const { mount } = await import('../../react/sdui/console/mount');
    return mount(element, {
      payload: this.args.payload,
      navigate: this.navigate,
    });
  };

  <template>
    <div class="react-island" {{mountIsland this.mountApp}}></div>
  </template>
}
