'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Icon } from '@/components/Icons';
import { initials, shortTime } from '@/lib/format';
import { useToast } from '@/components/Toast';

export default function WhatsappScreen({ conversations, settings }: { conversations: any[]; settings: any }) {
  const [convos, setConvos] = useState(conversations);
  const [activeId, setActiveId] = useState<string | null>(conversations[0]?.id ?? null);
  const [thread, setThread] = useState<any | null>(null);
  const [draft, setDraft] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (!activeId) return;
    api<any>(`/whatsapp/conversations/${activeId}`).then(setThread);
  }, [activeId]);

  async function send() {
    if (!draft.trim() || !activeId) return;
    try {
      await api(`/whatsapp/conversations/${activeId}/messages`, { method: 'POST', body: { body: draft } });
      setDraft('');
      const t = await api<any>(`/whatsapp/conversations/${activeId}`);
      setThread(t);
      // refresh sidebar list
      const list = await api<any[]>('/whatsapp/conversations');
      setConvos(list);
    } catch (e: any) {
      toast.show(e?.detail?.message || 'Failed to send');
    }
  }

  return (
    <div className="wa-host">
      <div className="wa-app">
        <aside className="wa-side">
          <div className="wa-side-top">
            <div className="wa-me">
              <div className="wa-av">TT</div>
              <div className="wa-me-nm">Thawb Wa Teeb<span>WhatsApp Business</span></div>
            </div>
          </div>
          <div className="wa-search">
            <div className="wa-search-box">
              <Icon.search size={16} />
              <input placeholder="Search conversations" />
            </div>
          </div>
          <div className="wa-list">
            {convos.map((c) => (
              <button key={c.id} className={`wa-row${activeId === c.id ? ' on' : ''}`} onClick={() => setActiveId(c.id)}>
                <div className="wa-av lg">{initials(c.name)}</div>
                <div className="wa-row-main">
                  <div className="wa-row-top">
                    <span className="wa-row-nm">{c.name}</span>
                    <span className="wa-row-time">{shortTime(c.lastMsgAt)}</span>
                  </div>
                  <div className="wa-row-bot">
                    <span className="wa-row-prev">{c.phone}</span>
                    {c.unread > 0 && <span className="wa-unread">{c.unread}</span>}
                    {c.botPaused && <span className="wa-paused-dot">⏸</span>}
                  </div>
                </div>
              </button>
            ))}
            {convos.length === 0 && <div className="muted" style={{ padding: 24, fontSize: 13, textAlign: 'center' }}>No conversations yet</div>}
          </div>
        </aside>

        <section className="wa-main">
          {!thread ? (
            <div className="wa-empty">
              <div className="wa-empty-in">
                <div className="wa-empty-logo"><Icon.whatsapp size={56} /></div>
                <h2>WhatsApp Business</h2>
                <p>Pick a conversation to start replying. The bot ({settings?.botName ?? 'assistant'}) is {settings?.botEnabled ? 'on' : 'off'}.</p>
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
                <span className={`wa-bot-toggle ${thread.botPaused ? 'off' : 'on'}`}>
                  {thread.botPaused ? '⏸ Bot paused' : '✓ Bot active'}
                </span>
              </div>
              <div className="wa-thread">
                {thread.messages.map((m: any) => (
                  <div key={m.id} className={`wa-msg ${m.direction === 'IN' ? 'in' : m.direction === 'BOT' ? 'bot out' : 'out'}`}>
                    {m.direction === 'BOT' && <div className="wa-bot-tag">🤖 {settings?.botName ?? 'Bot'}</div>}
                    <div className={`wa-bubble${m.kind === 'IMAGE' ? ' img' : ''}`}>
                      {m.kind === 'IMAGE' && m.mediaUrl ? <div className="wa-att-img"><img src={m.mediaUrl} alt="" /></div> : m.body}
                      <span className="wa-time">{shortTime(m.ts)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="wa-composer">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type a message" />
                <button className="wa-send" onClick={send}>➤</button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
