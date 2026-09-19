import { ApiReference } from '@scalar/nextjs-api-reference';

const config = {
  spec: {
    url: '/api/openapi.json',
  },
  theme: 'deepSpace' as const,
  darkMode: true,
  pageTitle: 'Skalybr API Reference',
};

export const GET = ApiReference(config);
