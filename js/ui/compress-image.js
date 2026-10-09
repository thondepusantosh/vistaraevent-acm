// Shrinks a payment screenshot in the browser before upload: at most 1280px
// wide, re-encoded as JPEG, stepping quality (then size) down until it fits
// under ~1 MB. Screenshots are mostly flat UI, so this is usually 150-400 KB.

const MAX_WIDTH = 1280;
const TARGET_BYTES = 950 * 1024;

export class ImageReadError extends Error {}

async function decode(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to <img>, which handles a few more formats.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new ImageReadError("This image couldn't be opened. Take a regular screenshot (PNG or JPG) and try again.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toBlob = (canvas, quality) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageReadError("Couldn't process the image."))), "image/jpeg", quality),
  );

const toDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new ImageReadError("Couldn't read the image."));
    reader.readAsDataURL(blob);
  });

/** Returns { dataUrl, base64, mimeType, bytes, width, height }. */
export async function compressImage(file) {
  if (!file.type.startsWith("image/")) throw new ImageReadError("Choose an image file, like a screenshot of your payment.");
  if (file.size > 25 * 1024 * 1024) throw new ImageReadError("That image is over 25 MB. Choose a screenshot instead of a photo.");

  const source = await decode(file);
  const srcW = source.naturalWidth ?? source.width;
  const srcH = source.naturalHeight ?? source.height;
  let width = Math.min(MAX_WIDTH, srcW);

  for (let attempt = 0; attempt < 4; attempt++) {
    const height = Math.round((srcH * width) / srcW);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageReadError("Your browser couldn't process the image.");
    // JPEG has no alpha; paint white first so transparent PNGs don't turn black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);

    let blob = null;
    for (const q of [0.82, 0.7, 0.58]) {
      blob = await toBlob(canvas, q);
      if (blob.size <= TARGET_BYTES) break;
    }
    if (blob && blob.size <= TARGET_BYTES) {
      source.close?.();
      const dataUrl = await toDataUrl(blob);
      return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: "image/jpeg", bytes: blob.size, width, height };
    }
    width = Math.round(width * 0.75);
  }
  throw new ImageReadError("This image is too detailed to compress. Try a plain screenshot of the payment.");
}
