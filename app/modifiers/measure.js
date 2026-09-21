import { modifier } from 'ember-modifier';

/**
 * 엘리먼트의 실제 크기를 ResizeObserver로 관찰해 콜백에 넘깁니다.
 *
 *   <div {{measure this.setSize}}>…</div>
 *
 * 노드 높이는 내용(메시지 길이 등)에 따라 달라지는데, 엣지를 노드 아래쪽 가장자리에
 * 붙이려면 그 높이를 알아야 합니다. 값을 하드코딩하는 대신 측정해서 씁니다.
 */
export default modifier((element, [callback]) => {
  if (typeof ResizeObserver === 'undefined') return;

  const observer = new ResizeObserver(([entry]) => {
    const box = entry.borderBoxSize?.[0];
    const height = box ? box.blockSize : entry.contentRect.height;
    const width = box ? box.inlineSize : entry.contentRect.width;
    callback(height, width);
  });

  observer.observe(element);
  return () => observer.disconnect();
});
