import { tracked } from '@glimmer/tracking';

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2;

/** SVG 엣지 레이어가 쓰는 논리 캔버스 크기. 좌표계를 음수 영역까지 확장하기 위한 값. */
export const EDGE_PLANE = 40000;

/** 플로우 좌표계 위의 한 점 */
export interface Point {
  x: number;
  y: number;
}

/** 화면에 배치된 무언가. Viewport.fit / centerOn 이 이만큼만 요구합니다. */
export interface Boxed extends Point {
  width: number;
  height: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 위→아래로 흐르는 3차 베지어 경로.
 * 출발점에서 아래로, 도착점에서 위로 핸들을 뻗어 자연스러운 S 곡선을 만듭니다.
 */
export function bezierPath(source: Point, target: Point): string {
  const dy = Math.abs(target.y - source.y);
  const curve = Math.max(36, dy * 0.5);
  return [
    `M ${source.x},${source.y}`,
    `C ${source.x},${source.y + curve}`,
    `${target.x},${target.y - curve}`,
    `${target.x},${target.y}`,
  ].join(' ');
}

/**
 * 캔버스의 pan/zoom 상태.
 *
 * 화면 좌표(px, 캔버스 좌상단 기준)와 플로우 좌표 사이의 변환은
 *   screen = flow * zoom + offset
 * 이고, DOM에는 `translate(x, y) scale(zoom)` + `transform-origin: 0 0` 으로 그대로 적용됩니다.
 */
export class Viewport {
  @tracked x = 0;
  @tracked y = 0;
  @tracked zoom = 1;
  @tracked width = 0;
  @tracked height = 0;

  toFlow(screenX: number, screenY: number): Point {
    return {
      x: (screenX - this.x) / this.zoom,
      y: (screenY - this.y) / this.zoom,
    };
  }

  get center(): Point {
    return this.toFlow(this.width / 2, this.height / 2);
  }

  panBy(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  /** 주어진 화면상의 한 점을 고정한 채 확대/축소합니다 (커서 기준 줌). */
  zoomTo(
    nextZoom: number,
    screenX: number = this.width / 2,
    screenY: number = this.height / 2,
  ): void {
    const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const anchor = this.toFlow(screenX, screenY);
    this.x = screenX - anchor.x * zoom;
    this.y = screenY - anchor.y * zoom;
    this.zoom = zoom;
  }

  zoomBy(factor: number): void {
    this.zoomTo(this.zoom * factor);
  }

  centerOn(node: Boxed): void {
    if (!this.width) return;
    this.x = this.width / 2 - (node.x + node.width / 2) * this.zoom;
    this.y = this.height / 2 - (node.y + node.height / 2) * this.zoom;
  }

  /** 모든 노드가 한 화면에 들어오도록 맞춥니다. */
  fit(nodes: readonly Boxed[], padding = 72): void {
    if (!nodes.length || !this.width || !this.height) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    const width = Math.max(maxX - minX, 1);
    const height = Math.max(maxY - minY, 1);
    const zoom = clamp(
      Math.min(
        (this.width - padding * 2) / width,
        (this.height - padding * 2) / height,
      ),
      MIN_ZOOM,
      1,
    );

    this.zoom = zoom;
    this.x = this.width / 2 - (minX + width / 2) * zoom;
    this.y = this.height / 2 - (minY + height / 2) * zoom;
  }
}
