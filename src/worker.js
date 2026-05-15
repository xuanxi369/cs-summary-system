// ============================================================
// cs-summary-worker — 客服对话摘要 + 质量评估 Worker
// Cloudflare Workers (ES Modules)
// ============================================================

const SYSTEM_PROMPT = `你是一位资深的客服对话质量评估专家，拥有10年客服管理经验。请对提供的客服对话进行专业分析。

## 输出要求
请严格输出以下JSON格式，不要输出任何JSON之外的内容（不要加 \`\`\`json 标记）：

{
  "summary": "用一句话精准概括用户诉求和处理结果",
  "user_intent": "用户核心诉求（简短）",
  "agent_action": "客服采取的关键措施（简短）",
  "status": "已解决 | 处理中 | 待解决",
  "score": 5,
  "score_label": "优秀",
  "reasoning": "评分理由（简述优点或扣分原因）"
}

## 评分标准（1-5分）
- 5分（优秀）：高效解决问题，回应专业完整，主动提供后续建议或关怀
- 4分（良好）：问题基本解决，回应准确，整体表现好
- 3分（一般）：问题部分解决，回应合理但不够充分，缺少跟进
- 2分（较差）：回应不充分或不准确，问题未完全解决
- 1分（很差）：未解决问题，回应敷衍、错误或态度差

## status 判断标准
- 已解决：问题已有明确解决方案或已执行完毕
- 处理中：客服已采取行动但结果待定
- 待解决：问题尚未得到实质性处理

## 注意
- summary 必须是一句话，包含"用户做了什么"+"客服做了什么"+"结果如何"
- reasoning 必须具体，指出具体的优点或扣分点
- score 必须是 1-5 的整数`;

// ---------- CORS ----------

function getCorsHeaders(env) {
  const origin = env.CORS_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    "Access-Control-Max-Age": "86400",
  };
}

function handleOptions(request, env) {
  return new Response(null, { status: 204, headers: getCorsHeaders(env) });
}

// ---------- DeepSeek API ----------

async function callDeepSeek(apiKey, dialogueTurns) {
  // 将对话轮次格式化为 user 可读文本
  const conversationText = dialogueTurns
    .map((t) => `${t.role === "user" ? "用户" : "客服"}：${t.content}`)
    .join("\n");

  const payload = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `请分析以下客服对话：\n\n${conversationText}` },
    ],
    temperature: 0.3,
    max_tokens: 1024,
    response_format: { type: "json_object" },
  };

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API 错误 (${response.status}): ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek 返回内容为空");

  // 解析 JSON，容错处理
  try {
    return JSON.parse(content);
  } catch {
    // 尝试提取 JSON 块
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("无法解析 AI 返回的 JSON");
  }
}

// ---------- 主路由 ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(env);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }

    // 健康检查
    if (url.pathname === "/api/health" && request.method === "GET") {
      return Response.json(
        { status: "ok", timestamp: new Date().toISOString() },
        { headers: corsHeaders }
      );
    }

    // 单条对话分析
    if (url.pathname === "/api/summarize" && request.method === "POST") {
      try {
        const body = await request.json();
        const { dialogue, api_key } = body;

        // 验证输入
        if (!dialogue || !Array.isArray(dialogue.turns) || dialogue.turns.length === 0) {
          return Response.json(
            { error: "无效的对话数据：请提供包含 turns 数组的对话对象" },
            { status: 400, headers: corsHeaders }
          );
        }

        // API Key：优先使用请求中的，其次使用环境变量
        const apiKey = api_key || env.DEEPSEEK_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "未配置 DEEPSEEK_API_KEY，请在 Worker 环境变量或请求中提供" },
            { status: 401, headers: corsHeaders }
          );
        }

        // 调用 DeepSeek
        const result = await callDeepSeek(apiKey, dialogue.turns);

        return Response.json(
          {
            id: dialogue.id || "unknown",
            ...result,
          },
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("分析失败:", err.message);
        return Response.json(
          { error: err.message || "服务器内部错误" },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // 404
    return Response.json(
      { error: "未找到接口", available: ["/api/health (GET)", "/api/summarize (POST)"] },
      { status: 404, headers: corsHeaders }
    );
  },
};
