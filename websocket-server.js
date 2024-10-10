const WebSocket = require('ws');

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ port: 8089 });

// 存储客户端连接
const clients = new Map();

// 当有新的连接时
wss.on('connection', (ws, req) => {
  // 获取客户端的 ID 或其他唯一标识符
  const _list = req.url.split('/');
  let clientId = _list.pop();
  if (clientId === 'modbusStatus') {
    clientId = `/${_list.pop()}/${clientId}`;
  }

  console.log(`Client ${clientId} connected.`);

  // 保存客户端连接
  clients.set(clientId, ws);

  // 当从客户端接收到消息时
  ws.on('message', (message) => {
    console.log(`Received from ${clientId}: ${message}`);

    // 发送消息回客户端
    ws.send(`Echo: ${message}`);
  });

  // 当连接关闭时
  ws.on('close', () => {
    console.log(`Client ${clientId} disconnected.`);
    clients.delete(clientId);
  });
});

// 发送消息给特定客户端
function sendMessageToClient(clientId, message) {
  const ws = clients.get(clientId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  } else {
    console.error(`Client ${clientId} is not connected.`);
  }
}

// 示例：发送消息给特定客户端
// sendMessageToClient('123', 'Hello, client!');

console.log('WebSocket server is listening on port 8088.');

module.exports = {
  sendMessageToClient,
};
