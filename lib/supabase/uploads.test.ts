import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, sanitizeUploadFilename, validateUpload } from "./uploads";

describe("private upload validation", () => {
  it("accepts only the three configured image formats", () => {
    expect(validateUpload({ name: "map.webp", type: "image/webp", size: 1024 })).toMatchObject({
      type: "image/webp",
      size: 1024,
    });
    expect(() => validateUpload({ name: "map.svg", type: "image/svg+xml", size: 1024 })).toThrow();
  });

  it("rejects empty and oversized files", () => {
    expect(() => validateUpload({ name: "empty.png", type: "image/png", size: 0 })).toThrow();
    expect(() => validateUpload({ name: "large.jpg", type: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 })).toThrow();
  });

  it("removes path separators and control punctuation from object names", () => {
    expect(sanitizeUploadFilename("../账簿 / spring.png")).toBe("spring.png");
    expect(sanitizeUploadFilename("...")) .toBe("upload");
  });
});

