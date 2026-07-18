export default async function handler(req, res) {
  // CORS
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
        serverInfo: { name: 'google-search-mcp', version: '1.0.0' },
      };
      break;

    case 'notifications/initialized':
      return res.status(204).end();

    case 'tools/list':
      result = {
        tools: [
          {
            name: 'google_search',
            description: 'Search the web using Google. Returns titles, links, and snippets.',
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
      if (params.name === 'google_search') {
        const query = params.arguments.query;
        const num = params.arguments.num || 5;

        try {
          const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CX}&q=${encodeURIComponent(query)}&num=${num}`;
          const response = await fetch(url);
          const data = await response.json();

          if (data.error) {
            result = {
              content: [{ type: 'text', text: `Error: ${data.error.message}` }],
              isError: true,
            };
          } else if (data.items && data.items.length > 0) {
            const text = data.items
              .map((item, i) => `${i + 1}. ${item.title}\n   ${item.link}\n   ${item.snippet || ''}`)
              .join('\n\n');
            result = { content: [{ type: 'text', text }] };
          } else {
            result = { content: [{ type: 'text', text: 'No results found.' }] };
          }
        } catch (e) {
          result = {
            content: [{ type: 'text', text: `Fetch error: ${e.message}` }],
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
