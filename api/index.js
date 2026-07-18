export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { method, id, params } = req.body;

  let result;

  switch (method) {
    case 'initialize':
      result = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'ddg-search-mcp', version: '1.0.0' },
      };
      break;

    case 'notifications/initialized':
      return res.status(204).end();

    case 'tools/list':
      result = {
        tools: [
          {
            name: 'web_search',
            description: 'Search the web using DuckDuckGo. Returns titles, links, and snippets.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                num: { type: 'number', description: 'Number of results (1-10, default 5)' },
              },
              required: ['query'],
            },
          },
        ],
      };
      break;

    case 'tools/call':
      if (params.name === 'web_search') {
        const query = params.arguments.query;
        const num = params.arguments.num || 5;

        try {
          // Step 1: Get vqd token
          const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          const tokenHtml = await tokenRes.text();
          const vqdMatch = tokenHtml.match(/vqd=["']?([^"'&]+)/);

          if (!vqdMatch) {
            result = { content: [{ type: 'text', text: 'Failed to get search token.' }], isError: true };
            break;
          }

          const vqd = vqdMatch[1];

          // Step 2: Use DuckDuckGo internal API
          const searchUrl = `https://links.duckduckgo.com/d.js?q=${encodeURIComponent(query)}&vqd=${vqd}&kl=wt-wt&l=wt-wt&p=&s=0&df=&ex=-1`;
          const searchRes = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': 'https://duckduckgo.com/',
            },
          });

          const text = await searchRes.text();

          // Parse JSON from JSONP-like response
          const jsonMatch = text.match(/DDG\.pageLayout\.load\('d',(\[[\s\S]*?\])\);/);
          if (!jsonMatch) {
            // Try direct JSON parse
            try {
              const data = JSON.parse(text);
              if (Array.isArray(data)) {
                const items = data.filter(r => r.u && r.t).slice(0, num);
                if (items.length > 0) {
                  const output = items.map((item, i) => `${i + 1}. ${item.t}\n   ${item.u}\n   ${item.a || ''}`).join('\n\n');
                  result = { content: [{ type: 'text', text: output }] };
                  break;
                }
              }
            } catch(e) {}
            result = { content: [{ type: 'text', text: 'Failed to parse search results.' }], isError: true };
            break;
          }

          const data = JSON.parse(jsonMatch[1]);
          const items = data.filter(r => r.u && r.t).slice(0, num);

          if (items.length > 0) {
            const output = items.map((item, i) => {
              const title = item.t.replace(/<[^>]*>/g, '');
              const snippet = (item.a || '').replace(/<[^>]*>/g, '');
              return `${i + 1}. ${title}\n   ${item.u}\n   ${snippet}`;
            }).join('\n\n');
            result = { content: [{ type: 'text', text: output }] };
          } else {
            result = { content: [{ type: 'text', text: 'No results found.' }] };
          }
        } catch (e) {
          result = {
            content: [{ type: 'text', text: `Error: ${e.message}` }],
            isError: true,
          };
        }
      } else {
        result = {
          content: [{ type: 'text', text: `Unknown tool: ${params.name}` }],
          isError: true,
        };
      }
      break;

    default:
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: 'Method not found' },
      });
  }

  return res.status(200).json({ jsonrpc: '2.0', id, result });
}
