import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, getToken, setToken } from './api.js';
import { CountUp, Toast, fmt, fmtDate } from './ui.jsx';
import Products from './Products.jsx';
import Sales from './Sales.jsx';
import Suppliers from './Suppliers.jsx';
import Ledger from './Ledger.jsx';
import Monthly from './Monthly.jsx';
import Assistant from './Assistant.jsx';

const icon = (d) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

const TABS = [
  { id: 'home', label: 'الرئيسية', d: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6' },
  { id: 'products', label: 'المخزون', d: 'M12 3l9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8' },
  { id: 'suppliers', label: 'الموردين', d: 'M3 6h11v11H3zM14 10h4l3 3v4h-7M7 20a2 2 0 100-4 2 2 0 000 4zM17 20a2 2 0 100-4 2 2 0 000 4z' },
  { id: 'sales', label: 'المبيعات', d: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6' },
  { id: 'ledger', label: 'السجل', d: 'M5 4h14v16H5zM9 4v16M12 9h4M12 13h4' },
];

function Login({ onDone }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const { token } = await api('/login', { method: 'POST', body: { password: pw } });
      setToken(token);
      onDone();
    } catch (x) {
      setErr(x.message);
    }
    setBusy(false);
  };
  return (
    <div className="login-wrap">
      <motion.form className="login" onSubmit={submit} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <h1>AG Group</h1>
        <p>اكتب كلمة السر للدخول</p>
        <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="كلمة السر" />
        {err && <div className="form-err">{err}</div>}
        <button className="btn primary" disabled={busy || !pw}>{busy ? 'جارٍ الدخول…' : 'دخول'}</button>
      </motion.form>
    </div>
  );
}

function Home({ products, sales, go, reload, toast }) {
  const s = useMemo(() => {
    const stock = products.reduce((a, p) => a + (p.quantity - p.sold) * p.unitPrice, 0);
    const total = sales.reduce((a, x) => a + x.totalAfterInterest, 0);
    const cost = sales.reduce((a, x) => a + x.unitPrice * x.qty, 0);
    return { stock, total, profit: total - cost, forms: sales.length };
  }, [products, sales]);
  const out = products.filter((p) => p.quantity - p.sold <= 0);
  const recent = sales.slice(0, 5);
  return (
    <div>
      <Monthly sales={sales} reload={reload} toast={toast} />
      <div className="stats">
        <div className="stat"><span>قيمة المخزون المتبقي</span><b><CountUp value={s.stock} /></b></div>
        <div className="stat"><span>إجمالي المبيعات بعد الفائدة</span><b><CountUp value={s.total} /></b></div>
        <div className="stat gold"><span>الربح المتوقع</span><b><CountUp value={s.profit} /></b></div>
        <div className="stat"><span>عدد الاستمارات</span><b><CountUp value={s.forms} /></b></div>
      </div>
      <div className="two">
        <section className="panel">
          <div className="panel-head"><h3>آخر البيعات</h3><button className="link" onClick={() => go('sales')}>عرض الكل</button></div>
          {recent.length === 0 && <p className="muted">لا توجد مبيعات بعد. سجّل أول بيع من تبويب المبيعات.</p>}
          {recent.map((x) => (
            <div className="row-line" key={x._id}>
              <div><b>{x.customerName}</b><small>{x.productName} × {fmt(x.qty)} — {fmtDate(x.soldAt)}</small></div>
              <div className="num gold-t">{fmt(x.monthly)} <small>/ شهر</small></div>
            </div>
          ))}
        </section>
        <section className="panel">
          <div className="panel-head"><h3>أصناف نفدت</h3><button className="link" onClick={() => go('products')}>المخزون</button></div>
          {out.length === 0 && <p className="muted">كل الأصناف متوفرة.</p>}
          {out.map((p) => (
            <div className="row-line" key={p._id}><b>{p.name}</b><small>المباع {fmt(p.sold)}</small></div>
          ))}
        </section>
      </div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState('checking'); // checking | login | ok
  const [tab, setTab] = useState('home');
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [toast, setToastState] = useState(null);
  const [protectedApp, setProtected] = useState(false);

  const toast$ = useCallback((msg, error = false) => {
    const id = Date.now();
    setToastState({ id, msg, error });
    setTimeout(() => setToastState((t) => (t && t.id === id ? null : t)), 3200);
  }, []);

  const reload = useCallback(async () => {
    const [p, s, v] = await Promise.all([api('/products'), api('/sales'), api('/suppliers')]);
    setProducts(p);
    setSales(s);
    setSuppliers(v);
  }, []);

  const boot = useCallback(async () => {
    try {
      const cfg = await api('/config');
      setProtected(cfg.protected);
      if (cfg.protected && !getToken()) return setAuth('login');
      await reload();
      setAuth('ok');
    } catch (e) {
      if (getToken() === '' && protectedApp) return setAuth('login');
      toast$(e.message, true);
      setAuth('ok');
    }
  }, [reload, toast$, protectedApp]);

  useEffect(() => { boot(); }, []); // eslint-disable-line
  useEffect(() => {
    const f = () => setAuth('login');
    window.addEventListener('unauth', f);
    return () => window.removeEventListener('unauth', f);
  }, []);

  if (auth === 'checking') return <div className="splash">جارٍ التحميل…</div>;
  if (auth === 'login') return <Login onDone={boot} />;

  return (
    <div className="shell">
      <header className="top">
        <motion.div className="brand" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
          <span className="logo">AG</span>
          <div><h1>AG Group</h1><small>المخزون والبيع بالتقسيط</small></div>
        </motion.div>
        {protectedApp && (
          <button className="link" onClick={() => { setToken(''); setAuth('login'); }}>خروج</button>
        )}
      </header>

      <main>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {tab === 'home' && <Home products={products} sales={sales} go={setTab} reload={reload} toast={toast$} />}
            {tab === 'products' && <Products products={products} suppliers={suppliers} reload={reload} toast={toast$} />}
            {tab === 'suppliers' && <Suppliers suppliers={suppliers} products={products} reload={reload} toast={toast$} />}
            {tab === 'ledger' && <Ledger products={products} sales={sales} suppliers={suppliers} />}
            {tab === 'sales' && <Sales products={products} sales={sales} reload={reload} toast={toast$} />}
          </motion.div>
        </AnimatePresence>
      </main>
      <nav className="tabs" aria-label="التنقل">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {tab === t.id && <motion.span layoutId="pill" className="pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="lbl">{icon(t.d)}{t.label}</span>
          </button>
        ))}
      </nav>
      <Assistant products={products} sales={sales} suppliers={suppliers} />
      <Toast toast={toast} />
    </div>
  );
}
