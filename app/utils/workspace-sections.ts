/**
 * 워크스페이스에 들어 있는 기능들의 레지스트리.
 *
 * 이 배열이 단일 출처입니다. 지금은 홈의 카드 런처가 읽지만, 나중에 상단
 * 탭 바를 붙이더라도 같은 배열을 읽으면 됩니다 — 기능을 추가할 때 손댈 곳이
 * 한 군데로 유지됩니다.
 *
 * 새 섹션을 추가하려면:
 *   1. 여기에 항목을 하나 넣고
 *   2. app/router.ts 에 같은 이름의 라우트를 선언합니다.
 *
 * 아직 만들지 않은 기능은 status: 'planned' 로 두면 카드가 비활성으로
 * 그려지고 링크가 걸리지 않습니다.
 */
export interface WorkspaceSection {
  /** router.ts 의 라우트 이름과 같아야 합니다 */
  route: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
  tint: string;
  status: 'ready' | 'planned';
  /** 카드에 칩으로 나열할 짧은 키워드 */
  highlights: readonly string[];
}

export const WORKSPACE_SECTIONS = [
  {
    route: 'flow',
    title: '플로우 빌더',
    description:
      '캔버스에서 노드를 이어 고객 응대 흐름을 설계합니다. 조건 분기와 검증을 지원합니다.',
    icon: '⇅',
    accent: '#2563eb',
    tint: '#eff6ff',
    status: 'ready',
    highlights: ['캔버스', '조건 분기', '실시간 검증'],
  },
] as const satisfies readonly WorkspaceSection[];

export function readySections(): readonly WorkspaceSection[] {
  return WORKSPACE_SECTIONS.filter((section) => section.status === 'ready');
}
