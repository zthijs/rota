export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

export const lcm = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : Math.abs((a / gcd(a, b)) * b);
