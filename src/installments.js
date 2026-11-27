// حساب مواعيد الأقساط: أول قسط بعد شهر من تاريخ البيع
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function dueDate(soldAt, n) {
  const d = new Date(soldAt);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
}

// كل أقساط استمارة واحدة. آخر قسط بياخد فرق التقريب
export function schedule(sale) {
  const paid = new Set((sale.payments || []).map((p) => p.n));
  return Array.from({ length: sale.months }, (_, i) => {
    const n = i + 1;
    const amount = n === sale.months ? r2(sale.totalAfterInterest - sale.monthly * (sale.months - 1)) : sale.monthly;
    return { sale, n, amount, due: dueDate(sale.soldAt, n), paid: paid.has(n) };
  });
}

export const monthKey = (d) => new Date(d).toISOString().slice(0, 7);
export const allInstallments = (sales) => sales.flatMap(schedule);
export const sum = (list) => r2(list.reduce((a, x) => a + x.amount, 0));
export const isLate = (x, today) => !x.paid && x.due.toISOString().slice(0, 10) < today;
