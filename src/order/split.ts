// A line's price split into the item itself and each add-on (all times the line quantity), so customers and staff see what each costs
export function splitLine(lineTotal: number, qty: number, options: { name: string; qty: number; price?: number }[]) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const extras = options.map(o => ({ name: o.name, qty: o.qty, total: r2(Number(o.price ?? 0) * o.qty * qty) }));
  return { base: r2(Number(lineTotal) - extras.reduce((s, e) => s + e.total, 0)), extras };
}
