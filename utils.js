const dayjs = require('dayjs');

// 单独定义日期时间格式化函数
function formatDateTime(dateTimeStr, format) {
  return dateTimeStr ? dayjs(dateTimeStr).format(format || 'YYYY-MM-DD HH:mm:ss') : null;
}

// 定义一个中间件来转换字段名
function transformFieldNames(results) {
  return results.map(row => {
    const newRow = {};
    for (const key in row) {
      const camelCaseKey = key.replace(/_([a-z])/g, (match, p1) => p1.toUpperCase());
      newRow[camelCaseKey] = row[key];

      // 处理日期时间字段
      if (['createTime', 'updateTime'].includes(camelCaseKey)) {
        newRow[camelCaseKey] = formatDateTime(row[key]);
      }
    }
    return newRow;
  });
}

module.exports = {
  formatDateTime,
  transformFieldNames
};