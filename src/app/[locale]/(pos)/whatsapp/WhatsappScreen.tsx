'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Icon } from '@/components/Icons';
import { initials, shortTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import WhatsappSettingsPanel, { type WhatsappSettings } from './WhatsappSettingsPanel';

const EMOJI = ['😊', '👍', '🙏', '❤️', '👕', '🧺', '✨', '🚒', '📦', '👌', '🙌', '🔥'];

type WaDirection = 'IN' | 'OUT' | 'BOT';
type WaKind = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'TEMPLATE' | 'STICKER' | 'LOCATION' | 'CONTACT';

interface WaConversationListItem {
  id: string;
  customerId?: string | null;
  name: string;
  phone: string;
  area?: string | null;
  unread: number;
  pinned?: boolean;
  botPaused: boolean;
  pausedUntil: string | null;
  lastMsgAt: string | null;
  lastMsgPreview?: string | null;
  lastMsgFrom?: WaDirection | null;
}

interface WaMessage {
  id: string;
  direction: WaDirection;
  kind: WaKind;
  body?: string | null;
  mediaUrl?: string | null;
  ts: string;
  by?: { fullName?: string | null } | null;
}

interface WaThread extends WaConversationListItem {
  messages?: WaMessage[];
}

function dayLabel(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function trimPreview(s: string, max = 60): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function previewPrefix(from: WaDirection | null | undefined): string {
  if (from === 'OUT') return '✓ ';
  if (from === 'BOT') return '🤖 ';
  return '';
}

function minutesUntil(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 60_000);
}

export default function WhatsappScreen({
  conversations,
  settings,
}: {
  conversations: WaConversationListItem[];
  settings: WhatsappSettings | null;
}) {
  const [convos, setConvos] = useState<WaConversationListItem[]>(conversations);
  const [activeId, setActiveId] = useState<string | null>(conversations[0]?.id ?? null);
  const [thread, setThread] = useState<WaThread | null>(null);
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<WhatsappSettings | null>(settings);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [, forceTick] = useState(0);
  const threadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('WhatsApp');
  const toast = useToast();
  const router = useRouter();
  const params = useParams<{ locale: string }>();

  useEffect(() => {
    if (!activeId) {
      setThread(null);
      return;
    }
    api<WaThread>(`/whatsapp/conversations/${activeId}`).then(setThread).catch(() => {});
  }, [activeId]);

  useEffect(() => {
    threadRef.current?.scrollTo(0, threadRef.current.scrollHeight);
  }, [thread]);

  // Re-render every 30s while any thread is paused so countdown ticks down.
  useEffect(() => {
    const anyPaused = thread?.botPaused || convos.some((c) => c.botPaused);
    if (!anyPaused) return;
    const h = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(h);
  }, [thread?.botPaused, convos]);

  async function refreshSidebar() {
    try {
      const list = await api<WaConversationListItem[]>('/whatsapp/conversations');
      setConvos(list);
    } catch {}
  }

  async function reloadActiveConversation() {
    if (!activeId) return;
    const r = await api<WaThread>(`/whatsapp/conversations/${activeId}`);
    setThread(r);
    refreshSidebar();
  }

  async function send() {
    if (!draft.trim() || !activeId) return;
    const pauseMin = currentSettings?.pauseMinutes ?? 15;
    try {
      await api(`/whatsapp/conversations/${activeId}/messages`, {
        method: 'POST',
        body: { body: draft },
      });
      setDraft('');
      await api(`/whatsapp/conversations/${activeId}`, {
        method: 'PATCH',
        body: { botPaused: true, pausedUntil: new Date(Date.now() + pauseMin * 60_000) },
      }).catch(() => {});
      const r = await api<WaThread>(`/whatsapp/conversations/${activeId}`);
      setThread(r);
      refreshSidebar();
      toast.show(t('sentPaused', { mins: pauseMin }));
    } catch (e: any) {
      toast.show(e?.detail?.message || t('failedToSend'));
    }
  }

  async function toggleBot() {
    if (!thread) return;
    const wasPaused = thread.botPaused;
    const pauseMin = currentSettings?.pauseMinutes ?? 15;
    try {
      await api(`/whatsapp/conversations/${thread.id}`, {
        method: 'PATCH',
        body: wasPaused
          ? { botPaused: false, pausedUntil: null }
          : { botPaused: true, pausedUntil: new Date(Date.now() + pauseMin * 60_000) },
      });
      const r = await api<WaThread>(`/whatsapp/conversations/${thread.id}`);
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
    const r = await api<WaThread>(`/whatsapp/conversations/${thread.id}`);
    setThread(r);
    refreshSidebar();
    toast.show(t('botResumed'));
  }

  async function markUnread() {
    if (!thread) return;
    await api(`/whatsapp/conversations/${thread.id}`, {
      method: 'PATCH',
      body: { unread: (thread.unread ?? 0) + 1 },
    });
    refreshSidebar();
    setMenuOpen(false);
    toast.show(t('markedUnread'));
  }

  function clearChat() {
    setMenuOpen(false);
    // No DELETE endpoint exists yet; surface a coming-soon notice.
    toast.show(t('clearComingSoon'));
  }

  function viewOrders() {
    setMenuOpen(false);
    if (!thread) return;
    const locale = params?.locale ?? 'en';
    const q = thread.customerId
      ? `id=${encodeURIComponent(thread.customerId)}`
      : `q=${encodeURIComponent(thread.phone)}`;
    router.push(`/${locale}/customers?${q}`);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    // Reset the input so the same file can be re-selected after a failure.
    e.target.value = '';

    // 10 MB FE cap (server cap is 25 MB; we want to fail fast before hitting it).
    if (file.size > 10 * 1024 * 1024) {
      toast.show(t('uploadTooLarge'));
      return;
    }

    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const uploaded = await api<{ id: string; key: string; originalName: string; mime: string; sizeBytes: number }>(
        '/files/upload',
        { method: 'POST', body: fd },
      );

      await api(`/whatsapp/conversations/${activeId}/messages`, {
        method: 'POST',
        body: {
          kind: uploaded.mime.startsWith('image/') ? 'IMAGE' : 'FILE',
          mediaUrl: `/files/${uploaded.id}`,
        },
      });

      // Refresh the thread so the new message lands.
      await reloadActiveConversation();
    } catch (err: any) {
      toast.show(err?.detail?.message || t('uploadFailed'));
    } finally {
      setUploadBusy(false);
    }
  }

  async function startNewChat() {
    const phone = newChatPhone.trim();
    if (!phone) return;
    try {
      const c = await api<WaConversationListItem>('/whatsapp/conversations', {
        method: 'POST',
        body: { phone, name: newChatName.trim() || phone },
      });
      setNewChatOpen(false);
      setNewChatPhone('');
      setNewChatName('');
      await refreshSidebar();
      if (c?.id) setActiveId(c.id);
    } catch {
      toast.show(t('failedToSend'));
    }
  }

  async function onSettingsSaved(next: WhatsappSettings) {
    setCurrentSettings(next);
    setSettingsOpen(false);
    toast.show(t('saved'));
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const matched = q
      ? convos.filter(
          (c) =>
            c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(search),
        )
      : convos;
    // Pinned first, then most recent message.
    return [...matched].sort((a, b) => {
      const pa = a.pinned ? 1 : 0;
      const pb = b.pinned ? 1 : 0;
      if (pb !== pa) return pb - pa;
      const ta = a.lastMsgAt ? new Date(a.lastMsgAt).getTime() : 0;
      const tb = b.lastMsgAt ? new Date(b.lastMsgAt).getTime() : 0;
      return tb - ta;
    });
  }, [convos, search]);

  return (
    <div className="wa-host">
      <div className="wa-app">
        {/* SIDEBAR */}
        <aside className="wa-side">
          <div className="wa-side-top">
            <div className="wa-me">
              <div className="wa-av">TT</div>
              <div className="wa-me-nm">
                {t('businessLabel')}
                <span>{t('businessSub')}</span>
              </div>
            </div>
            {/* Design whatsapp.js:79 — .wa-side-ico div id="wa-newchat". */}
            <div className="wa-side-ico" id="wa-newchat" role="button" title={t('newChat')} onClick={() => setNewChatOpen(true)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            </div>
          </div>
          <div className="wa-search">
            <div className="wa-search-box">
              {/* Design whatsapp.js:81 — search icon rendered via ic(…,16)
                  which uses stroke-width 1.8 (NOT the global Icon.search
                  stroke 1.6). Inlined SVG keeps the stroke exactly. */}
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                id="wa-q"
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="wa-list" id="wa-list">
            {filtered.map((c) => {
              const last = c.lastMsgAt ? new Date(c.lastMsgAt) : null;
              const previewBody = c.lastMsgPreview ?? '';
              const prev = previewBody
                ? previewPrefix(c.lastMsgFrom) + trimPreview(previewBody)
                : c.phone;
              return (
                <button
                  key={c.id}
                  className={`wa-row${activeId === c.id ? ' on' : ''}`}
                  onClick={() => setActiveId(c.id)}
                >
                  <div className="wa-av lg">{initials(c.name)}</div>
                  <div className="wa-row-main">
                    <div className="wa-row-top">
                      <span className="wa-row-nm">
                        {c.pinned ? '📌 ' : ''}
                        {c.name}
                      </span>
                      <span className="wa-row-time">{last ? shortTime(last) : '—'}</span>
                    </div>
                    <div className="wa-row-bot">
                      <span className="wa-row-prev">{prev}</span>
                      {c.unread > 0 && <span className="wa-unread">{c.unread}</span>}
                      {c.botPaused && c.unread === 0 && (
                        /* Design whatsapp.js:87 — uses ⏸ emoji, not an icon. */
                        <span className="wa-paused-dot" title={t('botPaused')}>⏸</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="muted" style={{ padding: 24, fontSize: 13, textAlign: 'center' }}>
                {t('noConversations')}
              </div>
            )}
          </div>
        </aside>

        {/* MAIN THREAD — design whatsapp.js:95 renders the empty state as
            <div class="wa-main wa-empty">, with both classes on the SAME
            element. Empty-logo is a tiny arc SVG, not the full WhatsApp logo. */}
        {!thread ? (
          <section className="wa-main wa-empty">
            <div className="wa-empty-in">
              <div className="wa-empty-logo">
                <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4c0-1 .8-1.8 1.8-1.8S15.6 3 15.6 4" />
                </svg>
              </div>
              <h2>{t('title')}</h2>
              <p>{t('emptyHint')}</p>
            </div>
          </section>
        ) : (
          <section className="wa-main">
            <>
              <div className="wa-head">
                <div className="wa-av">{initials(thread.name)}</div>
                <div className="wa-head-info">
                  <div className="wa-head-nm">{thread.name}</div>
                  <div className="wa-head-sub">
                    {thread.phone}
                    {thread.area ? ` · ${thread.area}` : ''}
                  </div>
                </div>
                {/* Design whatsapp.js:110 — wa-bot-toggle <div> id="wa-bottoggle". */}
                <div
                  className={`wa-bot-toggle ${thread.botPaused ? 'off' : 'on'}`}
                  id="wa-bottoggle"
                  role="button"
                  onClick={toggleBot}
                  title={thread.botPaused ? t('botResume') : t('botPause')}
                >
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="7" width="16" height="11" rx="3" />
                    {thread.botPaused ? (
                      <>
                        <path d="M9 11v3M15 11v3" />
                      </>
                    ) : (
                      <>
                        <circle cx="9" cy="12.5" r="1.4" />
                        <circle cx="15" cy="12.5" r="1.4" />
                        <path d="M12 4v3" />
                      </>
                    )}
                  </svg>
                  <span>
                    {thread.botPaused
                      ? t('botPausedTimer', { mins: minutesUntil(thread.pausedUntil) })
                      : t('botActive')}
                  </span>
                </div>
                {/* Design whatsapp.js:114 — search btn id="wa-search-btn"
                    title="Search" (not search-placeholder). */}
                <div className="wa-head-ico" id="wa-search-btn" role="button" title={t('headerSearch')} onClick={() => { document.getElementById('wa-q')?.focus(); }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                </div>
                <div
                  className="wa-head-ico"
                  id="wa-menu-btn"
                  role="button"
                  title={t('menu')}
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                  style={{ position: 'relative' }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="5" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="12" cy="19" r="1.6" />
                  </svg>
                  {/* Design whatsapp.js:116-121 — menu is always rendered with
                      `hidden` attribute, items have data-m, order is
                      info / unread / clear / order. */}
                  <div className="wa-menu" id="wa-menu" hidden={!menuOpen} onClick={(e) => e.stopPropagation()}>
                    <button data-m="info" onClick={() => { setMenuOpen(false); toast.show(`${thread.name} · ${thread.phone} · ${thread.area ?? '—'}`); }}>
                      {t('menuOptions.info')}
                    </button>
                    <button data-m="unread" onClick={markUnread}>{t('menuOptions.unread')}</button>
                    <button data-m="clear" onClick={clearChat}>{t('menuOptions.clear')}</button>
                    <button data-m="order" onClick={viewOrders}>{t('menuOptions.viewOrders')}</button>
                  </div>
                </div>
              </div>

              <div className="wa-thread" id="wa-thread" ref={threadRef}>
                {(() => {
                  const items: React.ReactNode[] = [];
                  let lastDay = '';
                  for (const m of thread.messages ?? []) {
                    const dl = dayLabel(m.ts);
                    if (dl !== lastDay) {
                      items.push(
                        <div key={`day-${m.id}`} className="wa-day">
                          <span>{dl}</span>
                        </div>,
                      );
                      lastDay = dl;
                    }
                    const cls = m.direction === 'IN' ? 'in' : 'out';
                    const isImage = m.kind === 'IMAGE';
                    const isFile = m.kind === 'DOCUMENT' || m.kind === 'VIDEO' || m.kind === 'AUDIO';
                    items.push(
                      <div
                        key={m.id}
                        className={`wa-msg ${cls} ${m.direction === 'BOT' ? 'bot' : ''}`}
                      >
                        {m.direction === 'BOT' && (
                          <span className="wa-bot-tag">
                            🤖 {currentSettings?.botName ?? 'Bot'}
                          </span>
                        )}
                        {m.direction === 'OUT' && m.by && (
                          <span className="wa-by">{m.by.fullName ?? 'You'}</span>
                        )}
                        <div className={`wa-bubble${isImage ? ' img' : ''}`}>
                          {isImage && m.mediaUrl ? (
                            <div className="wa-att-img">
                              <img src={m.mediaUrl} alt={m.body ?? ''} />
                            </div>
                          ) : null}
                          {isFile && m.mediaUrl ? (
                            <a
                              className="wa-att-file"
                              href={m.mediaUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                color: 'inherit',
                                textDecoration: 'none',
                              }}
                            >
                              <span className="wa-att-ic">
                                <Icon.receipt size={20} />
                              </span>
                              <span className="wa-att-meta">
                                <b>{m.body || 'Document'}</b>
                              </span>
                            </a>
                          ) : null}
                          {m.body && !isFile && <span>{m.body}</span>}
                          <span className="wa-time">
                            {shortTime(m.ts)}
                            {m.direction !== 'IN' ? ' ✓✓' : ''}
                          </span>
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
                  <button id="wa-resume" onClick={resumeBot}>{t('botResume')}</button>
                </div>
              )}

              {/* Design whatsapp.js:126 — emoji-bar is always rendered with
                  hidden attr, not conditionally mounted. */}
              <div className="wa-emoji-bar" id="wa-emoji-bar" hidden={!emojiOpen}>
                {EMOJI.map((e) => (
                  <button key={e} data-emo={e} onClick={() => setDraft((d) => d + e)}>
                    {e}
                  </button>
                ))}
              </div>

              {/* Design whatsapp.js:127-133 — composer uses SVG icons; each
                  composer button has design-matching id. Send button has
                  no title attribute. */}
              <div className="wa-composer">
                <button className="wa-comp-ico" id="wa-emoji" onClick={() => setEmojiOpen((v) => !v)} title={t('emoji')}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M9 10h.01M15 10h.01M8.5 14a4 4 0 0 0 7 0" />
                  </svg>
                </button>
                <button className="wa-comp-ico wa-attach" id="wa-attach" onClick={openFilePicker} disabled={uploadBusy} title={t('attach')} aria-label={t('uploadImage')}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10 17.5a1.6 1.6 0 0 1-2.3-2.3l7.8-7.8" />
                  </svg>
                </button>
                {/* Design whatsapp.js:130 — file input carries `multiple`. */}
                <input ref={fileInputRef} id="wa-file" type="file" accept="image/*,application/pdf" multiple hidden onChange={onFileChosen} />
                <input
                  id="wa-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder={t('typeMessage')}
                />
                <button className="wa-send" id="wa-send" onClick={send}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12l16-8-6 16-3-6-7-2z" />
                  </svg>
                </button>
              </div>
            </>
          </section>
        )}
      </div>

      {newChatOpen && (
        <div
          onClick={() => setNewChatOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.4)',
            zIndex: 1000,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ width: 360, padding: 20, background: 'var(--card, #fff)', borderRadius: 12 }}
          >
            <h3 style={{ marginTop: 0 }}>{t('newChat')}</h3>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>{t('newChatPhone')}</label>
              <input
                className="inp"
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
                placeholder={t('newChatPhonePlaceholder')}
                autoFocus
              />
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>{t('businessLabel')}</label>
              <input
                className="inp"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                placeholder={t('newChatNamePlaceholder')}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-pri" onClick={startNewChat} disabled={!newChatPhone.trim()}>
                {t('newChatStart')}
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <WhatsappSettingsPanel
          initial={currentSettings}
          onClose={() => setSettingsOpen(false)}
          onSaved={onSettingsSaved}
        />
      )}
    </div>
  );
}
