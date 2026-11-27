import { useEffect, useRef, useState } from 'react';
import { answer, HELP } from './assistant.js';
import { today } from './ui.jsx';

const QUICK = ['مين متأخر؟', 'أقساط الشهر ده', 'المخزون', 'الأرباح'];

export default function Assistant(data) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState([{ bot: true, text: 'أهلاً 👋\n' + HELP }]);
  const end = useRef(null);

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs, open]);

  const ask = (q) => {
    if (!q.trim()) return;
    setMsgs((m) => [...m, { text: q }, { bot: true, text: answer(q, data, today()) }]);
    setText('');
  };

  if (!open) return <button className="chat-fab" onClick={() => setOpen(true)}>المساعد</button>;

  return (
    <div className="chat" role="dialog" aria-label="المساعد">
      <div className="chat-head">
        <b>مساعد AG</b>
        <button className="icon-btn" onClick={() => setOpen(false)} aria-label="إغلاق">✕</button>
      </div>
      <div className="chat-body" aria-live="polite">
        {msgs.map((m, i) => <div key={i} className={'msg' + (m.bot ? '' : ' me')}>{m.text}</div>)}
        <div ref={end} />
      </div>
      <div className="chat-quick">
        {QUICK.map((q) => <button key={q} onClick={() => ask(q)}>{q}</button>)}
      </div>
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب سؤالك" aria-label="سؤالك" />
        <button className="btn primary">إرسال</button>
      </form>
    </div>
  );
}
