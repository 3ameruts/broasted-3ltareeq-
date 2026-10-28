import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { ticketSvg, WIDTH } from './ticket.mjs';

let ready = null;
// load the renderer once; assets come from the exe (or from disk when run with node)
export function initRenderer({ wasm, fonts }) {
  ready ??= initWasm(wasm).then(() => fonts);
  return ready;
}

export async function renderTicket(order) {
  const fonts = await ready;
  const { svg } = ticketSvg(order);
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH }, font: { fontBuffers: fonts, loadSystemFonts: false, defaultFontFamily: 'Readex Pro' } });
  const img = r.render();
  return { rgba: img.pixels, width: img.width, height: img.height, png: () => img.asPng() };
}
