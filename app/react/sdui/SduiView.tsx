import { Handle, Position } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { PortStatus, ViewNode } from 'emberjs/utils/sdui/resolve';

const PORT_TITLES: Record<PortStatus, string> = {
  connected: '다음 블록으로 연결됨 · 끌어서 다른 블록에 다시 연결',
  open: '연결되지 않은 출구 · 끌어서 블록에 연결',
  broken: '존재하지 않는 블록을 가리킵니다 · 끌어서 다시 연결',
};

function clampStyle(lines: number): CSSProperties | undefined {
  if (lines <= 0) return undefined;
  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    overflow: 'hidden',
  };
}

/**
 * 뷰 트리의 노드 하나를 그립니다. section 은 자기 자신을 재귀로 씁니다.
 *
 * 값은 전부 resolve 단계에서 완성된 문자열이라 이 컴포넌트는 데이터 경로를
 * 모릅니다. 텍스트로만 렌더하므로 서버 값이 HTML 로 해석될 일도 없습니다.
 */
export function SduiView({ node }: { node: ViewNode }) {
  switch (node.kind) {
    case 'header':
      return (
        <header className="sdui-header">
          {node.icon && <span className="sdui-header__icon">{node.icon}</span>}
          <div className="sdui-header__text">
            <strong className="sdui-header__title">{node.title}</strong>
            {node.caption && (
              <span className="sdui-header__caption">{node.caption}</span>
            )}
          </div>
        </header>
      );

    case 'text':
      return (
        <p
          className={`sdui-text sdui-text--${node.tone}${node.isEmpty ? ' is-empty' : ''}`}
          style={clampStyle(node.lines)}
        >
          {node.text}
        </p>
      );

    case 'field':
      return (
        <div className={`sdui-field${node.isEmpty ? ' is-empty' : ''}`}>
          <span className="sdui-field__label">{node.label}</span>
          <span
            className={`sdui-field__value${node.mono ? ' is-mono' : ''}`}
            title={node.value}
          >
            {node.value}
          </span>
        </div>
      );

    case 'chips':
      return (
        <div className="sdui-chips">
          {node.label && (
            <span className="sdui-chips__label">{node.label}</span>
          )}
          {node.items.length > 0 ? (
            <ul className="sdui-chips__list">
              {node.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : (
            node.empty && (
              <span className="sdui-chips__empty">{node.empty}</span>
            )
          )}
        </div>
      );

    case 'section':
      return (
        <section className="sdui-section">
          {node.title && <h4 className="sdui-section__title">{node.title}</h4>}
          {node.children.map((child, index) => (
            <SduiView key={index} node={child} />
          ))}
        </section>
      );

    case 'divider':
      return <hr className="sdui-divider" />;

    case 'ports':
      // 출구마다 xyflow Handle 을 둡니다. 레이아웃이 포트를 본문 어디에 놓든
      // xyflow 가 Handle 위치를 재서 연결선을 붙여 줍니다.
      return (
        <ul className="sdui-ports">
          {node.ports.map((port) => (
            <li
              key={port.key}
              className={`sdui-port sdui-port--${port.status}`}
              title={PORT_TITLES[port.status]}
            >
              <span className="sdui-port__label">{port.label}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={port.key}
                className="sdui-port__dot"
                isConnectable={port.targetPath !== null}
              />
            </li>
          ))}
        </ul>
      );

    case 'unknown':
      return (
        <p className="sdui-unknown">
          알 수 없는 요소 <code>{node.type}</code>
        </p>
      );
  }
}
