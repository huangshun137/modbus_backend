// index.js
const express = require('express');
const app = express();
const port = 3000;
const modbusRouter = require('./modbus');

// 使用 express.urlencoded() 中间件来解析表单格式的请求体
app.use(express.urlencoded({ extended: true }));
// 使用 express.json() 中间件来解析 JSON 请求体
app.use(express.json());

// 使用路由模块
app.use('/modbus', modbusRouter);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});