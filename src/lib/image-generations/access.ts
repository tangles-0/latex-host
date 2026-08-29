import { getGroupLimits, getUserGroupInfo } from "@/lib/metadata-store";

export const canUserGenerateImages = async (userId: string) => {
  const groupInfo = await getUserGroupInfo(userId);
  const limits = await getGroupLimits(groupInfo.groupId);
  return limits.imageGenerationEnabled;
};
