const axios = require('axios');

// ===== 百度OCR配置（请填入您的密钥） =====
const BAIDU_API_KEY = 'xNQ3STog7pIzySxfQB6hkAPC';
const BAIDU_SECRET_KEY = 'E5213YGl8xdm16Jbs8RbaIPe4w4KPPJQ';

let accessToken = null;
let tokenExpireTime = 0;

// ===== 获取百度Access Token =====
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpireTime - 300000) {
    return accessToken;
  }

  try {
    const response = await axios.post(
      'https://aip.baidubce.com/oauth/2.0/token',
      null,
      {
        params: {
          grant_type: 'client_credentials',
          client_id: BAIDU_API_KEY,
          client_secret: BAIDU_SECRET_KEY
        }
      }
    );

    if (response.data.access_token) {
      accessToken = response.data.access_token;
      tokenExpireTime = Date.now() + (response.data.expires_in || 2592000) * 1000;
      return accessToken;
    } else {
      throw new Error('获取Token失败');
    }
  } catch (error) {
    console.error('获取Access Token失败:', error.message);
    throw error;
  }
}

// ===== Vercel 入口函数 =====
module.exports = async (req, res) => {
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ===== 健康检查 =====
  if (req.url === '/api/health' || req.query.action === 'health') {
    return res.status(200).json({ 
      status: 'ok', 
      message: '百度OCR代理服务运行中 (Vercel)',
      timestamp: new Date().toISOString()
    });
  }

  // ===== OCR识别 =====
  if (req.method === 'POST' && req.url === '/api/ocr') {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: '缺少图片数据' });
      }

      // 获取Token
      const token = await getAccessToken();

      // 调用百度OCR API
      const response = await axios.post(
        'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic',
        `image=${encodeURIComponent(image)}&language_type=CHN_ENG`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          params: {
            access_token: token
          }
        }
      );

      if (response.data.error_code) {
        throw new Error(`百度OCR错误: ${response.data.error_msg}`);
      }

      // 提取文字
      const words = response.data.words_result.map(item => item.words);
      const fullText = words.join('\n');

      console.log('📝 OCR识别结果:', fullText);

      res.status(200).json({
        success: true,
        text: fullText,
        raw: response.data
      });

    } catch (error) {
      console.error('❌ OCR识别失败:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  } else {
    res.status(404).json({ error: '接口不存在' });
  }
};