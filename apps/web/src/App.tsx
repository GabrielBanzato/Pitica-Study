import React, { useState, useEffect } from 'react';
import { Upload, Video, Image, Heart, Flame, Sparkles, CheckCircle2, XCircle, ArrowRight, BookOpen, Map as MapIcon, Award, ShieldAlert, BookMarked, ToggleLeft, ToggleRight, Send, MessageCircle } from 'lucide-react';

type Tab = 'study' | 'exam' | 'glossary' | 'classes' | 'dashboard' | 'upload';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'study', label: 'Prática Diária', icon: <BookOpen size={18} /> },
  { id: 'exam', label: 'Modo Prova', icon: <span aria-hidden>⚔️</span> },
  { id: 'glossary', label: 'Glossário & Tópicos', icon: <BookMarked size={18} /> },
  { id: 'classes', label: 'Mapa de Aulas', icon: <MapIcon size={18} /> },
  { id: 'dashboard', label: 'Evolução', icon: <Award size={18} /> },
  { id: 'upload', label: 'Subir Aulas', icon: <Upload size={18} /> },
];

/** Junta classes CSS ignorando valores falsos. */
const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('study');
  const [classMessage, setClassMessage] = useState('');
  const [taskMessage, setTaskMessage] = useState('');
  const [uploadingClass, setUploadingClass] = useState(false);
  const [uploadingTask, setUploadingTask] = useState(false);

  // Prática Diária
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffledOptions, setShuffledOptions] = useState<[string, any][]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<any>(null);

  // Modo Prova
  const [examQuestions, setExamQuestions] = useState<any[]>([]);
  const [examIndex, setExamIndex] = useState(0);
  const [examSelected, setExamSelected] = useState<string | null>(null);
  const [examScore, setExamScore] = useState(0);
  const [examFinished, setExamFinished] = useState(false);
  const [loadingExam, setLoadingExam] = useState(false);

  // Glossário & Chat Sun 🌻
  const [topicsList, setTopicsList] = useState<any[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [isFashionMode, setIsFashionMode] = useState(true);
  const [chatMessages, setChatMessages] = useState<{
    id: string;
    sender: 'user' | 'ai';
    text: string;
    feedback?: 'like' | 'dislike';
  }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Dashboard & Aulas
  const [analytics, setAnalytics] = useState<any>(null);
  const [classList, setClassList] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboard();
    fetchQuestions();
    fetchClasses();
    fetchTopics();
  }, []);

  useEffect(() => {
    if (questions.length > 0 && questions[currentIndex]?.options) {
      const entries = Object.entries(questions[currentIndex].options);
      setShuffledOptions([...entries].sort(() => Math.random() - 0.5));
    }
  }, [questions, currentIndex]);

  useEffect(() => {
    setChatMessages([]);
  }, [selectedTopic]);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/analytics/dashboard');
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Erro ao buscar estatísticas', err);
    }
  };

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/learning/session');
      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar questões', err);
      setQuestions([]);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/classes');
      const data = await res.json();
      setClassList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar aulas', err);
      setClassList([]);
    }
  };

  const fetchTopics = async () => {
    try {
      const res = await fetch('/api/classes/topics');
      const data = await res.json();
      setTopicsList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar tópicos', err);
      setTopicsList([]);
    }
  };

  const handleTabClick = (tab: Tab) => {
    if (tab === 'exam') {
      startExamMode();
      return;
    }
    setActiveTab(tab);
    if (tab === 'glossary') fetchTopics();
    if (tab === 'classes') fetchClasses();
    if (tab === 'dashboard') fetchDashboard();
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !selectedTopic) return;

    const userText = chatInput.trim();
    const userMsgId = Date.now().toString();

    setChatMessages(prev => [...prev, { id: userMsgId, sender: 'user', text: userText }]);
    setChatInput('');
    setSendingChat(true);

    try {
      const topicContext = selectedTopic.academicText || selectedTopic.summary || selectedTopic.fashionText;

      const res = await fetch('/api/classes/topics/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicName: selectedTopic.name,
          topicContext,
          userQuestion: userText
        })
      });

      const data = await res.json();
      setChatMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: 'ai', text: data.answer }
      ]);
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: 'ai', text: 'Tive um probleminha ao conectar com o jardim, tente de novo! 🌻' }
      ]);
    } finally {
      setSendingChat(false);
    }
  };

  const handleFeedback = async (msgId: string, type: 'like' | 'dislike', msgText: string) => {
    setChatMessages(prev =>
      prev.map(msg => (msg.id === msgId ? { ...msg, feedback: type } : msg))
    );

    try {
      // Pergunta que originou esta resposta: a última mensagem da Lê antes dela
      const msgIndex = chatMessages.findIndex(m => m.id === msgId);
      const lastUserMsg = chatMessages.slice(0, msgIndex).reverse().find(m => m.sender === 'user')?.text || '';
      await fetch('/api/classes/topics/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicName: selectedTopic?.name,
          userQuestion: lastUserMsg,
          aiAnswer: msgText,
          feedback: type === 'like' ? 'util' : 'inutil'
        })
      });
    } catch (err) {
      console.error('Erro ao registrar feedback', err);
    }
  };

  const startExamMode = async () => {
    setActiveTab('exam');
    setLoadingExam(true);
    setExamFinished(false);
    setExamIndex(0);
    setExamScore(0);
    setExamSelected(null);
    try {
      const res = await fetch('/api/learning/exam-session');
      const data = await res.json();
      setExamQuestions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao gerar Modo Prova', err);
      setExamQuestions([]);
    } finally {
      setLoadingExam(false);
    }
  };

  const handleExamSubmit = () => {
    if (!examSelected) return;
    const currentExamQ = examQuestions[examIndex];
    if (examSelected === currentExamQ.answer) {
      setExamScore(prev => prev + 1);
    }

    if (examIndex < examQuestions.length - 1) {
      setExamIndex(prev => prev + 1);
      setExamSelected(null);
    } else {
      setExamFinished(true);
    }
  };

  const handleClassUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingClass(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/classes/upload', {
        method: 'POST', body: formData
      });
      const data = await res.json();
      setClassMessage((res.ok ? data.message : data.error) || (res.ok ? 'Aula enviada com sucesso! ❤️' : 'Erro ao enviar a aula! 😅'));
      fetchClasses();
      fetchTopics();
    } catch (err) {
      setClassMessage('Erro ao enviar a aula! 😅');
    } finally {
      setUploadingClass(false);
    }
  };

  const handleTaskUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTask(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/tasks/upload', {
        method: 'POST', body: formData
      });
      const data = await res.json();
      setTaskMessage((res.ok ? data.message : data.error) || (res.ok ? 'Print enviado! 📸' : 'Erro ao enviar o print! 😅'));
      fetchQuestions();
    } catch (err) {
      setTaskMessage('Erro ao enviar o print! 😅');
    } finally {
      setUploadingTask(false);
    }
  };

  const handleReanalyze = async (classId: string) => {
    await fetch(`/api/classes/reanalyze/${classId}`, { method: 'POST' });
    alert('Reanálise iniciada! A Sunfl.IA.wer buscará novos subtópicos.');
    fetchClasses();
  };

  const handleAnswerSubmit = async () => {
    if (!selectedOption) return;
    const currentQ = questions[currentIndex];

    try {
      const res = await fetch('/api/learning/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQ.id,
          selectedOption,
        })
      });
      const data = await res.json();
      setFeedbackResult(data);
      fetchDashboard();
    } catch (err) {
      console.error('Erro ao enviar resposta', err);
    }
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setFeedbackResult(null);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      fetchQuestions();
      setCurrentIndex(0);
    }
  };

  /** Estado visual de uma alternativa da Prática Diária. */
  const optionState = (key: string) => {
    if (selectedOption !== key) return null;
    if (!feedbackResult) return 'is-selected';
    return feedbackResult.isCorrect ? 'is-correct' : 'is-wrong';
  };

  const currentQ = questions[currentIndex];
  const currentExamQ = examQuestions[examIndex];
  const canSendChat = !sendingChat && chatInput.trim().length > 0;

  return (
    <div className="app">

      {/* Header */}
      <header className="header">
        <div>
          <h1 className="header__title">
            Pitica Study <Heart fill="currentColor" size={24} />
          </h1>
          <p className="header__subtitle">Sua aula. Seu jeito de aprender. ✨</p>
        </div>
        <div className="header__badges">
          <span className="badge badge--level">{analytics?.levelTitle || 'New Face 💖'}</span>
          <span className="badge badge--streak">
            <Flame color="#f97316" fill="#f97316" size={18} />
            {analytics?.streak || 0} dias de ofensiva!
          </span>
        </div>
      </header>

      {/* Navegação por Abas */}
      <nav className="tabs" aria-label="Seções">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={cx('tab', activeTab === tab.id && 'is-active')}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>

      {/* ABA PRÁTICA DIÁRIA */}
      {activeTab === 'study' && (
        currentQ ? (
          <div className="card">
            {currentQ.topic?.fashionText && (
              <div className="fashion-note">
                <Sparkles color="#c084fc" size={22} />
                <div className="fashion-note__body">
                  <strong className="fashion-note__title">Modo Fashion 👗 — {currentQ.topic.name}</strong>
                  <p className="fashion-note__text">{currentQ.topic.fashionText}</p>
                </div>
              </div>
            )}

            <h2 className="question-title">{currentQ.statement}</h2>

            <div className="options">
              {shuffledOptions.map(([originalKey, val], idx) => (
                <button
                  key={originalKey}
                  type="button"
                  className={cx('option', optionState(originalKey), feedbackResult && 'is-locked')}
                  onClick={() => !feedbackResult && setSelectedOption(originalKey)}
                >
                  <strong className="option__key">{String.fromCharCode(65 + idx)})</strong> {String(val)}
                </button>
              ))}
            </div>

            {!feedbackResult ? (
              <button type="button" className="btn-primary" onClick={handleAnswerSubmit} disabled={!selectedOption}>
                Conferir Resposta ✨
              </button>
            ) : (
              <div className={cx('result', feedbackResult.isCorrect ? 'result--correct' : 'result--wrong')}>
                <div className="result__head">
                  {feedbackResult.isCorrect ? <CheckCircle2 color="#34d399" size={28} /> : <XCircle color="#f87171" size={28} />}
                  <h3>{feedbackResult.feedback}</h3>
                </div>
                <p className="result__text">{feedbackResult.explanation}</p>
                <button type="button" className="btn-next" onClick={handleNextQuestion}>
                  Próxima Questão <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="card empty-state">
            <BookOpen size={48} color="#f43f5e" />
            <h3>Nenhuma questão pendente!</h3>
            <p>Suba uma aula nova na aba "Subir Aulas" para gerar mais questões!</p>
          </div>
        )
      )}

      {/* ABA GLOSSÁRIO & TÓPICOS */}
      {activeTab === 'glossary' && (
        <div>
          <div className="row-between glossary-head">
            <h2 className="section-title">Glossário de Tópicos Estudados</h2>
            <button
              type="button"
              className={cx('mode-toggle', isFashionMode ? 'mode-toggle--fashion' : 'mode-toggle--science')}
              onClick={() => setIsFashionMode(!isFashionMode)}
            >
              {isFashionMode ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              {isFashionMode ? 'Modo Fashion Ativo 👗' : 'Modo Científico Meigo Ativo 🔬'}
            </button>
          </div>

          {topicsList.length === 0 ? (
            <div className="card empty-state">
              <BookMarked size={48} color="#a855f7" />
              <h3>Glossário Vazio</h3>
              <p>Suba o vídeo de uma aula para a Sunfl.IA.wer mapear os tópicos!</p>
            </div>
          ) : (
            <>
              <div className="topic-grid">
                {topicsList.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    className={cx('topic-card', selectedTopic?.id === topic.id && 'is-active')}
                    onClick={() => setSelectedTopic(topic)}
                  >
                    <h3>{topic.name || 'Tópico'}</h3>
                    <p>
                      {isFashionMode
                        ? (topic.fashionSummary || topic.fashionText || topic.summary || 'Sem resumo disponível.')
                        : (topic.academicSummary || topic.academicText || topic.summary || 'Sem resumo disponível.')}
                    </p>
                  </button>
                ))}
              </div>

              {selectedTopic && (
                <div className={cx('topic-detail', !isFashionMode && 'topic-detail--science')}>
                  <span className="topic-detail__kicker">
                    {isFashionMode ? '👗 Explicação Modo Fashion' : '🔬 Explicação Científica Meiga'}
                  </span>
                  <h3>{selectedTopic.name}</h3>
                  <p className="topic-detail__text">
                    {isFashionMode
                      ? (selectedTopic.fashionText || selectedTopic.fashionSummary || selectedTopic.summary)
                      : (selectedTopic.academicText || selectedTopic.academicSummary || selectedTopic.summary)}
                  </p>

                  {/* Seção de Chat com a Sun 🌻 */}
                  <div className="chat">
                    <div className="chat__title">
                      <MessageCircle size={20} />
                      <strong>Tirar dúvida com a Sun 🌻 sobre este assunto:</strong>
                    </div>

                    {chatMessages.length > 0 && (
                      <div className="chat__messages">
                        {chatMessages.map((msg) => (
                          <div key={msg.id} className={cx('bubble', msg.sender === 'user' ? 'bubble--user' : 'bubble--ai')}>
                            {msg.sender === 'ai' && <span className="bubble__author">Sun 🌻</span>}

                            {msg.text}

                            {/* Botões Útil / Inútil */}
                            {msg.sender === 'ai' && (
                              <div className="bubble__feedback">
                                <span>Esta resposta foi útil?</span>
                                <button
                                  type="button"
                                  className={cx('chip', msg.feedback === 'like' && 'is-like')}
                                  onClick={() => handleFeedback(msg.id, 'like', msg.text)}
                                >
                                  👍 Útil
                                </button>
                                <button
                                  type="button"
                                  className={cx('chip', msg.feedback === 'dislike' && 'is-dislike')}
                                  onClick={() => handleFeedback(msg.id, 'dislike', msg.text)}
                                >
                                  👎 Inútil
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <form
                      className="chat__form"
                      onSubmit={(e) => { e.preventDefault(); handleSendChatMessage(); }}
                    >
                      <input
                        type="text"
                        className="chat__input"
                        placeholder="Ex: Qual fármaco age mais rápido no organismo?"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        enterKeyHint="send"
                      />
                      <button type="submit" className="chat__send" disabled={!canSendChat} aria-label="Enviar pergunta">
                        {sendingChat ? 'Pensando...' : <Send size={18} />}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ABA MODO PROVA */}
      {activeTab === 'exam' && (
        <div className="card">
          {loadingExam ? (
            <div className="centered">
              <Sparkles size={36} color="#f43f5e" />
              <p>Gerando simulado inédito com a Sunfl.IA.wer 🌻...</p>
            </div>
          ) : examFinished ? (
            <div className="centered">
              <Award size={48} color="#fde047" />
              <h2>Simulado Concluído! 🏆</h2>
              <p>
                Você acertou <strong className="highlight">{examScore}</strong> de {examQuestions.length} questões!
              </p>
              <button type="button" className="btn-primary btn-primary--inline" onClick={startExamMode}>
                Tentar Outro Simulado
              </button>
            </div>
          ) : currentExamQ ? (
            <div>
              <div className="row-between exam-meta">
                <span className="muted">Simulado Inédito Sem Dicas</span>
                <span className="exam-meta__progress">Questão {examIndex + 1} de {examQuestions.length}</span>
              </div>

              <h2 className="question-title">{currentExamQ.statement}</h2>

              <div className="options">
                {Object.entries(currentExamQ.options).map(([key, val]) => (
                  <button
                    key={key}
                    type="button"
                    className={cx('option', examSelected === key && 'is-selected')}
                    onClick={() => setExamSelected(key)}
                  >
                    <strong className="option__key">{key})</strong> {String(val)}
                  </button>
                ))}
              </div>

              <button type="button" className="btn-primary" onClick={handleExamSubmit} disabled={!examSelected}>
                {examIndex === examQuestions.length - 1 ? 'Finalizar Simulado 🏁' : 'Responder e Avançar ➔'}
              </button>
            </div>
          ) : (
            <p className="muted centered">Nenhum simulado disponível. Suba algumas aulas primeiro!</p>
          )}
        </div>
      )}

      {/* ABA EVOLUÇÃO */}
      {activeTab === 'dashboard' && analytics && (
        <div className="grid-2">
          <div className="card card--compact">
            <h3 className="stat__title"><Award color="#fde047" /> Pontuação & Nível</h3>
            <div className="stat__value highlight">{analytics.xp} XP</div>
            <p className="muted">
              Rank Atual: <strong style={{ color: '#c7d2fe' }}>{analytics.levelTitle}</strong>
            </p>
          </div>

          <div className="card card--compact">
            <h3 className="stat__title"><ShieldAlert color="#38bdf8" /> Banco de Questões</h3>
            <div className="stat__value" style={{ color: '#38bdf8' }}>{analytics.totalQuestions} Questões</div>
            <p className="muted">
              Distribuídas em {analytics.topicsCount} tópicos e {analytics.totalClasses} aulas processadas.
            </p>
          </div>
        </div>
      )}

      {/* ABA MAPA DE AULAS */}
      {activeTab === 'classes' && (
        <div className="stack">
          {classList.length === 0 ? (
            <div className="card empty-state">
              <Video size={48} color="#f43f5e" />
              <h3>Nenhuma aula encontrada!</h3>
              <p>Suba o arquivo da sua aula na aba "Subir Aulas" para a Sunfl.IA.wer criar seu mapa!</p>
            </div>
          ) : (
            classList.map((c) => (
              <div key={c.id} className="card card--compact">
                <div className="row-between class-card__head">
                  <h3>{c.title || 'Aula sem título'}</h3>
                  <div className="class-card__actions">
                    <button type="button" className="btn-reanalyze" onClick={() => handleReanalyze(c.id)}>
                      Analisar Novamente 🔄
                    </button>
                    <span className={cx('status', c.status === 'COMPLETED' ? 'status--done' : 'status--pending')}>
                      {c.status === 'COMPLETED' ? '✓ Processada' : '⏳ Processando'}
                    </span>
                  </div>
                </div>

                {c.transcript && <p className="class-card__summary">{c.transcript}</p>}

                {c.topics?.length > 0 && (
                  <div className="class-topics">
                    <strong className="class-topics__title">Tópicos Mapeados pela Sunfl.IA.wer 🌻</strong>
                    {c.topics.map((t: any) => (
                      <div key={t.id} className="class-topics__item">
                        <div className="class-topics__name">• {t.name}</div>
                        {(t.fashionSummary || t.academicSummary) && (
                          <div className="class-topics__summary">{t.fashionSummary || t.academicSummary}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ABA UPLOAD */}
      {activeTab === 'upload' && (
        <div className="grid-2">
          <div className="card card--compact">
            <div className="upload-card__head">
              <Video color="#f43f5e" size={24} />
              <h2>Minha Aula</h2>
            </div>
            <label className="dropzone">
              <Upload color="#94a3b8" size={32} />
              <span>{uploadingClass ? 'Enviando aula...' : 'Selecionar vídeo da aula'}</span>
              <input type="file" accept="video/*,audio/*" onChange={handleClassUpload} />
            </label>
            {classMessage && <p className="upload-card__message" style={{ color: '#38bdf8' }}>{classMessage}</p>}
          </div>

          {/* Card de Upload de Prints e PDFs */}
          <div className="card card--compact">
            <div className="upload-card__head">
              <Image color="#a855f7" size={24} />
              <h2>Tarefas, Prints & Resumos PDF</h2>
            </div>
            <label className="dropzone">
              <Upload color="#94a3b8" size={32} />
              <span>{uploadingTask ? 'Lendo arquivo e gerando questões...' : 'Selecionar imagem de print ou resumo em PDF'}</span>
              <input type="file" accept="image/*,application/pdf" onChange={handleTaskUpload} />
            </label>
            {taskMessage && <p className="upload-card__message" style={{ color: '#c084fc' }}>{taskMessage}</p>}
          </div>
        </div>
      )}

    </div>
  );
}
