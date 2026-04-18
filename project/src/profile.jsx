const ProfilePage = ({ onBack }) => {
  const { MY_PROFILE, WEEKS } = window.APP_DATA;
  const [exportOpen, setExportOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const allDoneDays = WEEKS.flatMap(w => w.days.filter(d => d.status === 'done').map(d => ({ ...d, week: w.n })));

  const generateMarkdown = () => {
    let md = `# YouBuddy Business English · 5기 학습 기록\n\n`;
    md += `**이름.** ${MY_PROFILE.name}\n`;
    md += `**직무.** ${MY_PROFILE.role}\n`;
    md += `**시작일.** ${MY_PROFILE.joined}\n\n`;
    md += `---\n\n## 🎯 My North Star\n> ${MY_PROFILE.north_star}\n\n`;
    md += `### Day 1에 세운 업무 영어 목표\n`;
    MY_PROFILE.day1_goals.forEach(g => { md += `${g.i}. ${g.text}\n`; });
    md += `\n---\n\n## 📚 완료한 학습 (${allDoneDays.length}/20)\n\n`;
    WEEKS.forEach(w => {
      md += `### Week ${w.n} · ${w.title}\n`;
      w.days.forEach(d => {
        const icon = d.status === 'done' ? '✅' : d.status === 'today' ? '🟠' : '⬜';
        md += `- ${icon} **Day ${d.day}: ${d.title}** — _"${d.goal}"_\n`;
        if (d.status === 'done') md += `  - 표현 3개: ${d.words.map(w => `\`${w}\``).join(', ')}\n`;
      });
      md += '\n';
    });
    md += `---\n\n_Exported from YouBuddy · ${new Date().toLocaleDateString('ko-KR')}_\n`;
    return md;
  };

  const downloadMD = () => {
    const md = generateMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `youbuddy-learning-record-${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const copyMD = async () => {
    try {
      await navigator.clipboard.writeText(generateMarkdown());
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="page">
      <TopBar onBack={onBack} title="프로필" right={
        <button className="icon-btn" onClick={() => setExportOpen(true)} aria-label="노션 내보내기">
          <Icon name="download" size={14} />
        </button>
      }/>

      {/* Hero */}
      <div className="profile-hero">
        <Avatar name={MY_PROFILE.name} color="orange" size="xl" />
        <h1 className="h1" style={{ marginTop: 12, fontSize: 22 }}>{MY_PROFILE.name}</h1>
        <div className="t-body" style={{ marginTop: 4 }}>{MY_PROFILE.role}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <span className="badge badge-ink">YouBuddy {MY_PROFILE.cohort}</span>
          <span className="badge">Team {MY_PROFILE.team}</span>
          <span className="badge badge-orange">
            <Icon name="flame" size={10} color="var(--orange-dark)" /> {MY_PROFILE.stats.streak}일 연속
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
        {[
          { label: '완료 Day', value: MY_PROFILE.stats.done, suffix: '/20' },
          { label: '표현 누적', value: MY_PROFILE.stats.words, suffix: '개' },
          { label: '내 문장', value: MY_PROFILE.stats.sentences, suffix: '개' },
        ].map((s, i) => (
          <div key={i} className="card card-flat" style={{ padding: '12px 10px', textAlign: 'center' }}>
            <div className="kicker">{s.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2, marginTop: 4 }}>
              <span className="serif" style={{ fontSize: 26, lineHeight: 1, color: 'var(--orange)' }}>{s.value}</span>
              <span className="t-small mono">{s.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      {/* North Star */}
      <div className="target-banner" style={{ marginTop: 20, background: 'var(--ink)', color: 'var(--cream)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="target" size={14} color="var(--orange)" />
          <span className="kicker" style={{ color: 'var(--orange)' }}>MY NORTH STAR · DAY 01</span>
        </div>
        <div className="quote-mark" style={{ color: 'var(--orange)' }}>"</div>
        <div style={{ fontSize: 18, lineHeight: 1.35, marginTop: 4, fontWeight: 500, color: 'var(--cream)', fontFamily: 'var(--font-kor)' }}>
          {MY_PROFILE.north_star}
        </div>
      </div>

      {/* Day 1 goals */}
      <div style={{ marginTop: 20 }}>
        <div className="kicker">DAY 01 · 업무 영어 목표 3</div>
        <div className="stack-sm" style={{ marginTop: 10 }}>
          {MY_PROFILE.day1_goals.map(g => (
            <div key={g.i} className="goal-item">
              <div className="goal-num">{g.i}</div>
              <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5, fontFamily: 'var(--font-kor)' }}>
                {g.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent verifications */}
      <div style={{ marginTop: 24 }}>
        <div className="row-between">
          <div className="kicker">RECENT CHECK-INS</div>
          <span className="t-small mono">{allDoneDays.length}/20</span>
        </div>
        <div className="stack-sm" style={{ marginTop: 10 }}>
          {allDoneDays.slice(-5).reverse().map((d) => (
            <div key={d.day} style={{
              display: 'flex', gap: 10, alignItems: 'center',
              padding: '10px 12px', background: 'var(--cream)',
              border: '1px solid var(--line)', borderRadius: 12,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'var(--green)', color: '#fff',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                <Icon name="check" size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Day {d.day} · {d.title}
                </div>
                <div className="t-small mono" style={{ marginTop: 2 }}>
                  Week {d.week} · {d.date}
                </div>
              </div>
              <span className="badge badge-green" style={{ fontSize: 9 }}>완료</span>
            </div>
          ))}
        </div>
      </div>

      {/* Export section */}
      <div className="card" style={{ marginTop: 20, padding: 18, background: 'linear-gradient(135deg, #FFF3E3, #FDE2C6)', border: '1px solid var(--orange-soft)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: '#fff',
            display: 'grid', placeItems: 'center', fontSize: 18,
            fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 700, color: 'var(--ink)',
          }}>N</div>
          <div style={{ flex: 1 }}>
            <div className="h3">Notion으로 내보내기</div>
            <div className="t-small" style={{ marginTop: 4 }}>
              20일치 학습 노트, 표현, 내 문장, 목표를 한 페이지로
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn btn-ink" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setExportOpen(true)}>
            <Icon name="download" size={14} /> 노션 내보내기
          </button>
          <button className="btn btn-ghost" onClick={copyMD}>
            {copied ? '복사됨 ✓' : '마크다운 복사'}
          </button>
        </div>
      </div>

      {/* Notification preview */}
      <div style={{ marginTop: 24 }}>
        <div className="kicker">📱 앱 알림 미리보기</div>
        <div className="t-small" style={{ marginTop: 4, marginBottom: 12 }}>
          실제 푸시 알림은 앱 출시 후 활성화됩니다
        </div>
        <div className="stack-sm">
          <div className="notif">
            <div className="notif-icon">Y</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>YouBuddy</span>
                <span className="t-small mono">오전 9:00</span>
              </div>
              <div style={{ fontSize: 13, marginTop: 2, fontWeight: 600 }}>오늘은 Day 14 · 합의 도출 🎯</div>
              <div className="t-small" style={{ marginTop: 2 }}>2분이면 끝나요. 29명이 이미 시작했어요.</div>
            </div>
          </div>
          <div className="notif">
            <div className="notif-icon" style={{ background: 'var(--orange)' }}>🔥</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>YouBuddy</span>
                <span className="t-small mono">방금</span>
              </div>
              <div style={{ fontSize: 13, marginTop: 2, fontWeight: 600 }}>7-day streak! 대단해요 👏</div>
              <div className="t-small" style={{ marginTop: 2 }}>오늘 인증하면 8일 연속 기록이 됩니다</div>
            </div>
          </div>
        </div>
      </div>

      {/* Export drawer */}
      {exportOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(42,31,20,0.5)',
          zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={() => setExportOpen(false)}>
          <div style={{
            background: 'var(--ivory)', width: '100%', maxWidth: 440,
            borderRadius: '24px 24px 0 0', padding: 20, maxHeight: '80vh', overflowY: 'auto',
            animation: 'aiIn 260ms',
          }} onClick={e => e.stopPropagation()}>
            <div className="row-between" style={{ marginBottom: 14 }}>
              <div>
                <div className="kicker">NOTION EXPORT · PREVIEW</div>
                <div className="h3" style={{ marginTop: 4 }}>내 학습 기록</div>
              </div>
              <button className="icon-btn" onClick={() => setExportOpen(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{
              background: 'var(--cream)', border: '1px solid var(--line)',
              borderRadius: 12, padding: 14,
              fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6,
              color: 'var(--ink)', whiteSpace: 'pre-wrap', maxHeight: 360, overflowY: 'auto',
            }}>
              {generateMarkdown()}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-ink" onClick={downloadMD}>
                <Icon name="download" size={14} /> .md 다운로드
              </button>
              <button className="btn btn-primary btn-full" onClick={copyMD}>
                {copied ? '복사됨 ✓' : '📋 클립보드로 복사'}
              </button>
            </div>
            <div className="t-small" style={{ textAlign: 'center', marginTop: 10 }}>
              Notion에서는 Import로 `.md` 파일을 올리거나, 복사해서 붙여넣으면 됩니다
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

window.ProfilePage = ProfilePage;
