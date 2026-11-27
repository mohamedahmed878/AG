import { useState } from 'react';
import { api } from './api.js';
import { fmt, fmtDate, today } from './ui.jsx';
import { allInstallments, monthKey, sum, isLate } from './installments.js';

const shift = (key, by) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
};
const title = (key) => new Date(key + '-01T00:00:00Z').toLocaleDateString('ar-EG', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function Monthly({ sales, reload, toast }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [busy, setBusy] = useState('');
  const all = allInstallments(sales);
  const list = all.filter((x) => monthKey(x.due) === month).sort((a, b) => a.paid - b.paid || a.due - b.due);
  const older = all.filter((x) => monthKey(x.due) < month && isLate(x, today())).sort((a, b) => a.due - b.due);

  const toggle = async (x) => {
    if (x.paid && !window.confirm(`إلغاء دفع القسط ${x.n} للعميل ${x.sale.customerName}؟`)) return;
    const id = x.sale._id + x.n;
    setBusy(id);
    try {
      await api(`/sales/${x.sale._id}/payments/${x.n}`, { method: 'PUT', body: { paid: !x.paid } });
      await reload();
      toast(x.paid ? 'تم إلغاء الدفع' : 'تم تسجيل الدفع');
    } catch (e) {
      toast(e.message, true);
    }
    setBusy('');
  };

  const row = (x) => {
    const id = x.sale._id + x.n;
    const late = isLate(x, today());
    return (
      <div className="row-line" key={id}>
        <div>
          <b>{x.sale.customerName}</b>
          <small>استمارة {x.sale.formNumber || '—'} — {x.sale.productName}</small>
          <small>قسط {fmt(x.n)} من {fmt(x.sale.months)} — {fmtDate(x.due)}</small>
        </div>
        <div className="pay">
          <b className="num">{fmt(x.amount)}</b>
          <span className={'badge ' + (x.paid ? 'ok' : late ? 'out' : 'low')}>{x.paid ? 'مدفوع' : late ? 'متأخر' : 'منتظر'}</span>
          <button className={'btn' + (x.paid ? '' : ' primary')} disabled={busy === id} onClick={() => toggle(x)}>{x.paid ? 'إلغاء' : 'تم الدفع'}</button>
        </div>
      </div>
    );
  };

  return (
    <section className="panel monthly">
      <div className="panel-head">
        <h3>المتابعة الشهرية</h3>
        <div className="month-nav">
          <button className="btn" onClick={() => setMonth(shift(month, -1))}>السابق</button>
          <b>{title(month)}</b>
          <button className="btn" onClick={() => setMonth(shift(month, 1))}>التالي</button>
        </div>
      </div>
      <div className="preview big">
        <div><span>المطلوب</span><b>{fmt(sum(list))}</b></div>
        <div><span>المحصّل</span><b>{fmt(sum(list.filter((x) => x.paid)))}</b></div>
        <div className="hl"><span>الباقي</span><b>{fmt(sum(list.filter((x) => !x.paid)))}</b></div>
      </div>
      {list.length === 0 && <p className="muted pad">لا توجد أقساط في هذا الشهر.</p>}
      {list.map(row)}
      {older.length > 0 && (
        <>
          <h3 className="late-head">متأخرات من شهور سابقة: {fmt(sum(older))}</h3>
          {older.map(row)}
        </>
      )}
    </section>
  );
}
