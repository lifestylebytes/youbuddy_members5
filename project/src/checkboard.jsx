// Checkerboard component for home page
const Checkboard = ({ onTapMember }) => {
  const { CHALLENGE_MEMBERS, CHECK_MATRIX } = window.APP_DATA;
  const TODAY = (window.APP_DATA.TODAY_LESSON?.day || 14) - 1;
  const savedState = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('yb5_state_v1') || '{}');
    } catch (e) {
      return {};
    }
  }, []);
  const [team, setTeam] = React.useState('all');
  const members = React.useMemo(() => {
    const list = team === 'all' ? CHALLENGE_MEMBERS : CHALLENGE_MEMBERS.filter(m => m.team === team);
    return [...list].sort((a, b) => b.progress - a.progress);
  }, [team]);

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 10 }}>
        <div>
          <div className="kicker">DAILY CHECK · 30 × 20</div>
          <h2 className="h2" style={{ marginTop: 4 }}>
            <span className="serif">Everyone's</span> progress
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all','A','B'].map(f => (
            <button
              key={f} className="badge"
              style={{
                background: team === f ? 'var(--ink)' : 'var(--paper)',
                color: team === f ? 'var(--cream)' : 'var(--ink-soft)',
                cursor: 'pointer', border: 'none', padding: '6px 10px', fontSize: 10,
              }}
              onClick={() => setTeam(f)}
            >
              {f === 'all' ? '전체' : 'Team ' + f}
            </button>
          ))}
        </div>
      </div>

      <div className="checkboard-wrap">
        <div className="hidden-scroll" style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div className="checkboard" style={{ minWidth: 540 }}>
            {/* Header row */}
            <div></div>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className={`cb-header ${i === TODAY ? 'today-col' : ''}`}>
                {i + 1}
              </div>
            ))}

            {/* Member rows */}
            {members.map((m) => {
              const checks = m.me
                ? Array.from({ length: 20 }, (_, idx) => !!savedState?.verified?.[`d${idx + 1}`])
                : (CHECK_MATRIX[m.id] || []);
              return (
                <React.Fragment key={m.id}>
                  <div className="cb-name" onClick={() => onTapMember && onTapMember(m)} style={{ cursor: 'pointer' }}>
                    <div className={`tiny-av ${m.color}`}>{m.name.replace(/\s+|[()0-9-]/g, '').slice(0,1)}</div>
                    <span>{m.name}</span>
                    {m.me && <span className="badge badge-orange" style={{ fontSize: 8, padding: '1px 5px' }}>ME</span>}
                  </div>
                  {Array.from({ length: 20 }).map((_, d) => {
                    const on = checks[d];
                    const isToday = d === TODAY;
                    const cls = isToday && on ? 'today' : on ? 'on' : '';
                    return <div key={d} className={`cb-cell ${cls}`} title={`Day ${d+1}: ${on ? '완료' : '미인증'}`} />;
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: 'var(--ink)', borderRadius: 2, display: 'inline-block' }}/> 완료
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: 'var(--orange)', borderRadius: 2, display: 'inline-block' }}/> 오늘
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: 'var(--line-soft)', borderRadius: 2, display: 'inline-block' }}/> 미인증
        </span>
      </div>
    </div>
  );
};

window.Checkboard = Checkboard;
