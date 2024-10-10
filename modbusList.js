// modbusList.js
const express = require('express');
const router = express.Router();
const { transformFieldNames, formatDateTime } = require('./utils');

let connection;
// 操作数据库的函数
function operateDatabase(dbConnection, query, params, callback) {
  dbConnection.query(query, params, (error, results, fields) => {
    if (error) {
      console.error('Error executing query:', error);
      callback(error, null);
    } else {
      callback(null, results);
    }
  });
}

// 获取modbus列表
router.get('/getModbusList', (req, res) => {
  const { modbusIp } = req.query;

  let query = 'SELECT * FROM modbus_list';
  if (modbusIp) {
    query += ` WHERE modbus_ip = '${modbusIp.trim()}'`;
  }
  operateDatabase(connection, query, [], (error, results) => {
    if (error) {
      res.status(500).send({
        code: 500,
        msg: error.message,
        data: null
      });
    } else {
      const transformedResults = transformFieldNames(results);
      res.json({
        code: 200,
        msg: null,
        data: transformedResults
      });
    }
  });
});

router.post('/updateModbus', async (req, res) => {
  const { id, modbusIp, modbusPort } = req.body;
  try {
    const sameModbusResult = await new Promise((resolve, reject) => {
      let _query = `
        SELECT * FROM modbus_list
        WHERE modbus_ip = ? AND modbus_port = ?
      `;
      if (id) {
        _query += ` AND id != ?`;
      }
      operateDatabase(connection, _query, [modbusIp, modbusPort, id], (error, results) => {
        if (error) {
          reject("查询失败")
        } else {
          resolve(results);
        }
      });
    });
    if (sameModbusResult.length > 0) {
      return res.json({
        code: 500,
        msg: "操作失败，已有相同的modbus连接",
        data: null
      });
    }
  } catch (error) {
    return res.json({
      code: 500,
      msg: "操作失败",
      data: null
    });
  }

  const currentTime = formatDateTime(new Date());
  let query, data = [];
  if (id) {
    query = `
      UPDATE modbus_list
      SET modbus_ip = ?, modbus_port = ?, update_time = ?
      WHERE id = ?
    `;
    data = [modbusIp, modbusPort, currentTime, id];
  } else {
    query = `
      INSERT INTO modbus_list (modbus_ip, modbus_port, create_time)
      VALUES (?, ?, ?)
    `;
    data = [modbusIp, modbusPort, currentTime];
  }
  operateDatabase(connection, query, data, (error, results) => {
    if (error) {
      res.status(500).send({
        code: 500,
        msg: error.message,
        data: null
      });
    } else {
      res.json({
        code: 200,
        msg: "操作成功",
        data: null
      });
    }
  });
})

// 根据id删除modbus记录
router.delete('/deleteModbus/:id', (req, res) => {
  const id = req.params.id;

  const query = `
    DELETE FROM modbus_list
    WHERE id = ?
  `;
  operateDatabase(connection, query, [id], (error, results) => {
    if (error) {
      res.status(500).send({
        code: 500,
        msg: error.message,
        data: null
      });
    } else {
      res.json({
        code: 200,
        msg: "删除成功",
        data: null
      });
    }
  });
});

// 获取modbus数据类型
router.get('/getModbusDataType', (req, res) => {
  let query = 'SELECT * FROM modbus_data_type';
  operateDatabase(connection, query, [], (error, results) => {
    if (error) {
      res.status(500).send({
        code: 500,
        msg: error.message,
        data: null
      });
    } else {
      const transformedResults = transformFieldNames(results);
      res.json({
        code: 200,
        msg: null,
        data: transformedResults
      });
    }
  });
});

// 保存modbus配置
router.post('/saveOrUpdateModbusConfig', async (req, res) => {
  const { id, listId, registerList, writeRegisterList } = req.body;
  try {
    const newRegisterList = registerList.filter((item) => !item.id);
    const updateRegisterList = registerList.filter((item) => item.id);
    const newWriteRegisterList = writeRegisterList.filter((item) => !item.id);
    const updateWriteRegisterList = writeRegisterList.filter((item) => item.id);
    // 新增
    if (newRegisterList?.length > 0) {
      await new Promise((resolve, reject) => {
        const query = `
          INSERT INTO read_register_config (label, label_width, register_addr, register_addr_length, register_data_type, register_type, span, list_id)
          VALUES ?
        `;
        data = newRegisterList.map((item) => [item.label, item.labelWidth, item.registerAddr, item.registerAddrLength, item.registerDataType, item.registerType, item.span, parseInt(listId)])
        operateDatabase(connection, query, [data], (error, results) => {
          if (error) {
            reject(error)
          } else {
            resolve(results);
          }
        });
      });
    }
    if (newWriteRegisterList?.length > 0) {
      await new Promise((resolve, reject) => {
        const query = `
          INSERT INTO write_register_config (label, register_addr, register_type, register_value, list_id)
          VALUES ?
        `;
        data = newWriteRegisterList.map((item) => [item.label, item.registerAddr, item.registerType, item.registerValue, parseInt(listId)])
        operateDatabase(connection, query, [data], (error, results) => {
          if (error) {
            reject(error)
          } else {
            resolve(results);
          }
        });
      });
    }
    // 更新
    if (updateRegisterList.length > 0) {
      await new Promise((resolve, reject) => {
        const query = `
          INSERT INTO read_register_config (id, label, label_width, register_addr, register_addr_length, register_data_type, register_type, span, list_id)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            label = VALUES(label),
            label_width = VALUES(label_width),
            register_addr = VALUES(register_addr),
            register_addr_length = VALUES(register_addr_length),
            register_data_type = VALUES(register_data_type),
            register_type = VALUES(register_type),
            span = VALUES(span),
            list_id = VALUES(list_id)
        `;
        data = updateRegisterList.map((item) => [item.id, item.label, item.labelWidth, item.registerAddr, item.registerAddrLength, item.registerDataType, item.registerType, item.span, parseInt(listId)])
        operateDatabase(connection, query, [data], (error, results) => {
          if (error) {
            reject(error)
          } else {
            resolve(results);
          }
        });
      });
    }
    if (updateWriteRegisterList?.length > 0) {
      await new Promise((resolve, reject) => {
        const query = `
          INSERT INTO write_register_config (id, label, register_addr, register_type, register_value, list_id)
          VALUES ?
          on DUPLICATE KEY UPDATE
            label = VALUES(label),
            register_addr = VALUES(register_addr),
            register_type = VALUES(register_type),
            register_value = VALUES(register_value),
            list_id = VALUES(list_id)
        `;
        data = updateWriteRegisterList.map((item) => [item.id, item.label, item.registerAddr, item.registerType, item.registerValue, parseInt(listId)])
        operateDatabase(connection, query, [data], (error, results) => {
          if (error) {
            reject(error)
          } else {
            resolve(results);
          }
        });
      });
    }
    res.json({
      code: 200,
      msg: "操作成功",
      data: null
    });
  } catch (error) {
    res.status(500).send({
      code: 500,
      msg: error.message,
      data: null
    });
  }
});

// 查询modbus配置项
router.get('/getModbusConfig', async (req, res) => {
  const { id } = req.query;
  try {
    const readRegisterSql = `
      SELECT
        rrc.id,
        rrc.label,
        rrc.label_width,
        rrc.register_addr,
        rrc.register_addr_length,
        rrc.register_data_type,
        rrc.register_type,
        rrc.span,
        ml.modbus_ip,
        ml.modbus_port
      FROM read_register_config rrc
      LEFT JOIN modbus_list ml
      ON rrc.list_id = ml.id
      WHERE ml.id = ?;
    `;
    const registerList = await new Promise((resolve, reject) => {
      operateDatabase(connection, readRegisterSql, [id], (error, results) => {
        if (error) {
          reject(error)
        } else {
          resolve(results);
        }
      });
    });
    const writeRegisterSql = `
      SELECT
        wrc.id,
        wrc.label,
        wrc.register_addr,
        wrc.register_type,
        wrc.register_value,
        ml.modbus_ip,
        ml.modbus_port
      FROM write_register_config wrc
      LEFT JOIN modbus_list ml
      ON wrc.list_id = ml.id
      WHERE ml.id = ?;
    `;
    const writeRegisterList = await new Promise((resolve, reject) => {
      operateDatabase(connection, writeRegisterSql, [id], (error, results) => {
        if (error) {
          reject(error)
        } else {
          resolve(results);
        }
      });
    });
    let modbusInfo = {};
    if (registerList.length === 0 && writeRegisterList.length === 0) {
      const query = `
        SELECT * FROM modbus_list
        WHERE id = ?
      `;
      await new Promise((resolve, reject) => {
        operateDatabase(connection, query, [id], (error, results) => {
          if (error) {
            reject(error)
          } else {
            modbusInfo = results[0] ?? {};
            resolve();
          }
        });
      });
    }
    res.json({
      code: 200,
      msg: null,
      data: {
        registerList: transformFieldNames(registerList),
        writeRegisterList: transformFieldNames(writeRegisterList),
        modbusIp: [...registerList, ...writeRegisterList][0]?.modbus_ip || modbusInfo.modbus_ip,
        modbusPort: [...registerList, ...writeRegisterList][0]?.modbus_port || modbusInfo.modbus_port,
      }
    });
  } catch (error) {
    res.status(500).send({
      code: 500,
      msg: error.message,
      data: null
    });
  }
})

module.exports = (dbConnection) => {
  // 在这里可以使用 dbConnection 进行数据库操作
  connection = dbConnection; // 将传入的连接赋值给全局变量
  return router;
};;