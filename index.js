import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Health check для Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Корневой endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Anongram Server is running!',
    version: '1.0.0'
  });
});

// Простые тестовые данные в памяти
let users = [
  { id: 1, username: 'user1', email: 'user1@test.com' },
  { id: 2, username: 'user2', email: 'user2@test.com' },
  { id: 3, username: 'admin', email: 'admin@test.com', isAdmin: true }
];

let messages = [];

// API Routes
app.get('/api/users', (req, res) => {
  res.json(users);
});

app.post('/api/send-code', (req, res) => {
  const { email } = req.body;
  const code = '123456'; // Для теста фиксированный код
  res.json({ success: true, code });
});

app.post('/api/verify-code', (req, res) => {
  const { email, code } = req.body;
  
  // Простая проверка для теста
  if (code === '123456' || code === '654321') {
    const user = users.find(u => u.email === email) || {
      id: users.length + 1,
      username: email.split('@')[0],
      email,
      isAdmin: code === '654321'
    };
    
    res.json({ success: true, user });
  } else {
    res.status(400).json({ error: 'Неверный код' });
  }
});

// Запуск сервера
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`✅ Health check: http://0.0.0.0:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
