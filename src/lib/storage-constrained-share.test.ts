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
});
