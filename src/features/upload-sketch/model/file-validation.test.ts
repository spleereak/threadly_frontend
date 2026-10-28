import { describe, expect, it, vi } from "vitest";
import {
  MAX_SKETCH_SIZE,
  validateSketchFile,
} from "./file-validation";
import { needsSizeWarning, readImageDimensions } from "./image-dimensions";
import { formatFileSize } from "./format-file-size";

describe("validateSketchFile", () => {
  it.each([
    ["sketch.jpg", "image/jpeg"],
    ["sketch.png", "image/png"],
    ["sketch.webp", "image/webp"],
  ])("accepts %s", (name, type) => {
    expect(validateSketchFile(new File(["image"], name, { type }))).toEqual({ valid: true });
  });

  it("accepts a supported extension when the browser leaves MIME type empty", () => {
    expect(validateSketchFile(new File(["image"], "sketch.webp"))).toEqual({ valid: true });
  });

  it("rejects unsupported formats", () => {
    expect(validateSketchFile(new File(["document"], "notes.pdf", { type: "application/pdf" }))).toEqual({
      valid: false,
      reason: "type",
    });
  });

  it("accepts files up to and including 10 MB and rejects larger files", () => {
    const allowed = new File([new Uint8Array(MAX_SKETCH_SIZE)], "large.png", { type: "image/png" });
    const tooLarge = new File([new Uint8Array(MAX_SKETCH_SIZE + 1)], "too-large.png", { type: "image/png" });

    expect(validateSketchFile(allowed)).toEqual({ valid: true });
    expect(validateSketchFile(tooLarge)).toEqual({ valid: false, reason: "size" });
  });
});

describe("image size helpers", () => {
  it("warns when the shorter side is below 512 pixels", () => {
    expect(needsSizeWarning(1000, 511)).toBe(true);
    expect(needsSizeWarning(512, 900)).toBe(false);
  });

  it("formats image file sizes for display", () => {
    expect(formatFileSize(1)).toBe("1 КБ");
    expect(formatFileSize(1024 * 1024)).toBe("1,0 МБ");
  });

  it("falls back to the Image decoder when createImageBitmap rejects a valid image", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("Decode unsupported")));
    const imageInstances: Array<{ naturalWidth: number; naturalHeight: number; onload: (() => void) | null; onerror: (() => void) | null; src: string }> = [];
    vi.stubGlobal("Image", class {
      naturalWidth = 320;
      naturalHeight = 640;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private source = "";
      constructor() { imageInstances.push(this); }
      set src(value: string) { this.source = value; queueMicrotask(() => this.onload?.()); }
      get src() { return this.source; }
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fallback");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    await expect(readImageDimensions(new File(["image"], "sketch.png", { type: "image/png" }))).resolves.toEqual({ width: 320, height: 640 });
    expect(imageInstances).toHaveLength(1);
    expect(revoke).toHaveBeenCalledWith("blob:fallback");
    vi.unstubAllGlobals();
  });
});
