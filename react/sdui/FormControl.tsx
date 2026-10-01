import type { FormControl as Control } from 'emberjs/utils/sdui/form';
import { useScenario } from './context';

/**
 * 서버 폼 스키마의 컨트롤 하나. list 는 항목마다 자기 자신을 재귀로 씁니다.
 *
 * 입력이 들어오면 컨트롤이 들고 있는 절대 경로로 'set' 을 보낼 뿐, 그 경로가
 * 버튼명인지 메시지인지는 모릅니다.
 */
export function FormControl({
  control,
  blockId,
}: {
  control: Control;
  blockId: string;
}) {
  const { dispatch } = useScenario();
  const set = (path: string, value: unknown) =>
    dispatch({ type: 'set', id: blockId, path, value });

  switch (control.kind) {
    case 'text':
    case 'textarea': {
      const Input = control.kind === 'text' ? 'input' : 'textarea';
      return (
        <label className="sdui-control">
          <span className="sdui-control__label">{control.label}</span>
          <Input
            className="sdui-control__input"
            value={control.value}
            placeholder={control.placeholder}
            rows={control.kind === 'textarea' ? 3 : undefined}
            onChange={(event) => set(control.path, event.target.value)}
          />
          {control.help && (
            <small className="sdui-control__help">{control.help}</small>
          )}
        </label>
      );
    }

    case 'number':
      return (
        <label className="sdui-control">
          <span className="sdui-control__label">{control.label}</span>
          <input
            type="number"
            className="sdui-control__input"
            value={control.value}
            min={control.min}
            // 지우는 중의 빈 칸은 빈 칸으로 둡니다. 0 으로 바꾸면 입력이 튑니다.
            onChange={(event) =>
              set(
                control.path,
                event.target.value === '' ? '' : Number(event.target.value),
              )
            }
          />
        </label>
      );

    case 'toggle':
      return (
        <label className="sdui-control sdui-control--toggle">
          <input
            type="checkbox"
            checked={control.checked}
            onChange={(event) => set(control.path, event.target.checked)}
          />
          <span className="sdui-control__label">{control.label}</span>
        </label>
      );

    case 'select':
      return (
        <label className="sdui-control">
          <span className="sdui-control__label">{control.label}</span>
          <select
            className="sdui-control__input"
            value={control.choices.find((choice) => choice.selected)?.value}
            onChange={(event) => set(control.path, event.target.value)}
          >
            {control.choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      );

    case 'list':
      return (
        <fieldset className="sdui-list">
          <legend className="sdui-control__label">{control.label}</legend>
          {control.items.length === 0 && (
            <p className="panel__empty">항목이 없습니다.</p>
          )}
          {control.items.map((item) => (
            <div key={item.index} className="sdui-list__item">
              <div className="sdui-list__head">
                <strong>{item.title}</strong>
                <button
                  type="button"
                  className="sdui-list__remove"
                  onClick={() =>
                    dispatch({
                      type: 'removeItem',
                      id: blockId,
                      path: control.path,
                      index: item.index,
                    })
                  }
                >
                  삭제
                </button>
              </div>
              {item.controls.map((child, index) => (
                <FormControl key={index} control={child} blockId={blockId} />
              ))}
            </div>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() =>
              dispatch({
                type: 'addItem',
                id: blockId,
                path: control.path,
                item: control.newItem,
              })
            }
          >
            + {control.addLabel}
          </button>
        </fieldset>
      );

    case 'unknown':
      return (
        <p className="sdui-unknown">
          알 수 없는 폼 필드 <code>{control.type}</code>
        </p>
      );
  }
}
