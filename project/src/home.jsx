const { CHALLENGE_MEMBERS, WEEKS, TODAY_LESSON } = window.APP_DATA;

const HomePage = ({ onOpenMy }) => {
  const TOTAL_DAYS = 20;
  const me = CHALLENGE_MEMBERS.find(m => m.me);
  const sorted = [...CHALLENGE_MEMBERS].sort((a,b) => b.progress - a.progress || b.streak - a.streak);
  const myRank = sorted.findIndex(m => m.me) + 1;
  const totalParticipants = CHALLENGE_MEMBERS.length;
  const todayRate = Math.round(
    (CHALLENGE_MEMBERS.filter(m => m.progress >= 14).length / totalParticipants) * 100
  );

  const [filter, setFilter] = React.useState('all'); // all | A | B

  const filtered = filter === 'all' ? sorted : sorted.filter(m => m.team === filter);

  return (
    <div className="page">
      <TopBar />

      {/* Hero — my progress */}
      <div className="card card-ink" style={{ padding: 20, borderRadius: 28, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', right: -40, top: -40, width: 180, height: 180,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,116,60,0.35), transparent 65%)'
        }}/>
        <div className="row-between">
          <div className="kicker" style={{ color: 'rgba(251,247,240,0.55)' }}>MY PROGRESS · DAY 14/20</div>
          <span className="badge badge-orange">Today · Day 14</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 18 }}>
          <div>
            <div className="serif" style={{ fontSize: 64, lineHeight: 0.9, letterSpacing: '-0.04em' }}>
              <span style={{ color: 'var(--orange)' }}>14</span>
              <span style={{ color: 'rgba(251,247,240,0.35)' }}>/20</span>
            </div>
            <div className="t-small" style={{ marginTop: 8, color: 'rgba(251,247,240,0.7)' }}>
              5기 비즈니스 영어 챌린지
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              <Icon name="flame" size={14} color="var(--orange)" />
              <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{me.streak}-day streak</span>
            </div>
            <div className="t-small mono" style={{ color: 'rgba(251,247,240,0.55)', marginTop: 4 }}>
              #{myRank} of {totalParticipants}
            </div>
          </div>
        </div>

        {/* progress dots */}
        <div className="progress-dots" style={{ marginTop: 18 }}>
          {Array.from({ length: TOTAL_DAYS }).map((_, i) => {
            const day = i + 1;
            let cls = '';
            if (day < 14) cls = 'on';
            else if (day === 14) cls = 'today';
            return <span key={i} className={cls} />;
          })}
        </div>

        <button
          className="btn btn-primary btn-full btn-lg"
          style={{ marginTop: 18 }}
          onClick={onOpenMy}
        >
          오늘의 학습 열기 · Day 14
          <Icon name="arrow-right" size={16} />
        </button>
      </div>

      {/* Checkboard — everyone's 20-day grid */}
      <div style={{ marginTop: 28 }}>
        <Checkboard />
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
        <div className="card card-flat" style={{ padding: '14px 12px' }}>
          <div className="kicker">오늘 인증률</div>
          <div className="serif-num" style={{ fontSize: 32, lineHeight: 1, marginTop: 4, color: 'var(--orange)' }}>{todayRate}%</div>
          <div className="t-small" style={{ marginTop: 2 }}>어제 이 시간보다 ↑ 8%</div>
        </div>
        <div className="card card-flat" style={{ padding: '14px 12px' }}>
          <div className="kicker">TEAM A</div>
          <div className="serif-num" style={{ fontSize: 32, lineHeight: 1, marginTop: 4 }}>
            {Math.round(sorted.filter(m => m.team === 'A').reduce((s,m) => s+m.progress, 0) / sorted.filter(m => m.team === 'A').length * 5)}%
          </div>
          <div className="t-small" style={{ marginTop: 2 }}>평균 진행률</div>
        </div>
        <div className="card card-flat" style={{ padding: '14px 12px' }}>
          <div className="kicker">TEAM B</div>
          <div className="serif-num" style={{ fontSize: 32, lineHeight: 1, marginTop: 4 }}>
            {Math.round(sorted.filter(m => m.team === 'B').reduce((s,m) => s+m.progress, 0) / sorted.filter(m => m.team === 'B').length * 5)}%
          </div>
          <div className="t-small" style={{ marginTop: 2 }}>평균 진행률</div>
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ marginTop: 28, marginBottom: 12 }}>
        <div className="row-between">
          <div>
            <div className="kicker">LEADERBOARD</div>
            <h2 className="h2" style={{ marginTop: 4 }}>
              <span className="serif">This week's</span> stars
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['all','A','B'].map(f => (
              <button
                key={f}
                className="badge"
                style={{
                  background: filter === f ? 'var(--ink)' : 'var(--paper)',
                  color: filter === f ? 'var(--cream)' : 'var(--ink-soft)',
                  cursor: 'pointer', border: 'none',
                  padding: '6px 10px', fontSize: 10,
                }}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? '전체' : 'Team ' + f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 3 podium */}
      {filter === 'all' && (
        <div className="card" style={{ padding: 16, marginBottom: 12, background: 'linear-gradient(180deg, var(--cream), var(--paper))' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 10, alignItems: 'end' }}>
            {[sorted[1], sorted[0], sorted[2]].map((m, i) => {
              const place = i === 1 ? 1 : i === 0 ? 2 : 3;
              const h = place === 1 ? 96 : place === 2 ? 70 : 58;
              const bg = place === 1 ? 'var(--orange)' : place === 2 ? 'var(--ink)' : 'var(--muted)';
              return (
                <div key={m.id} style={{ textAlign: 'center' }}>
                  {place === 1 && (
                    <div style={{ fontSize: 18, marginBottom: 4 }}>👑</div>
                  )}
                  <Avatar name={m.name} color={place === 1 ? 'orange' : 'ink'} size="xl" />
                  <div className="h3" style={{ marginTop: 8, fontSize: 13 }}>{m.name}</div>
                  <div className="t-small mono" style={{ marginTop: 2 }}>{m.progress}/20</div>
                  <div style={{
                    height: h, marginTop: 10, borderRadius: '12px 12px 0 0',
                    background: bg, color: '#fff',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                    paddingTop: 10,
                    fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22,
                  }}>
                    {place}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ranked list */}
      <div className="card" style={{ padding: 6 }}>
        {filtered.slice(filter === 'all' ? 3 : 0, (filter === 'all' ? 3 : 0) + 12).map((m) => {
          const rank = sorted.findIndex(x => x.id === m.id) + 1;
          return (
            <div key={m.id} className={`rank-row ${m.me ? 'me' : ''}`}>
              <div className={`rank-num ${rank === 1 ? 'top1' : rank <= 3 ? 'top3' : ''}`}>
                {rank}
              </div>
              <Avatar name={m.name} color={m.color} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="h3" style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                  {m.me && <span className="badge badge-orange" style={{ fontSize: 9, padding: '2px 6px' }}>ME</span>}
                  <span className="t-small mono" style={{ color: 'var(--muted)' }}>· {m.team}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <div style={{ flex: 1, maxWidth: 120 }}>
                    <Bar value={m.progress} max={20} orange={m.me} />
                  </div>
                  <span className="t-small mono serif-num" style={{ fontSize: 13 }}>{m.progress}<span className="mono" style={{ fontSize: 10, opacity: 0.5 }}>/20</span></span>
                </div>
              </div>
              <span className="streak-pill serif-num" style={{ fontSize: 11, letterSpacing: '0.02em' }}>
                <Icon name="flame" size={12} color="var(--orange)" />
                <span className="serif-num" style={{ fontSize: 13 }}>{m.streak}</span>
                <span className="mono" style={{ fontSize: 10, opacity: 0.7 }}>d</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom note */}
      <div style={{ textAlign: 'center', padding: '24px 12px 12px', color: 'var(--muted)' }}>
        <div className="kicker">YOUBUDDY BUSINESS ENGLISH · 5기</div>
        <div className="t-small" style={{ marginTop: 6 }}>
          매일 2분, 20일이면 말하기가 달라져요
        </div>
      </div>
    </div>
  );
};

window.HomePage = HomePage;
