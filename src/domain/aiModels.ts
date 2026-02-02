export type AiModelOption = {
  label: string;
  value: string;
};

export const AI_MODELS: AiModelOption[] = [
  { label: 'gpt-5 (default)', value: 'gpt-5' },
  { label: 'gpt-5-mini', value: 'gpt-5-mini' },
  { label: 'gpt-5-nano', value: 'gpt-5-nano' },
  { label: 'gpt-4.1-mini', value: 'gpt-4.1-mini' },
  { label: 'gpt-4o-mini', value: 'gpt-4o-mini' },
  { label: 'gpt-4o', value: 'gpt-4o' },
];

export function getAiModelLabel(model: string): string {
  const found = AI_MODELS.find((m) => m.value === model);
  return found?.label ?? model;
}
