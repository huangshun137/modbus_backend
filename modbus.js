// modbus.js
const express = require('express');
const router = express.Router();
const ModbusRTU = require("modbus-serial");
// const client = new ModbusRTU();
const wsServer = require('./websocket-server');

let clientMap = new Map();
// 连接到 Modbus TCP 设备
function connectToModbusDevice(id) {
  const clientInfo = clientMap.get(id);
  if (!clientInfo) return;
  const { client, ip, port } = clientInfo;
  client.connectTCP(ip, { port }, function(err) {
    if (err) {
      console.error("Connection failed:", err);
      return err;
    }
    clientInfo.modbusStatus = 'connected';
    wsServer.sendMessageToClient(`/${id}/modbusStatus`, 'connected');
    console.log("Connected to Modbus TCP device.");
  });
}

function handleListenningClient(id) {
  const clientInfo = clientMap.get(id);
  if (!clientInfo) return;
  const { client } = clientInfo;
  // 监听连接成功事件(好像插件里没有这个connected监听事件)
  client.on("connected", () => {
    console.log("123");
    clientInfo.modbusStatus = 'connected';
    wsServer.sendMessageToClient(`/${id}/modbusStatus`, 'connected');
  });
  // 监听错误事件
  client.on('error', function(err) {
    clientInfo.modbusStatus = 'error';
    wsServer.sendMessageToClient(`/${id}/modbusStatus`, 'error');
    console.error('Modbus connection error:', err);
    client.close(); // 关闭旧连接
    clientInfo.connetTimes = 0;
    reconnect(clientInfo); // 尝试重新连接
  });
  // 监听连接关闭事件
  client.on("close", () => {
    clientInfo.modbusStatus = 'close';
    wsServer.sendMessageToClient(`/${id}/modbusStatus`, 'close');
    console.log("Connection closed.");
  });
}

// 只读状态量（1x）
function readDiscreteInputs(client, addr, count = 2, callback) {
  // 读取指定地址的输入寄存器值
  const address = addr; // 输入寄存器起始地址

  client.readDiscreteInputs(address, count, function(err, res) {
    if (err) {
      console.error("Error reading input registers:", err);
      return callback(err);
    }

    console.log("Input Registers:", addr, count, res);
    return callback(null, res.data);
  });
}
// 只读寄存器（3x）
function readInputRegisters(client, addr, count = 2, callback) {
  // 读取指定地址的输入寄存器值
  const address = addr; // 输入寄存器起始地址

  client.readInputRegisters(address, count, function(err, res) {
    if (err) {
      console.error("Error reading input registers:", err);
      return callback(err);
    }

    console.log("Input Registers:", res);
    return callback(null, res.data);
  });
}

// 保持寄存器-可读可写（4x）
function readHoldingRegisters(client, addr, count = 2, callback) {
  // 读取指定地址的输入寄存器值
  const address = addr; // 输入寄存器起始地址

  client.readHoldingRegisters(address, count, function(err, res) {
    if (err) {
      console.error("Error reading input registers:", err);
      return callback(err);
    }

    console.log("Input Registers:", res);
    return callback(null, res.data);
  });
}

// 保持寄存器-可读可写（4x）
function writeHoldingRegister(client, addr, value, callback) {
  // 设置指定地址的寄存器值
  const address = addr; // 寄存器地址
  const regValue = value; // 寄存器值

  client.writeRegister(address, regValue, function(err, res) {
    if (err) {
      console.error("Error writing holding register:", err);
      return callback(err);
    }

    console.log("Wrote Holding Register:", res);
    return callback(null, res);
  });
}
// 写入线圈-可写状态量（0x）
function writeCoil(client, addr, value, callback) {
  // 设置指定地址的线圈值
  const address = addr; // 线圈地址
  const coilValue = value; // 线圈值

  client.writeCoil(address, coilValue, function(err, res) {
    if (err) {
      console.error("Error writing coil:", err);
      return callback(err);
    }

    console.log("Wrote Coil:", res);
    return callback(null, res);
  });
}

// 监听信号以优雅地关闭 Modbus 连接
process.on('SIGINT', function() {
  console.log('Received SIGINT. Gracefully shutting down from CLI...');
  shutdown();
});

process.on('SIGTERM', function() {
  console.log('Received SIGTERM. Gracefully shutting down from Heroku...');
  shutdown();
});

// 使 shutdown 函数异步
async function shutdown(clientInfo = null) {
  try {
    console.log('Closing Modbus connection...');
    if (clientInfo) {
      const { connectTimeout, client, id } = clientInfo;
      return new Promise((resolve, reject) => {
        connectTimeout && clearTimeout(connectTimeout);
        client.close((err) => {
          if (err) {
            console.error("Error closing connection:", err);
            reject(err);
          } else {
            console.log('Disconnected from Modbus TCP device.');
            clientMap.delete(id);
            resolve('done');
          }
        });
      });
    } else {
      await Promise.all(Array.from(clientMap.values()).map(clientInfo => shutdown(clientInfo)));
    }
  } catch (err) {
    console.error('Error during shutdown:', err);
  } finally {
    console.log('Exiting process...', clientInfo);
    !clientInfo && process.exit(0); // 确保在所有清理操作完成后退出进程
  }
}

// 重连逻辑
function reconnect(clientInfo) {
  const { client, ip, port } = clientInfo;
  clientInfo.connectTimeout && clearTimeout(clientInfo.connectTimeout);
  clientInfo.connetTimes++;
  console.log('Attempting to reconnect...');
  client.connectTCP(ip, { port }, function(err) {
    if (err) {
      console.error("Reconnection failed:", err);
      if (clientInfo.connetTimes < 5) {
        clientInfo.connectTimeout = setTimeout(() => reconnect(clientInfo), 5000); // 5秒后再次尝试重连
      }
    } else {
      clientInfo.modbusStatus = 'connected';
      wsServer.sendMessageToClient(`/${id}/modbusStatus`, 'connected');
      console.log("Reconnected to Modbus TCP device.");
    }
  });
}

const readRegistersMap = {
  '1x': readDiscreteInputs, // 1x: 读离散输入寄存器
  '3x': readInputRegisters, // 3x: 读输入寄存器
  '4x': readHoldingRegisters, // 4x: 读保持寄存器
};
const writeRegistersMap = {
  '0x': writeCoil, // 0x: 写单个线圈
  '4x': writeHoldingRegister, // 4x: 写保持寄存器
};

// 数据转换为正确的小数
function convertToFloatValue(data) {
  const reg1 = data[0]; // 第一个寄存器
  const reg2 = data[1]; // 第二个寄存器
  const floatBuffer = Buffer.alloc(4); // 创建一个 4 字节的缓冲区
  floatBuffer.writeUInt16BE(reg2, 0); // 写入高字节
  floatBuffer.writeUInt16BE(reg1, 2); // 写入低字节

  return floatBuffer.readFloatBE(0); // 读取浮点数
}

router.get('/startConection', (req, res) => {
  try {
    const { modbusIp, modbusPort, id } = req.query;
    if (!clientMap.has(id)) {
      clientMap.set(id, {
        id,
        ip: modbusIp,
        port: modbusPort,
        client: new ModbusRTU(),
        connectTimeout: null,
        connetTimes: 0
      })
    }
    handleListenningClient(id);
    connectToModbusDevice(id);
    res.send({
      code: 200,
      msg: '正在连接',
      data: null
    })
  } catch (error) {
    res.send({
      code: 500,
      msg: error.message,
      data: null
    })
  }
});
/**
 * 读取Modbus值
 * @param {*} addr 寄存器地址
 * @param {*} type 类型
 * @param {*} float 存储类型是否为浮点型
 */
router.get('/getModbusValue', (req, res) => {
  const { addr, type = '4x', float = false, count = 2, id } = req.query;
  const func = readRegistersMap[type];
  const clientInfo = clientMap.get(id);
  if (!clientInfo || clientInfo.modbusStatus !== "connected") {
    res.send({
      code: 500,
      msg: 'modbus未成功连接'
    });
    return;
  }
  func(clientInfo.client, addr, count, (err, result) => {
    if (err) {
      res.status(500).send(`Error reading register: ${err.message}`);
    } else {
      // 假设结果是一个数组，取第一个元素作为寄存器值
      let _result = result;
      // if (float) {
      //   _result = convertToFloatValue(result);
      // }
      res.send({
        data: _result
      });
    }
  });
});

// 获取Modbus状态
router.get('/status', (req, res) => {
  const id = req.query.id;
  const clientInfo = clientMap.get(id);
  res.send({
    data: clientInfo?.modbusStatus
  });
});

// 获取Modbus所有寄存器值
const navStatusList = ["无", "等待执行导航", "正在执行导航", "导航暂停", "到达", "失败", "取消", "超时"]
router.get('/getAllStatus', async (req, res) => {
  const id = req.query.id;
  const clientInfo = clientMap.get(id);

  const data = { modbusStatus: clientInfo?.modbusStatus };

  try {
    // 占用状态 0 -> 可用  1 -> 被占用
    const isOccupyResult = await new Promise((resolve, reject) => {
      readInputRegisters(42, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result[0]);
        }
      });
    });
    data.isOccupy = isOccupyResult;

    // 当前点位
    const currentPointResult = await new Promise((resolve, reject) => {
      readInputRegisters(6, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result[0]);
        }
      });
    });
    data.currentPoint = currentPointResult;

    // 导航状态
    const navStatusResult = await new Promise((resolve, reject) => {
      readInputRegisters(8, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result[0]);
        }
      });
    });
    data.navStatus = navStatusResult;
    data.navStatusName = navStatusList[parseInt(navStatusResult)];

    // 电池电量
    const powerResult = await new Promise((resolve, reject) => {
      readInputRegisters(12, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result[0]);
        }
      });
    });
    data.power = powerResult;

    // 如果有错误发生，捕获并处理
  } catch (error) {
    console.error('Error reading registers:', error);
    res.status(500).send({
      data: `Error reading registers: ${error.message}`
    });
    return;
  }

  console.log(data);
  res.send({ data });
});

/**
 * 写入Modbus值
 * @param {*} addr 寄存器地址
 * @param {*} type 类型
 * @param {*} value 值
 */
router.post('/setModbusValue', (req, res) => {
  const { addr, value, type = '4x', id } = req.body;
  const func = writeRegistersMap[type];
  const clientInfo = clientMap.get(id);
  if (!clientInfo || clientInfo.modbusStatus !== "connected") {
    res.send({
      code: 500,
      msg: 'modbus未成功连接'
    });
    return;
  }
  func(clientInfo.client, addr, value, (err, result) => {
    if (err) {
      res.status(500).send(`Error setting register: ${err.message}`);
    } else {
      res.send(`Set the value at address ${addr} to ${value}`);
    }
  });
});
// 尝试重连
router.post('/reconnected', (req, res) => {
  const { id } = req.body;
  const clientInfo = clientMap.get(id);
  if (!clientInfo) {
    res.send({
      code: 500,
      msg: 'modbus未成功连接'
    });
    return;
  }
  if (!clientInfo.modbusStatus || clientInfo.modbusStatus === 'close') {
    connectToModbusDevice(id);
    res.send({
      code: 200,
      msg: '正在连接',
      data: null
    })
  } else {
    clientInfo.connetTimes = 0;
    reconnect(clientInfo);
    res.send({
      msg: '正在重连...'
    });
  }
});
// 关闭modbus连接
router.post('/closeConnect', async (req, res) => {
  const { id } = req.body;
  const clientInfo = clientMap.get(id);
  if (!clientInfo || clientInfo.modbusStatus !== "connected") {
    res.send({
      code: 500,
      msg: 'modbus未成功连接'
    });
    return;
  }
  const result = await shutdown(clientInfo);
  if (result === 'done') {
    res.send({
      code: 200,
      msg: '关闭成功'
    });
  } else {
    res.send({
      code: 500,
      msg: '关闭失败'
    });
  }
});
module.exports = router;