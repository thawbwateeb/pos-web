'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { Icon } from '@/components/Icons';
import { initials, shortTime } from '@/lib/format';
import { useToast } from '@/components/Toast';

const EMOJI = ['😊', '👍', '🙏', '❤️', '👕', '🧺', '✨', '🚒', '📦', '👌', '🙌', '🔥'];

function dayLabel(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function WhatsappScreen({ conversations, settings }: { conversations: any[]; settings: any }) {
  const [convos, setConvos] = useState(conversations);
  const [activeId, setActiveId] = useState<string | null>(conversations[0]?.id ?? null);
  const [thread, setThread] = useState<any | null>(null);
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('WhatsApp');
  const toast = useToast();

  useEffect(() => {
    if (!activeId) return;
    api<any>(`/whatsapp/conversations/${activeId}`).then(setThread);
  }, [activeId]);

  useEffect(() => {
    threadRef.current?.scrollTo(0, threadRef.current.scrollHeight);
  }, [thread]);

  async function refreshSidebar() {
    const list = await api<any[]>('/whatsapp/conversations');
    setConvos(list);
  }

  async function send() {
    if (!draft.trim() || !activeId) return;
    try {
      await api(`/whatsapp/conversations/${activeId}/messages`, { method: 'POST', body: { body: draft } });
      setDraft('');
      // Local optimistic state: bot pauses when staff sends.
      await api(`/whatsapp/conversations/${activeId}`, {
        method: 'PATCH',
        body: { botPaused: true, pausedUntil: new Date(Date.now() + (settings?.pauseMinutes ?? 15) * 60_000) },
      }).catch(() => {});
      const r = await api<any>(`/whatsapp/conversations/${activeId}`);
      setThread(r);
      refreshSidebar();
      toast.show(t('sentPaused', { mins: settings?.pauseMinutes ?? 15 }));
    } catch (e: any) {
      toast.show(e?.detail?.message || t('failedToSend'));
    }
  }

  async function toggleBot() {
    if (!thread) return;
    const wasPaused = thread.botPaused;
    try {
      await api(`/whatsapp/conversations/${thread.id}`, {
        method: 'PATCH',
        body: wasPaused
          ? { botPaused: false, pausedUntil: null }
          : { botPaused: true, pausedUntil: new Date(Date.now() + (settings?.pauseMinutes ?? 15) * 60_000) },
      });
      const r = await api<any>(`/whatsapp/conversations/${thread.id}`);
      setThread(r);
      refreshSidebar();
      toast.show(wasPaused ? t('botResumed') : t('botPaused'));
    } catch {}
  }

  async function resumeBot() {
    if (!thread) return;
    await api(`/whatsapp/conversations/${thread.id}`, {
      method: 'PATCH',
      body: { botPaused: false, pausedUntil: null },
    });
    const r = await api<any>(`/whatsapp/conversations/${thread.id}`);
    setThread(r);
    refreshSidebar();
    toast.show(t('botResumed'));
  }

  async function markUnread() {
    if (!thread) return;
    await api(`/whatsapp/conversations/${thread.id}`, { method: 'PATCH', body: { unread: (thread.unread ?? 0) + 1 } });
    refreshSidebar();
    setMenuOpen(false);
    toast.show(t('markedUnread'));
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const filtered = convos.filter((c) =>
    !search ? true : c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search),
  );

  return (
    <div className="wa-host">
      <div className="wa-app">
        {/* SIDEBAR */}
        <aside className="wa-side">
          <div className="wa-side-top">
            <div className="wa-me">
              <div className="wa-av">TT</div>
              <div className="wa-me-nm">{t('businessLabel')}<span>{t('businessSub')}</span></div>
            </div>
          </div>
          <div className="wa-search">
            <div className="wa-search-box">
              <Icon.search size={16} />
              <input placeholder={t('searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="wa-list">
            {filtered.map((c) => {
              const last = c.lastMsgAt ? new Date(c.lastMsgAt) : null;
              return (
                <button key={c.id} className={`wa-row${activeId === c.id ? ' on' : ''}`} onClick={() => setActiveId(c.id)}>
                  <div className="wa-av lg">{initials(c.name)}</div>
                  <div className="wa-row-main">
                    <div className="wa-row-top">
                      <span className="wa-row-nm">{c.name}</span>
                      <span className="wa-row-time">{last ? shortTime(last) : '—'}</span>
                    </div>
                    <div className="wa-row-bot">
                      <span className="wa-row-prev">{c.phone}</span>
                      {c.unread > 0 && <span className="wa-unread">{c.unread}</span>}
                      {c.botPaused && <span className="wa-paused-dot">⏸</span>}
                    </div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <div className="muted" style={{ padding: 24, fontSize: 13, textAlign: 'center' }}>{t('noConversations')}</div>}
          </div>
        </aside>

        {/* MAIN THREAD */}
        <section className="wa-main">
          {!thread ? (
            <div className="wa-empty">
              <div className="wa-empty-in">
                <div className="wa-empty-logo"><Icon.whatsapp size={56} /></div>
                <h2>{t('title')}</h2>
                <p>{t('empty', { botName: settings?.botName ?? 'assistant', state: settings?.botEnabled ? t('stateOn') : t('stateOff') })}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="wa-head">
                <div className="wa-av">{initials(thread.name)}</div>
                <div className="wa-head-info">
                  <div className="wa-head-nm">{thread.name}</div>
                  <div className="wa-head-sub">{thread.phone}{thread.area ? ` · ${thread.area}` : ''}</div>
                </div>
                <button
                  className={`wa-bot-toggle ${thread.botPaused ? 'off' : 'on'}`}
                  onClick={toggleBot}
                  title={thread.botPaused ? t('botResume') : t('botPause')}
                >
                  {thread.botPaused ? `⏸ ${t('botPaused')}` : `🤖 ${t('botActive')}`}
                </button>
                <button className="wa-head-ico" title={t('menu')} onClick={() => setMenuOpen((v) => !v)} style={{ position: 'relative' }}>
                  ⋯
                  {menuOpen && (
                    <div className="wa-menu" onClick={(e) => e.stopPropagation()}>
                      <button onClick={markUnread}>{t('menuOptions.unread')}</button>
                      <button onClick={() => { setMenuOpen(false); toast.show(`${thread.name} · ${thread.phone}`); }}>
                        {t('menuOptions.info')}
                      </button>
                    </div>
                  )}
                </button>
              </div>

              <div className="wa-thread" ref={threadRef}>
                {(() => {
                  const items: React.ReactNode[] = [];
                  let lastDay = '';
                  for (const m of (thread.messages ?? [])) {
                    const dl = dayLabel(m.ts);
                    if (dl !== lastDay) {
                      items.push(
                        <div key={`day-${m.id}`} className="wa-day"><span>{dl}</span></div>,
                      );
                      lastDay = dl;
                    }
                    const cls = m.direction === 'IN' ? 'in' : 'out';
                    items.push(
                      <div key={m.id} className={`wa-msg ${cls} ${m.direction === 'BOT' ? 'bot' : ''}`}>
                        {m.direction === 'BOT' && <span className="wa-bot-tag">🤖 {settings?.botName ?? 'Bot'}</span>}
                        {m.direction === 'OUT' && m.by && <span className="wa-by">{m.by.fullName ?? 'You'}</span>}
                        <div className={`wa-bubble${m.kind === 'IMAGE' ? ' img' : ''}`}>
                          {m.kind === 'IMAGE' && m.mediaUrl ? (
                            <div className="wa-att-img"><img src={m.mediaUrl} alt={m.body ?? ''} /></div>
                          ) : null}
                          {m.body && <span>{m.body}</span>}
                          <span className="wa-time">{shortTime(m.ts)}{m.direction !== 'IN' ? ' ✓✓' : ''}</span>
                        </div>
                      </div>,
                    );
                  }
                  return items;
                })()}
              </div>

              {thread.botPaused && (
                <div className="wa-takeover-bar">
                  {t('takeoverNotice')}
                  <button onClick={resumeBot}>{t('botResume')}</button>
                </div>
              )}

              {emojiOpen && (
                <div className="wa-emoji-bar">
                  {EMOJI.map((e) => (
                    <button key={e} onClick={() => setDraft((d) => d + e)}>{e}</button>
                  ))}
                </div>
              )}

              <div className="wa-composer">
                <button className="wa-comp-ico" onClick={() => setEmojiOpen((v) => !v)} title={t('emoji')}>😊</button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder={t('typeMessage')}
                />
                <button className="wa-send" onClick={send}>➤</button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
