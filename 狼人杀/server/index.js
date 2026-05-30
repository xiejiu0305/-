const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const config = require('./config');
const MessageRouter = require('./MessageRouter');

// MIME 类型映射
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// 静态文件服务
const CLIENT_DIR = path.join(__dirname, '..', 'client');

function serveStatic(req, res) {
  let filePath = path.join(CLIENT_DIR, req.url === '/' ? 'index.html' : req.url);
  // 安全：防止目录遍历
  if (!filePath.startsWith(CLIENT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  serveStatic(req, res);
});

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ noServer: true });
const router = new MessageRouter();

// HTTP Upgrade 处理
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

// WS 连接处理
wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      router.handle(ws, msg);
    } catch (e) {
      // 忽略无效 JSON
    }
  });

  ws.on('close', () => {
    router.handleDisconnect(ws);
  });

  ws.on('error', () => {
    // 静默处理
  });
});

server.listen(config.PORT, () => {
  console.log(`🐺 狼人杀服务器已启动: http://localhost:${config.PORT}`);
});
