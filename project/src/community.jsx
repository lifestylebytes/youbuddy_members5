const CommunityPage = ({ onBack }) => {
  const { COMMUNITY_FEED, CHALLENGE_MEMBERS } = window.APP_DATA;
  const [filter, setFilter] = React.useState('all'); // all | align on | go with | for now
  const [liked, setLiked] = React.useState({});

  const words = ['all', 'align on', 'go with', 'for now'];
  const feed = filter === 'all' ? COMMUNITY_FEED : COMMUNITY_FEED.filter(p => p.word === filter);

  const toggle = (id) => setLiked(l => ({ ...l, [id]: !l[id] }));

  const wordLabel = (word) => word === 'all' ? '전체' : word.toUpperCase();

  const userById = React.useMemo(() => {
    const m = {}; CHALLENGE_MEMBERS.forEach(u => m[u.id] = u); return m;
  }, []);

  const renderSentence = (sentence, word) => {
    const re = new RegExp(`\\b(${word.replace(/\s+/g, '\\s+')})\\b`, 'i');
    const parts = sentence.split(re);
    return parts.map((p, i) => re.test(p) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>);
  };

  return (
    <div className="page community-page">
      <div className="community-header">
        <button className="icon-btn community-header-btn" onClick={onBack}>
          <Icon name="chevron-left" />
        </button>
        <div className="community-header-copy">
          <h2>커뮤니티</h2>
          <p>오늘 동료들의 문장</p>
        </div>
        <button className="icon-btn dot community-header-btn" style={{ position: 'relative' }}>
          <Icon name="bell" />
        </button>
      </div>

      <div className="community-hero">
        <div className="kicker">TODAY · DAY 14</div>
        <h1 className="community-title">
          <span className="serif">30명의</span> 오늘 문장
        </h1>
        <p className="community-desc">
          Submit한 순서대로 보여요. 좋은 표현은 저장하고 댓글로 응원해요.
        </p>
      </div>

      <div className="community-filter hidden-scroll">
        {words.map(w => (
          <button
            key={w}
            className={`community-filter-chip ${filter === w ? 'active' : ''}`}
            onClick={() => setFilter(w)}
          >
            {w === 'all' ? '전체' : <span className="serif">{wordLabel(w)}</span>}
          </button>
        ))}
      </div>

      <div className="stack community-feed">
        {feed.map((p) => {
          const u = userById[p.user];
          if (!u) return null;
          const isLiked = liked[p.id];
          const likes = (p.likes || 0) + (isLiked ? 1 : 0);
          return (
            <div key={p.id} className="community-card">
              <div className="community-card-head">
                <Avatar name={u.name} initials={u.avatar} color={u.color} />
                <div className="community-card-meta">
                  <div className="community-card-userline">
                    <span className="community-card-name">{u.name}</span>
                    <span className="community-card-team">· Team {u.team}</span>
                  </div>
                  <div className="community-card-subline">
                    <span className="community-word-badge">{wordLabel(p.word)}</span>
                    <span className="community-card-time">{p.time}</span>
                  </div>
                </div>
                <button className="icon-btn community-card-action">
                  <Icon name="spark" size={12} />
                </button>
              </div>

              <p className="community-sentence">{renderSentence(p.sentence, p.word)}</p>
              <p className="community-translate">{p.translate}</p>

              <div className="community-actions">
                <button onClick={() => toggle(p.id)} style={{ color: isLiked ? 'var(--orange-dark)' : 'var(--ink-soft)' }}>
                  <Icon name="flame" size={12} color={isLiked ? 'var(--orange)' : 'var(--ink-soft)'} /> {likes}
                </button>
                <button>
                  <Icon name="pen" size={12} /> {p.comments}
                </button>
                <button style={{ marginLeft: 'auto' }}>
                  <Icon name="volume" size={12} /> 듣기
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

window.CommunityPage = CommunityPage;
