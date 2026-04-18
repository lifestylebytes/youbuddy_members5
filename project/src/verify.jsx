const VerifyPage = ({ onBack, onComplete }) => {
  const steps = window.APP_DATA.TODAY_LESSON.verify_steps;
  const [doneSteps, setDoneSteps] = React.useState({});
  const [activeStep, setActiveStep] = React.useState(0);
  const [recording, setRecording] = React.useState(false);
  const [recordTime, setRecordTime] = React.useState(0);
  const [uploaded, setUploaded] = React.useState(false);
  const [showTest, setShowTest] = React.useState(false);
  const [testScore, setTestScore] = React.useState(null);
  const [currentSent, setCurrentSent] = React.useState(0);
  const savedS = React.useMemo(() => JSON.parse(sessionStorage.getItem('yb_sentences') || '{}'), []);
  const savedFb = React.useMemo(() => JSON.parse(sessionStorage.getItem('yb_feedback') || '{}'), []);
  const [sentences, setSentences] = React.useState({
    0: savedS[0] || '',
    1: savedS[1] || '',
    2: savedS[2] || '',
  });
  const [sentenceFeedback, setSentenceFeedback] = React.useState(savedFb);
  const [sentenceLoading, setSentenceLoading] = React.useState({});
  const [celebrating, setCelebrating] = React.useState(false);

  React.useEffect(() => {
    sessionStorage.setItem('yb_sentences', JSON.stringify(sentences));
  }, [sentences]);

  React.useEffect(() => {
    sessionStorage.setItem('yb_feedback', JSON.stringify(sentenceFeedback));
  }, [sentenceFeedback]);

  const speak = (text) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {}
  };

  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecordTime(x => x + 0.1), 100);
    return () => clearInterval(t);
  }, [recording]);

  const markDone = (id) => {
    setDoneSteps(d => ({ ...d, [id]: true }));
    const next = steps.findIndex((s, i) => i > activeStep && !doneSteps[s.id]);
    if (next >= 0) setActiveStep(next);
  };

  const allDone = steps.every(s => doneSteps[s.id]);

  const handleSubmit = () => {
    setCelebrating(true);
    setTimeout(() => onComplete(), 2400);
  };

  const fmtTime = (t) => {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(Math.floor((t%1)*10))}`;
  };

  const askClaude = async (i) => {
    const word = window.APP_DATA.TODAY_LESSON.words[i];
    const userSentence = sentences[i];
    setSentenceLoading(s => ({ ...s, [i]: true }));

    const prompt = `You are a warm, encouraging business English coach for Korean learners.
The student is practicing the phrase "${word.en}" (${word.def_short}).
Their attempt: "${userSentence}"

Return ONLY valid JSON with this exact shape:
{
  "corrected": "a natural business-English sentence using '${word.en}'",
  "diff_html": "the corrected sentence as HTML with <del>removed</del> and <ins>added</ins> tags to show changes",
  "why": "1-2 sentences in Korean (한국어) explaining what you changed and why. Keep it kind & concrete."
}
No markdown, no code fences. Just the JSON.`;

    try {
      const raw = await window.claude.complete(prompt);
      const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/,'').trim();
      const parsed = JSON.parse(clean);
      setSentenceFeedback(f => ({ ...f, [i]: parsed }));
    } catch (e) {
      setSentenceFeedback(f => ({ ...f, [i]: {
        corrected: userSentence,
        diff_html: userSentence,
        why: '네트워크 이슈로 AI 교정이 지연되고 있어요. 잠시 후 다시 시도해보세요.',
      }}));
    } finally {
      setSentenceLoading(s => ({ ...s, [i]: false }));
    }
  };

  const step = steps[activeStep];

  return (
    <div className="page">
      <TopBar onBack={onBack} title="인증 · Day 14" />

      {celebrating && <Celebration />}

      {/* Progress bar */}
      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="row-between" style={{ marginBottom: 8 }}>
          <span className="kicker">VERIFICATION · 4 STEPS</span>
          <span className="t-small mono">{Object.keys(doneSteps).filter(k => doneSteps[k]).length}/{steps.length}</span>
        </div>
        <Bar value={Object.keys(doneSteps).filter(k => doneSteps[k]).length} max={steps.length} orange />
      </div>

      {/* Active step panel */}
      <div className="card" style={{ padding: 22, background: 'var(--ink)', color: 'var(--cream)', borderColor: 'var(--ink)' }}>
        <div className="kicker" style={{ color: 'rgba(251,247,240,0.6)' }}>STEP {activeStep + 1}/{steps.length} · {step.time}</div>
        <h2 className="h2" style={{ marginTop: 10, color: 'var(--cream)' }}>
          {step.label}
        </h2>

        {/* Step-specific UI */}
        {step.id === 'copy' && (
          <div style={{ marginTop: 20 }}>
            <div className="stack-sm">
              {window.APP_DATA.TODAY_LESSON.words.map((w, i) => (
                <div key={i} style={{
                  padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(251,247,240,0.06)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span className="mono" style={{ fontSize: 11, color: 'rgba(251,247,240,0.4)' }}>0{i+1}</span>
                  <span className="serif" style={{ fontStyle: 'italic', color: 'var(--orange)', fontSize: 18 }}>{w.en}</span>
                  <button className="icon-btn" style={{ marginLeft: 'auto', background: 'rgba(251,247,240,0.1)', border: 'none', color: 'var(--cream)' }}>
                    <Icon name="volume" size={14}/>
                  </button>
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 16 }}
              onClick={() => markDone('copy')}
            >
              <Icon name="check" size={14} /> 3번씩 소리 내어 읽었어요
            </button>
          </div>
        )}

        {step.id === 'sentence' && (
          <div style={{ marginTop: 20 }}>
            <div className="t-body" style={{ color: 'rgba(251,247,240,0.75)', lineHeight: 1.6 }}>
              오늘 배운 표현 3개로, 내 실제 업무 상황에 맞는 문장을 하나씩 만들어봐요.
              완벽할 필요 없어요. AI가 바로 다듬어 드립니다.
            </div>
            <div className="stack-sm" style={{ marginTop: 16 }}>
              {window.APP_DATA.TODAY_LESSON.words.map((w, i) => (
                <div key={i} style={{
                  background: 'var(--cream)',
                  border: `1px solid ${sentenceFeedback[i] ? 'var(--orange-soft)' : 'rgba(231,221,200,0.8)'}`,
                  borderRadius: 20,
                  padding: 18,
                  color: 'var(--ink)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span className="badge badge-orange" style={{ fontSize: 10 }}>{w.en}</span>
                    <span className="t-small" style={{ color: 'var(--ink-soft)' }}>를 써서 내 업무 상황 문장</span>
                  </div>

                  <textarea
                    className="sentence-input"
                    rows={3}
                    placeholder={`e.g. Let's ${w.en.toLowerCase()} the timeline before we...`}
                    value={sentences[i]}
                    onChange={(e) => setSentences(s => ({ ...s, [i]: e.target.value }))}
                    style={{
                      background: '#FFFDF9',
                      minHeight: 120,
                      borderColor: sentenceLoading[i] ? 'var(--orange)' : 'var(--line)',
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 10 }}>
                    <span className="t-small mono" style={{ color: 'var(--muted)' }}>{sentences[i].length} chars</span>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '10px 16px', background: 'transparent' }}
                      disabled={!sentences[i].trim() || sentenceLoading[i]}
                      onClick={() => askClaude(i)}
                    >
                      <Icon name="sparkle" size={12} color="var(--orange)" />
                      AI 교정 받기
                    </button>
                  </div>

                  {sentenceLoading[i] && (
                    <div className="ai-feedback" style={{ marginTop: 16, background: 'linear-gradient(135deg, #FFF3E3 0%, #FDE2C6 100%)' }}>
                      <div className="ai-loading">
                        <span className="dot"/><span className="dot"/><span className="dot"/>
                        <span>AI가 교정 중...</span>
                      </div>
                    </div>
                  )}

                  {sentenceFeedback[i] && !sentenceLoading[i] && (
                    <div className="ai-feedback" style={{ marginTop: 16, background: 'linear-gradient(135deg, #FFF3E3 0%, #FDE2C6 100%)' }}>
                      <div className="ai-head">
                        <Icon name="sparkle" size={12} color="var(--orange-dark)" />
                        AI 교정 결과
                      </div>
                      <div className="corrected">"{sentenceFeedback[i].corrected}"</div>
                      <div dangerouslySetInnerHTML={{ __html: sentenceFeedback[i].diff_html }} style={{ fontSize: 13, marginBottom: 8 }} />
                      <div className="t-small" style={{ color: 'var(--ink-soft)', lineHeight: 1.55 }}>
                        <b style={{ color: 'var(--orange-dark)' }}>💡 Why.</b> {sentenceFeedback[i].why}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 12 }}
              disabled={!window.APP_DATA.TODAY_LESSON.words.every((_, i) => sentenceFeedback[i])}
              onClick={() => markDone('sentence')}
            >
              <Icon name="check" size={14} /> 문장 3개 확인
            </button>
          </div>
        )}

        {step.id === 'capture' && (
          <div style={{ marginTop: 20 }}>
            {showTest && (
              <div style={{ position: 'fixed', inset: 0, background: 'var(--ivory)', zIndex: 200, overflowY: 'auto' }}>
                <div style={{ maxWidth: 440, margin: '0 auto' }}>
                  <VocabTest
                    onClose={() => setShowTest(false)}
                    onSubmit={(s) => { setTestScore(s); setUploaded(true); setShowTest(false); }}
                  />
                </div>
              </div>
            )}
            <div
              style={{
                border: '2px dashed rgba(251,247,240,0.25)',
                borderRadius: 16, padding: 24,
                textAlign: 'center',
                background: uploaded ? 'rgba(107,142,78,0.15)' : 'transparent',
                transition: 'all 200ms',
              }}
            >
              {uploaded ? (
                <div>
                  <div style={{
                    width: 56, height: 56, margin: '0 auto', borderRadius: 16,
                    background: 'var(--green)', color: '#fff',
                    display: 'grid', placeItems: 'center',
                  }}><Icon name="check" size={24}/></div>
                  <div className="h3" style={{ marginTop: 10, color: 'var(--cream)' }}>단어 시험 통과</div>
                  <div className="t-small" style={{ color: 'rgba(251,247,240,0.6)', marginTop: 4 }}>
                    {testScore ? `${testScore.score}/${testScore.total} 정답 · ${Math.round(testScore.score/testScore.total*100)}%` : '21/21 정답'}
                  </div>
                  <button className="btn btn-ghost" style={{ marginTop: 10, background: 'rgba(251,247,240,0.1)', color: 'var(--cream)', border: 'none' }} onClick={() => { setUploaded(false); setTestScore(null); }}>
                    다시 풀기
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 28, fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--orange)', fontWeight: 700 }}>YB</div>
                  <div className="h3" style={{ marginTop: 10, color: 'var(--cream)' }}>단어 시험 10문제</div>
                  <div className="t-small" style={{ color: 'rgba(251,247,240,0.6)', marginTop: 4 }}>
                    70% 이상 맞춰야 인증 제출 가능해요
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ marginTop: 14, background: 'var(--orange)', color: '#fff', border: 'none' }}
                    onClick={() => setShowTest(true)}
                  >
                    <Icon name="play" size={12} color="#fff" /> 시험 시작
                  </button>
                </div>
              )}
            </div>
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 12 }}
              disabled={!uploaded}
              onClick={() => markDone('capture')}
            >
              <Icon name="check" size={14} /> 시험 결과 제출
            </button>
          </div>
        )}

        {step.id === 'record' && (
          <div style={{ marginTop: 20 }}>
            {/* My submitted sentences */}
            <div className="kicker" style={{ color: 'rgba(251,247,240,0.55)', marginBottom: 8 }}>
              오늘 제출한 내 문장 · {currentSent + 1}/{window.APP_DATA.TODAY_LESSON.words.length}
            </div>
            <div style={{
              padding: '14px 16px', borderRadius: 14,
              background: 'rgba(251,247,240,0.06)',
              border: '1px solid rgba(232,116,60,0.35)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge badge-orange" style={{ fontSize: 10 }}>
                  {window.APP_DATA.TODAY_LESSON.words[currentSent].en}
                </span>
                <button
                  className="icon-btn"
                  style={{ marginLeft: 'auto', background: 'rgba(251,247,240,0.1)', border: 'none', color: 'var(--cream)', width: 28, height: 28 }}
                  onClick={() => speak(sentenceFeedback[currentSent]?.corrected || sentences[currentSent] || '')}
                >
                  <Icon name="volume" size={12}/>
                </button>
              </div>
              <div className="serif" style={{ fontStyle: 'italic', fontSize: 19, lineHeight: 1.35, color: 'var(--cream)', marginTop: 10 }}>
                "{sentenceFeedback[currentSent]?.corrected || sentences[currentSent] || '(문장 없음)'}"
              </div>
              {sentenceFeedback[currentSent] && sentences[currentSent] !== sentenceFeedback[currentSent].corrected && (
                <div className="t-small" style={{ color: 'rgba(251,247,240,0.45)', marginTop: 8, fontSize: 11 }}>
                  내 원문: {sentences[currentSent]}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
              {window.APP_DATA.TODAY_LESSON.words.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSent(i)}
                  style={{
                    width: 8, height: 8, borderRadius: '50%', border: 'none',
                    background: i === currentSent ? 'var(--orange)' : 'rgba(251,247,240,0.25)',
                    cursor: 'pointer', padding: 0,
                  }}
                />
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: 22 }}>
              <div className="serif-num" style={{ fontSize: 36, color: recording ? 'var(--orange)' : 'var(--cream)', letterSpacing: '0.02em' }}>
                {fmtTime(recordTime)}
              </div>
              <div className="t-small" style={{ color: 'rgba(251,247,240,0.55)', marginTop: 4 }}>
                {recording ? '녹음 중...' : (recordTime > 0 ? '녹음 완료' : '위 문장을 녹음해주세요')}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                <button
                  className={`record-button ${recording ? 'recording' : ''}`}
                  onClick={() => setRecording(r => !r)}
                >
                  <Icon name={recording ? 'stop' : 'mic'} size={30} color="#fff" />
                </button>
              </div>

              {/* Waveform mock */}
              <div style={{
                marginTop: 20,
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                gap: 3, height: 40,
              }}>
                {Array.from({ length: 30 }).map((_, i) => {
                  const base = Math.sin(i * 0.7) * 0.5 + 0.5;
                  const active = recording || recordTime > 0;
                  const h = active ? (10 + base * 22 + (recording ? Math.random() * 10 : 0)) : 4;
                  return (
                    <div key={i} style={{
                      width: 3, height: h, borderRadius: 2,
                      background: active ? 'var(--orange)' : 'rgba(251,247,240,0.2)',
                      transition: 'height 150ms',
                    }}/>
                  );
                })}
              </div>
            </div>
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 20 }}
              disabled={recording || recordTime === 0}
              onClick={() => markDone('record')}
            >
              <Icon name="check" size={14} /> 녹음 파일 제출
            </button>
          </div>
        )}
      </div>

      {/* Step list */}
      <div style={{ marginTop: 20 }} className="stack-sm">
        {steps.map((s, i) => {
          const done = !!doneSteps[s.id];
          const active = i === activeStep;
          return (
            <div key={s.id} className={`verify-step ${done ? 'done' : ''} ${active && !done ? 'active' : ''}`} onClick={() => !done && setActiveStep(i)}>
              <div className="vs-icon">
                {done ? <Icon name="check" size={18}/> : <Icon name={s.icon} size={18}/>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="h3" style={{ fontSize: 13 }}>{s.label}</div>
                <div className="t-small mono" style={{ marginTop: 2 }}>{s.time} · Step {i+1}</div>
              </div>
              {done ? (
                <span className="badge badge-green" style={{ fontSize: 9 }}>완료</span>
              ) : active ? (
                <span className="badge badge-orange" style={{ fontSize: 9 }}>진행</span>
              ) : (
                <Icon name="lock" size={14} color="var(--muted)"/>
              )}
            </div>
          );
        })}
      </div>

      {/* Final submit */}
      <div style={{ marginTop: 24 }}>
        <button
          className="btn btn-primary btn-full btn-lg"
          style={{ padding: '18px 24px', fontSize: 16, background: allDone ? 'var(--orange)' : 'var(--paper)', color: allDone ? '#fff' : 'var(--muted)' }}
          disabled={!allDone}
          onClick={handleSubmit}
        >
          {allDone ? 'Day 14 인증 완료하기 ✓' : `${Object.keys(doneSteps).filter(k => doneSteps[k]).length}/${steps.length} 단계 완료`}
          {allDone && <Icon name="arrow-right" size={16} />}
        </button>
        <div className="t-small" style={{ textAlign: 'center', marginTop: 10, color: 'var(--muted)' }}>
          완료 메시지가 자동으로 유버디(5기) 카톡방에 올라갑니다
        </div>
      </div>
    </div>
  );
};

window.VerifyPage = VerifyPage;
