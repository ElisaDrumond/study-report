import { FlatCompat } from '@eslint/eslintrc';
import prettier from 'eslint-config-prettier/flat';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.next-production/**',
      '.test-build/**',
      'data/**',
      'next-env.d.ts',
      'public/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'import/no-cycle': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['tests/**/*.cjs', 'scripts/**/*.cjs'],
    rules: {
      // These are native Node CommonJS entry points, not browser modules.
      '@typescript-eslint/no-require-imports': 'off',
      // Verification commands report outcomes to stdout; application code may not.
      'no-console': ['error', { allow: ['log', 'warn', 'error'] }],
    },
  },
];

export default eslintConfig;
