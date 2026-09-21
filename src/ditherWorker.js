import DitherJS from 'ditherjs';

// Runs the same brighten + Atkinson-dither pass footerArt.js used to run
// synchronously on the main thread. It's pure pixel math with no DOM
// dependency once the source image is decoded, so it belongs off-thread:
// each pass took 400ms+ inline and froze everything else (including the
// loading timer) for its whole duration.
function brightenGrayscale(imageData, gamma) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = 255 * Math.pow(luma / 255, gamma);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
}

self.onmessage = async ({ data }) => {
  const { id, url, width, gamma, step, palette } = data;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const height = Math.round(width * (bitmap.height / bitmap.width));

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    brightenGrayscale(imageData, gamma);
    new DitherJS({ algorithm: 'atkinson', step, palette }).ditherImageData(imageData);

    self.postMessage({ id, width, height, buffer: imageData.data.buffer }, [imageData.data.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
