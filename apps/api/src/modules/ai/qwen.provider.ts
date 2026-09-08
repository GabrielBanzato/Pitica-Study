export class QwenProvider {
  private static ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  private static modelName = process.env.QWEN_MODEL || 'qwen2.5';

  /**
   * Encaminha um prompt já estruturado pelo chamador para o Qwen via Ollama.
   */
  public static async analyzeClassTranscript(prompt: string) {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na chamada ao Ollama: ${response.statusText}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Erro no QwenProvider:', error);
      throw error;
    }
  }
}