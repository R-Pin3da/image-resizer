module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json']
  },
  plugins: [
    '@typescript-eslint'
  ],
  ignorePatterns: [
    'dist/**', '.eslintrc.js', 'he.js'
  ],
  extends: ['eslint-config-standard', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'no-console': ['warn', {allow: ['warn', 'error']}],
    '@typescript-eslint/ban-types': 'off',
    'indent': ['error', 2, { "SwitchCase": 1 }],
    '@typescript-eslint/indent': ['error', 2],
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/prefer-readonly-parameter-types': 'off',
    '@typescript-eslint/no-magic-numbers': 'off',
    '@typescript-eslint/prefer-readonly': 'off',
    'no-process-exit': 'off',
    '@typescript-eslint/lines-between-class-members': 'off',
    '@typescript-eslint/array-type': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/restrict-plus-operands': 'off',
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/indent': 'off',
    'no-multi-spaces': 'error',
    'comma-spacing': 'error',
    'no-trailing-spaces': 'error',
    'no-unexpected-multiline': 'error',
    'space-in-parens': 'error',
    'space-infix-ops': 'error',
    'prefer-spread': 'off'
  }
}
