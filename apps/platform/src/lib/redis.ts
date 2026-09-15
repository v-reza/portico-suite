import { createConnection } from 'node:net';

/**
 * Minimal RESP client over `node:net` — no `redis`/`ioredis` dependency.
 *
 * The suite already probes Redis this way (apps/hub/src/app/ready/route.ts),
 * and the commands we need (INCR/EXPIRE/TTL/DEL/SET) are four RESP types, so a
 * driver would be more surface area than the whole call site.
 *
 * One connection per command: the volume here is login attempts, and a fresh
 * socket cannot go stale between calls. Every command has a 2s deadline so a
 * hung Redis can never pin a request open.
 */
export async function redis(...args: (string | number)[]): Promise<string | number | null> {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL not configured');

  const target = new URL(url);
  const payload =
    `*${args.length}\r\n` +
    args
      .map((a) => {
        const s = String(a);
        return `$${Buffer.byteLength(s)}\r\n${s}\r\n`;
      })
      .join('');

  return new Promise((resolve, reject) => {
    const sock = createConnection({ host: target.hostname, port: Number(target.port || 6379) });
    let buf = '';
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      sock.destroy();
      fn();
    };

    sock.setTimeout(2000);
    sock.on('connect', () => sock.write(payload));
    sock.on('timeout', () => finish(() => reject(new Error('redis timeout'))));
    sock.on('error', (e) => finish(() => reject(e)));
    sock.on('data', (d) => {
      buf += d.toString();
      const eol = buf.indexOf('\r\n');
      if (eol === -1) return;
      const kind = buf[0];
      const rest = buf.slice(1, eol);
      if (kind === '+') return finish(() => resolve(rest));
      if (kind === ':') return finish(() => resolve(Number(rest)));
      if (kind === '-') return finish(() => reject(new Error(rest)));
      if (kind !== '$') return finish(() => reject(new Error(`unexpected RESP reply: ${buf.slice(0, 32)}`)));
      if (rest === '-1') return finish(() => resolve(null));
      const start = eol + 2;
      const end = start + Number(rest);
      // A bulk string can arrive split across packets — wait for the whole body.
      if (buf.length < end + 2) return;
      finish(() => resolve(buf.slice(start, end)));
    });
  });
}
