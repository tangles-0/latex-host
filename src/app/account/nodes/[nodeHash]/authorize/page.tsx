import { redirect } from "next/navigation";

import NodeAuthorizeClient from "@/components/node-authorize-client";
import { getSessionUserId } from "@/lib/auth";
import { getSelfHostedNodeForUser } from "@/lib/self-hosted-nodes";

export const dynamic = "force-dynamic";

const NodeAuthorizePage = async ({
  params,
}: {
  params: Promise<{ nodeHash: string }>;
}) => {
  const userId = await getSessionUserId();
  const { nodeHash } = await params;
  if (!userId) {
    redirect(`/?node_authorize=${encodeURIComponent(nodeHash)}`);
  }
  const node = await getSelfHostedNodeForUser(nodeHash, userId);
  if (!node?.publicHttpsUrl) {
    redirect("/account");
  }
  return (
    <main className="page-scaffold page-scaffold-narrow">
      <NodeAuthorizeClient
        nodeHash={nodeHash}
        publicHttpsUrl={node.publicHttpsUrl}
      />
    </main>
  );
};

export default NodeAuthorizePage;
