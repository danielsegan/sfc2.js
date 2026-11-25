import tseslint from 'typescript-eslint';

const mathBanned = [
  'random', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh',
  'exp', 'expm1', 'log', 'log2', 'log10', 'log1p', 'pow', 'sqrt', 'cbrt', 'hypot', 'fround',
].map((property) => ({ object: 'Math', property, message: 'banned in sim packages' }));

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', '**/target/**', '**/*.test.ts', 'tools/**'] },
  {
    files: ['engine/core/**/*.ts', 'engine/sim/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { sourceType: 'module', ecmaVersion: 2022 },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'no wall clock in sim packages' },
        { name: 'performance', message: 'no wall clock in sim packages' },
        { name: 'Promise', message: 'no promises in sim packages' },
        { name: 'queueMicrotask', message: 'no event loop in sim packages' },
        { name: 'setTimeout', message: 'no timers in sim packages' },
        { name: 'setInterval', message: 'no timers in sim packages' },
        { name: 'requestAnimationFrame', message: 'no frame callbacks in sim packages' },
        { name: 'fetch', message: 'no IO in sim packages' },
        { name: 'Intl', message: 'no locale APIs in sim packages' },
        { name: 'BigInt', message: 'BigInt is tests-only' },
      ],
      'no-restricted-properties': [
        'error',
        ...mathBanned,
        { object: 'Object', property: 'keys', message: 'no object iteration in sim packages' },
        { object: 'Object', property: 'values', message: 'no object iteration in sim packages' },
        { object: 'Object', property: 'entries', message: 'no object iteration in sim packages' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'ForInStatement', message: 'for-in is banned in sim packages' },
        { selector: 'AwaitExpression', message: 'await is banned in sim packages' },
        { selector: 'BinaryExpression[operator="/"]', message: 'raw / is banned; use fx.div or fx.idiv' },
        { selector: 'BinaryExpression[operator="**"]', message: '** is banned in sim packages' },
      ],
    },
  },
);
