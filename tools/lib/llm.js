/**
 * OpenAI 兼容 API 调用（chat/completions）。
 *
 * chatJson：发送 system+user 消息并解析 JSON 返回。
 * - 兼容模型用 markdown 代码块包裹 JSON 的情况；
 * - max_tokens 固定 10k 上限（推理模型的思维链可能很长，递增预算意义不大），
 *   仅对偶发空响应做一次同参数重试。
 *
 * buildPostContext：把文章 front-matter + 正文组装成供提示词使用的上下文。
 */
function buildPostContext(post, fileName) {
  const fm = post.frontmatter;
  const join = v => (Array.isArray(v) ? v.join(', ') : v);
  return `
标题: ${fm.title || fileName}
分类: ${fm.categories ? join(fm.categories) : '无'}
现有标签: ${fm.tags ? join(fm.tags) : '无'}

正文:
${post.body}
`.trim();
}

async function chatJson(env, { system, user, temperature = 0.7, maxTokens = 10000 }) {
  const endpoint = env.OPENAI_API_ENDPOINT.replace(/\/$/, '');
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_LLM_MODEL;

  const MAX_ATTEMPTS = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      // 不要在错误信息中包含完整响应，可能包含敏感信息
      console.error('API response error:', await response.text());
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices && data.choices[0];
    const message = choice && choice.message;
    const finishReason = choice ? choice.finish_reason : 'unknown';
    const resultText = message && typeof message.content === 'string' ? message.content.trim() : '';

    if (!resultText) {
      lastError = new Error(
        `API returned empty content (finish_reason: ${finishReason}); ` +
        `reasoning may have exhausted max_tokens=${maxTokens}`
      );
      console.warn(`  ${lastError.message}`);
      continue;
    }

    // 模型可能无视指令用 markdown 代码块包裹 JSON，这里做兼容提取
    const fenceMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = (fenceMatch ? fenceMatch[1] : resultText).trim();
    const jsonStart = jsonText.indexOf('{');
    const jsonEnd = jsonText.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd <= jsonStart) {
      throw new Error('API response does not contain a JSON object');
    }

    return JSON.parse(jsonText.slice(jsonStart, jsonEnd + 1));
  }

  throw lastError || new Error('API returned empty content');
}

module.exports = { chatJson, buildPostContext };
