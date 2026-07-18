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
        serverInfo: { name: 'tavily-mcp', version: '1.0.0' },
      };
      break;

    case 'notifications/initialized':
      return res.status(204).end();

    case 'tools/list':
      result = {
        tools: [
          {
            name: 'web_search',
            description: 'Search the web using Tavily. Returns titles, links, and snippets.',
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
          const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: process.env.TAVILY_API_KEY,
              query: query,
              max_results: num,
              include_answer: false,
            }),
          });

          const data = await response.json();

          if (data.results && data.results.length > 0) {
            const text = data.results
              .map((item, i) => `${i + 1}. ${item.title}\n   ${item.url}\n   ${item.content || ''}`)
              .join('\n\n');
            result = { content: [{ type: 'text', text }] };
          } else {
            result = { content: [{ type: 'text', text: data.error || 'No results found.' }] };
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
Elias is pig~
