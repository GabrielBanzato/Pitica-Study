import React, { useState, useEffect } from 'react';
import { Upload, Video, Image, Heart, Flame, Sparkles, CheckCircle2, XCircle, ArrowRight, BookOpen, Map, Award, ShieldAlert, BookMarked, ToggleLeft, ToggleRight, Send, MessageCircle } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'study' | 'exam' | 'glossary' | 'classes' | 'dashboard' | 'upload'>('study');
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
      const res = await fetch('http://localhost:3000/api/analytics/dashboard');
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Erro ao buscar estatísticas', err);
    }
  };

  const fetchQuestions = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/learning/session');
      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar questões', err);
      setQuestions([]);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/classes');
      const data = await res.json();
      setClassList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar aulas', err);
      setClassList([]);
    }
  };

  const fetchTopics = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/classes/topics');
      const data = await res.json();
      setTopicsList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar tópicos', err);
      setTopicsList([]);
    }
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

      const res = await fetch('http://localhost:3000/api/classes/topics/chat', {
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
      const lastUserMsg = chatMessages.find(m => m.sender === 'user')?.text || '';
      await fetch('http://localhost:3000/api/classes/topics/chat/feedback', {
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
      const res = await fetch('http://localhost:3000/api/learning/exam-session');
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
      const res = await fetch('http://localhost:3000/api/classes/upload', {
        method: 'POST', body: formData
      });
      const data = await res.json();
      setClassMessage(data.message || 'Aula enviada com sucesso! ❤️');
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
      const res = await fetch('http://localhost:3000/api/tasks/upload', {
        method: 'POST', body: formData
      });
      const data = await res.json();
      setTaskMessage(data.message || 'Print enviado! 📸');
      fetchQuestions();
    } catch (err) {
      setTaskMessage('Erro ao enviar o print! 😅');
    } finally {
      setUploadingTask(false);
    }
  };

  const handleAnswerSubmit = async () => {
    if (!selectedOption) return;
    const currentQ = questions[currentIndex];

    try {
      const res = await fetch('http://localhost:3000/api/learning/answer', {
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

  const currentQ = questions[currentIndex];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Pitica Study <Heart fill="#f43f5e" size={24} />
          </h1>
          <p style={{ color: '#94a3b8', marginTop: '4px' }}>Sua aula. Seu jeito de aprender. ✨</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ background: '#312e81', color: '#c7d2fe', padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
            {analytics?.levelTitle || 'New Face 💖'}
          </span>
          <div style={{ background: '#1e293b', padding: '10px 18px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #334155' }}>
            <Flame color="#f97316" fill="#f97316" size={20} />
            <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>{analytics?.streak || 0} dias de ofensiva!</span>
          </div>
        </div>
      </header>

      {/* Navegação por Abas */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('study')}
          style={{
            padding: '12px 20px', borderRadius: '12px', border: 'none',
            background: activeTab === 'study' ? '#f43f5e' : '#1e293b', color: '#fff',
            fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <BookOpen size={18} /> Prática Diária
        </button>

        <button
          onClick={startExamMode}
          style={{
            padding: '12px 20px', borderRadius: '12px', border: 'none',
            background: activeTab === 'exam' ? '#f43f5e' : '#1e293b', color: '#fff',
            fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          ⚔️ Modo Prova
        </button>

        <button
          onClick={() => { setActiveTab('glossary'); fetchTopics(); }}
          style={{
            padding: '12px 20px', borderRadius: '12px', border: 'none',
            background: activeTab === 'glossary' ? '#f43f5e' : '#1e293b', color: '#fff',
            fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <BookMarked size={18} /> Glossário & Tópicos
        </button>
        
        <button
          onClick={() => { setActiveTab('classes'); fetchClasses(); }}
          style={{
            padding: '12px 20px', borderRadius: '12px', border: 'none',
            background: activeTab === 'classes' ? '#f43f5e' : '#1e293b', color: '#fff',
            fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <Map size={18} /> Mapa de Aulas
        </button>

        <button
          onClick={() => { setActiveTab('dashboard'); fetchDashboard(); }}
          style={{
            padding: '12px 20px', borderRadius: '12px', border: 'none',
            background: activeTab === 'dashboard' ? '#f43f5e' : '#1e293b', color: '#fff',
            fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <Award size={18} /> Evolução
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          style={{
            padding: '12px 20px', borderRadius: '12px', border: 'none',
            background: activeTab === 'upload' ? '#f43f5e' : '#1e293b', color: '#fff',
            fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <Upload size={18} /> Subir Aulas
        </button>
      </div>

      {/* ABA PRÁTICA DIÁRIA */}
      {activeTab === 'study' && (
        currentQ ? (
          <div style={{ background: '#1e293b', padding: '32px', borderRadius: '20px', border: '1px solid #334155' }}>
            {currentQ.topic?.fashionText && (
              <div style={{ background: '#2e1065', border: '1px solid #7e22ce', padding: '16px 20px', borderRadius: '12px', marginBottom: '24px', display: 'flex', gap: '12px' }}>
                <Sparkles color="#c084fc" size={24} style={{ minWidth: '24px' }} />
                <div>
                  <strong style={{ color: '#e9d5ff', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                    Modo Fashion 👗 — {currentQ.topic.name}
                  </strong>
                  <p style={{ color: '#f3e8ff', fontSize: '14px', lineHeight: '1.5' }}>
                    {currentQ.topic.fashionText}
                  </p>
                </div>
              </div>
            )}

            <h2 style={{ fontSize: '20px', color: '#f8fafc', marginBottom: '24px', lineHeight: '1.4' }}>
              {currentQ.statement}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
              {shuffledOptions.map(([originalKey, val], idx) => {
                const displayLabel = String.fromCharCode(65 + idx);
                const isSelected = selectedOption === originalKey;

                let btnBorder = '1px solid #475569';
                let btnBg = '#0f172a';
                let labelColor = '#94a3b8';

                if (isSelected) {
                  if (!feedbackResult) {
                    btnBorder = '2px solid #3b82f6';
                    btnBg = '#1e3a8a';
                    labelColor = '#60a5fa';
                  } else if (feedbackResult.isCorrect) {
                    btnBorder = '2px solid #10b981';
                    btnBg = '#064e3b';
                    labelColor = '#34d399';
                  } else {
                    btnBorder = '2px solid #ef4444';
                    btnBg = '#7f1d1d';
                    labelColor = '#f87171';
                  }
                }

                return (
                  <button
                    key={originalKey}
                    onClick={() => !feedbackResult && setSelectedOption(originalKey)}
                    style={{
                      padding: '16px 20px', borderRadius: '12px',
                      border: btnBorder,
                      background: btnBg, color: '#f8fafc',
                      textAlign: 'left', fontSize: '15px',
                      cursor: feedbackResult ? 'default' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <strong style={{ color: labelColor, marginRight: '8px' }}>{displayLabel})</strong> {String(val)}
                  </button>
                );
              })}
            </div>

            {!feedbackResult ? (
              <button
                onClick={handleAnswerSubmit}
                disabled={!selectedOption}
                style={{
                  width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                  background: selectedOption ? '#f43f5e' : '#334155', color: '#fff',
                  fontSize: '16px', fontWeight: 'bold', cursor: selectedOption ? 'pointer' : 'not-allowed'
                }}
              >
                Conferir Resposta ✨
              </button>
            ) : (
              <div style={{
                background: feedbackResult.isCorrect ? '#064e3b' : '#7f1d1d',
                border: `1px solid ${feedbackResult.isCorrect ? '#059669' : '#dc2626'}`,
                padding: '24px', borderRadius: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  {feedbackResult.isCorrect ? <CheckCircle2 color="#34d399" size={28} /> : <XCircle color="#f87171" size={28} />}
                  <h3 style={{ fontSize: '18px', color: '#fff' }}>{feedbackResult.feedback}</h3>
                </div>

                <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.5' }}>
                  {feedbackResult.explanation}
                </p>

                <button
                  onClick={handleNextQuestion}
                  style={{
                    marginTop: '20px', width: '100%', padding: '14px', borderRadius: '10px',
                    border: 'none', background: '#f8fafc', color: '#0f172a', fontWeight: 'bold',
                    fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  Próxima Questão <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: '#1e293b', padding: '40px', borderRadius: '20px', textAlign: 'center', border: '1px solid #334155' }}>
            <BookOpen size={48} color="#f43f5e" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>Nenhuma questão pendente!</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>Suba uma aula nova na aba "Subir Aulas" para gerar mais questões!</p>
          </div>
        )
      )}

      {/* ABA GLOSSÁRIO & TÓPICOS */}
      {activeTab === 'glossary' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ color: '#fff', fontSize: '20px' }}>Glossário de Tópicos Estudados</h2>
            <button
              onClick={() => setIsFashionMode(!isFashionMode)}
              style={{
                padding: '10px 20px', borderRadius: '20px', border: 'none',
                background: isFashionMode ? '#7e22ce' : '#0284c7', color: '#fff',
                fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              {isFashionMode ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              {isFashionMode ? 'Modo Fashion Ativo 👗' : 'Modo Científico Meigo Ativo 🔬'}
            </button>
          </div>

          {!Array.isArray(topicsList) || topicsList.length === 0 ? (
            <div style={{ background: '#1e293b', padding: '40px', borderRadius: '20px', textAlign: 'center', border: '1px solid #334155' }}>
              <BookMarked size={48} color="#a855f7" style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>Glossário Vazio</h3>
              <p style={{ color: '#94a3b8', fontSize: '14px' }}>Suba o vídeo de uma aula para a Sunfl.IA.wer mapear os tópicos!</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {topicsList.map((topic) => (
                  <div
                    key={topic?.id || Math.random()}
                    onClick={() => setSelectedTopic(topic)}
                    style={{
                      background: selectedTopic?.id === topic?.id ? '#331523' : '#1e293b',
                      padding: '20px', borderRadius: '16px',
                      border: selectedTopic?.id === topic?.id ? '2px solid #f43f5e' : '1px solid #334155',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    <h3 style={{ color: '#f8fafc', fontSize: '16px', marginBottom: '8px' }}>{topic?.name || 'Tópico'}</h3>
                    <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.4' }}>
                      {isFashionMode 
                        ? (topic?.fashionSummary || topic?.fashionText || topic?.summary || 'Sem resumo disponível.') 
                        : (topic?.academicSummary || topic?.academicText || topic?.summary || 'Sem resumo disponível.')}
                    </p>
                  </div>
                ))}
              </div>

              {selectedTopic && (
                <div style={{ background: '#0f172a', padding: '28px', borderRadius: '20px', border: `1px solid ${isFashionMode ? '#7e22ce' : '#0284c7'}`, marginBottom: '30px' }}>
                  <span style={{ color: isFashionMode ? '#c084fc' : '#38bdf8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {isFashionMode ? '👗 Explicação Modo Fashion' : '🔬 Explicação Científica Meiga'}
                  </span>
                  <h3 style={{ color: '#fff', fontSize: '20px', marginTop: '4px', marginBottom: '16px' }}>{selectedTopic?.name}</h3>
                  <p style={{ color: '#cbd5e1', fontSize: '15px', lineHeight: '1.7', whiteSpace: 'pre-line' }}>
                    {isFashionMode 
                      ? (selectedTopic?.fashionText || selectedTopic?.fashionSummary || selectedTopic?.summary) 
                      : (selectedTopic?.academicText || selectedTopic?.academicSummary || selectedTopic?.summary)}
                  </p>

                  {/* Seção de Chat com a Sun 🌻 */}
                  <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #334155' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <MessageCircle color="#fde047" size={20} />
                      <strong style={{ color: '#fde047', fontSize: '15px' }}>Tirar dúvida com a Sun 🌻 sobre este assunto:</strong>
                    </div>

                    {chatMessages.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
                        {chatMessages.map((msg) => (
                          <div
                            key={msg.id}
                            style={{
                              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                              background: msg.sender === 'user' ? '#f43f5e' : '#1e293b',
                              color: '#fff',
                              padding: '14px 18px',
                              borderRadius: msg.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                              maxWidth: '85%',
                              fontSize: '14px',
                              lineHeight: '1.6',
                              whiteSpace: 'pre-wrap',
                              border: msg.sender === 'ai' ? '1px solid #334155' : 'none'
                            }}
                          >
                            {msg.sender === 'ai' && (
                              <span style={{ color: '#fde047', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                                Sun 🌻
                              </span>
                            )}

                            {msg.text}

                            {/* Botões Útil / Inútil */}
                            {msg.sender === 'ai' && (
                              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #334155', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Esta resposta foi útil?</span>
                                <button
                                  onClick={() => handleFeedback(msg.id, 'like', msg.text)}
                                  style={{
                                    padding: '4px 10px', borderRadius: '6px', border: 'none',
                                    background: msg.feedback === 'like' ? '#15803d' : '#334155',
                                    color: '#fff', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold'
                                  }}
                                >
                                  👍 Útil
                                </button>
                                <button
                                  onClick={() => handleFeedback(msg.id, 'dislike', msg.text)}
                                  style={{
                                    padding: '4px 10px', borderRadius: '6px', border: 'none',
                                    background: msg.feedback === 'dislike' ? '#b91c1c' : '#334155',
                                    color: '#fff', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold'
                                  }}
                                >
                                  👎 Inútil
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="text"
                        placeholder="Ex: Qual fármaco age mais rápido no organismo?"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                        style={{
                          flex: 1, padding: '14px 18px', borderRadius: '12px', border: '1px solid #475569',
                          background: '#1e293b', color: '#fff', fontSize: '14px'
                        }}
                      />
                      <button
                        onClick={handleSendChatMessage}
                        disabled={sendingChat || !chatInput.trim()}
                        style={{
                          padding: '14px 20px', borderRadius: '12px', border: 'none',
                          background: sendingChat || !chatInput.trim() ? '#334155' : '#f43f5e',
                          color: '#fff', fontWeight: 'bold', cursor: sendingChat || !chatInput.trim() ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                      >
                        {sendingChat ? 'Pensando...' : <Send size={18} />}
                      </button>
                    </div>
                  </div>

                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ABA MODO PROVA */}
      {activeTab === 'exam' && (
        <div style={{ background: '#1e293b', padding: '32px', borderRadius: '20px', border: '1px solid #334155' }}>
          {loadingExam ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Sparkles size={36} color="#f43f5e" />
              <p style={{ color: '#cbd5e1', marginTop: '16px' }}>Gerando simulado inédito com a Sunfl.IA.wer 🌻...</p>
            </div>
          ) : examFinished ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Award size={48} color="#fde047" style={{ marginBottom: '16px' }} />
              <h2 style={{ fontSize: '24px', color: '#fff', marginBottom: '12px' }}>Simulado Concluído! 🏆</h2>
              <p style={{ fontSize: '18px', color: '#cbd5e1', marginBottom: '24px' }}>
                Você acertou <strong style={{ color: '#f43f5e' }}>{examScore}</strong> de {examQuestions.length} questões!
              </p>
              <button
                onClick={startExamMode}
                style={{ padding: '14px 28px', background: '#f43f5e', border: 'none', color: '#fff', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Tentar Outro Simulado
              </button>
            </div>
          ) : examQuestions.length > 0 ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>Simulado Inédito Sem Dicas</span>
                <span style={{ color: '#f43f5e', fontWeight: 'bold' }}>Questão {examIndex + 1} de {examQuestions.length}</span>
              </div>

              <h2 style={{ fontSize: '20px', color: '#f8fafc', marginBottom: '24px', lineHeight: '1.4' }}>
                {examQuestions[examIndex].statement}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
                {Object.entries(examQuestions[examIndex].options).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setExamSelected(key)}
                    style={{
                      padding: '16px 20px', borderRadius: '12px',
                      border: examSelected === key ? '2px solid #3b82f6' : '1px solid #475569',
                      background: examSelected === key ? '#1e3a8a' : '#0f172a', color: '#f8fafc',
                      textAlign: 'left', fontSize: '15px', cursor: 'pointer'
                    }}
                  >
                    <strong style={{ color: examSelected === key ? '#60a5fa' : '#94a3b8', marginRight: '8px' }}>{key})</strong> {String(val)}
                  </button>
                ))}
              </div>

              <button
                onClick={handleExamSubmit}
                disabled={!examSelected}
                style={{
                  width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                  background: examSelected ? '#f43f5e' : '#334155', color: '#fff',
                  fontSize: '16px', fontWeight: 'bold', cursor: examSelected ? 'pointer' : 'not-allowed'
                }}
              >
                {examIndex === examQuestions.length - 1 ? 'Finalizar Simulado 🏁' : 'Responder e Avançar ➔'}
              </button>
            </div>
          ) : (
            <p style={{ color: '#94a3b8', textAlign: 'center' }}>Nenhum simulado disponível. Suba algumas aulas primeiro!</p>
          )}
        </div>
      )}

      {/* ABA EVOLUÇÃO */}
      {activeTab === 'dashboard' && analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award color="#fde047" /> Pontuação & Nível
            </h3>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f43f5e', marginBottom: '8px' }}>
              {analytics.xp} XP
            </div>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              Rank Atual: <strong style={{ color: '#c7d2fe' }}>{analytics.levelTitle}</strong>
            </p>
          </div>

          <div style={{ background: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert color="#38bdf8" /> Banco de Questões
            </h3>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#38bdf8', marginBottom: '8px' }}>
              {analytics.totalQuestions} Questões
            </div>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              Distribuídas em {analytics.topicsCount} tópicos e {analytics.totalClasses} aulas processadas.
            </p>
          </div>
        </div>
      )}

      {/* ABA MAPA DE AULAS */}
      {activeTab === 'classes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!Array.isArray(classList) || classList.length === 0 ? (
            <div style={{ background: '#1e293b', padding: '40px', borderRadius: '20px', textAlign: 'center', border: '1px solid #334155' }}>
              <Video size={48} color="#f43f5e" style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>Nenhuma aula encontrada!</h3>
              <p style={{ color: '#94a3b8', fontSize: '14px' }}>Suba o arquivo da sua aula na aba "Subir Aulas" para a Sunfl.IA.wer criar seu mapa!</p>
            </div>
          ) : (
            classList.map((c) => (
              <div key={c?.id || Math.random()} style={{ background: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', color: '#f8fafc' }}>{c?.title || 'Aula sem título'}</h3>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={async () => {
                        await fetch(`http://localhost:3000/api/classes/reanalyze/${c?.id}`, { method: 'POST' });
                        alert('Reanálise iniciada! A Sunfl.IA.wer buscará novos subtópicos.');
                        fetchClasses();
                      }}
                      style={{
                        padding: '6px 14px', borderRadius: '12px', border: '1px solid #38bdf8',
                        background: '#0284c7', color: '#fff', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                      }}
                    >
                      Analisar Novamente 🔄
                    </button>
                    <span style={{
                      padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                      background: c?.status === 'COMPLETED' ? '#064e3b' : '#854d0e',
                      color: c?.status === 'COMPLETED' ? '#34d399' : '#fde047'
                    }}>
                      {c?.status === 'COMPLETED' ? '✓ Processada' : '⏳ Processando'}
                    </span>
                  </div>
                </div>

                {c?.transcript && (
                  <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '16px', lineHeight: '1.5' }}>
                    {c.transcript}
                  </p>
                )}

                {Array.isArray(c?.topics) && c.topics.length > 0 && (
                  <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px' }}>
                    <strong style={{ color: '#f43f5e', fontSize: '13px', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                      Tópicos Mapeados pela Sunfl.IA.wer 🌻
                    </strong>
                    {c.topics.map((t: any) => (
                      <div key={t?.id || Math.random()} style={{ marginBottom: '12px' }}>
                        <div style={{ color: '#f8fafc', fontWeight: '600', fontSize: '14px' }}>• {t?.name}</div>
                        {(t?.fashionSummary || t?.academicSummary) && (
                          <div style={{ color: '#c084fc', fontSize: '13px', marginTop: '4px', fontStyle: 'italic' }}>
                            {t.fashionSummary || t.academicSummary}
                          </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Video color="#f43f5e" size={24} />
              <h2 style={{ fontSize: '18px' }}>Minha Aula</h2>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '2px dashed #475569', padding: '30px', borderRadius: '12px', cursor: 'pointer', background: '#0f172a' }}>
              <Upload color="#94a3b8" size={32} />
              <span style={{ marginTop: '12px', fontSize: '14px', color: '#cbd5e1' }}>
                {uploadingClass ? 'Enviando aula...' : 'Selecionar vídeo da aula'}
              </span>
              <input type="file" accept="video/*,audio/*" onChange={handleClassUpload} style={{ display: 'none' }} />
            </label>
            {classMessage && <p style={{ marginTop: '16px', fontSize: '14px', color: '#38bdf8', textAlign: 'center' }}>{classMessage}</p>}
          </div>

          {/* Card de Upload de Prints e PDFs */}
          <div style={{ background: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Image color="#a855f7" size={24} />
              <h2 style={{ fontSize: '18px', color: '#f8fafc' }}>Tarefas, Prints & Resumos PDF</h2>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '2px dashed #475569', padding: '30px', borderRadius: '12px', cursor: 'pointer', background: '#0f172a' }}>
              <Upload color="#94a3b8" size={32} />
              <span style={{ marginTop: '12px', fontSize: '14px', color: '#cbd5e1', textAlign: 'center' }}>
                {uploadingTask ? 'Lendo arquivo e gerando questões...' : 'Selecionar imagem de print ou resumo em PDF'}
              </span>
              <input 
                type="file" 
                accept="image/*,application/pdf" 
                onChange={handleTaskUpload} 
                style={{ display: 'none' }} 
              />
            </label>
            {taskMessage && <p style={{ marginTop: '16px', fontSize: '14px', color: '#c084fc', textAlign: 'center' }}>{taskMessage}</p>}
          </div>
        </div>
      )}

    </div>
  );
}