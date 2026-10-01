import scenarioJson from 'emberjs/mocks/scenario.json';
import layoutsJson from 'emberjs/mocks/node-layouts.json';
import type { ScenarioPayload } from 'emberjs/utils/sdui/scenario';

/** 네트워크 왕복처럼 보이게 하는 지연 (ms) */
const LATENCY = 250;

/**
 * 서버 대신 app/mocks/ 의 JSON 을 돌려줍니다.
 *
 * 실제 서버라면 GET /scenarios/:id 는 블록 문서를, GET /node-layouts 는
 * 레이아웃 스키마를 내려줄 자리입니다. Mongo 의 ObjectId/Double/ISODate 래퍼는
 * JSON 으로 내려올 때 이미 문자열·숫자로 풀려 있다고 가정했습니다.
 *
 * 응답은 매번 깊은 복사합니다. 실제 fetch 처럼 호출마다 새 객체여야
 * 화면에서 한 편집이 모듈 수준의 원본에 새지 않습니다.
 */
export async function fetchScenario(): Promise<ScenarioPayload> {
  await new Promise((resolve) => setTimeout(resolve, LATENCY));

  // 네트워크 경계라 여기서 한 번 타입을 붙입니다. 레이아웃 스키마는
  // 화면에서 다시 편집될 때 parseNodeLayout 으로 검증합니다.
  const { scenario, blocks } = structuredClone(scenarioJson) as unknown as Omit<
    ScenarioPayload,
    'layouts'
  >;
  const layouts = structuredClone(
    layoutsJson,
  ) as unknown as ScenarioPayload['layouts'];

  return { scenario, blocks, layouts };
}
