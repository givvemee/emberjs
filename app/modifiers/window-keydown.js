import { modifier } from 'ember-modifier';

/**
 * 창 전체의 keydown 을 듣습니다.
 *
 * Delete/Escape 같은 단축키는 특정 엘리먼트에 포커스가 있든 없든 동작해야 합니다.
 * 캔버스 드래그는 pointerdown 에서 preventDefault 하기 때문에 포커스가 옮겨가지
 * 않아서, tabindex + 엘리먼트 리스너로는 잡히지 않습니다.
 */
export default modifier((_element, [handler]) => {
  const listener = (event) => handler(event);
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
});
