export type ExplainCardInput = {
  front: string;
  back: string;
};

export type GenerateExampleInput = {
  front: string;
  back: string;
};

export interface AiAssistProvider {
  explainCard(input: ExplainCardInput): Promise<{ explanation: string }>;
  generateExample(input: GenerateExampleInput): Promise<{ example: string }>;
}

