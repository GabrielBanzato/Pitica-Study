import { PrismaClient } from '@prisma/client';
import { QwenProvider } from './qwen.provider.js';

const prisma = new PrismaClient();

export class QuestionGeneratorService {
  /**
   * Pega o texto da transcrição ou do OCR e pede para o Qwen gerar
   * questões estruturadas em JSON com analogias em Modo Fashion!
   */
  public static async processAndGenerateQuestions(content: string, classId?: string, subjectId?: string) {
    const prompt = `
Você é a Tutora de IA do "Pitica Study", e seu nome é Sun (Sunfl.IA.wer), assistente de estudos de Nutrição da Lê (namorada do seu criador).
Com base no texto abaixo, crie 2 questões de múltipla escolha.

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS um JSON válido.
2. Crie APENAS perguntas afirmativas e diretas.
3. O campo "fashionText" deve conter uma analogia conceitual e leve sobre o assunto.
4. PROIBIDO USAR AS MESMAS PALAVRAS OU A MESMA METÁFORA DO "fashionText" NAS ALTERNATIVAS DAS QUESTÕES! As alternativas (A, B, C, D) devem avaliar o conceito farmacológico/fisiológico REAL do corpo humano, sem dar a resposta de mão beijada pela analogia.
5. SEU NOME É SUN, A TUTORA DE IA DA LÊ.

ESTRUTURA DO JSON ESPERADO:
{
  "topicName": "Nome do Tópico",
  "fashionText": "Analogia do mundo fashion explicando o conceito de forma conceitual...",
  "questions": [
    {
      "statement": "Enunciado focado na fisiologia/farmacologia real...",
      "options": {
        "A": "Conceito fisiológico A",
        "B": "Conceito fisiológico B",
        "C": "Conceito fisiológico C",
        "D": "Conceito fisiológico D"
      },
      "answer": "B",
      "explanation": "Explicação técnica do motivo da resposta."
    }
  ]
}

TEXTO PARA ANÁLISE:
"${content.substring(0, 3000)}"
`;

    try {
      const responseText = await QwenProvider.analyzeClassTranscript(prompt);
      
      // Tenta extrair e tratar o JSON da resposta do Qwen
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;
      
      if (jsonStart === -1 || jsonEnd === -1) {
        console.log('⚠️ Qwen não retornou um JSON limpo, usando fallback.');
        return;
      }

      const parsedData = JSON.parse(responseText.substring(jsonStart, jsonEnd));

      // Garante que a disciplina exista
      let subject = subjectId 
        ? await prisma.subject.findUnique({ where: { id: subjectId } })
        : await prisma.subject.findFirst();

      if (!subject) {
        subject = await prisma.subject.create({ data: { name: 'Nutrição Base' } });
      }

      // Se veio de uma aula, usa o classId; caso contrário, garante uma aula genérica
      let targetClassId = classId;
      if (!targetClassId) {
        let defaultClass = await prisma.class.findFirst({ where: { subjectId: subject.id } });
        if (!defaultClass) {
          defaultClass = await prisma.class.create({
            data: { title: 'Exercícios de Fixação', subjectId: subject.id, status: 'COMPLETED' }
          });
        }
        targetClassId = defaultClass.id;
      }

      // Salva o Tópico com o Modo Fashion
      const topic = await prisma.topic.create({
        data: {
          classId: targetClassId,
          name: parsedData.topicName || 'Tópico de Estudo',
          fashionText: parsedData.fashionText || 'Modo Fashion ativo! 👗✨'
        }
      });

      // Salva as questões geradas no PostgreSQL
      for (const q of parsedData.questions) {
        await prisma.question.create({
          data: {
            topicId: topic.id,
            statement: q.statement,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            difficulty: 'MEDIUM'
          }
        });
      }

      console.log(`✨ ${parsedData.questions.length} novas questões geradas para o Pitica Study!`);
    } catch (err) {
      console.error('❌ Erro na geração automática de questões via Qwen:', err);
    }
  }
}