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
        serverInfo: { name: 'searx-mcp', version: '1.0.0' },
      };
      break;

    case 'notifications/initialized':
      return res.status(204).end();

    case 'tools/list':
      result = {
        tools: [
          {
            name: 'web_search',
            description: 'Search the web. Returns titles, links, and snippets.',
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

const instances = [
          'https://searx.be',
          'https://search.ononoki.org',
          'https://searx.work',
          'https://paulgo.io',
          'https://priv.au',
        ];

        let data = null;
        let lastError = '';

        for (const instance of instances) {
          try {
            const url = `${instance}/search?q=${encodeURIComponent(query)}&format=json&number_of_results=${num}`;
            const response = await fetch(url, {
              headers: { 'User-Agent': 'MCP-Search/1.0' },
            });
            if (response.ok) {
              data = await response.json();
              break;
            }
          } catch (e) {
            lastError = e.message;
          }
        }

        if (data && data.results && data.results.length > 0) {
          const text = data.results
            .slice(0, num)
            .map((item, i) => `${i + 1}. ${item.title}\n   ${item.link}\n   ${item.content || ''}`)
            .join('\n\n');
          result = { content: [{ type: 'text', text }] };
        } else if (data) {
          result = { content: [{ type: 'text', text: 'No results found.' }] };
        } else {
          result = {
            content: [{ type: 'text', text: `All instances failed. Last error: ${lastError}` }],
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
