/**
 * React 화면에서 갈 수 있는 Ember 라우트.
 *
 * 라우팅은 Ember 가 하므로 React 는 이동을 직접 하지 않고, 경계 컴포넌트가
 * 넘겨준 navigate 를 부릅니다. 라우트 이름을 여기 모아 두면 router.ts 와
 * 어긋났을 때 한 곳만 보면 됩니다.
 */
export type SduiRoute = 'index' | 'sdui' | 'sdui-schema';

export type Navigate = (to: SduiRoute) => void;
