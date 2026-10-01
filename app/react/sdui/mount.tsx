import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import { SduiApp, type SduiAppProps } from 'emberjs/react/sdui/SduiApp';

/**
 * Ember → React 경계. Ember 쪽(mount-island 모디파이어)은 이 함수만 압니다.
 *
 * 이 모듈은 /sdui 라우트에 들어갈 때 동적 import 로 불러옵니다. React ·
 * react-dom · xyflow 가 이 청크에만 들어가므로 다른 화면의 번들은 그대로입니다.
 *
 * @returns 언마운트 함수
 */
export function mount(element: HTMLElement, props: SduiAppProps): () => void {
  const root = createRoot(element);
  root.render(
    <StrictMode>
      <SduiApp {...props} />
    </StrictMode>,
  );
  return () => root.unmount();
}
