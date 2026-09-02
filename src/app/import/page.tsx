import { redirect } from "next/navigation";

import NodeImportClient from "@/components/node-import-client";
import { getSessionUserId } from "@/lib/auth";
import { listAlbums } from "@/lib/metadata-store";
import { isNodeMode } from "@/lib/self-hosted-nodes";

export const dynamic = "force-dynamic";

const NodeImportPage = async () => {
  if (!isNodeMode()) {
    redirect("/gallery");
  }
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/");
  }
  const albums = await listAlbums(userId);
  return (
    <NodeImportClient
      albums={albums.map((album) => ({ id: album.id, name: album.name }))}
    />
  );
};

export default NodeImportPage;
