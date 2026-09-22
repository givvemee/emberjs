import { tracked } from '@glimmer/tracking';
import { htmlSafe } from '@ember/template';
import type { SafeString } from '@ember/template';
import {
  NODE_WIDTH,
  typeDef,
  type AnyNodeData,
  type NodeType,
  type ResolvedNodeDef,
} from 'emberjs/utils/node-types';
import type { Point } from 'emberjs/utils/flow-geometry';

let sequence = 0;

export function uid(prefix: string): string {
  sequence += 1;
  return `${prefix}_${sequence.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** 출력 포트 하나를 화면에 배치하기 위한 정보 */
export interface OutputPort {
  key: string;
  label: string;
  ratio: number;
  style: SafeString;
}

export interface FlowNodeInit {
  id?: string;
  type: NodeType;
  x: number;
  y: number;
  data?: Partial<AnyNodeData>;
}

export interface SerializedNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  data: AnyNodeData;
}

/**
 * 캔버스 위의 노드 하나.
 *
 * x/y/width/height/data 만 @tracked 입니다. 드래그로 x가 바뀌면 이 노드의 박스와
 * 이 노드에 연결된 엣지 경로만 다시 그려집니다 — 나머지 노드는 건드리지 않습니다.
 */
export class FlowNode {
  readonly id: string;
  readonly type: NodeType;

  @tracked x: number;
  @tracked y: number;
  @tracked data: AnyNodeData;

  /**
   * 실제 렌더된 크기. measure 모디파이어가 채워줍니다.
   * 인라인 모드에서 노드가 펼쳐지면 폭·높이가 모두 변하는데, 이 값이 tracked 라
   * 포트 위치와 연결선이 따로 손대지 않아도 같이 움직입니다.
   */
  @tracked width = NODE_WIDTH;
  @tracked height = 104;

  constructor({ id, type, x, y, data }: FlowNodeInit) {
    this.id = id ?? uid('node');
    this.type = type;
    this.x = x;
    this.y = y;
    this.data = { ...typeDef(type).defaults, ...data } as AnyNodeData;
  }

  get def(): ResolvedNodeDef {
    return typeDef(this.type);
  }

  get title(): string {
    return this.def.label;
  }

  get summary(): string {
    return this.def.summary(this.data);
  }

  /** 하단 출력 포트들. n개를 가로로 균등 분배합니다. */
  get outputPorts(): OutputPort[] {
    const outputs = this.def.outputs;
    return outputs.map((port, index) => {
      const ratio = (index + 1) / (outputs.length + 1);
      return {
        key: port.key,
        label: port.label,
        ratio,
        style: htmlSafe(`left: ${(ratio * 100).toFixed(3)}%`),
      };
    });
  }

  /** 출력 포트의 플로우 좌표 (엣지 시작점) */
  portPosition(portKey: string): Point {
    const port = this.outputPorts.find(
      (candidate) => candidate.key === portKey,
    );
    const ratio = port ? port.ratio : 0.5;
    return { x: this.x + this.width * ratio, y: this.y + this.height };
  }

  /** 입력 포트의 플로우 좌표 (엣지 도착점) */
  get inputPosition(): Point {
    return { x: this.x + this.width / 2, y: this.y };
  }

  moveTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  update(key: string, value: string | number): void {
    // 객체를 통째로 갈아끼워야 @tracked data 가 무효화됩니다.
    this.data = { ...this.data, [key]: value } as AnyNodeData;
  }

  toJSON(): SerializedNode {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      data: this.data,
    };
  }
}

export interface FlowEdgeInit {
  id?: string;
  from: string;
  port?: string;
  to: string;
}

export interface SerializedEdge {
  id: string;
  from: string;
  port: string;
  to: string;
}

/** 출력 포트 하나 → 다른 노드의 입력으로 가는 연결. */
export class FlowEdge {
  readonly id: string;
  readonly from: string;
  readonly port: string;
  readonly to: string;

  constructor({ id, from, port, to }: FlowEdgeInit) {
    this.id = id ?? uid('edge');
    this.from = from;
    this.port = port ?? 'next';
    this.to = to;
  }

  toJSON(): SerializedEdge {
    return { id: this.id, from: this.from, port: this.port, to: this.to };
  }
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** 처음 열었을 때 빈 캔버스 대신 보여줄 예시 플로우. */
export function seedGraph(): FlowGraph {
  const start = new FlowNode({ type: 'start', x: 320, y: 60 });
  const greet = new FlowNode({
    type: 'message',
    x: 320,
    y: 240,
    data: { text: '안녕하세요! 무엇을 도와드릴까요?', delay: 0 },
  });
  const branch = new FlowNode({
    type: 'condition',
    x: 320,
    y: 430,
    data: { attribute: 'replied', operator: 'eq', value: 'true' },
  });
  const followUp = new FlowNode({
    type: 'message',
    x: 100,
    y: 640,
    data: { text: '답변 감사합니다. 담당자가 곧 연결됩니다.', delay: 2 },
  });
  const done = new FlowNode({
    type: 'end',
    x: 560,
    y: 640,
    data: { reason: '무응답 종료' },
  });

  return {
    nodes: [start, greet, branch, followUp, done],
    edges: [
      new FlowEdge({ from: start.id, port: 'next', to: greet.id }),
      new FlowEdge({ from: greet.id, port: 'next', to: branch.id }),
      new FlowEdge({ from: branch.id, port: 'yes', to: followUp.id }),
      new FlowEdge({ from: branch.id, port: 'no', to: done.id }),
    ],
  };
}
