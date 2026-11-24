import type { NextRequest } from "next/server";

import { OPTIONS, servePublicShare } from "@/app/share/[fileName]/route";
import { getFileSharePath } from "@/lib/media-store";
import { splitFileName } from "@/lib/media-types";

export const runtime = "nodejs";
export { OPTIONS };

const SIZE_SUFFIX = {
  original: "",
  sm: "-sm",
  lg: "-lg",
  x640: "-640",
  x512: "-512",
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> },
): Promise<Response> {
  const { fileName } = await params;
  const [sharePath, split] = await Promise.all([
    getFileSharePath(fileName),
    Promise.resolve(splitFileName(fileName)),
  ]);
  if (!sharePath || !split) {
    return new Response("Not found", { status: 404 });
  }
  const internalFileName = `${sharePath.code}${SIZE_SUFFIX[sharePath.size]}.${split.ext}`;
  return servePublicShare(request, internalFileName, {
    allowFileNameShare: true,
    requestedFileName: fileName,
  });
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ fileName: string }> },
): Promise<Response> {
  return GET(request, context);
}
