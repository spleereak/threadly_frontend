export const MIN_RECOMMENDED_SIDE = 512;

export function needsSizeWarning(width: number, height: number, minSide = MIN_RECOMMENDED_SIDE): boolean {
  return Math.min(width, height) < minSide;
}

export async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    } catch {
      // Some browsers expose createImageBitmap but cannot decode a particular image with it.
    }
  }

  if (typeof Image === "undefined" || typeof URL.createObjectURL !== "function") return null;

  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}
