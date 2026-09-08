export const minDenoisingStrength = 0.2;
export const maxDenoisingStrength = 0.9;
export const defaultDenoisingStrength = 0.5;
export const maxImageGenerationMaskChars = 2_000_000;
export const maxImageGenerationMaskBytes = 1_500_000;

export const denoisingStrengthLabel = (value: number) => {
  if (value <= 0.35) {
    return "subtle cleanup";
  }
  if (value <= 0.6) {
    return "substantial restyle";
  }
  return "mostly replace";
};

export const stripBase64Payload = (value: string) => {
  const trimmed = value.trim();
  const commaIndex = trimmed.indexOf(",");
  if (trimmed.toLowerCase().startsWith("data:") && commaIndex !== -1) {
    return trimmed.slice(commaIndex + 1);
  }
  return trimmed;
};

export const decodeImageGenerationMask = (value: string) => {
  const encoded = stripBase64Payload(value).replace(/\s+/g, "");
  if (!encoded) {
    throw new Error("Mask image is empty.");
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error("Mask image is not valid base64.");
  }

  const mask = Buffer.from(encoded, "base64");
  if (mask.length === 0) {
    throw new Error("Mask image is empty.");
  }
  if (mask.length > maxImageGenerationMaskBytes) {
    throw new Error("Mask image is too large.");
  }

  return { encoded, bytes: mask };
};

export const img2imgSourceExtensions = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "tiff",
]);

export const isImg2ImgSourceExtension = (ext: string) =>
  img2imgSourceExtensions.has(ext.trim().toLowerCase());

export const denoisingStrengthToPercent = (value: number) =>
  Math.round(value * 100);

export const denoisingPercentToStrength = (value: number) => value / 100;
