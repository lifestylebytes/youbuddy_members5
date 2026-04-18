const { TODAY_LESSON: LESSON } = window.APP_DATA;

const VocabCard = ({ word, idx }) => {
  const [expanded, setExpanded] = React.useState(idx === 0);
  const [showSyn, setShowSyn] = React.useState(false);

  // Highlight **bold** in example
  const renderExample = (txt) => {
    const parts = txt.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) => p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>);
  };

  const speak = (text) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 0.9; u.pitch = 1;
      const voices = window.speechSynthesis.getVoices();
      const enVoice = voices.find(v => v.lang.startsWith('en'));
      if (enVoice) u.voice = enVoice;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {}
  };

  return (
    <div className="vocab-card">
      <div className="vocab-num">#{String(idx + 1).padStart(2, '0')}</div>
      <div className="vocab-head">
        <div className="eng-word">{word.en}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge">{word.pos}</span>
          <span className="kor-def" style={{ marginTop: 0 }}>{word.def_short}</span>
          <button
            className="icon-btn"
            style={{ width: 30, height: 30, borderRadius: 10, marginLeft: 'auto', flexShrink: 0, background: 'var(--orange-ghost)', borderColor: 'var(--orange-soft)', color: 'var(--orange-dark)' }}
            aria-label="Play pronunciation"
            onClick={(e) => { e.stopPropagation(); speak(word.en); }}
          >
            <Icon name="volume" size={14} />
          </button>
        </div>
      </div>

      <div className="vocab-example">
        {renderExample(word.example_en)}
        <span className="translate">{word.example_kr}</span>
      </div>

      <button
        onClick={() => setShowSyn(s => !s)}
        style={{
          marginTop: 12, background: 'transparent', border: 'none',
          padding: 0, display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--ink-soft)', fontSize: 12, fontWeight: 600,
          fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}
      >
        <Icon name={showSyn ? 'close' : 'spark'} size={12} />
        유의어·뉘앙스 {showSyn ? '닫기' : '보기'}
      </button>

      {showSyn && (
        <div style={{ marginTop: 10, animation: 'aiIn 200ms' }}>
          <div className="t-small" style={{ color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            <b style={{ color: 'var(--ink)' }}>뉘앙스.</b> {word.nuance}
          </div>
          <div className="syn-row">
            {word.syn.map((s, i) => <span key={i} className="syn-chip">{s}</span>)}
          </div>
        </div>
      )}
    </div>
  );
};

const SentenceBuilder = ({ word, sentence, onChange, feedback, loading, onCorrect }) => {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span className="badge badge-orange" style={{ fontSize: 10 }}>{word.en}</span>
        <span className="t-small">를 써서 내 업무 상황 문장</span>
      </div>
      <textarea
        className="sentence-input"
        rows={3}
        placeholder={`e.g. Let's ${word.en.toLowerCase()} the timeline before we...`}
        value={sentence}
        onChange={(e) => onChange(e.target.value)}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span className="t-small mono" style={{ color: 'var(--muted)' }}>{sentence.length} chars</span>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: '8px 14px' }}
          disabled={!sentence.trim() || loading}
          onClick={onCorrect}
        >
          <Icon name="sparkle" size={12} color="var(--orange)" />
          AI 교정 받기
        </button>
      </div>

      {loading && (
        <div className="ai-feedback" style={{ background: 'var(--orange-ghost)' }}>
          <div className="ai-loading">
            <span className="dot"/><span className="dot"/><span className="dot"/>
            <span>Claude가 교정 중...</span>
          </div>
        </div>
      )}

      {feedback && !loading && (
        <div className="ai-feedback">
          <div className="ai-head">
            <Icon name="sparkle" size={12} color="var(--orange-dark)" />
            AI 교정 결과
          </div>
          <div className="corrected">"{feedback.corrected}"</div>
          <div dangerouslySetInnerHTML={{ __html: feedback.diff_html }} style={{ fontSize: 13, marginBottom: 8 }} />
          <div className="t-small" style={{ color: 'var(--ink-soft)', lineHeight: 1.55 }}>
            <b style={{ color: 'var(--orange-dark)' }}>💡 Why.</b> {feedback.why}
          </div>
        </div>
      )}
    </div>
  );
};

const DayNotePage = ({ onBack, onVerify }) => {
  const saved = JSON.parse(sessionStorage.getItem('yb_sentences') || '{}');
  const [sentences, setSentences] = React.useState({ 0: saved[0] || '', 1: saved[1] || '', 2: saved[2] || '' });
  const savedFb = JSON.parse(sessionStorage.getItem('yb_feedback') || '{}');
  const [feedback, setFeedback] = React.useState(savedFb);
  const [loading, setLoading] = React.useState({});
  const [copyDone, setCopyDone] = React.useState(false);

  React.useEffect(() => { sessionStorage.setItem('yb_sentences', JSON.stringify(sentences)); }, [sentences]);
  React.useEffect(() => { sessionStorage.setItem('yb_feedback', JSON.stringify(feedback)); }, [feedback]);

  const askClaude = async (i) => {
    const word = LESSON.words[i];
    const user_sentence = sentences[i];
    setLoading(s => ({ ...s, [i]: true }));

    const prompt = `You are a warm, encouraging business English coach for Korean learners.
The student is practicing the phrase "${word.en}" (${word.def_short}).
Their attempt: "${user_sentence}"

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
      setFeedback(f => ({ ...f, [i]: parsed }));
    } catch (e) {
      // fallback
      setFeedback(f => ({ ...f, [i]: {
        corrected: user_sentence,
        diff_html: user_sentence,
        why: '네트워크 이슈로 AI 교정이 지연되고 있어요. 잠시 후 다시 시도해보세요.',
      }}));
    } finally {
      setLoading(s => ({ ...s, [i]: false }));
    }
  };

  const allDone = LESSON.words.every((_, i) => feedback[i]);

  return (
    <div className="page">
      <TopBar onBack={onBack} right={
        <button className="icon-btn"><Icon name="settings" size={16} /></button>
      }/>

      {/* Header */}
      <div style={{ padding: '4px 4px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-ink">Week {LESSON.week}</span>
          <span className="badge">{LESSON.date}</span>
        </div>
        <h1 className="h1" style={{ marginTop: 14, fontSize: 32 }}>
          Day {LESSON.day}
          <br />
          <span className="serif" style={{ color: 'var(--orange)' }}>{LESSON.title}</span>
        </h1>

        {/* Target banner */}
        <div className="target-banner" style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="target" size={14} color="var(--orange)" />
            <span className="kicker" style={{ color: 'var(--orange-dark)' }}>오늘의 목표</span>
          </div>
          <div className="quote-mark">"</div>
          <div style={{ fontSize: 20, lineHeight: 1.3, letterSpacing: '-0.01em', marginTop: 4, fontWeight: 600 }} className="eng">
            {LESSON.goal_en}
          </div>
          <div className="t-body" style={{ marginTop: 10 }}>
            {LESSON.goal_kr}
          </div>
        </div>

        {/* Tip strip */}
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: 'linear-gradient(90deg, #FFF8E3 0%, #FEE8C4 100%)',
          borderRadius: 12, fontSize: 12.5, color: 'var(--ink)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>⚡</span>
          <span>{LESSON.tip}</span>
        </div>
      </div>

      {/* Step 1: Copy & Speak */}
      <div style={{ marginTop: 8 }}>
        <div className="step-head" style={{ marginBottom: 12 }}>
          <div className="step-num">1</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="kicker">CARD 1 · COPY & SPEAK</div>
            <div className="h3" style={{ marginTop: 2 }}>오늘의 표현 3개 <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· 5분</span></div>
          </div>
        </div>

        <div className="stack">
          {LESSON.words.map((w, i) => <VocabCard key={i} word={w} idx={i} />)}
        </div>

        <button
          className="btn btn-full"
          style={{
            marginTop: 12, border: '1px dashed var(--line)',
            background: copyDone ? 'var(--green-soft)' : 'var(--cream)',
            color: copyDone ? 'var(--green)' : 'var(--ink-soft)',
          }}
          onClick={() => setCopyDone(d => !d)}
        >
          <Icon name={copyDone ? 'check' : 'mic'} size={14} />
          {copyDone ? '3번씩 소리 내어 읽기 완료' : '3번씩 소리 내어 읽었어요'}
        </button>
      </div>

      <div className="divider" />

      {/* Step 2: Sentence building */}
      <div>
        <div className="step-head" style={{ marginBottom: 12 }}>
          <div className="step-num">2</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="kicker">CARD 2 · YOUR SENTENCES</div>
            <div className="h3" style={{ marginTop: 2 }}>내 업무 문장 만들기 <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· 5분</span></div>
          </div>
        </div>

        <p className="t-body" style={{ marginBottom: 14 }}>
          오늘 배운 표현 3개로, 내 실제 업무 상황에 맞는 문장을 하나씩 만들어봐요.
          완벽할 필요 없어요 — Claude가 자연스럽게 다듬어 드립니다.
        </p>

        <div className="stack">
          {LESSON.words.map((w, i) => (
            <SentenceBuilder
              key={i}
              word={w}
              sentence={sentences[i]}
              onChange={(v) => setSentences(s => ({ ...s, [i]: v }))}
              feedback={feedback[i]}
              loading={loading[i]}
              onCorrect={() => askClaude(i)}
            />
          ))}
        </div>
      </div>

      <div className="divider" />

      {/* Step 3: Bonus */}
      <div className="card" style={{ background: 'var(--paper)', border: 'none', padding: 14 }}>
        <div className="row-gap-sm row" style={{ gap: 10 }}>
          <span style={{ fontSize: 18 }}>💡</span>
          <div style={{ flex: 1 }}>
            <div className="h3" style={{ fontSize: 13 }}>Bonus · 귀 열기 자료</div>
            <div className="t-small" style={{ marginTop: 2 }}>
              오늘 표현이 실제 TED 대화에서 어떻게 쓰이는지 2분 영상으로
            </div>
          </div>
          <button className="icon-btn"><Icon name="play" size={12} color="var(--orange)" /></button>
        </div>
      </div>

      {/* Verify CTA */}
      <div style={{ marginTop: 28 }}>
        <button
          className="btn btn-primary btn-full btn-lg"
          style={{ padding: '18px 24px', fontSize: 16 }}
          disabled={!copyDone || !allDone}
          onClick={onVerify}
        >
          {!copyDone || !allDone
            ? `체크 완료 (${[copyDone, allDone].filter(Boolean).length}/2 준비됨)`
            : '인증하러 가기'
          }
          <Icon name="arrow-right" size={16} />
        </button>
        <div className="t-small" style={{ textAlign: 'center', marginTop: 10, color: 'var(--muted)' }}>
          3단계 인증을 모두 마치면 대시보드에 자동 반영됩니다
        </div>
      </div>
    </div>
  );
};

window.DayNotePage = DayNotePage;
