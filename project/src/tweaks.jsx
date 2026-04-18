const TWEAK_DEFAULS = /*EDITMODE-BEGIN*/{
  "accent": "orange",
  "fontScale": 100,
  "compact": false,
  "showPodium": true
}/*EDITMODE-END*/;

const ACCENTS = {
  orange: { base: '#E8743C', dark: '#C95721', soft: '#FAE3D1', ghost: '#FDF0E2' },
  clay:   { base: '#B85D3A', dark: '#8F3D1E', soft: '#EDD4C2', ghost: '#F4E5D9' },
  olive:  { base: '#7A8B4A', dark: '#5C6B32', soft: '#DDE4C2', ghost: '#EDF0DC' },
  plum:   { base: '#8B5A7A', dark: '#6A3D5C', soft: '#E4D2DD', ghost: '#F0E4EB' },
  sunset: { base: '#D9712A', dark: '#AD4E12', soft: '#F4D9BD', ghost: '#FAE9D5' },
};

const applyTweaks = (t) => {
  const a = ACCENTS[t.accent] || ACCENTS.orange;
  const root = document.documentElement;
  root.style.setProperty('--orange', a.base);
  root.style.setProperty('--orange-dark', a.dark);
  root.style.setProperty('--orange-soft', a.soft);
  root.style.setProperty('--orange-ghost', a.ghost);
  root.style.fontSize = (16 * (t.fontScale / 100)) + 'px';
  document.body.dataset.compact = t.compact ? '1' : '0';
};

const TweaksPanel = ({ open, values, onChange, onClose }) => {
  return (
    <div className={`tweaks-panel ${open ? 'open' : ''}`}>
      <div className="row-between" style={{ marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>
          <Icon name="sparkle" size={12} color="var(--orange)" /> Tweaks
        </h4>
        <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={onClose}>
          <Icon name="close" size={12}/>
        </button>
      </div>

      <div className="kicker" style={{ marginTop: 8 }}>ACCENT COLOR</div>
      <div className="swatch-row">
        {Object.entries(ACCENTS).map(([k, v]) => (
          <button
            key={k}
            className={`swatch ${values.accent === k ? 'active' : ''}`}
            style={{ background: v.base }}
            onClick={() => onChange({ accent: k })}
            title={k}
          />
        ))}
      </div>

      <div className="kicker">FONT SIZE · {values.fontScale}%</div>
      <input
        type="range" min="85" max="115" step="5"
        value={values.fontScale}
        onChange={(e) => onChange({ fontScale: parseInt(e.target.value, 10) })}
        style={{ width: '100%', accentColor: 'var(--orange)', marginTop: 6, marginBottom: 14 }}
      />

      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
        <span>홈 포디움 표시</span>
        <input
          type="checkbox"
          checked={values.showPodium}
          onChange={(e) => onChange({ showPodium: e.target.checked })}
          style={{ accentColor: 'var(--orange)' }}
        />
      </label>

      <div style={{ marginTop: 16, padding: 10, background: 'var(--paper)', borderRadius: 10, fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
        🎨 상단 툴바의 <b>Tweaks</b> 토글로 이 패널을 열고 닫을 수 있어요.
      </div>
    </div>
  );
};

window.TweaksPanel = TweaksPanel;
window.applyTweaks = applyTweaks;
window.TWEAK_DEFAULS = TWEAK_DEFAULS;
