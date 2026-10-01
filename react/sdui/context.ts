import { createContext, useContext, type Dispatch } from 'react';
import type { LayoutDocument } from 'emberjs/utils/sdui/schema';
import type {
  BlockDocument,
  DerivedBlock,
  ScenarioAction,
  ScenarioState,
} from 'emberjs/utils/sdui/scenario';

export interface ScenarioContextValue {
  state: ScenarioState;
  dispatch: Dispatch<ScenarioAction>;
  blocks: DerivedBlock[];
  blockById: ReadonlyMap<string, DerivedBlock>;
  /** 서버가 처음 보내준 그대로. 편집 여부 판단과 되돌리기에 씁니다. */
  original: {
    docs: Record<string, BlockDocument>;
    layouts: LayoutDocument;
  };
}

export const ScenarioContext = createContext<ScenarioContextValue | null>(null);

/**
 * 노드·인스펙터·목록이 같은 시나리오 상태를 읽습니다.
 *
 * xyflow 의 노드 data 에 블록을 넣지 않고 context 로 돌리는 이유: 노드 배열은
 * 위치와 측정값(measured)을 들고 있어서, 데이터가 바뀔 때마다 노드 배열을 새로
 * 만들면 xyflow 가 측정을 다시 해야 합니다. 노드 배열에는 id 와 위치만 두고
 * 내용은 여기서 읽습니다.
 */
export function useScenario(): ScenarioContextValue {
  const value = useContext(ScenarioContext);
  if (!value)
    throw new Error('ScenarioContext 밖에서 useScenario 를 불렀습니다.');
  return value;
}
