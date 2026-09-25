// 临时模拟识别服务：验证「AI 识别 → 存进我的元件库」这条链，不消耗任何真实额度。
// 用法：node tools/mock-ai.cjs [端口]      （默认 8799）
// 它只回答 OpenAI 兼容的 /chat/completions，返回两个假元件。

const http = require('http');

const port = Number(process.argv[2] || 8799);

const payload = {
  components: [
    {
      name: 'LM358 运算放大器',
      type: '集成电路',
      model: 'LM358',
      manufacturer: 'TI',
      packageType: 'DIP-8',
      pinCount: 8,
      specifications: '双运放 · 供电 3~32V',
      description: '把微弱信号放大，常用来做传感器调理',
      confidence: 0.92,
    },
    {
      name: '10kΩ 电位器',
      type: '基础元件',
      model: '10kΩ',
      manufacturer: '',
      packageType: 'THT',
      pinCount: 3,
      specifications: '旋转式 · 线性',
      description: '拧一拧改变阻值',
      confidence: 0.81,
    },
  ],
};

const server = http.createServer((req, res) => {
  // 页面在 :3000，这个服务在 :8799，属于跨源请求，必须给 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== 'POST' || !req.url.includes('/chat/completions')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"error":"not found"}');
    return;
  }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    console.log(`[模拟识别] 收到请求 ${body.length} 字节，返回 2 个元件`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }));
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[模拟识别] 已启动：http://127.0.0.1:${port}/v1  （Ctrl+C 或关窗口停止）`);
});
