import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from './api.js';
import { Modal, Field, Empty, fmt, fmtDate, today } from './ui.jsx';

const MONTHS = [12, 15, 18, 24];
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const blank = (sales) => {
  const last = sales.map((s) => parseInt(s.formNumber, 10)).filter(Number.isFinite);
  return {
    productId: '', qty: 1, priceDiff: 0, months: 12, ratePct: 0,
    soldAt: today(), formNumber: last.length ? String(Math.max(...last) + 1) : '1', customerName: '',
  };
};

export default function Sales({ products, sales, reload, toast }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank(sales));
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const prod = products.find((p) => p._id === form.productId);
  const left = prod ? prod.quantity - prod.sold : 0;

  const c = useMemo(() => {
    if (!prod) return null;
    const qty = Number(form.qty) || 0, diff = Number(form.priceDiff) || 0, rate = Number(form.ratePct) || 0;
    const afterDiff = r2((prod.unitPrice + diff) * qty);
    const afterInt = r2(afterDiff * (1 + rate / 100));
    return { sellUnit: prod.unitPrice + diff, afterDiff, afterInt, monthly: r2(afterInt / form.months) };
  }, [prod, form.qty, form.priceDiff, form.ratePct, form.months]);

  const list = useMemo(
    () => sales.filter((s) => (s.customerName + ' ' + s.productName + ' ' + (s.formNumber || '')).includes(q.trim())),
    [sales, q],
  );

  const save = async (e) => {
    e.preventDefault();
    if (!prod) return toast('اختر الصنف أولاً', true);
    if (Number(form.qty) > left) return toast(`المتاح من الصنف ${fmt(left)} فقط`, true);
    setBusy(true);
    try {
      await api('/sales', { method: 'POST', body: form });
      await reload();
      setOpen(false);
      toast('تم تسجيل البيع');
    } catch (err) {
      toast(err.message, true);
    }
    setBusy(false);
  };

  const del = async (s) => {
    if (!window.confirm(`حذف استمارة ${s.customerName}؟ سيرجع العدد للمخزون.`)) return;
    try {
      await api(`/sales/${s._id}`, { method: 'DELETE' });
      await reload();
      toast('تم حذف البيع');
    } catch (err) {
      toast(err.message, true);
    }
  };

  const available = products.filter((p) => p.quantity - p.sold > 0);

  return (
    <section>
      <div className="bar">
        <h2>المبيعات والأقساط</h2>
        <input className="search" placeholder="ابحث بالعميل أو الصنف أو رقم الاستمارة" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" onClick={() => { setForm(blank(sales)); setOpen(true); }} disabled={products.length === 0}>+ بيع جديد</button>
      </div>

      {sales.length === 0 ? (
        <Empty text={products.length === 0 ? 'أضف أصنافاً في المخزون أولاً ثم سجّل البيع.' : 'لا توجد مبيعات بعد.'} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>رقم الاستمارة</th><th>العميل</th><th>الصنف</th><th>العدد</th><th>سعر القطعة</th>
                <th>فرق السعر</th><th>بعد الفرق</th><th>المدة</th><th>الفائدة</th>
                <th>بعد الفائدة</th><th>القسط الشهري</th><th>تاريخ البيع</th><th></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {list.map((s) => (
                  <motion.tr key={s._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <td className="num">{s.formNumber || '—'}</td>
                    <td><b>{s.customerName}</b></td>
                    <td>{s.productName}</td>
                    <td className="num">{fmt(s.qty)}</td>
                    <td className="num">{fmt(s.unitPrice)}</td>
                    <td className="num">{fmt(s.priceDiff)}</td>
                    <td className="num">{fmt(s.totalAfterDiff)}</td>
                    <td className="num">{fmt(s.months)} شهر</td>
                    <td className="num">{fmt(s.ratePct)}٪</td>
                    <td className="num">{fmt(s.totalAfterInterest)}</td>
                    <td className="num gold-t"><b>{fmt(s.monthly)}</b></td>
                    <td>{fmtDate(s.soldAt)}</td>
                    <td className="actions"><button className="link danger" onClick={() => del(s)}>حذف</button></td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {list.length === 0 && <p className="muted pad">لا نتائج مطابقة للبحث.</p>}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="بيع جديد بالتقسيط">
        <form onSubmit={save} className="form">
          <div className="grid2">
            <Field label="رقم الاستمارة"><input value={form.formNumber} onChange={set('formNumber')} /></Field>
            <Field label="اسم العميل"><input required value={form.customerName} onChange={set('customerName')} /></Field>
          </div>
          <Field label="صنف البضاعة" hint={prod ? `المتاح: ${fmt(left)} — سعر القطعة: ${fmt(prod.unitPrice)}` : undefined}>
            <select required value={form.productId} onChange={set('productId')}>
              <option value="">اختر الصنف</option>
              {available.map((p) => <option key={p._id} value={p._id}>{p.name} (متاح {fmt(p.quantity - p.sold)})</option>)}
            </select>
          </Field>
          <div className="grid3">
            <Field label="العدد"><input required type="number" min="1" max={left || undefined} step="1" inputMode="numeric" value={form.qty} onChange={set('qty')} /></Field>
            <Field label="فرق سعر البيع (للقطعة)"><input type="number" step="any" inputMode="decimal" value={form.priceDiff} onChange={set('priceDiff')} /></Field>
            <Field label="نسبة الفائدة ٪"><input type="number" min="0" step="any" inputMode="decimal" value={form.ratePct} onChange={set('ratePct')} /></Field>
          </div>
          <div className="field">
            <span>مدة التقسيط</span>
            <div className="chips" role="radiogroup">
              {MONTHS.map((m) => (
                <button type="button" key={m} role="radio" aria-checked={form.months === m} className={form.months === m ? 'on' : ''} onClick={() => setForm((f) => ({ ...f, months: m }))}>
                  {fmt(m)} شهر
                </button>
              ))}
            </div>
          </div>
          <Field label="تاريخ بيع الصنف"><input type="date" value={form.soldAt} onChange={set('soldAt')} /></Field>

          <div className="preview big">
            <div><span>بعد زيادة الفرق</span><b>{c ? fmt(c.afterDiff) : '—'}</b></div>
            <div><span>بعد إضافة الفائدة</span><b>{c ? fmt(c.afterInt) : '—'}</b></div>
            <div className="hl"><span>القسط الشهري</span><b>{c ? fmt(c.monthly) : '—'}</b></div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setOpen(false)}>إلغاء</button>
            <button className="btn primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'تسجيل البيع'}</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
