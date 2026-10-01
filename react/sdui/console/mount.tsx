import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import { SchemaConsole, type SchemaConsoleProps } from './SchemaConsole';

/**
 * Ember → React 경계 (스키마 콘솔). sdui/mount.tsx 와 같은 모양입니다.
 *
 * @returns 언마운트 함수
 */
export function mount(
  element: HTMLElement,
  props: SchemaConsoleProps,
): () => void {
  const root = createRoot(element);
  root.render(
    <StrictMode>
      <SchemaConsole {...props} />
    </StrictMode>,
  );
  return () => root.unmount();
}
