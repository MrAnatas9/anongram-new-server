import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;

// Храним данные в памяти (для демо)
let users = [
  { 
    id: 1, 
    email: 'user1@test.com', 
    username: 'user1', 
    code: '111222', 
    isAdmin: false,
    balance: 100,
    level: 1,
    experience: 0,
    profession: null,
    avatar: null,
    status: 'В сети',
    about: '',
    createdAt: new Date().toISOString()
  },
  { 
    id: 2, 
    email: 'user2@test.com', 
    username: 'user2', 
    code: '333444', 
    isAdmin: false,
    balance: 100,
    level: 1,
    experience: 0,
    profession: null,
    avatar: null,
    status: 'В сети',
    about: '',
    createdAt: new Date().toISOString()
  },
  { 
    id: 3, 
    email: 'user3@test.com', 
    username: 'user3', 
    code: '555666', 
    isAdmin: false,
    balance: 100,
    level: 1,
    experience: 0,
    profession: null,
    avatar: null,
    status: 'В сети',
    about: '',
    createdAt: new Date().toISOString()
  },
  { 
    id: 4, 
    email: 'admin@test.com', 
    username: 'Системный Админ', 
    code: '654321', 
    isAdmin: true,
    balance: 1000,
    level: 10,
    experience: 5000,
    profession: 'Системный администратор',
    avatar: null,
    status: 'В сети',
    about: 'Главный администратор Anongram',
    createdAt: new Date().toISOString()
  }
];

let verificationCodes = [];
let messages = [];

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.post('/api/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email обязателен' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Удаляем старые коды
  verificationCodes = verificationCodes.filter(c => c.email !== email);
  verificationCodes.push({ email, code, createdAt: new Date().toISOString() });

  console.log(`Код для ${email}: ${code}`);
  res.json({ success: true, message: 'Код отправлен', code: code });
});

app.post('/api/verify-code', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email и код обязательны' });

  const validCode = verificationCodes.find(c => c.email === email && c.code === code);
  if (!validCode) return res.status(400).json({ error: 'Неверный код' });

  let user = users.find(u => u.email === email);
  
  if (!user) {
    user = {
      id: users.length + 1,
      email,
      username: email.split('@')[0],
      code,
      isAdmin: code === '654321',
      balance: 100,
      level: 1,
      experience: 0,
      profession: null,
      avatar: null,
      status: 'В сети',
      about: '',
      createdAt: new Date().toISOString()
    };
    users.push(user);
  }

  // Удаляем использованный код
  verificationCodes = verificationCodes.filter(c => c !== validCode);

  res.json({ 
    success: true, 
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      isAdmin: user.isAdmin,
      balance: user.balance,
      level: user.level
    }
  });
});

app.get('/api/users', async (req, res) => {
  const safeUsers = users.map(user => ({
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    status: user.status,
    level: user.level,
    profession: user.profession
  }));
  res.json(safeUsers);
});

app.get('/api/messages/:userId1/:userId2', async (req, res) => {
  const { userId1, userId2 } = req.params;
  
  const chatMessages = messages.filter(msg => 
    (msg.senderId == userId1 && msg.receiverId == userId2) ||
    (msg.senderId == userId2 && msg.receiverId == userId1)
  ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  res.json(chatMessages);
});

// WebSocket
const clients = new Map();

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  console.log(`Новое соединение: ${clientId}`);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === 'chat_message') {
        const newMessage = {
          id: uuidv4(),
          text: message.text,
          senderId: message.senderId,
          receiverId: message.receiverId,
          timestamp: new Date().toISOString(),
          type: 'text'
        };
        
        messages.push(newMessage);

        clients.forEach((client, id) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'new_message', message: newMessage }));
          }
        });
      }
    } catch (error) {
      console.error('Ошибка:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Соединение закрыто: ${clientId}`);
  });
});

// Запуск сервера
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`👑 Админ: admin@test.com / 654321`);
  console.log(`👤 User1: user1@test.com / 111222`);
  console.log(`👤 User2: user2@test.com / 333444`);
  console.log(`👤 User3: user3@test.com / 555666`);
});
