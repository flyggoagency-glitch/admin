import type { OpenNextConfig } from 'open-next/types/open-next.js';

export default {
  default: {
    override: {
      wrapper: 'cloudflare-node',
      converter: 'edge',
      generateProvider: 'cloudflare',
    },
  },
  middleware: {
    external: true,
    override: {
      wrapper: 'cloudflare-edge',
      converter: 'edge',
      proxyExternalRequest: 'fetch',
    },
  },
  dangerous: {
    enableCacheInterception: false,
  },
} satisfies OpenNextConfig;
