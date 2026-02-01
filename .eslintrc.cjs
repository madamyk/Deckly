module.exports = {
  root: true,
  extends: ['expo', 'prettier'],
  rules: {
    // Keep the MVP strict but not annoying.
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};

