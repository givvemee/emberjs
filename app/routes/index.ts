import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type RouterService from '@ember/routing/router-service';

/** 루트로 들어오면 곧장 빌더로 보냅니다. */
export default class IndexRoute extends Route {
  @service declare router: RouterService;

  redirect(): void {
    this.router.replaceWith('flow');
  }
}
