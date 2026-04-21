import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
  tokensPerInterval: Number(process.env.DEEPSEEK_RPM || 10),
  interval: 'minute'
});

export async function throttle(cost = 1) {
  await limiter.removeTokens(cost);
}

export default limiter;
