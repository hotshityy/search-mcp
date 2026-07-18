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
          const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `q=${encodeURIComponent(query)}`,
          });

          const html = await response.text();

          // Parse results from DuckDuckGo HTML
          const results = [];
          const resultBlocks = html.split('class="result__body"');

          for (let i = 1; i < resultBlocks.length && results.length < num; i++) {
            const block = resultBlocks[i];

            // Extract title and link
            const linkMatch = block.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
            // Extract snippet
            const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|span|td)/);

            if (linkMatch) {
              let link = linkMatch[1];
              // DuckDuckGo wraps links in a redirect URL
              const uddgMatch = link.match(/uddg=([^&]*)/);
              if (uddgMatch) {
                link = decodeURIComponent(uddgMatch[1]);
              }

              const title = linkMatch[2].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim();
              const snippet = snippetMatch
                ? snippetMatch[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim()
                : '';

              if (title && link) {
                results.push({ title, link, snippet });
              }
            }
          }

          if (results.length > 0) {
            const text = results
              .map((item, i) => `${i + 1}. ${item.title}\n   ${item.link}\n   ${item.snippet}`)
              .join('\n\n');
            result = { content: [{ type: 'text', text }] };
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
