// Icons + small primitive components
const { useState, useEffect, useRef, useMemo } = React;

const Icon = ({ name, size = 18, color = 'currentColor', strokeWidth = 1.8 }) => {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: color, strokeWidth,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (name) {
    case 'home': return <svg {...props}><path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>;
    case 'book': return <svg {...props}><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5a2.5 2.5 0 0 0 0 5H20"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22"/></svg>;
    case 'spark': return <svg {...props}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>;
    case 'user': return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case 'chevron-right': return <svg {...props}><path d="m9 6 6 6-6 6"/></svg>;
    case 'chevron-left': return <svg {...props}><path d="m15 6-6 6 6 6"/></svg>;
    case 'check': return <svg {...props}><path d="M5 12.5 10 17.5 19.5 7.5"/></svg>;
    case 'bell': return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9zM10.5 21a1.5 1.5 0 0 0 3 0"/></svg>;
    case 'flame': return <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 .5-2S6 10 6 14a6 6 0 0 0 12 0c0-6-6-12-6-12z"/></svg>;
    case 'trophy': return <svg {...props}><path d="M8 3h8v5a4 4 0 0 1-8 0V3zM5 5H3a3 3 0 0 0 5 3M19 5h2a3 3 0 0 1-5 3M12 12v4M8 21h8M10 21l.5-5h3L14 21"/></svg>;
    case 'mic': return <svg {...props}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/></svg>;
    case 'pen': return <svg {...props}><path d="M15 4 20 9 8 21H3v-5z"/></svg>;
    case 'image': return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m3 18 6-6 5 5 3-3 4 4"/></svg>;
    case 'wave': return <svg {...props}><path d="M2 12h2M6 8v8M10 5v14M14 8v8M18 10v4M22 12h-2"/></svg>;
    case 'settings': return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case 'sparkle': return <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M12 2 14 9l7 2-7 2-2 7-2-7-7-2 7-2z"/></svg>;
    case 'arrow-right': return <svg {...props}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'play': return <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M7 4v16l13-8z"/></svg>;
    case 'lock': return <svg {...props}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>;
    case 'clock': return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'target': return <svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>;
    case 'stop': return <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><rect x="6" y="6" width="12" height="12" rx="2"/></svg>;
    case 'close': return <svg {...props}><path d="M6 6l12 12M6 18 18 6"/></svg>;
    case 'volume': return <svg {...props}><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15 9a4 4 0 0 1 0 6"/><path d="M18 6a8 8 0 0 1 0 12"/></svg>;
    case 'download': return <svg {...props}><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 21h16"/></svg>;
    default: return null;
  }
};

const TopBar = ({ title, onBack, right, subtitle }) => (
  <div className="topbar">
    {onBack ? (
      <button className="icon-btn" onClick={onBack}><Icon name="chevron-left" /></button>
    ) : (
      <div className="brand">
        <div className="logo-mark">Y</div>
        <div>
          <div className="brand-name">YouBuddy<small>5기 · Week 3</small></div>
        </div>
      </div>
    )}
    {title && (
      <div style={{ textAlign: 'center', flex: 1, padding: '0 12px' }}>
        <div className="h3">{title}</div>
        {subtitle && <div className="t-small" style={{ marginTop: 2 }}>{subtitle}</div>}
      </div>
    )}
    {right || <button className="icon-btn dot" style={{ position: 'relative' }}><Icon name="bell" /></button>}
  </div>
);

const Avatar = ({ name, color = 'cream', size = 'md', initials }) => {
  const fallback = name.replace(/\s+|[()0-9-]/g, '').slice(0, 2).toUpperCase() || '?';
  const label = initials || fallback;
  const cls = `avatar ${color} ${size === 'xl' ? 'avatar-xl' : ''}`;
  return <div className={cls}>{label}</div>;
};

const Bar = ({ value, max = 100, orange }) => (
  <div className={`bar ${orange ? 'orange' : ''}`}>
    <span style={{ width: Math.min(100, (value / max) * 100) + '%' }} />
  </div>
);

const StreakPill = ({ n, size = 11 }) => (
  <span className="streak-pill" style={{ fontSize: size }}>
    <Icon name="flame" size={12} color="var(--orange)" /> {n}일
  </span>
);

const Celebration = () => {
  const items = useMemo(() => {
    const emojis = ['🎉','✨','⭐','🧡','🔥','💫'];
    return Array.from({ length: 18 }, (_, i) => ({
      i, left: 5 + Math.random() * 90,
      x: (Math.random() - 0.5) * 160, r: Math.random() * 720,
      delay: Math.random() * 0.3, ch: emojis[i % emojis.length],
    }));
  }, []);
  return (
    <div className="celebration">
      {items.map(p => (
        <span key={p.i} style={{
          left: p.left + '%',
          '--x': p.x + 'px', '--r': p.r + 'deg',
          animationDelay: p.delay + 's',
        }}>{p.ch}</span>
      ))}
    </div>
  );
};

Object.assign(window, { Icon, TopBar, Avatar, Bar, StreakPill, Celebration });
