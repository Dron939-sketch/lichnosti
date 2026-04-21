import 'dotenv/config';

const url = `${process.env.NEXT_PUBLIC_URL}/api/cron/generate-daily`;
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error('CRON_SECRET is not set');
  process.exit(1);
}

try {
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` }
  });
  const text = await r.text();
  console.log('status', r.status, text);
  if (!r.ok) process.exit(2);
} catch (e) {
  console.error('cron-daily failed:', e.message);
  process.exit(3);
}
