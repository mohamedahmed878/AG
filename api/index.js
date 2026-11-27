import express from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';

const app = express();
app.use(express.json());

/* ---------- الاتصال بقاعدة البيانات (مخزّن لإعادة الاستخدام على Vercel) ---------- */
const g = globalThis;
g._mongo ||= { conn: null, promise: null };
async function connect() {
  if (g._mongo.conn) return g._mongo.conn;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI غير مضبوط');
  g._mongo.promise ||= mongoose.connect(process.env.MONGODB_URI, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 8000,
  });
  try {
    g._mongo.conn = await g._mongo.promise;
  } catch (e) {
    g._mongo.promise = null;
    throw e;
  }
  return g._mongo.conn;
}

/* ---------- النماذج ---------- */
const Product = mongoose.models.Product || mongoose.model('Product', new mongoose.Schema({
  name: { type: String, required: true, trim: true },       // صنف البضاعة
  quantity: { type: Number, required: true, min: 0 },       // العدد
  receiver: { type: String, default: '', trim: true },      // المستلم
  unitPrice: { type: Number, required: true, min: 0 },     // سعر القطعة
  receivedAt: { type: Date, default: Date.now },            // تاريخ استلام البضاعة
  sold: { type: Number, default: 0, min: 0 },               // المباع
}, { timestamps: true }));

const Sale = mongoose.models.Sale || mongoose.model('Sale', new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: String,          // صنف البضاعة
  qty: Number,                  // العدد
  unitPrice: Number,            // سعر القطعة
  priceDiff: Number,            // فرق سعر البيع (للقطعة)
  totalAfterDiff: Number,       // اجمالي السعر بعد زيادة الفرق
  months: Number,               // مدة التقسيط
  ratePct: Number,              // نسبة الفائدة
  totalAfterInterest: Number,   // اجمالي السعر بعد اضافة الفائدة
  monthly: Number,              // قيمة القسط الشهري
  soldAt: { type: Date, default: Date.now }, // تاريخ بيع الصنف
  formNumber: String,           // رقم الاستمارة
  customerName: String,         // اسم العميل
}, { timestamps: true }));

/* ---------- أدوات ---------- */
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const httpErr = (status, message) => Object.assign(new Error(message), { status });
const h = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => res.status(e.status || 500).json({ error: e.message || 'حدث خطأ' }));

function calc(unit, qty, diff, rate, months) {
  const totalAfterDiff = r2((unit + diff) * qty);
  const totalAfterInterest = r2(totalAfterDiff * (1 + rate / 100));
  return { totalAfterDiff, totalAfterInterest, monthly: r2(totalAfterInterest / months) };
}

const secret = () => process.env.JWT_SECRET || process.env.APP_PASSWORD || '';
const makeToken = () => crypto.createHmac('sha256', secret()).update('installments-ok').digest('hex');

const r = express.Router();

r.get('/config', (req, res) => res.json({ protected: !!process.env.APP_PASSWORD }));

r.post('/login', h(async (req, res) => {
  if (!process.env.APP_PASSWORD) return res.json({ token: 'open' });
  if (req.body?.password !== process.env.APP_PASSWORD) throw httpErr(401, 'كلمة السر غير صحيحة');
  res.json({ token: makeToken() });
}));

// حماية باقي المسارات
r.use((req, res, next) => {
  if (!process.env.APP_PASSWORD) return next();
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (t && t === makeToken()) return next();
  res.status(401).json({ error: 'سجّل الدخول أولاً' });
});

r.use(async (req, res, next) => {
  try { await connect(); next(); }
  catch (e) { res.status(500).json({ error: 'تعذر الاتصال بقاعدة البيانات: ' + e.message }); }
});

/* ---------- الأصناف ---------- */
r.get('/products', h(async (req, res) => {
  res.json(await Product.find().sort({ createdAt: -1 }).lean());
}));

function readProduct(b) {
  const quantity = Number(b.quantity), unitPrice = Number(b.unitPrice);
  if (!String(b.name || '').trim()) throw httpErr(400, 'اسم الصنف مطلوب');
  if (!Number.isInteger(quantity) || quantity < 0) throw httpErr(400, 'العدد غير صحيح');
  if (!(unitPrice >= 0)) throw httpErr(400, 'سعر القطعة غير صحيح');
  return {
    name: String(b.name).trim(), quantity, unitPrice,
    receiver: String(b.receiver || '').trim(),
    receivedAt: b.receivedAt ? new Date(b.receivedAt) : new Date(),
  };
}

r.post('/products', h(async (req, res) => {
  res.status(201).json(await Product.create(readProduct(req.body)));
}));

r.put('/products/:id', h(async (req, res) => {
  const data = readProduct(req.body);
  const p = await Product.findById(req.params.id);
  if (!p) throw httpErr(404, 'الصنف غير موجود');
  if (data.quantity < p.sold) throw httpErr(400, `العدد لا يمكن أن يقل عن المباع (${p.sold})`);
  Object.assign(p, data);
  res.json(await p.save());
}));

r.delete('/products/:id', h(async (req, res) => {
  if (await Sale.exists({ product: req.params.id })) throw httpErr(400, 'لا يمكن حذف صنف عليه مبيعات. احذف المبيعات أولاً');
  await Product.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
}));

/* ---------- المبيعات / الأقساط ---------- */
r.get('/sales', h(async (req, res) => {
  res.json(await Sale.find().sort({ soldAt: -1, createdAt: -1 }).lean());
}));

r.post('/sales', h(async (req, res) => {
  const b = req.body || {};
  const q = Number(b.qty), diff = Number(b.priceDiff) || 0, rate = Number(b.ratePct) || 0, months = Number(b.months);
  if (!mongoose.isValidObjectId(b.productId)) throw httpErr(400, 'اختر الصنف');
  if (!Number.isInteger(q) || q < 1) throw httpErr(400, 'العدد غير صحيح');
  if (!(months >= 1)) throw httpErr(400, 'مدة التقسيط غير صحيحة');
  if (!String(b.customerName || '').trim()) throw httpErr(400, 'اسم العميل مطلوب');

  // خصم الكمية من المخزون بشكل آمن (لو لاب توبين باعوا في نفس اللحظة)
  const prod = await Product.findOneAndUpdate(
    { _id: b.productId, $expr: { $gte: [{ $subtract: ['$quantity', '$sold'] }, q] } },
    { $inc: { sold: q } },
    { new: true },
  );
  if (!prod) throw httpErr(400, 'الكمية المتاحة من الصنف أقل من المطلوب');

  try {
    const c = calc(prod.unitPrice, q, diff, rate, months);
    const sale = await Sale.create({
      product: prod._id, productName: prod.name, qty: q, unitPrice: prod.unitPrice,
      priceDiff: diff, ...c, months, ratePct: rate,
      soldAt: b.soldAt ? new Date(b.soldAt) : new Date(),
      formNumber: String(b.formNumber || '').trim(),
      customerName: String(b.customerName).trim(),
    });
    res.status(201).json(sale);
  } catch (e) {
    await Product.updateOne({ _id: prod._id }, { $inc: { sold: -q } });
    throw e;
  }
}));

r.delete('/sales/:id', h(async (req, res) => {
  const sale = await Sale.findByIdAndDelete(req.params.id);
  if (sale?.product) await Product.updateOne({ _id: sale.product }, { $inc: { sold: -sale.qty } });
  res.json({ ok: true });
}));

app.use('/api', r);

export default app;
