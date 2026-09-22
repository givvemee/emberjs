/**
 * 노드 설정 UI를 어떤 형태로 띄울지.
 *
 * 내용(NodeForm)은 모든 모드가 공유하고, 각 모드는 위치와 등장 방식만 다릅니다.
 */
export const PANEL_MODES = [
  {
    value: 'drawer',
    label: '드로어',
    hint: '우측에서 슬라이드, 캔버스 위에 겹침',
  },
  {
    value: 'popover',
    label: '팝오버',
    hint: '노드에 붙어 캔버스를 따라 움직임',
  },
  {
    value: 'modal',
    label: '모달',
    hint: '배경을 어둡게 하고 중앙에서 편집',
  },
  {
    value: 'docked',
    label: '고정 패널',
    hint: '항상 자리를 차지하고 캔버스를 밀어냄',
  },
  {
    value: 'inline',
    label: '노드 인라인',
    hint: '노드 박스가 펼쳐져 그 안에서 편집',
  },
];

export const DEFAULT_PANEL_MODE = 'drawer';

export function isPanelMode(value) {
  return PANEL_MODES.some((mode) => mode.value === value);
}
