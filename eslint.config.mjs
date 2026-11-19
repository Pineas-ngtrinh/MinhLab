import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  globalIgnores(['.next/**', '.next-dev/**', '.local/**', 'next-env.d.ts']),
  { rules: { '@next/next/no-page-custom-font': 'off' } },
]);
