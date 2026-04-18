const { WEEKS: WEEKS_DATA } = window.APP_DATA;

const MyWeeksPage = ({ onOpenDay, onBack }) => {
  const me = window.APP_DATA.CHALLENGE_MEMBERS.find(m => m.me);
  const totalDone = WEEKS_DATA.reduce((s, w) => s + w.days.filter(d => d.status === 'done').length, 0);

  return (
    <div className="page">
      <TopBar onBack={onBack} title="내 학습" subtitle="4주 · 20일" />

      {/* Overview */}
      <div style={{ marginTop: 4, padding: '8px 4px 20px' }}>
        <div className="kicker">MY DASHBOARD</div>
        <h1 className="h1" style={{ marginTop: 8 }}>
          <span className="serif">13 Days</span> 완주했어요
          <br /><span style={{ color: 'var(--orange)' }}>7 Days</span> 더 달려볼까요?
        </h1>
        <p className="t-body" style={{ marginTop: 10 }}>
          매주 5일 × 4주 = 20일. 오늘은 <b>Day 14 · 합의 도출</b>.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16,
        }}>
          <div className="card card-flat" style={{ padding: 12 }}>
            <div className="kicker">완료</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="serif" style={{ fontSize: 30, lineHeight: 1 }}>{totalDone}</span>
              <span className="t-small mono" style={{ whiteSpace: 'nowrap' }}>/ 20 days</span>
            </div>
          </div>
          <div className="card card-flat" style={{ padding: 12 }}>
            <div className="kicker">표현 누적</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="serif" style={{ fontSize: 30, lineHeight: 1 }}>{totalDone * 3}</span>
              <span className="t-small mono" style={{ whiteSpace: 'nowrap' }}>개</span>
            </div>
          </div>
        </div>
      </div>

      {/* Weeks */}
      <div className="stack">
        {WEEKS_DATA.map((w) => {
          const doneCount = w.days.filter(d => d.status === 'done').length;
          const isCurrent = w.days.some(d => d.status === 'today');
          return (
            <div key={w.n} className={`week-card ${isCurrent ? 'current' : ''}`}>
              <div className="row-between">
                <div>
                  <div className="kicker" style={{ color: isCurrent ? 'rgba(251,247,240,0.55)' : 'var(--muted)' }}>
                    WEEK {w.n} · {w.title.toUpperCase()}
                  </div>
                  <h2 className="h2" style={{ marginTop: 6, fontSize: 18 }}>
                    {w.subtitle}
                  </h2>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontWeight: 600, fontSize: 13 }}>
                    {doneCount}<span style={{ opacity: 0.4 }}>/5</span>
                  </div>
                  {isCurrent && <div className="badge badge-orange" style={{ marginTop: 6, fontSize: 9 }}>진행중</div>}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <Bar value={doneCount} max={5} orange={isCurrent} />
              </div>

              <div className="day-chip-row">
                {w.days.map((d) => {
                  const cls = d.status === 'done' ? 'done'
                           : d.status === 'today' ? 'today'
                           : d.status === 'locked' ? 'locked' : '';
                  return (
                    <button
                      key={d.day}
                      className={`day-chip ${cls}`}
                      onClick={() => d.status !== 'locked' && onOpenDay(d.day)}
                      disabled={d.status === 'locked'}
                      style={{ border: 'none', cursor: d.status === 'locked' ? 'not-allowed' : 'pointer' }}
                      title={d.title}
                    >
                      {d.status === 'done' && <span className="dot-done" />}
                      {d.day}
                    </button>
                  );
                })}
              </div>

              {/* Day preview for current week */}
              {isCurrent && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(251,247,240,0.12)' }}>
                  <div className="kicker" style={{ color: 'rgba(251,247,240,0.55)' }}>오늘</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    <div>
                      <div className="h3" style={{ color: 'var(--cream)' }}>{w.days.find(d => d.status === 'today').title}</div>
                      <div className="t-small" style={{ color: 'rgba(251,247,240,0.6)', marginTop: 2, fontStyle: 'italic' }}>
                        "{w.days.find(d => d.status === 'today').goal}"
                      </div>
                    </div>
                    <button
                      className="icon-btn"
                      style={{ marginLeft: 'auto', background: 'var(--orange)', border: 'none', color: '#fff' }}
                      onClick={() => onOpenDay(w.days.find(d => d.status === 'today').day)}
                    >
                      <Icon name="arrow-right" size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bonus materials */}
      <div className="card" style={{ marginTop: 14, padding: 16, background: 'var(--orange-ghost)', border: '1px solid var(--orange-soft)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: '#fff', color: 'var(--orange)',
            display: 'grid', placeItems: 'center',
          }}>
            <Icon name="volume" size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="kicker" style={{ color: 'var(--orange-dark)' }}>BONUS · MON · WED · FRI</div>
            <div className="h3" style={{ marginTop: 4 }}>귀 열기 자료</div>
            <div className="t-small" style={{ marginTop: 4, color: 'var(--ink-soft)' }}>
              TED 영상에서 오늘 표현이 실제로 어떻게 쓰이는지 들어봐요.
            </div>
          </div>
          <Icon name="chevron-right" color="var(--orange-dark)" />
        </div>
      </div>
    </div>
  );
};

window.MyWeeksPage = MyWeeksPage;
