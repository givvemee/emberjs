import { modifier } from 'ember-modifier';

/** 엘리먼트에 무언가를 그리고, 치우는 함수를 돌려줍니다. */
export type Mounter = (element: HTMLElement) => Promise<() => void>;

/**
 * 다른 프레임워크(React 등)로 만든 "아일랜드"를 이 엘리먼트에 띄웁니다.
 *
 *   <div {{mountIsland this.mountApp}}></div>
 *
 * mounter 가 비동기인 건 아일랜드 코드를 동적 import 로 늦게 불러오기 위해서입니다.
 * 불러오는 사이에 엘리먼트가 사라지면(라우트 이탈) 도착하자마자 바로 치웁니다.
 */
export default modifier<{
  Element: HTMLElement;
  Args: { Positional: [Mounter] };
}>((element, [mounter]) => {
  let unmount: (() => void) | null = null;
  let destroyed = false;

  void mounter(element).then((cleanup) => {
    if (destroyed) cleanup();
    else unmount = cleanup;
  });

  return () => {
    destroyed = true;
    unmount?.();
  };
});
