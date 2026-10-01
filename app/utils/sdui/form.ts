import {
  childScope,
  interpolate,
  isRecord,
  lookup,
  rootScope,
  type FormField,
  type FormFieldType,
  type FormOption,
  type Scope,
} from 'emberjs/utils/sdui/schema';

/**
 * 폼 스키마(FormField) + 블록 문서 → 화면에 그릴 컨트롤(FormControl).
 *
 * 컨트롤마다 블록 문서 기준의 절대 경로(path)를 들고 있어서, 입력이 들어오면
 * 그 경로 하나만 바꾸면 됩니다. 컴포넌트는 경로가 무슨 뜻인지 모릅니다.
 */

export interface SelectChoice extends FormOption {
  selected: boolean;
}

export interface ListItem {
  index: number;
  title: string;
  controls: FormControl[];
}

interface ControlBase {
  /** 블록 문서 기준 절대 경로 */
  path: string;
  label: string;
  help: string;
}

export type FormControl =
  | (ControlBase & { kind: 'text'; value: string; placeholder: string })
  | (ControlBase & { kind: 'textarea'; value: string; placeholder: string })
  | (ControlBase & { kind: 'number'; value: string; min: number | undefined })
  | (ControlBase & { kind: 'toggle'; checked: boolean })
  | (ControlBase & { kind: 'select'; choices: SelectChoice[] })
  | (ControlBase & {
      kind: 'list';
      items: ListItem[];
      newItem: Record<string, unknown>;
      addLabel: string;
    })
  | { kind: 'unknown'; type: string };

/** "$blocks" 선택지를 채우는 데 필요한 것: 이 블록을 뺀 나머지 블록들 */
export interface BlockChoice {
  id: string;
  name: string;
}

interface FormContext {
  scope: Scope;
  /** scope.item 의 절대 경로. 최상위면 빈 문자열 */
  base: string;
  blocks: BlockChoice[];
}

type FieldOf<K extends FormFieldType> = Extract<FormField, { type: K }>;
type Builder<K extends FormFieldType> = (
  field: FieldOf<K>,
  base: ControlBase,
  context: FormContext,
) => FormControl;

function join(base: string, path: string): string {
  return base ? `${base}.${path}` : path;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value as string | number | boolean);
}

/** 새 프리미티브를 schema.ts 에 추가하고 여기를 빠뜨리면 컴파일 에러가 납니다. */
const BUILDERS: { [K in FormFieldType]: Builder<K> } = {
  text: (field, base, { scope }) => ({
    ...base,
    kind: 'text',
    value: text(lookup(scope, field.path)),
    placeholder: String(field.placeholder ?? ''),
  }),

  textarea: (field, base, { scope }) => ({
    ...base,
    kind: 'textarea',
    value: text(lookup(scope, field.path)),
    placeholder: String(field.placeholder ?? ''),
  }),

  number: (field, base, { scope }) => ({
    ...base,
    kind: 'number',
    value: text(lookup(scope, field.path)),
    min: typeof field.min === 'number' ? field.min : undefined,
  }),

  toggle: (field, base, { scope }) => ({
    ...base,
    kind: 'toggle',
    checked: Boolean(lookup(scope, field.path)),
  }),

  select: (field, base, { scope, blocks }) => {
    const current = text(lookup(scope, field.path));
    const options: FormOption[] =
      field.options === '$blocks'
        ? [
            { value: '', label: '(연결 안 함)' },
            ...blocks.map((block) => ({ value: block.id, label: block.name })),
          ]
        : Array.isArray(field.options)
          ? field.options.filter(isRecord).map((option) => ({
              value: text(option['value']),
              label: text(option['label'] ?? option['value']),
            }))
          : [];

    // 지금 값이 선택지에 없으면(삭제된 블록 등) 그대로 보여 줘야 값이 몰래 바뀌지 않습니다.
    if (!options.some((option) => option.value === current)) {
      options.push({ value: current, label: `⚠ 없는 값 (${current})` });
    }

    return {
      ...base,
      kind: 'select',
      choices: options.map((option) => ({
        ...option,
        selected: option.value === current,
      })),
    };
  },

  list: (field, base, context) => {
    const value = lookup(context.scope, field.source);
    const items = Array.isArray(value) ? value : [];
    return {
      ...base,
      kind: 'list',
      addLabel: String(field.addLabel ?? '항목 추가'),
      newItem: isRecord(field.newItem) ? field.newItem : {},
      items: items.map((item, index) => {
        const scope = childScope(context.scope, item, index);
        return {
          index,
          title: interpolate(field.itemTitle, scope) || `#${index + 1}`,
          controls: resolveFields(field.fields, {
            scope,
            base: join(base.path, String(index)),
            blocks: context.blocks,
          }),
        };
      }),
    };
  },
};

function isFieldType(type: string): type is FormFieldType {
  return Object.hasOwn(BUILDERS, type);
}

function resolveFields(fields: unknown, context: FormContext): FormControl[] {
  if (!Array.isArray(fields)) return [];

  return fields.flatMap((field: unknown): FormControl[] => {
    if (!isRecord(field) || typeof field['type'] !== 'string') return [];
    const type = field['type'];
    if (!isFieldType(type)) return [{ kind: 'unknown', type }];

    const relative = type === 'list' ? field['source'] : field['path'];
    if (typeof relative !== 'string') return [];

    const base: ControlBase = {
      path: join(context.base, relative),
      label: interpolate(field['label'], context.scope),
      help: text(field['help']),
    };
    // BUILDERS[type] 은 K 별 함수의 유니온이라 직접 부를 수 없습니다.
    // type 으로 이미 짝을 맞췄으므로 여기서 한 번만 넓힙니다.
    const build = BUILDERS[type] as Builder<FormFieldType>;
    return [build(field as unknown as FormField, base, context)];
  });
}

export function resolveForm(
  fields: unknown,
  doc: unknown,
  blocks: BlockChoice[],
): FormControl[] {
  return resolveFields(fields, { scope: rootScope(doc), base: '', blocks });
}
