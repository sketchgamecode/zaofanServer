import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import saveRouter from './routes/save.js';
import adminRouter from './routes/admin.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// ── 安全中间件 ──────────────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // 允许无 origin（如 curl 测试、Railway healthcheck）
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS 拦截：来源 ${origin} 未在白名单中`));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' })); // GameState JSON 可能略大

// ── 健康检查（Railway 需要这个确认服务存活） ────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'zaofan-server' });
});

// ── 路由挂载 ────────────────────────────────────────────────────────────────
app.use('/api/save', saveRouter);
app.use('/api/admin', adminRouter);

// ── 404 处理 ────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// ── 启动 ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ 大宋造反模拟器服务端启动成功`);
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`🌍 允许来源: ${allowedOrigins.join(', ')}`);
});
