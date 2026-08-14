import {
  getAppSettings,
  getGroupLimits,
  getUserGroupInfo,
} from "@/lib/metadata-store";
import { withApiV1Route } from "@/lib/api-v1/handler";
import { apiV1Json } from "@/lib/api-v1/errors";
import { originFromRequest } from "@/lib/api-v1/resources";

export const runtime = "nodejs";

export const GET = withApiV1Route(async (request, auth) => {
  const origin = originFromRequest(request);
  const [settings, groupInfo] = await Promise.all([
    getAppSettings(),
    getUserGroupInfo(auth.userId),
  ]);
  const limits = await getGroupLimits(groupInfo.groupId);
  return apiV1Json({
    version: "1.0.0",
    docs: `${origin}/api/v1/docs`,
    openapi: `${origin}/api/v1/openapi.json`,
    uploadsEnabled: settings.uploadsEnabled,
    limits: {
      resumableThresholdBytes: settings.resumableThresholdBytes,
      maxImageSize: limits.maxImageSize,
      maxVideoSize: limits.maxVideoSize,
      maxDocumentSize: limits.maxDocumentSize,
      maxOtherSize: limits.maxOtherSize,
      maxFileSize: limits.maxFileSize,
      allowedTypes: limits.allowedTypes,
      rateLimitPerMinute: limits.rateLimitPerMinute,
    },
  });
});

export const OPTIONS = GET;
