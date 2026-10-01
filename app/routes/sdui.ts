import Route from '@ember/routing/route';
import { fetchScenario } from 'emberjs/utils/sdui/mock-api';
import type { ScenarioPayload } from 'emberjs/utils/sdui/scenario';

/** 블록 문서와 레이아웃 스키마를 "서버"(mock)에서 받아 옵니다. */
export default class SduiRoute extends Route<ScenarioPayload> {
  model(): Promise<ScenarioPayload> {
    return fetchScenario();
  }
}
