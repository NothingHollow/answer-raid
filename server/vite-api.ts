import type { Plugin } from 'vite';
import { handleApi } from './api.ts';

/** Same handler in Vite development and Vercel production. */
export function raidApi(): Plugin {
  return {
    name: 'raid-api',
    configureServer(server) {
      server.middlewares.use('/api/raid', async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 4096) { res.writeHead(413); res.end(); return; }
            chunks.push(Buffer.from(chunk));
          }
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value);
          }
          const request = new Request(`http://${req.headers.host}/api/raid${req.url ?? ''}`, {
            method: req.method, headers,
            ...(req.method === 'POST' ? { body: Buffer.concat(chunks).toString('utf8') } : {}),
          });
          const result = await handleApi(request);
          res.writeHead(result.status, Object.fromEntries(result.headers));
          res.end(await result.text());
        } catch { res.writeHead(500); res.end('{"error":"unavailable"}'); }
      });
    },
  };
}
