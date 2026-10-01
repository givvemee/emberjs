import { pageTitle } from 'ember-page-title';
import type { TOC } from '@ember/component/template-only';
import SduiPage from 'emberjs/components/sdui-page';
import type { ScenarioPayload } from 'emberjs/utils/sdui/scenario';

const SduiTemplate: TOC<{ Args: { model: ScenarioPayload } }> = <template>
  {{pageTitle "SDUI 노드"}}
  <SduiPage @payload={{@model}} />
</template>;

export default SduiTemplate;
