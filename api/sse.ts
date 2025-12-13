export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const encoder = new TextEncoder();
  let controller;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
      // Initial ready event
      controller.enqueue(encoder.encode('event: ready\ndata: {"service":"tax-intake-mcp-bridge-vercel-edge"}\n\n'));

      // Heartbeat pings
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {"ts": ${Date.now()}}\n\n`));
        } catch (e) {
          clearInterval(interval);
        }
      }, 25000);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
