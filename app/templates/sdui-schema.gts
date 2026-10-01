import { pageTitle } from 'ember-page-title';
import type { TOC } from '@ember/component/template-only';
import SduiSchemaPage from 'emberjs/components/sdui-schema-page';
import type { ConsolePayload } from 'emberjs/utils/sdui/mock-api';

const SduiSchemaTemplate: TOC<{ Args: { model: ConsolePayload } }> = <template>
  {{pageTitle "SDUI 스키마 콘솔"}}
  <SduiSchemaPage @payload={{@model}} />
</template>;

export default SduiSchemaTemplate;
