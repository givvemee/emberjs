import { useState } from 'react';

/**
 * 고치는 즉시 반영되는 JSON 편집기.
 *
 * 파싱이나 검증에 실패해도 사용자가 친 글자는 draft 로 남기고, 반영된 값은
 * 마지막으로 성공한 상태를 유지합니다. 대상이 바뀌면 부모가 key 를 바꿔 이
 * 컴포넌트를 새로 만들고, 그때 draft 가 비워집니다.
 */
export function JsonEditor({
  value,
  apply,
  label,
}: {
  value: unknown;
  /** 파싱된 값을 반영합니다. 거절하면 오류 메시지를, 받아들이면 null 을 돌려줍니다. */
  apply: (parsed: unknown) => string | null;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onChange = (text: string) => {
    setDraft(text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (cause) {
      setError(`JSON 문법 오류: ${(cause as Error).message}`);
      return;
    }
    setError(apply(parsed));
  };

  return (
    <>
      <textarea
        className={`sdui-code sdui-code--edit${error ? ' is-invalid' : ''}`}
        spellCheck={false}
        aria-label={label}
        value={draft ?? JSON.stringify(value, null, 2)}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <p className="sdui-inspector__error">{error}</p>}
    </>
  );
}
