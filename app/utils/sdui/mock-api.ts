import scenarioJson from 'emberjs/mocks/scenario.json';
import layoutsJson from 'emberjs/mocks/node-layouts.json';
import {
  FALLBACK_KEY,
  type BlockDocument,
  type ScenarioPayload,
} from 'emberjs/utils/sdui/scenario';
import {
  isRecord,
  parseNodeLayout,
  type LayoutDocument,
  type NodeLayout,
} from 'emberjs/utils/sdui/schema';

/**
 * 서버 흉내.
 *
 * 실제 서버라면 GET /scenarios/:id 는 블록 문서를, GET /node-layouts 는
 * 레이아웃 스키마를, POST /node-layouts/deployments 는 새 스키마 배포를 맡을
 * 자리입니다.
 *
 * - 블록 문서: 언제나 app/mocks/scenario.json. Mongo 의 ObjectId/Double/ISODate
 *   래퍼는 JSON 으로 내려올 때 이미 문자열·숫자로 풀려 있다고 가정했습니다.
 * - 레이아웃: 스키마 콘솔에서 배포한 것이 localStorage 에 있으면 그것, 없으면
 *   app/mocks/node-layouts.json. 그래서 콘솔에서 배포한 뒤 /sdui 를 새로고침하면
 *   클라이언트 배포 없이 노드 모양이 바뀝니다.
 *
 * 응답은 매번 깊은 복사합니다. 실제 fetch 처럼 호출마다 새 객체여야 화면에서
 * 한 편집이 "서버" 쪽 원본에 새지 않습니다.
 */

/** 네트워크 왕복처럼 보이게 하는 지연 (ms) */
const LATENCY = 250;

const STORAGE_KEY = 'emberjs:sdui:layout-server:v1';

/** 이력은 최근 것만 보관합니다. */
const HISTORY_LIMIT = 20;

export type LayoutChangeKind = 'added' | 'modified' | 'removed';

export interface LayoutChange {
  /** blockType, 또는 fallback 이면 FALLBACK_KEY */
  key: string;
  kind: LayoutChangeKind;
}

export interface Deployment {
  version: number;
  deployedAt: string;
  changes: LayoutChange[];
}

export interface LayoutServerState {
  document: LayoutDocument;
  /** null 이면 한 번도 배포하지 않은 기본 스키마 */
  deployedAt: string | null;
  /** 최신 배포가 앞 */
  history: Deployment[];
}

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCY));
}

function seed(): LayoutServerState {
  return {
    // JSON import 는 리터럴 타입이 너무 구체적이라 경계에서 한 번 넓힙니다.
    document: structuredClone(layoutsJson) as unknown as LayoutDocument,
    deployedAt: null,
    history: [],
  };
}

/** 저장본의 모양이 틀리면(손상, 옛 형식) 기본 스키마로 돌아갑니다. */
function parseStored(raw: string | null): LayoutServerState | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || !isRecord(value['document'])) return null;

  const document = value['document'];
  const layouts = document['layouts'];
  if (typeof document['version'] !== 'number' || !isRecord(layouts)) {
    return null;
  }
  const all = [...Object.values(layouts), document['fallback']];
  if (!all.every((layout) => parseNodeLayout(layout).ok)) return null;

  return {
    document: document as unknown as LayoutDocument,
    deployedAt:
      typeof value['deployedAt'] === 'string' ? value['deployedAt'] : null,
    history: Array.isArray(value['history'])
      ? (value['history'] as Deployment[])
      : [],
  };
}

function readServer(): LayoutServerState {
  try {
    return parseStored(localStorage.getItem(STORAGE_KEY)) ?? seed();
  } catch {
    // 시크릿 모드 등에서 저장소를 못 써도 기본 스키마로는 돌아가야 합니다.
    return seed();
  }
}

function writeServer(state: LayoutServerState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** 두 레이아웃 묶음 사이에서 무엇이 추가·수정·삭제됐는지. 키 이름 순입니다. */
export function diffLayouts(
  before: Record<string, NodeLayout>,
  after: Record<string, NodeLayout>,
): LayoutChange[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.sort().flatMap((key): LayoutChange[] => {
    const prev = before[key];
    const next = after[key];
    if (!prev && next) return [{ key, kind: 'added' }];
    if (prev && !next) return [{ key, kind: 'removed' }];
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      return [{ key, kind: 'modified' }];
    }
    return [];
  });
}

/** fallback 까지 한 맵으로 펼칩니다. 비교와 편집을 같은 방식으로 하기 위해서입니다. */
export function flattenLayouts(
  document: Pick<LayoutDocument, 'layouts' | 'fallback'>,
): Record<string, NodeLayout> {
  return { ...document.layouts, [FALLBACK_KEY]: document.fallback };
}

// ── 엔드포인트 ────────────────────────────────────────────────────────

/** GET /scenarios/:id + GET /node-layouts — 캔버스 화면용 */
export async function fetchScenario(): Promise<ScenarioPayload> {
  await wait();
  const { scenario, blocks } = structuredClone(scenarioJson) as unknown as Omit<
    ScenarioPayload,
    'layouts'
  >;
  return { scenario, blocks, layouts: structuredClone(readServer().document) };
}

export interface ConsolePayload {
  server: LayoutServerState;
  /** 미리보기 샘플로 쓸 블록 문서들 */
  blocks: BlockDocument[];
}

/** GET /node-layouts (+ 이력) — 스키마 콘솔용 */
export async function fetchConsole(): Promise<ConsolePayload> {
  await wait();
  const { blocks } = structuredClone(scenarioJson) as unknown as {
    blocks: BlockDocument[];
  };
  return { server: structuredClone(readServer()), blocks };
}

/**
 * POST /node-layouts/deployments — 새 스키마를 배포합니다.
 *
 * 각 레이아웃은 서버에서도 다시 검증합니다. 클라이언트 검증을 믿고 깨진
 * 스키마를 받아 두면, 그걸 내려받는 모든 화면이 깨지기 때문입니다.
 *
 * @throws 검증 실패, 바뀐 것이 없음, 저장 실패
 */
export async function deployLayouts(
  next: Pick<LayoutDocument, 'layouts' | 'fallback'>,
): Promise<LayoutServerState> {
  await wait();
  const current = readServer();

  for (const [key, layout] of Object.entries(flattenLayouts(next))) {
    const result = parseNodeLayout(layout);
    if (!result.ok) throw new Error(`${key}: ${result.error}`);
  }

  const changes = diffLayouts(
    flattenLayouts(current.document),
    flattenLayouts(next),
  );
  if (changes.length === 0) throw new Error('배포할 변경이 없습니다.');

  const version = current.document.version + 1;
  const deployedAt = new Date().toISOString();
  const state: LayoutServerState = {
    document: {
      version,
      layouts: structuredClone(next.layouts),
      fallback: structuredClone(next.fallback),
    },
    deployedAt,
    history: [{ version, deployedAt, changes }, ...current.history].slice(
      0,
      HISTORY_LIMIT,
    ),
  };
  writeServer(state);
  return structuredClone(state);
}

/** DELETE /node-layouts/deployments — app/mocks 의 기본 스키마로 되돌립니다. */
export async function resetLayoutServer(): Promise<LayoutServerState> {
  await wait();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장소를 못 쓰는 환경이면 애초에 저장본도 없습니다.
  }
  return seed();
}
