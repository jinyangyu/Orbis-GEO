-- Seed AI engines (idempotent)
INSERT INTO engines (id, code, name, sort_order, is_active)
SELECT UUID(), v.code, v.name, v.sort_order, 1
FROM (
  SELECT 'chatgpt' AS code, 'ChatGPT' AS name, 1 AS sort_order
  UNION ALL SELECT 'perplexity', 'Perplexity', 2
  UNION ALL SELECT 'google', 'Google AI', 3
  UNION ALL SELECT 'gemini', 'Gemini', 4
  UNION ALL SELECT 'copilot', 'Copilot', 5
  -- Domestic / inspection providers (raw response import)
  UNION ALL SELECT 'deepseek', 'DeepSeek', 6
  UNION ALL SELECT 'doubao', 'Doubao', 7
  UNION ALL SELECT 'gpt', 'GPT', 8
) AS v
WHERE NOT EXISTS (SELECT 1 FROM engines e WHERE e.code = v.code);
