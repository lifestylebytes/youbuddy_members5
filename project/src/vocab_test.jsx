// Inline vocab test — inspired by lifestylebytes.github.io/words_members4
const VOCAB_TEST_QUESTIONS = [
  { en: 'align on', kr: '(기준/방향에) 맞추다, 정렬하다', syn: ['get on the same page', 'sync on'] },
  { en: 'go with', kr: '~로 결정하다, 그걸로 가다', syn: ['commit to', 'settle on'] },
  { en: 'for now', kr: '일단, 당분간', syn: ['at this point', 'for the time being'] },
  { en: 'push back', kr: '반대 의사를 밝히다, 미루다', syn: ['disagree softly', 'defer'] },
  { en: 'circle back', kr: '다시 돌아와서 논의하다', syn: ['revisit', 'follow up'] },
  { en: 'heads-up', kr: '미리 알려주는 안내', syn: ['FYI', 'a quick note'] },
  { en: 'on track', kr: '예정대로 진행 중인', syn: ['on pace', 'as planned'] },
  { en: 'wrap up', kr: '마무리하다', syn: ['finish off', 'close out'] },
  { en: 'flag', kr: '이슈를 공유하다/제기하다', syn: ['raise', 'call out'] },
  { en: 'blocker', kr: '진행을 막는 이슈', syn: ['obstacle', 'roadblock'] },
];

const VocabTest = ({ onClose, onSubmit }) => {
  const QUESTIONS = React.useMemo(() => VOCAB_TEST_QUESTIONS.slice(0, 10), []);
  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState({});
  const [value, setValue] = React.useState('');
  const [done, setDone] = React.useState(false);
  const [showResult, setShowResult] = React.useState(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    setValue(answers[idx] || '');
    if (inputRef.current) setTimeout(() => inputRef.current?.focus(), 80);
  }, [idx]);

  const current = QUESTIONS[idx];
  const total = QUESTIONS.length;

  const submit = () => {
    const v = value.trim().toLowerCase();
    const correct = v === current.en.toLowerCase();
    setAnswers(a => ({ ...a, [idx]: value, ['c' + idx]: correct }));
    setShowResult(correct ? 'correct' : 'wrong');
    setTimeout(() => {
      setShowResult(null);
      if (idx < total - 1) setIdx(idx + 1);
      else finish({ ...answers, [idx]: value, ['c' + idx]: correct });
    }, 700);
  };

  const finish = (finalAns) => {
    const score = QUESTIONS.reduce((s, _, i) => s + (finalAns['c' + i] ? 1 : 0), 0);
    setDone({ score, total });
  };

  if (done) {
    const pct = Math.round((done.score / done.total) * 100);
    return (
      <div className="page" style={{ paddingTop: 12 }}>
        <div className="topbar">
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14}/></button>
          <div className="kicker">VOCAB TEST · 결과</div>
          <div style={{ width: 36 }}/>
        </div>
        <div className="card" style={{ padding: 28, textAlign: 'center', marginTop: 20, background: 'var(--ink)', color: 'var(--cream)', border: 'none' }}>
          <div className="kicker" style={{ color: 'rgba(251,247,240,0.55)' }}>YOUR SCORE</div>
          <div className="serif-num" style={{ fontSize: 72, lineHeight: 1, marginTop: 10, color: 'var(--orange)' }}>
            {done.score}<span style={{ color: 'rgba(251,247,240,0.25)', fontSize: 48 }}>/{done.total}</span>
          </div>
          <div className="serif" style={{ fontSize: 22, marginTop: 8 }}>
            {pct >= 90 ? 'Outstanding!' : pct >= 70 ? 'Nice work' : pct >= 50 ? 'Keep going' : 'Try again'}
          </div>
          <div className="t-body" style={{ color: 'rgba(251,247,240,0.7)', marginTop: 8 }}>
            {pct}% · {pct >= 70 ? '인증에 제출할 수 있어요' : '한 번 더 복습해볼까요?'}
          </div>
        </div>

        <div className="stack-sm" style={{ marginTop: 14 }}>
          {QUESTIONS.map((q, i) => {
            const c = answers['c' + i];
            return (
              <div key={i} className="card" style={{ padding: 12, background: c ? 'var(--green-soft)' : '#F5D8CE', borderColor: 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>Q{i+1}</span>
                  <span className="kor" style={{ fontSize: 13, flex: 1 }}>{q.kr}</span>
                  <span className="serif" style={{ fontStyle: 'italic', color: c ? 'var(--green)' : 'var(--orange-dark)', fontSize: 15 }}>
                    {q.en}
                  </span>
                  <Icon name={c ? 'check' : 'close'} size={14} color={c ? 'var(--green)' : 'var(--orange-dark)'}/>
                </div>
                {!c && (
                  <div className="t-small" style={{ marginTop: 4, color: 'var(--orange-dark)', paddingLeft: 34 }}>
                    내 답: <span className="mono">{answers[i] || '(빈칸)'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setIdx(0); setAnswers({}); setValue(''); setDone(false); }}>
            🔄 다시하기
          </button>
          <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} disabled={pct < 70} onClick={() => onSubmit && onSubmit(done)}>
            <Icon name="check" size={14}/> 인증에 제출
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ paddingTop: 12 }}>
      <div className="topbar">
        <button className="icon-btn" onClick={onClose}><Icon name="close" size={14}/></button>
        <div>
          <div className="kicker">VOCAB TEST · DAY 14</div>
          <div className="t-small mono" style={{ textAlign: 'center' }}>{idx + 1} / {total}</div>
        </div>
        <div style={{ width: 36 }}/>
      </div>

      <div style={{ marginTop: 8 }}>
        <Bar value={idx} max={total} orange />
      </div>

      <div className="card" style={{ padding: 24, marginTop: 20, background: 'var(--cream)', textAlign: 'center', minHeight: 200 }}>
        <div className="kicker">빈칸을 영어로 채워보세요</div>
        <div className="kor" style={{ fontSize: 22, marginTop: 14, fontWeight: 500, lineHeight: 1.35, color: 'var(--ink)' }}>
          {current.kr}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 10 }}>
          {current.syn.map((s, i) => (
            <span key={i} className="syn-chip" style={{ fontSize: 10 }}>≈ {s}</span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, position: 'relative' }}>
        <input
          ref={inputRef}
          className="sentence-input"
          style={{
            fontFamily: 'var(--font-serif)', fontStyle: 'italic',
            fontSize: 28, textAlign: 'center', padding: '20px 16px',
            borderColor: showResult === 'correct' ? 'var(--green)' : showResult === 'wrong' ? 'var(--orange)' : 'var(--line)',
            background: showResult === 'correct' ? 'var(--green-soft)' : showResult === 'wrong' ? 'var(--orange-ghost)' : 'var(--cream)',
            transition: 'all 200ms',
          }}
          placeholder="type here..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) submit(); }}
          disabled={showResult !== null}
        />
        {showResult === 'correct' && (
          <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--green)' }}>
            <Icon name="check" size={24}/>
          </div>
        )}
      </div>

      {showResult === 'wrong' && (
        <div className="t-small" style={{ textAlign: 'center', marginTop: 8, color: 'var(--orange-dark)' }}>
          정답: <span className="serif" style={{ fontStyle: 'italic', fontSize: 16 }}>{current.en}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setAnswers(a => ({ ...a, [idx]: '', ['c' + idx]: false })); if (idx < total - 1) setIdx(idx + 1); else finish({ ...answers, [idx]: '', ['c' + idx]: false }); }}>
          Skip
        </button>
        <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} disabled={!value.trim() || showResult !== null} onClick={submit}>
          {idx === total - 1 ? '제출' : '다음'} <Icon name="arrow-right" size={14}/>
        </button>
      </div>

      <div className="t-small" style={{ textAlign: 'center', marginTop: 18, color: 'var(--muted)' }}>
        Powered by YouBuddy Words · Members 5기
      </div>
    </div>
  );
};

window.VocabTest = VocabTest;
