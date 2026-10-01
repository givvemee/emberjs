import { useMemo, useState, type CSSProperties } from 'react';
import {
  deployLayouts,
  diffLayouts,
  flattenLayouts,
  resetLayoutServer,
  type ConsolePayload,
  type LayoutChangeKind,
  type LayoutServerState,
} from 'emberjs/utils/sdui/mock-api';
import { FALLBACK_KEY } from 'emberjs/utils/sdui/scenario';
import { parseNodeLayout, type NodeLayout } from 'emberjs/utils/sdui/schema';
import type { Navigate } from '../navigate';
import { Preview } from './Preview';

export interface SchemaConsoleProps {
  payload: ConsolePayload;
  navigate: Navigate;
}

/** 목록에 보일 레이아웃 하나의 상태 */
type KeyStatus = LayoutChangeKind | 'invalid' | 'same';

const STATUS_LABEL: Record<KeyStatus, string> = {
  added: '추가',
  modified: '수정',
  removed: '삭제',
  invalid: '오류',
  same: '',
};

const CHANGE_SIGN: Record<LayoutChangeKind, string> = {
  added: '+',
  modified: '~',
  removed: '−',
};

/** blockType 이름 규칙. $ 로 시작하는 키는 fallback 같은 예약어라 막습니다. */
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

type Notice = { tone: 'ok' | 'error'; text: string } | null;

type Parsed = { ok: true; layout: NodeLayout } | { ok: false; error: string };

function pretty(layout: NodeLayout): string {
  return JSON.stringify(layout, null, 2);
}

function textsOf(server: LayoutServerState): Record<string, string> {
  return Object.fromEntries(
    Object.entries(flattenLayouts(server.document)).map(([key, layout]) => [
      key,
      pretty(layout),
    ]),
  );
}

function parseText(text: string): Parsed {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: `JSON 문법 오류: ${(error as Error).message}` };
  }
  return parseNodeLayout(raw);
}

function keyLabel(key: string): string {
  return key === FALLBACK_KEY ? 'fallback' : key;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 새 blockType 의 출발점. 버튼 목록을 출구로 쓰는 가장 흔한 모양입니다. */
function newLayout(key: string): NodeLayout {
  return {
    label: key,
    icon: '◆',
    accent: '#475569',
    tint: '#f1f5f9',
    body: [
      { type: 'header', icon: '◆', title: '{{name}}', caption: key },
      { type: 'ports' },
    ],
    ports: [
      {
        source: 'editorData.blockData.0.user_choice',
        label: '{{name}}',
        target: '{{next}}',
      },
    ],
    form: [{ type: 'text', label: '블록 이름', path: 'name' }],
  };
}

/**
 * 서버가 내려줄 레이아웃 스키마를 관리하는 화면.
 *
 * 편집은 초안(drafts)에만 쌓이고, "배포"를 눌러야 mock 서버에 저장됩니다.
 * 캔버스 화면(/sdui)은 다음에 불러올 때 배포본을 받아 그립니다.
 *
 * 초안은 JSON 문자열로 들고 있습니다. 입력 도중의 깨진 JSON 도 그대로 남아야
 * 하기 때문입니다. 목록 상태와 배포 가능 여부는 매번 초안을 파싱해서 계산합니다.
 */
export function SchemaConsole({ payload, navigate }: SchemaConsoleProps) {
  const [server, setServer] = useState(payload.server);
  const [drafts, setDrafts] = useState(() => textsOf(payload.server));
  const [selected, setSelected] = useState(FALLBACK_KEY);
  const [newKey, setNewKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  /** 레이아웃별 마지막으로 올바르던 모양. 입력이 깨져 있는 동안 미리보기가 씁니다. */
  const [lastValid, setLastValid] = useState(() =>
    flattenLayouts(payload.server.document),
  );

  const deployed = useMemo(() => flattenLayouts(server.document), [server]);

  const parsed = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(drafts).map(([key, text]) => [key, parseText(text)]),
      ) as Record<string, Parsed>,
    [drafts],
  );

  /** 초안이 전부 올바르면 그 레이아웃 맵, 하나라도 깨졌으면 null */
  const validDrafts = useMemo(() => {
    const result: Record<string, NodeLayout> = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (!entry.ok) return null;
      result[key] = entry.layout;
    }
    return result;
  }, [parsed]);

  const changes = useMemo(() => {
    const ok = Object.fromEntries(
      Object.entries(parsed).flatMap(([key, entry]) =>
        entry.ok ? [[key, entry.layout]] : [],
      ),
    );
    return diffLayouts(deployed, ok);
  }, [parsed, deployed]);

  const keys = useMemo(() => {
    const all = new Set([...Object.keys(deployed), ...Object.keys(drafts)]);
    all.delete(FALLBACK_KEY);
    return [...[...all].sort(), FALLBACK_KEY];
  }, [deployed, drafts]);

  const statusOf = (key: string): KeyStatus => {
    const entry = parsed[key];
    if (entry && !entry.ok) return 'invalid';
    return changes.find((change) => change.key === key)?.kind ?? 'same';
  };

  const canDeploy = validDrafts !== null && changes.length > 0 && !busy;
  const invalidCount = Object.values(parsed).filter(
    (entry) => !entry.ok,
  ).length;

  const selectedText = drafts[selected];
  const selectedParsed = parsed[selected];
  const isRemoved = selectedText === undefined;
  const previewLayout = lastValid[selected] ?? deployed[selected];

  // ── 편집 ────────────────────────────────────────────────────────────

  const edit = (text: string) => {
    setDrafts((current) => ({ ...current, [selected]: text }));
    const result = parseText(text);
    if (result.ok) {
      setLastValid((current) => ({ ...current, [selected]: result.layout }));
    }
    setNotice(null);
  };

  const addKey = () => {
    const key = newKey.trim();
    if (!KEY_PATTERN.test(key)) {
      setNotice({
        tone: 'error',
        text: 'blockType 은 영문 소문자로 시작하고 소문자·숫자·_ 만 쓸 수 있습니다.',
      });
      return;
    }
    if (drafts[key] !== undefined) {
      setNotice({ tone: 'error', text: `"${key}" 레이아웃이 이미 있습니다.` });
      return;
    }
    const layout = deployed[key] ?? newLayout(key);
    setDrafts((current) => ({ ...current, [key]: pretty(layout) }));
    setLastValid((current) => ({ ...current, [key]: layout }));
    setSelected(key);
    setNewKey('');
    setNotice(null);
  };

  const removeSelected = () => {
    if (selected === FALLBACK_KEY) return;
    setDrafts((current) => {
      const next = { ...current };
      delete next[selected];
      return next;
    });
  };

  /** 선택한 레이아웃을 배포본으로. 배포본에 없던(새로 추가한) 것이면 초안에서 뺍니다. */
  const revertSelected = () => {
    const layout = deployed[selected];
    setDrafts((current) => {
      const next = { ...current };
      if (layout) next[selected] = pretty(layout);
      else delete next[selected];
      return next;
    });
    if (layout) setLastValid((current) => ({ ...current, [selected]: layout }));
    else setSelected(FALLBACK_KEY);
  };

  const discardAll = () => {
    setDrafts(textsOf(server));
    setLastValid(flattenLayouts(server.document));
    if (!(selected in deployed)) setSelected(FALLBACK_KEY);
    setNotice(null);
  };

  // ── 서버 ────────────────────────────────────────────────────────────

  const adopt = (state: LayoutServerState) => {
    setServer(state);
    setDrafts(textsOf(state));
    setLastValid(flattenLayouts(state.document));
    const keysNow = flattenLayouts(state.document);
    if (!(selected in keysNow)) setSelected(FALLBACK_KEY);
  };

  const deploy = async () => {
    if (!validDrafts) return;
    setBusy(true);
    setNotice(null);
    try {
      const { [FALLBACK_KEY]: fallback, ...layouts } = validDrafts;
      if (!fallback) throw new Error('fallback 레이아웃이 없습니다.');
      const state = await deployLayouts({ layouts, fallback });
      adopt(state);
      setNotice({
        tone: 'ok',
        text: `v${state.document.version} 을 배포했습니다. 캔버스 화면은 다음에 열 때 이 스키마를 받습니다.`,
      });
    } catch (error) {
      setNotice({ tone: 'error', text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const resetServer = async () => {
    setConfirmReset(false);
    setBusy(true);
    try {
      adopt(await resetLayoutServer());
      setNotice({
        tone: 'ok',
        text: '배포 기록을 지우고 app/mocks 의 기본 스키마로 되돌렸습니다.',
      });
    } finally {
      setBusy(false);
    }
  };

  const latest = server.history[0];

  return (
    <div className="builder">
      <header className="builder__bar">
        <div className="builder__brand">
          <button
            type="button"
            className="builder__home"
            title="SDUI 캔버스로"
            onClick={() => navigate('sdui')}
          >
            ←
          </button>
          <span className="builder__logo">{'{ }'}</span>
          <div>
            <h1>SDUI 스키마 콘솔</h1>
            <p>
              배포본 v{server.document.version}
              {server.deployedAt
                ? ` · ${formatTime(server.deployedAt)} 배포`
                : ' · 기본 스키마 (app/mocks)'}
            </p>
          </div>
        </div>

        <div className="builder__tools">
          {invalidCount > 0 ? (
            <span className="status status--error">오류 {invalidCount}개</span>
          ) : changes.length > 0 ? (
            <span className="status status--warn">
              배포 안 된 변경 {changes.length}개
            </span>
          ) : (
            <span className="status status--ok">배포본과 같음</span>
          )}
          <button
            type="button"
            className="btn"
            disabled={changes.length === 0 && invalidCount === 0}
            onClick={discardAll}
          >
            변경 버리기
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canDeploy}
            onClick={() => void deploy()}
          >
            {busy ? '배포 중…' : `v${server.document.version + 1} 배포`}
          </button>
        </div>
      </header>

      <div className="builder__body">
        <aside className="panel panel--left">
          <div className="panel__section">
            <h2 className="panel__title">레이아웃</h2>
            <p className="panel__caption">
              blockType 마다 노드를 그리는 법(body), 출구(ports), 편집
              폼(form)을 정합니다. 레이아웃이 없는 타입은 fallback 으로
              그려집니다.
            </p>
            <ul className="sdui-blocks">
              {keys.map((key) => {
                const status = statusOf(key);
                const layout = lastValid[key] ?? deployed[key];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={`sdui-blocks__item${key === selected ? ' is-selected' : ''}`}
                      style={
                        layout
                          ? ({
                              '--accent': layout.accent,
                              '--tint': layout.tint,
                            } as CSSProperties)
                          : undefined
                      }
                      onClick={() => setSelected(key)}
                    >
                      <span className="sdui-blocks__icon">
                        {layout?.icon ?? '?'}
                      </span>
                      <span className="sdui-blocks__text">
                        <strong>{keyLabel(key)}</strong>
                        <small>{layout?.label ?? ''}</small>
                      </span>
                      {status !== 'same' && (
                        <span className={`sdui-tag sdui-tag--${status}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <form
              className="sdui-console__add"
              onSubmit={(event) => {
                event.preventDefault();
                addKey();
              }}
            >
              <input
                className="sdui-control__input"
                placeholder="새 blockType (예: survey)"
                aria-label="새 blockType"
                value={newKey}
                onChange={(event) => setNewKey(event.target.value)}
              />
              <button type="submit" className="btn">
                추가
              </button>
            </form>
          </div>

          <div className="panel__section panel__section--grow">
            <h3 className="panel__subtitle">배포 이력</h3>
            {server.history.length === 0 ? (
              <p className="panel__empty">
                아직 배포한 적이 없습니다. 지금은 app/mocks 의 기본 스키마를
                내려주고 있습니다.
              </p>
            ) : (
              <ol className="sdui-history">
                {server.history.map((deployment) => (
                  <li key={deployment.version}>
                    <div className="sdui-history__head">
                      <strong>v{deployment.version}</strong>
                      <span>{formatTime(deployment.deployedAt)}</span>
                    </div>
                    <ul className="sdui-history__changes">
                      {deployment.changes.map((change) => (
                        <li
                          key={change.key}
                          className={`sdui-history__change is-${change.kind}`}
                        >
                          {CHANGE_SIGN[change.kind]} {keyLabel(change.key)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
            {confirmReset ? (
              <div className="sdui-console__confirm">
                <p>
                  배포 이력 {server.history.length}건을 지우고 기본 스키마로
                  되돌립니다. 되돌릴 수 없습니다.
                </p>
                <div className="sdui-console__actions">
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => void resetServer()}
                  >
                    초기화
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setConfirmReset(false)}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--danger"
                disabled={!latest || busy}
                onClick={() => setConfirmReset(true)}
              >
                서버를 기본 스키마로 초기화
              </button>
            )}
          </div>
        </aside>

        <section className="sdui-console__editor">
          <div className="sdui-console__editor-head">
            <div>
              <h2 className="panel__title">
                {keyLabel(selected)}
                {statusOf(selected) !== 'same' && (
                  <span className={`sdui-tag sdui-tag--${statusOf(selected)}`}>
                    {STATUS_LABEL[statusOf(selected)]}
                  </span>
                )}
              </h2>
              <p className="panel__caption">
                {selected === FALLBACK_KEY
                  ? '레이아웃이 없는 blockType 을 그릴 때 씁니다. 지울 수 없습니다.'
                  : `blockType 이 "${selected}" 인 블록을 그립니다.`}
              </p>
            </div>
            <div className="sdui-console__actions">
              <button
                type="button"
                className="btn"
                disabled={statusOf(selected) === 'same'}
                onClick={revertSelected}
              >
                이 레이아웃 되돌리기
              </button>
              {selected !== FALLBACK_KEY && !isRemoved && (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={removeSelected}
                >
                  삭제
                </button>
              )}
            </div>
          </div>

          {notice && (
            <p className={`sdui-console__notice is-${notice.tone}`}>
              {notice.text}
            </p>
          )}

          {isRemoved ? (
            <div className="sdui-console__removed">
              <p>
                이 레이아웃은 삭제 예정입니다. 배포하면 <code>{selected}</code>{' '}
                블록은 fallback 으로 그려집니다.
              </p>
              <button type="button" className="btn" onClick={revertSelected}>
                삭제 취소
              </button>
            </div>
          ) : (
            <>
              <textarea
                className={`sdui-code sdui-code--edit${selectedParsed && !selectedParsed.ok ? ' is-invalid' : ''}`}
                spellCheck={false}
                aria-label={`${keyLabel(selected)} 레이아웃 JSON`}
                value={selectedText}
                onChange={(event) => edit(event.target.value)}
              />
              {selectedParsed && !selectedParsed.ok && (
                <p className="sdui-inspector__error">{selectedParsed.error}</p>
              )}
            </>
          )}
        </section>

        {previewLayout && (
          <Preview
            layoutKey={selected}
            layout={previewLayout}
            deployedTypes={Object.keys(server.document.layouts)}
            blocks={payload.blocks}
          />
        )}
      </div>
    </div>
  );
}
