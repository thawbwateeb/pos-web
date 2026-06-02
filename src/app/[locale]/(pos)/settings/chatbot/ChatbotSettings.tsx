'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/Toast';
import type { WhatsappSettings } from '../../whatsapp/WhatsappSettingsPanel';

/* Design whatsapp.js:183-226 — WhatsApp chatbot settings panel rendered
   inline in Settings → WhatsApp Bot.
   - .fin > .card max-width:820:
     - .set-row top toggle: <b>WhatsApp chatbot</b> + <span>Auto-reply to
       customers when staff are busy</span> + switch id='bot-en'
     - .field margin:18 0: 'Bot display name' + input id='bot-name'
     - .field margin-bottom:18: 'System prompt (bot personality &
       knowledge)' + textarea id='bot-prompt' rows=8 resize:vertical
       font:inherit line-height:1.5 + .note 'This instruction is sent to
       the AI on every customer message.' margin-top:6
     - .grid.g2 gap:14 margin-bottom:18: greeting + away textareas (rows=3)
     - .grid.g2 gap:14 margin-bottom:18: 'Pause bot when staff replies
       (minutes)' input id='bot-pause' type=number + note;
       'Hand-off keywords (comma separated)' input id='bot-keys' + note
     - .field margin-bottom:18: 'Hand-off message' input id='bot-handoff'
     - .grid.g2 gap:14 margin-bottom:18: 'Working hours' input id='bot-hours'
       + 'After-hours auto-reply' textarea id='bot-after' rows=2
     - flex gap:10: 'Save chatbot settings' .btn.btn-pri id='bot-save' +
       'Send test message' .btn.btn-ghost id='bot-test' */

const DEFAULTS: Required<Pick<WhatsappSettings,
  'botEnabled' | 'botName' | 'botPrompt' | 'greeting' | 'awayMsg' | 'handoffMsg' |
  'pauseMinutes' | 'handoffKeywords' | 'workingHours' | 'afterHoursMsg'
>> = {
  botEnabled: true,
  botName: 'Teeb Assistant',
  botPrompt:
    'You are Teeb Assistant, the friendly WhatsApp concierge for Thawb Wa Teeb Laundry in Dubai.\n' +
    '- Greet customers warmly and answer questions about services, pricing, pickup & delivery, and order status.\n' +
    '- Standard turnaround is 24 hours; express same-day if booked before 11 AM.\n' +
    '- Pickup & delivery is free over AED 50.\n' +
    '- If you cannot help or the customer asks for a human, hand over to staff.\n' +
    "- Keep replies short, polite, and in the customer's language (English or Arabic).",
  greeting: 'Hello! 👋 This is Teeb Assistant from Thawb Wa Teeb. How can I help you today?',
  awayMsg:
    "Thanks for your message! Our team is currently busy — I'll help in the meantime, or a team member will reply shortly.",
  handoffMsg: 'Got it — connecting you with a team member now. 🙌',
  pauseMinutes: 15,
  handoffKeywords: 'human, agent, staff, complaint, manager, refund',
  workingHours: '08:00 – 22:00',
  afterHoursMsg:
    "We're closed right now (open 8 AM–10 PM). Leave your message and we'll reply first thing!",
};

export default function ChatbotSettings({ initial }: { initial: WhatsappSettings | null }) {
  const src = initial ?? ({} as WhatsappSettings);
  const [f, setF] = useState({
    botEnabled: src.botEnabled ?? DEFAULTS.botEnabled,
    botName: src.botName ?? DEFAULTS.botName,
    botPrompt: src.botPrompt ?? DEFAULTS.botPrompt,
    greeting: src.greeting ?? DEFAULTS.greeting,
    awayMsg: src.awayMsg ?? DEFAULTS.awayMsg,
    handoffMsg: src.handoffMsg ?? DEFAULTS.handoffMsg,
    pauseMinutes: src.pauseMinutes ?? DEFAULTS.pauseMinutes,
    handoffKeywords: src.handoffKeywords ?? DEFAULTS.handoffKeywords,
    workingHours: src.workingHours ?? DEFAULTS.workingHours,
    afterHoursMsg: src.afterHoursMsg ?? DEFAULTS.afterHoursMsg,
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    setBusy(true);
    try {
      await api('/whatsapp/settings', { method: 'PATCH', body: f });
      toast.show('Chatbot settings saved');
    } catch {
      toast.show('Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fin">
      <div className="card" style={{ maxWidth: 820 }}>
        <div className="set-row">
          <div className="l">
            <b>WhatsApp chatbot</b>
            <span>Auto-reply to customers when staff are busy</span>
          </div>
          <div className="r">
            <button
              className={`switch ${f.botEnabled ? 'on' : ''}`}
              id="bot-en"
              onClick={() => setF({ ...f, botEnabled: !f.botEnabled })}
              type="button"
            />
          </div>
        </div>

        <div className="field" style={{ margin: '18px 0' }}>
          <label>Bot display name</label>
          <input
            className="inp"
            id="bot-name"
            value={f.botName}
            onChange={(e) => setF({ ...f, botName: e.target.value })}
          />
        </div>

        <div className="field" style={{ marginBottom: 18 }}>
          <label>System prompt (bot personality &amp; knowledge)</label>
          <textarea
            className="inp"
            id="bot-prompt"
            rows={8}
            style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
            value={f.botPrompt}
            onChange={(e) => setF({ ...f, botPrompt: e.target.value })}
          />
          <span className="note" style={{ marginTop: 6 }}>
            This instruction is sent to the AI on every customer message.
          </span>
        </div>

        <div className="grid g2" style={{ gap: 14, marginBottom: 18 }}>
          <div className="field">
            <label>Greeting message (first contact)</label>
            <textarea
              className="inp"
              id="bot-greet"
              rows={3}
              style={{ resize: 'vertical' }}
              value={f.greeting}
              onChange={(e) => setF({ ...f, greeting: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Busy / away message</label>
            <textarea
              className="inp"
              id="bot-away"
              rows={3}
              style={{ resize: 'vertical' }}
              value={f.awayMsg}
              onChange={(e) => setF({ ...f, awayMsg: e.target.value })}
            />
          </div>
        </div>

        <div className="grid g2" style={{ gap: 14, marginBottom: 18 }}>
          <div className="field">
            <label>Pause bot when staff replies (minutes)</label>
            <input
              className="inp"
              id="bot-pause"
              type="number"
              min={0}
              value={f.pauseMinutes}
              onChange={(e) => setF({ ...f, pauseMinutes: +e.target.value || 0 })}
            />
            <span className="note" style={{ marginTop: 6 }}>
              When a team member sends a message, the bot stops auto-replying to that chat for this long.
            </span>
          </div>
          <div className="field">
            <label>Hand-off keywords (comma separated)</label>
            <input
              className="inp"
              id="bot-keys"
              value={f.handoffKeywords}
              onChange={(e) => setF({ ...f, handoffKeywords: e.target.value })}
            />
            <span className="note" style={{ marginTop: 6 }}>
              If a customer message contains any of these, the bot hands over to a human.
            </span>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 18 }}>
          <label>Hand-off message</label>
          <input
            className="inp"
            id="bot-handoff"
            value={f.handoffMsg}
            onChange={(e) => setF({ ...f, handoffMsg: e.target.value })}
          />
        </div>

        <div className="grid g2" style={{ gap: 14, marginBottom: 18 }}>
          <div className="field">
            <label>Working hours</label>
            <input
              className="inp"
              id="bot-hours"
              value={f.workingHours}
              onChange={(e) => setF({ ...f, workingHours: e.target.value })}
            />
          </div>
          <div className="field">
            <label>After-hours auto-reply</label>
            <textarea
              className="inp"
              id="bot-after"
              rows={2}
              style={{ resize: 'vertical' }}
              value={f.afterHoursMsg}
              onChange={(e) => setF({ ...f, afterHoursMsg: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`btn btn-pri${busy ? ' btn-loading' : ''}`}
            id="bot-save"
            onClick={save}
            disabled={busy}
          >
            Save chatbot settings
          </button>
          <button
            className="btn btn-ghost"
            id="bot-test"
            onClick={() => toast.show('Test message sent to bot sandbox')}
          >
            Send test message
          </button>
        </div>
      </div>
    </div>
  );
}
