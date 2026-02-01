// Dev-only configuration extras.
// NOTE: Anything placed in `extra` can end up in the JS bundle. Do NOT use this for production secrets.
const appJson = require('./app.json');

module.exports = () => {
  const base = appJson.expo;

  const devOpenAiApiKey =
    process.env.NODE_ENV !== 'production' ? process.env.DECKLY_DEV_OPENAI_API_KEY || null : null;

  return {
    ...base,
    extra: {
      ...(base.extra ?? {}),
      devOpenAiApiKey,
    },
  };
};

