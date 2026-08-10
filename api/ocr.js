const axios = require('axios');

// ===== 百度OCR配置 =====
const BAIDU_API_KEY = 'xNQ3STog7pIzySxfQB6hkAPC';
const BAIDU_SECRET_KEY = 'E5213YGl8xdm16Jbs8RbaIPe4w4KPPJQ';

let accessToken = null;
let tokenExpireTime = 0;

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ===== 健康检查 =====
  if (req.url === '/api/health' || req.url === '/api/health/') {
    return res.status(200).json({
      status: 'ok',
      message: '百度OCR代理服务运行中 (Vercel)',
      timestamp: new Date().toISOString()
    });
  }

  // ===== OCR识别 =====
  if (req.method === 'POST' && (req.url === '/api/ocr' || req.url === '/api/ocr/')) {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: '缺少图片数据' });
      }

      const token = await getAccessToken();

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

      const words = response.data.words_result.map(item => item.words);
      const fullText = words.join('\n');

      res.status(200).json({
        success: true,
        text: fullText,
        raw: response.data
      });

    } catch (error) {
      console.error('OCR识别失败:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  } else {
    res.status(404).json({ error: '接口不存在: ' + req.url });
  }
};
