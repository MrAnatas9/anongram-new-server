import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Middleware
app.use(cors());
app.use(express.json());

// Вспомогательные функции
const readData = async (file) => {
  try {
    const data = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
};

const writeData = async (file, data) => {
  await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
};

// Инициализация данных
const initializeData = async () => {
  const files = ['users.json', 'verification_codes.json', 'messages.json', 'professions.json'];
  
  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    try {
      await fs.access(filePath);
    } catch {
      await writeData(file, []);
    }
  }

  const users = await readData('users.json');
  const testUsers = [
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

  let hasChanges = false;
  for (const testUser of testUsers) {
    if (!users.find(u => u.email === testUser.email)) {
      users.push(testUser);
      hasChanges = true;
    }
  }

  if (hasChanges) await writeData('users.json', users);
};

// API Routes
app.post('/api/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email обязателен' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codes = await readData('verification_codes.json');
  
  const filteredCodes = codes.filter(c => c.email !== email);
  filteredCodes.push({ email, code, createdAt: new Date().toISOString() });
  
  await writeData('verification_codes.json', filteredCodes);

  console.log(`Код для ${email}: ${code}`);
  res.json({ success: true, message: 'Код отправлен', code: code });
});

app.post('/api/verify-code', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email и код обязательны' });

  const codes = await readData('verification_codes.json');
  const users = await readData('users.json');
  
  const validCode = codes.find(c => c.email === email && c.code === code);
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
    await writeData('users.json', users);
  }

  const updatedCodes = codes.filter(c => c !== validCode);
  await writeData('verification_codes.json', updatedCodes);

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
  const users = await readData('users.json');
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
  const messages = await readData('messages.json');
  
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
        const messages = await readData('messages.json');
        const newMessage = {
          id: uuidv4(),
          text: message.text,
          senderId: message.senderId,
          receiverId: message.receiverId,
          timestamp: new Date().toISOString(),
          type: 'text'
        };
        
        messages.push(newMessage);
        await writeData('messages.json', messages);

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
initializeData().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`👑 Админ: admin@test.com / 654321`);
    console.log(`👤 User1: user1@test.com / 111222`);
    console.log(`👤 User2: user2@test.com / 333444`);
    console.log(`👤 User3: user3@test.com / 555666`);
  });
});
