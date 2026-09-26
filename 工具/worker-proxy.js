// CIRCUITORIUM 识别代理（Cloudflare Worker 版）
//
// 作用：真 Key 只放在 Worker 的环境变量里，学生用「老师配置码」通过这个代理识别，
//       学生机器上永远拿不到真 Key。
//
// 部署步骤：
//   1. 打开 https://dashscope.aliyuncs.com 申请一个 Key（或用其它 OpenAI 兼容服务）
//   2. 打开 https://workers.cloudflare.com 新建 Worker，把本文件内容整段粘贴进去
//   3. 在 Worker 的 Settings → Variables 里加两个环境变量：
//        UPSTREAM_KEY    = 你的真 Key（类型选 Secret/加密）
//        ACCESS_TOKEN    = 你自己定的一串口令，例如 class-2026-abc（发给学生用）
//   4. 可选：改 UPSTREAM_BASE / MODEL 换服务商与模型
//   5. 部署后得到 https://<名字>.<账号>.workers.dev
//   6. 回到工具箱 →「识别设置」→ 老师配置码 → 填这个地址 + ACCESS_TOKEN → 生成配置码发给学生
//
// 换口令即可立刻让旧配置码失效；学生机器上不存任何真 Key。

const UPSTREAM_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const MODEL = 'qwen3-vl-plus';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return json({ error: { message: '只支持 POST' } }, 405);
    }

    // 校验访问令牌（学生配置码里带的就是它）
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!env.ACCESS_TOKEN || token !== env.ACCESS_TOKEN) {
      return json({ error: { message: '访问令牌无效' } }, 401);
    }
    if (!env.UPSTREAM_KEY) {
      return json({ error: { message: '服务端未配置 Key' } }, 500);
    }

    // 只允许转发对话接口，别的路径一律拒绝
    const url = new URL(request.url);
    if (!url.pathname.endsWith('/chat/completions')) {
      return json({ error: { message: '路径不支持' } }, 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: { message: '请求体不是合法 JSON' } }, 400);
    }

    // 限制一下规模，避免被当成免费大模型用
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0 || messages.length > 4) {
      return json({ error: { message: '请求内容不符合要求' } }, 400);
    }

    const upstream = await fetch(`${(env.UPSTREAM_BASE || UPSTREAM_BASE).replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.UPSTREAM_KEY}`,
      },
      body: JSON.stringify({
        model: body.model || env.MODEL || MODEL,
        messages,
        temperature: 0.1,
      }),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  },
};

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
