import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { generateConstrainedShareImageBuffer } from "@/lib/storage";

async function pngBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 80, b: 160 },
    },
  })
    .png()
    .toBuffer();
}

describe("generateConstrainedShareImageBuffer", () => {
  it("fits a landscape image inside 512x400 without changing aspect ratio", async () => {
    const source = await pngBuffer(1000, 800);
    const result = await generateConstrainedShareImageBuffer(source, "png");
    const metadata = await sharp(result).metadata();
    expect(metadata.width).toBe(500);
    expect(metadata.height).toBe(400);
  });

  it("fits a portrait image inside 512x400 without changing aspect ratio", async () => {
    const source = await pngBuffer(800, 1000);
    const result = await generateConstrainedShareImageBuffer(source, "png");
    const metadata = await sharp(result).metadata();
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(400);
  });

  it("does not enlarge images already within the box", async () => {
    const source = await pngBuffer(200, 100);
    const result = await generateConstrainedShareImageBuffer(source, "png");
    const metadata = await sharp(result).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(100);
  });

  it("keeps animated webp frames instead of flattening to the first frame", async () => {
    const source = Buffer.from(
      "UklGRsQAAABXRUJQVlA4WAoAAAACAAAADwAACwAAQU5JTQYAAAAAAAAAAABBTk1GSgAAAAAAAAAAAA8AAAsAAFAAAAJWUDggMgAAADABAJ0BKhAADAABQCYloAADcAD+8ut///mwP/bz/wR6Af//0uD//pcH//S4P/SkAAAAQU5NRkYAAAAAAAAAAAAPAAALAABQAAAAVlA4IC4AAAA0AQCdASoQAAwAAAAmJaAAA3AA/vtV4///S4P/+lwf/9Lg/9Lg//rV5Vesq6AA",
      "base64",
    );
    const sourceMeta = await sharp(source).metadata();
    expect(sourceMeta.pages).toBe(2);

    const flattened = await sharp(source).webp().toBuffer();
    expect((await sharp(flattened).metadata()).pages).toBeUndefined();

    const result = await generateConstrainedShareImageBuffer(source, "webp");
    const metadata = await sharp(result).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.pages).toBe(2);
    expect(metadata.width).toBe(16);
    expect(metadata.height).toBe(12);
  });
});
