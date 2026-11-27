import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from './api.js';
import { Modal, Field, Empty, fmt, fmtDate, today } from './ui.jsx';

const blank = () => ({ name: '', quantity: '', receiver: '', unitPrice: '', receivedAt: today() });

export default function Products({ products, reload, toast }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(blank());
  const [busy, setBusy] = useState(false);

  const list = useMemo(
    () => products.filter((p) => (p.name + ' ' + (p.receiver || '')).includes(q.trim())),
    [products, q],
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const show = (p) => {
    setEditId(p ? p._id : null);
    setForm(p ? { name: p.name, quantity: p.quantity, receiver: p.receiver || '', unitPrice: p.unitPrice, receivedAt: (p.receivedAt || '').slice(0, 10) } : blank());
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(editId ? `/products/${editId}` : '/products', { method: editId ? 'PUT' : 'POST', body: form });
      await reload();
      setOpen(false);
      toast(editId ? 'تم حفظ التعديل' : 'تمت إضافة الصنف');
    } catch (err) {
      toast(err.message, true);
    }
    setBusy(false);
  };

  const del = async (p) => {
    if (!window.confirm(`حذف الصنف "${p.name}"؟`)) return;
    try {
      await api(`/products/${p._id}`, { method: 'DELETE' });
      await reload();
      toast('تم حذف الصنف');
    } catch (err) {
      toast(err.message, true);
    }
  };

  const total = (Number(form.quantity) || 0) * (Number(form.unitPrice) || 0);

  return (
    <section>
      <div className="bar">
        <h2>المخزون</h2>
        <input className="search" placeholder="ابحث باسم الصنف أو المستلم" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" onClick={() => show()}>+ إضافة صنف</button>
      </div>

      {products.length === 0 ? (
        <Empty text="لم تُضف أي أصناف بعد." action="إضافة أول صنف" onAction={() => show()} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الصنف</th><th>العدد</th><th>المستلم</th><th>سعر القطعة</th><th>الإجمالي</th>
                <th>المباع</th><th>الباقي</th><th>تاريخ الاستلام</th><th></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {list.map((p) => {
                  const left = p.quantity - p.sold;
                  return (
                    <motion.tr key={p._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <td><b>{p.name}</b></td>
                      <td className="num">{fmt(p.quantity)}</td>
                      <td>{p.receiver || '—'}</td>
                      <td className="num">{fmt(p.unitPrice)}</td>
                      <td className="num">{fmt(p.quantity * p.unitPrice)}</td>
                      <td className="num">{fmt(p.sold)}</td>
                      <td><span className={'badge ' + (left <= 0 ? 'out' : left <= p.quantity * 0.2 ? 'low' : 'ok')}>{left <= 0 ? 'نفد' : fmt(left)}</span></td>
                      <td>{fmtDate(p.receivedAt)}</td>
                      <td className="actions">
                        <button className="link" onClick={() => show(p)}>تعديل</button>
                        <button className="link danger" onClick={() => del(p)}>حذف</button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
          {list.length === 0 && <p className="muted pad">لا نتائج مطابقة للبحث.</p>}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'تعديل الصنف' : 'إضافة صنف'}>
        <form onSubmit={save} className="form">
          <Field label="صنف البضاعة"><input required value={form.name} onChange={set('name')} placeholder="مثال: ثلاجة 16 قدم" /></Field>
          <div className="grid2">
            <Field label="العدد"><input required type="number" min="0" step="1" inputMode="numeric" value={form.quantity} onChange={set('quantity')} /></Field>
            <Field label="سعر القطعة"><input required type="number" min="0" step="any" inputMode="decimal" value={form.unitPrice} onChange={set('unitPrice')} /></Field>
          </div>
          <div className="grid2">
            <Field label="المستلم"><input value={form.receiver} onChange={set('receiver')} placeholder="اسم من استلم البضاعة" /></Field>
            <Field label="تاريخ استلام البضاعة"><input type="date" value={form.receivedAt} onChange={set('receivedAt')} /></Field>
          </div>
          <div className="preview"><span>إجمالي سعر الصنف</span><b>{fmt(total)}</b></div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setOpen(false)}>إلغاء</button>
            <button className="btn primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
