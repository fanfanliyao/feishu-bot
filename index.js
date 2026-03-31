require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const APP_ID = process.env.APP_ID;
const APP_SECRET = process.env.APP_SECRET;
const PORT = process.env.PORT || 3000;

let accessToken = null;
let tokenExpireTime = 0;

// 获取飞书 Access Token
async function getAccessToken() {
  const now = Date.now();
  
  // 如果 token 还未过期，直接使用
  if (accessToken && now < tokenExpireTime) {
    return accessToken;
  }

  try {
    const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: APP_ID,
      app_secret: APP_SECRET
    });

    accessToken = response.data.tenant_access_token;
    tokenExpireTime = now + (response.data.expire - 300) * 1000; // 提前 5 分钟刷新
    
    return accessToken;
  } catch (error) {
    console.error('获取 token 失败:', error.response?.data || error.message);
    throw error;
  }
}

// 读取多维表格数据
app.post('/api/bitable/read', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { app_token, table_id } = req.body;

    if (!app_token || !table_id) {
      return res.status(400).json({ error: '缺少 app_token 或 table_id' });
    }

    const response = await axios.get(
      `https://open.feishu.cn/open-apis/bitable/v3/apps/${app_token}/tables/${table_id}/records`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('读取表格失败:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// 写入多维表格数据
app.post('/api/bitable/write', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { app_token, table_id, fields } = req.body;

    if (!app_token || !table_id || !fields) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const response = await axios.post(
      `https://open.feishu.cn/open-apis/bitable/v3/apps/${app_token}/tables/${table_id}/records`,
      {
        fields: fields
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('写入表格失败:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// Webhook 端点（用于接收飞书事件）
app.post('/webhook', (req, res) => {
  console.log('收到飞书事件:', req.body);
  
  // TODO: 处理飞书事件
  res.json({ success: true });
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`服务运行在 http://localhost:${PORT}`);
  console.log(`Webhook 地址: http://localhost:${PORT}/webhook`);
});
