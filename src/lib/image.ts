/** Load a picked file as an image. */
function load(file: File) {
  const url = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => { res(i); URL.revokeObjectURL(url); }; i.onerror = rej; i.src = url; });
}

/** Shrink an image so pages stay fast on mobile data. Square crops centre; otherwise the shape is kept. */
async function shrinkTo(file: File, size: number, square: boolean) {
  const img = await load(file);
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  if (square) {
    c.width = c.height = size;
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  } else {
    const k = Math.min(1, size / Math.max(img.width, img.height));
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    ctx.drawImage(img, 0, 0, c.width, c.height);
  }
  return c;
}

/** A small square image kept inline (demo mode, or tiny thumbnails). */
export async function shrinkImage(file: File, size = 256): Promise<string> {
  return (await shrinkTo(file, size, true)).toDataURL("image/png");
}

/** Shrink then hand back a Blob, for uploading. */
export async function shrinkToBlob(file: File, size: number, square: boolean): Promise<Blob> {
  const c = await shrinkTo(file, size, square);
  return new Promise((res) => c.toBlob((b) => res(b!), "image/webp", 0.86));
}
