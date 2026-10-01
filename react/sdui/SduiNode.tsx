import { useEffect, type CSSProperties } from 'react';
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { useScenario } from './context';
import { SduiView } from './SduiView';

/** 노드 배열에는 위치만 둡니다. 내용은 context 에서 id 로 읽습니다. */
export type SduiFlowNode = Node<Record<string, never>, 'sdui'>;

/**
 * xyflow 의 커스텀 노드 타입 'sdui'.
 *
 * 테두리·테마 색·입력 Handle 처럼 모든 노드에 공통인 틀만 여기 있고, 안쪽
 * 내용은 전부 서버 레이아웃이 정합니다.
 */
export function SduiNode({ id, selected }: NodeProps<SduiFlowNode>) {
  const { blockById } = useScenario();
  const block = blockById.get(id);
  const updateNodeInternals = useUpdateNodeInternals();

  // 레이아웃·데이터 편집으로 포트가 늘거나 순서가 바뀌면 Handle 위치를 다시
  // 재게 합니다. 노드 크기가 그대로면 xyflow 가 스스로 알아차리지 못합니다.
  const body = block?.body;
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, body, updateNodeInternals]);

  if (!block) return null;
  const { layout, isFallback } = block.layoutInUse;
  const theme = {
    '--accent': layout.accent,
    '--tint': layout.tint,
  } as CSSProperties;

  const classes = ['sdui-node__frame'];
  if (selected) classes.push('is-selected');
  if (isFallback) classes.push('is-fallback');

  return (
    <div className={classes.join(' ')} style={theme}>
      <Handle
        type="target"
        position={Position.Left}
        className="sdui-node__input"
      />
      {block.body.map((part, index) => (
        <SduiView key={index} node={part} />
      ))}
    </div>
  );
}
