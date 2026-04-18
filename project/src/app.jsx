const { useState, useEffect } = React;

const App = () => {
  const [page, setPage] = useState(() => localStorage.getItem('yb_page') || 'home');
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [tweaks, setTweaks] = useState(window.TWEAK_DEFAULS);
  const [toast, setToast] = useState(null);

  useEffect(() => { localStorage.setItem('yb_page', page); }, [page]);
  useEffect(() => { window.applyTweaks(tweaks); }, [tweaks]);

  // Tweaks protocol
  useEffect(() => {
    const handler = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const updateTweak = (patch) => {
    const next = { ...tweaks, ...patch };
    setTweaks(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*');
  };

  const go = (p) => setPage(p);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  return (
    <div className="app" data-screen-label={
      page === 'home' ? '01 Home Leaderboard' :
      page === 'my' ? '02 My 4 Weeks' :
      page === 'day' ? '03 Day Note' :
      page === 'verify' ? '04 Verify Flow' : ''
    }>
      {page === 'home' && <HomePage onOpenMy={() => go('my')} />}
      {page === 'my' && <MyWeeksPage onBack={() => go('home')} onOpenDay={() => go('day')} />}
      {page === 'day' && <DayNotePage onBack={() => go('my')} onVerify={() => go('verify')} />}
      {page === 'verify' && <VerifyPage
        onBack={() => go('day')}
        onComplete={() => { go('home'); showToast('🎉 Day 14 인증 완료! 대시보드에 반영됐어요'); }}
      />}
      {page === 'community' && <CommunityPage onBack={() => go('home')} />}
      {page === 'profile' && <ProfilePage onBack={() => go('home')} />}

      {/* Bottom tab bar */}
      <div className="tabbar">
        <div className="tabbar-inner">
          <button className={`tab ${page === 'home' ? 'active' : ''}`} onClick={() => go('home')}>
            <Icon name="home" size={14} /> 홈
          </button>
          <button className={`tab ${page === 'my' || page === 'day' || page === 'verify' ? 'active' : ''}`} onClick={() => go('my')}>
            <Icon name="book" size={14} /> 내 학습
          </button>
          <button className={`tab ${page === 'community' ? 'active' : ''}`} onClick={() => go('community')}>
            <Icon name="spark" size={14} /> 커뮤니티
          </button>
          <button className={`tab ${page === 'profile' ? 'active' : ''}`} onClick={() => go('profile')}>
            <Icon name="user" size={14} /> 나
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 110, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ink)', color: 'var(--cream)',
          padding: '12px 18px', borderRadius: 999,
          fontSize: 13, fontWeight: 500, zIndex: 60,
          boxShadow: 'var(--shadow-l)',
          animation: 'aiIn 260ms cubic-bezier(.2,.9,.3,1.1)',
          maxWidth: 360, textAlign: 'center',
        }}>
          {toast}
        </div>
      )}

      <TweaksPanel
        open={tweaksOpen}
        values={tweaks}
        onChange={updateTweak}
        onClose={() => setTweaksOpen(false)}
      />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
