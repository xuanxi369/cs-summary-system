# CS Analytica — 客服对话智能分析系统

AI 驱动的客服对话自动摘要与质量评估工具。粘贴对话 JSON，一键生成结构化摘要 + 评分报告。

## 项目结构

```
cs-summary-system/
├── wrangler.toml            # Worker 配置
├── src/
│   └── worker.js            # 后端 API（CORS + DeepSeek 调用）
├── public/
│   ├── index.html           # 门户首页（产品展示入口）
│   └── app.html             # 功能分析工具（核心应用）
└── README.md
```

## 页面说明

| 页面 | 路径 | 功能 |
|------|------|------|
| 门户首页 | `public/index.html` | 产品介绍、功能展示、入口导航 |
| 分析工具 | `public/app.html` | 数据输入 → AI 分析 → 仪表盘 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | HTML5 + Tailwind CSS (CDN) + Vanilla JS |
| 后端 | Cloudflare Workers (ES Modules) |
| AI   | DeepSeek API (OpenAI 兼容格式) |
| 部署 | Cloudflare Pages (前端) + Workers (API) |

## 部署步骤

### 1. 部署 Worker（后端）

```bash
cd cs-summary-system

# 安装 wrangler（如果没有）
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 设置 DeepSeek API Key（密钥，不会写入代码）
wrangler secret put DEEPSEEK_API_KEY

# 部署 Worker
wrangler deploy
```

部署后会得到一个 Worker URL，如：
`https://cs-summary-worker.你的子域.workers.dev`

### 2. 部署 Pages（前端）

```bash
# 部署 public 目录到 Cloudflare Pages
npx wrangler pages deploy public --project-name cs-summary
```

### 3. 配置 Worker 地址

部署完成后，在分析工具页面的「Worker 地址」输入框中填入你的 Worker URL。

或者直接编辑 `public/app.html` 中的默认值。

## 使用方法

1. 打开门户首页，点击「进入分析系统」
2. 在文本框粘贴对话 JSON 数组（或点击「加载示例数据」）
3. 填入 Worker 地址（和可选的 API Key）
4. 点击「开始批量分析」
5. 等待分析完成，查看仪表盘结果
6. 可点击「导出 CSV」下载报告

## 对话 JSON 格式

```json
[
  {
    "id": "001",
    "turns": [
      {"role": "user", "content": "用户消息"},
      {"role": "assistant", "content": "客服回复"}
    ]
  }
]
```

## API 接口

### POST /api/summarize

**请求体：**
```json
{
  "dialogue": { "id": "001", "turns": [...] },
  "api_key": "可选的 API Key 覆盖"
}
```

**响应：**
```json
{
  "id": "001",
  "summary": "一句话摘要",
  "user_intent": "用户核心诉求",
  "agent_action": "客服措施",
  "status": "已解决 | 处理中 | 待解决",
  "score": 4,
  "score_label": "良好",
  "reasoning": "评分理由"
}
```

### GET /api/health

健康检查，返回 `{"status": "ok"}`
