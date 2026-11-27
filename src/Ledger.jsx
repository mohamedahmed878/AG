import { useState } from 'react';
import { Empty, fmt, fmtDate } from './ui.jsx';

// سجل الحركة: كل استلام وكل بيع مرتبين بالتاريخ
export default function Ledger({ products, sales, suppliers }) {
  const [q, setQ] = useState('');
  const rows = [
    ...products.map((p) => ({
      id: 'in' + p._id, type: 'استلام', date: p.receivedAt, item: p.name, qty: p.quantity,
      amount: p.quantity * p.unitPrice, party: suppliers.find((s) => s._id === p.supplier)?.name || '',
      receiver: p.receiver, form: '',
    })),
    ...sales.map((s) => ({
      id: 'out' + s._id, type: 'بيع', date: s.soldAt, item: s.productName, qty: s.qty,
      amount: s.totalAfterInterest, party: s.customerName, receiver: '', form: s.formNumber,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
  const list = rows.filter((x) => [x.type, x.item, x.party, x.receiver, x.form].join(' ').includes(q.trim()));

  return (
    <section>
      <div className="bar">
        <h2>سجل الحركة</h2>
        <input className="search" placeholder="ابحث بالصنف أو الاسم أو رقم الاستمارة" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {rows.length === 0 ? (
        <Empty text="لا توجد حركة بعد." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th><th>الحركة</th><th>رقم الاستمارة</th><th>الصنف</th>
                <th>العدد</th><th>المورد / العميل</th><th>المستلم</th><th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td>{fmtDate(x.date)}</td>
                  <td><span className={'badge ' + (x.type === 'بيع' ? 'ok' : 'low')}>{x.type}</span></td>
                  <td className="num">{x.form || '—'}</td>
                  <td><b>{x.item}</b></td>
                  <td className="num">{fmt(x.qty)}</td>
                  <td>{x.party || '—'}</td>
                  <td>{x.receiver || '—'}</td>
                  <td className="num">{fmt(x.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="muted pad">لا نتائج مطابقة للبحث.</p>}
        </div>
      )}
    </section>
  );
}
