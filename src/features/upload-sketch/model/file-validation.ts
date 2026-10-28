export const MAX_SKETCH_SIZE = 10 * 1024 * 1024;

const acceptedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const acceptedExtensions = /\.(jpe?g|png|webp)$/i;

export type SketchValidationResult =
  | { valid: true }
  | { valid: false; reason: "type" | "size" };

export function validateSketchFile(file: File, maxSize = MAX_SKETCH_SIZE): SketchValidationResult {
  const hasAcceptedType = acceptedMimeTypes.has(file.type);
  const hasAcceptedExtension = acceptedExtensions.test(file.name);

  if (!hasAcceptedType && !(file.type === "" && hasAcceptedExtension)) {
    return { valid: false, reason: "type" };
  }

  if (file.size > Math.min(MAX_SKETCH_SIZE, maxSize)) return { valid: false, reason: "size" };
  return { valid: true };
}
