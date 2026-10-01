import Route from '@ember/routing/route';
import { fetchConsole, type ConsolePayload } from 'emberjs/utils/sdui/mock-api';

/** 배포된 레이아웃 스키마와, 미리보기 샘플로 쓸 블록 문서를 받아 옵니다. */
export default class SduiSchemaRoute extends Route<ConsolePayload> {
  model(): Promise<ConsolePayload> {
    return fetchConsole();
  }
}
