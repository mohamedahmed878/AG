import { useState } from 'react';
import { api } from './api.js';
import { Modal, Field, Empty, fmt, fmtDate } from './ui.jsx';

const blank = { name: '', phone: '', address: '', notes: '' };

export default function Suppliers({ suppliers, products, reload, toast }) {
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null); // null = النافذة مقفولة
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const show = (s) => {
    setForm(s ? { name: s.name, phone: s.phone || '', address: s.address || '', notes: s.notes || '' } : blank);
    setEdit(s ? s._id : 'new');
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const isNew = edit === 'new';
      await api(isNew ? '/suppliers' : `/suppliers/${edit}`, { method: isNew ? 'POST' : 'PUT', body: form });
      await reload();
      setEdit(null);
      toast(isNew ? 'تمت إضافة المورد' : 'تم حفظ التعديل');
    } catch (err) {
      toast(err.message, true);
    }
    setBusy(false);
  };

  const del = async (s) => {
    if (!window.confirm(`حذف المورد "${s.name}"؟`)) return;
    try {
      await api(`/suppliers/${s._id}`, { method: 'DELETE' });
      await reload();
      toast('تم حذف المورد');
    } catch (err) {
      toast(err.message, true);
    }
  };

  const list = suppliers.filter((s) => (s.name + ' ' + s.phone).includes(q.trim()));

  return (
    <section>
      <div className="bar">
        <h2>الموردين</h2>
        <input className="search" placeholder="ابحث بالاسم أو التليفون" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" onClick={() => show()}>+ إضافة مورد</button>
      </div>

      {suppliers.length === 0 ? (
        <Empty text="لم يُضف أي مورد بعد." action="إضافة أول مورد" onAction={() => show()} />
      ) : (
        <div className="cards">
          {list.map((s) => {
            const items = products.filter((p) => p.supplier === s._id);
            const value = items.reduce((a, p) => a + p.quantity * p.unitPrice, 0);
            return (
              <article className="panel" key={s._id}>
                <div className="panel-head">
                  <h3>{s.name}</h3>
                  <div>
                    <button className="link" onClick={() => show(s)}>تعديل</button>
                    <button className="link danger" onClick={() => del(s)}>حذف</button>
                  </div>
                </div>
                {s.phone && <p><a href={`tel:${s.phone}`} dir="ltr">{s.phone}</a></p>}
                {s.address && <p className="muted">{s.address}</p>}
                {s.notes && <p className="muted">{s.notes}</p>}
                <p><b>{fmt(items.length)}</b> صنف — إجمالي البضاعة <b>{fmt(value)}</b></p>
                {items.map((p) => (
                  <div className="row-line" key={p._id}>
                    <div><b>{p.name}</b><small>استلام: {fmtDate(p.receivedAt)}</small></div>
                    <small>{fmt(p.quantity)} × {fmt(p.unitPrice)}</small>
                  </div>
                ))}
              </article>
            );
          })}
        </div>
      )}

      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === 'new' ? 'إضافة مورد' : 'تعديل المورد'}>
        <form onSubmit={save} className="form">
          <Field label="اسم المورد"><input required value={form.name} onChange={set('name')} /></Field>
          <div className="grid2">
            <Field label="التليفون"><input type="tel" value={form.phone} onChange={set('phone')} /></Field>
            <Field label="العنوان"><input value={form.address} onChange={set('address')} /></Field>
          </div>
          <Field label="ملاحظات"><input value={form.notes} onChange={set('notes')} /></Field>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setEdit(null)}>إلغاء</button>
            <button className="btn primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
