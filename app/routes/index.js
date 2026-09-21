import Route from '@ember/routing/route';
import { service } from '@ember/service';

/** 루트로 들어오면 곧장 빌더로 보냅니다. */
export default class IndexRoute extends Route {
  @service router;

  redirect() {
    this.router.replaceWith('flow');
  }
}
