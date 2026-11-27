// مساعد بسيط: بيفهم السؤال بالكلمات المفتاحية ويرد من بيانات الموقع (من غير أي خدمة خارجية)
import { allInstallments, monthKey, sum, isLate } from './installments.js';

const nf = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 });
const f = (n) => nf.format(n);
const day = (d) => new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

export const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c))
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[؟?!.,،]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const lines = (list, max = 10) =>
  list.slice(0, max).join('\n') + (list.length > max ? `\nو ${f(list.length - max)} كمان…` : '');
const mentions = (q, name) => norm(name) && (' ' + q + ' ').includes(' ' + norm(name) + ' ');

function describeSale(s, today) {
  const all = allInstallments([s]);
  const left = all.filter((x) => !x.paid);
  const late = left.filter((x) => isLate(x, today));
  return [
    `استمارة ${s.formNumber || '—'}: ${s.customerName} — ${s.productName} × ${f(s.qty)}`,
    `تاريخ البيع ${day(s.soldAt)}، القسط ${f(s.monthly)} لمدة ${f(s.months)} شهر`,
    `مدفوع ${f(all.length - left.length)} قسط، والباقي عليه ${f(sum(left))}`,
    late.length ? `متأخر ${f(late.length)} قسط بقيمة ${f(sum(late))}` : 'مفيش عليه متأخرات',
    left.length ? `أقدم قسط لسه ما اتدفعش: ${day(left[0].due)}` : 'خلّص كل الأقساط',
  ].join('\n');
}

export const HELP = `اسألني مثلاً:
• مين متأخر؟
• أقساط الشهر ده
• اسم العميل (أو: استمارة 5)
• اسم الصنف أو المورد
• المخزون / الأصناف اللي خلصت
• الأرباح / إجمالي المبيعات
• ازاي أضيف بيع؟`;

export function answer(question, { products, sales, suppliers }, today) {
  const q = norm(question);
  const has = (...words) => words.some((w) => q.includes(norm(w)));
  const all = allInstallments(sales);

  if (has('ازاي', 'اضيف', 'اسجل', 'امسح', 'احذف', 'اعدل')) {
    if (has('دفع', 'قسط')) return 'من الرئيسية ← المتابعة الشهرية، اختار الشهر واضغط "تم الدفع" جنب العميل.';
    if (has('مورد')) return 'من تبويب الموردين ← "+ إضافة مورد".';
    if (has('بيع', 'استماره', 'عميل')) return 'من تبويب المبيعات ← "+ بيع جديد"، اختار الصنف والعدد والمدة وسجّل.';
    if (has('صنف', 'بضاعه', 'مخزون')) return 'من تبويب المخزون ← "+ إضافة صنف". التعديل والحذف جنب كل صنف.';
    return HELP;
  }

  const num = q.match(/استماره(?: رقم)? (\d+)/);
  if (num) {
    const found = sales.filter((s) => norm(s.formNumber) === num[1]);
    return found.length ? found.map((s) => describeSale(s, today)).join('\n\n') : `مفيش استمارة برقم ${num[1]}.`;
  }

  const bySale = sales.filter((s) => mentions(q, s.customerName));
  if (bySale.length) return bySale.slice(0, 5).map((s) => describeSale(s, today)).join('\n\n');

  const sup = suppliers.find((s) => mentions(q, s.name));
  if (sup) {
    const items = products.filter((p) => p.supplier === sup._id);
    return `المورد ${sup.name}${sup.phone ? ` — ${sup.phone}` : ''}\n` +
      (items.length ? lines(items.map((p) => `• ${p.name}: ${f(p.quantity)} قطعة، استلام ${day(p.receivedAt)}`)) : 'مفيش أصناف مرتبطة بيه.');
  }

  const prods = products.filter((p) => mentions(q, p.name));
  if (prods.length) {
    return prods.map((p) => `${p.name}: المتاح ${f(p.quantity - p.sold)}، المباع ${f(p.sold)}، سعر القطعة ${f(p.unitPrice)}`).join('\n');
  }

  if (has('متاخر', 'مدفعش', 'ما دفعش')) {
    const late = all.filter((x) => isLate(x, today)).sort((a, b) => a.due - b.due);
    if (!late.length) return 'مفيش أقساط متأخرة 👌';
    return `المتأخرات ${f(sum(late))}:\n` + lines(late.map((x) => `• ${x.sale.customerName}: ${f(x.amount)} من ${day(x.due)}`));
  }

  if (has('شهر', 'اقساط', 'قسط', 'تحصيل', 'محصل')) {
    const [y, m] = today.split('-').map(Number);
    const offset = has('الجاي', 'القادم') ? 1 : has('اللي فات', 'السابق', 'الماضي') ? -1 : 0;
    const key = new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 7);
    const list = all.filter((x) => monthKey(x.due) === key);
    const left = list.filter((x) => !x.paid);
    return `شهر ${key}:\nالمطلوب ${f(sum(list))}\nالمحصّل ${f(sum(list.filter((x) => x.paid)))}\nالباقي ${f(sum(left))}` +
      (left.length ? '\n' + lines(left.map((x) => `• ${x.sale.customerName}: ${f(x.amount)} يوم ${day(x.due)}`)) : '');
  }

  if (has('خلص', 'نفد', 'ناقص')) {
    const out = products.filter((p) => p.quantity - p.sold <= 0);
    return out.length ? 'الأصناف اللي نفدت:\n' + lines(out.map((p) => '• ' + p.name)) : 'كل الأصناف متوفرة.';
  }

  if (has('مخزون', 'بضاعه', 'اصناف', 'متاح')) {
    if (!products.length) return 'لسه مفيش أصناف.';
    const value = products.reduce((a, p) => a + (p.quantity - p.sold) * p.unitPrice, 0);
    return `قيمة المخزون المتبقي ${f(value)}\n` + lines(products.map((p) => `• ${p.name}: ${f(p.quantity - p.sold)}`));
  }

  if (has('مورد')) {
    return suppliers.length ? `عندك ${f(suppliers.length)} مورد:\n` + lines(suppliers.map((s) => `• ${s.name}${s.phone ? ` — ${s.phone}` : ''}`)) : 'لسه مفيش موردين.';
  }

  if (has('ربح', 'ارباح', 'مكسب', 'مبيعات', 'اجمالي')) {
    const total = sales.reduce((a, s) => a + s.totalAfterInterest, 0);
    const cost = sales.reduce((a, s) => a + s.unitPrice * s.qty, 0);
    return `عدد الاستمارات ${f(sales.length)}\nإجمالي المبيعات ${f(total)}\nالربح المتوقع ${f(total - cost)}\nلسه ما اتحصلش ${f(sum(all.filter((x) => !x.paid)))}`;
  }

  return 'ما فهمتش السؤال.\n' + HELP;
}
