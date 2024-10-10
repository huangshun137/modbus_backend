// index.js
const express = require('express');
const mysql = require("mysql"); //引入mysql
const app = express();
const port = 3000;
const modbusListRouter = require('./modbusList');
const modbusRouter = require('./modbus');

// 设置MySQL连接配置
const connection = mysql.createConnection({
  host: "192.168.1.88",
  port: "3307",
  user: "root",  //数据库账号
  password: "root", //数据库密码
  database: "modbus_sys", //数据库名称
});
// 连接到MySQL数据库
connection.connect((error) => {
  if (error) throw error;
  //连接成功打印结果`如果连接失败，记得查看数据库是否开启`
  console.log("Successfully connected to the database.");
});

// 使用 express.urlencoded() 中间件来解析表单格式的请求体
app.use(express.urlencoded({ extended: true }));
// 使用 express.json() 中间件来解析 JSON 请求体
app.use(express.json());

// 使用路由模块
app.use('/modbus', modbusListRouter(connection));
app.use('/modbus', modbusRouter);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});