import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends(
    'next/core-web-vitals',
    'next/typescript',
    'plugin:import/recommended',
    'prettier',
    'plugin:prettier/recommended'
  ),
  {
    // `server-only` / `client-only` are Next.js boundary markers that ship an
    // `exports`-only package layout. TypeScript and webpack resolve them, but
    // eslint-plugin-import's resolver doesn't follow `exports` here — treat them
    // as core modules so `import/no-unresolved` doesn't false-positive.
    settings: {
      'import/core-modules': ['server-only', 'client-only'],
    },
  },
];

export default eslintConfig;
