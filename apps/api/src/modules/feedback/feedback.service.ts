export interface FeedbackContext {
  type: 'CORRECT' | 'INCORRECT';
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  streakCount?: number;
  isLinkedInMoment?: boolean; // Erro por desatenção ou gagueira conceitual
}

export class FeedbackEngine {
  private static correctMessages = {
    EASY: [
      "Boa, pitica! ❤️",
      "Mandou bem, gatinha! ✨",
      "Certinha! Vamos para a próxima! 🚀"
    ],
    MEDIUM: [
      "Essa é a minha garota! 🫶🏻",
      "Parabéns, pitica! Acertou em cheio! ❤️",
      "Aí sim! Sabia que você ia pegar de primeira! 🔥"
    ],
    HARD: [
      "ESSA É A MINHA GAROTA! 🫶🏻🔥",
      "Tá ficando perigosa demais nessa matéria! 👑",
      "Essa foi difícil e você amassou! Que orgulho! 💖"
    ]
  };

  private static incorrectMessages = [
    "Respira, calma lá... ❤️",
    "Calma, LinkedIn! 😂 Bora reajustar essa parte!",
    "Não foi dessa vez, pitica. Bora entender juntas essa parte! 🤝",
    "Calma, essa questão tentou te sabotar, mas a gente vai pegar ela! 🕵️‍♀️",
    "Tropeçamos nessa passarela, mas o look continua impecável. Bora tentar de novo! 👠"
  ];

  public static getFeedback(ctx: FeedbackContext): { message: string; streakText?: string } {
    if (ctx.type === 'CORRECT') {
      const difficulty = ctx.difficulty || 'MEDIUM';
      const list = this.correctMessages[difficulty];
      const randomIndex = Math.floor(Math.random() * list.length);
      const message = list[randomIndex];

      let streakText: string | undefined;
      if (ctx.streakCount && ctx.streakCount > 0) {
        streakText = `🔥 ${ctx.streakCount} dias seguidos! Orgulho demais de você!`;
      }

      return { message, streakText };
    } else {
      if (ctx.isLinkedInMoment) {
        return { message: "Calma, LinkedIn! 😂 Respira que essa questão tá querendo te enganar!" };
      }
      const randomIndex = Math.floor(Math.random() * this.incorrectMessages.length);
      return { message: this.incorrectMessages[randomIndex] };
    }
  }
}