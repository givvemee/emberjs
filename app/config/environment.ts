import loadConfigFromMeta from '@embroider/config-meta-loader';
import { assert } from '@ember/debug';

export interface AppConfig {
  modulePrefix: string;
  podModulePrefix?: string;
  environment: string;
  rootURL: string;
  locationType: 'history' | 'hash' | 'none';
  APP: Record<string, unknown>;
}

const config = loadConfigFromMeta('emberjs');

assert(
  'config is not an object',
  typeof config === 'object' && config !== null,
);
assert(
  'modulePrefix was not detected on your config',
  'modulePrefix' in config && typeof config['modulePrefix'] === 'string',
);
assert(
  'locationType was not detected on your config',
  'locationType' in config && typeof config['locationType'] === 'string',
);
assert(
  'rootURL was not detected on your config',
  'rootURL' in config && typeof config['rootURL'] === 'string',
);
assert(
  'APP was not detected on your config',
  'APP' in config && typeof config['APP'] === 'object',
);

// 위 assert 들이 런타임에서 형태를 보장하므로, 여기서 한 번만 좁힙니다.
export default config as unknown as AppConfig;
