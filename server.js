// تشغيل الـ API محلياً فقط (على Vercel بيشتغل api/index.js تلقائياً)
import app from './api/index.js';
app.listen(3001, () => console.log('API running on http://localhost:3001'));
