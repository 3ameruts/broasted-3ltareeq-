// RGBA pixels -> ESC/POS raster commands (GS v 0), sent in bands so small printer buffers keep up.
export function rasterCommands(rgba, width, height) {
  const bytesPerRow = Math.ceil(width / 8);
  const chunks = [Buffer.from([0x1b, 0x40])]; // ESC @ reset
  const BAND = 128;
  for (let top = 0; top < height; top += BAND) {
    const rows = Math.min(BAND, height - top);
    const data = Buffer.alloc(bytesPerRow * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < width; x++) {
      const i = ((top + y) * width + x) * 4;
      const lum = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      if (rgba[i + 3] > 127 && lum < 150) data[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
    chunks.push(Buffer.from([0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, rows & 0xff, rows >> 8]), data);
  }
  chunks.push(Buffer.from([0x1b, 0x64, 0x04]), Buffer.from([0x1d, 0x56, 0x42, 0x00])); // feed 4 lines, partial cut
  return Buffer.concat(chunks);
}
