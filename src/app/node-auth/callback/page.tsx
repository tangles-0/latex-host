import { redirect } from "next/navigation";

import NodeLoginCallback from "@/components/node-login-callback";
import { isNodeMode } from "@/lib/self-hosted-nodes";

export const dynamic = "force-dynamic";

const NodeAuthCallbackPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; node?: string }>;
}) => {
  if (!isNodeMode()) {
    redirect("/");
  }
  const { code, node } = await searchParams;
  if (!code || !node) {
    redirect("/");
  }
  return (
    <main className="page-scaffold page-scaffold-narrow">
      <NodeLoginCallback code={code} nodeHash={node} />
    </main>
  );
};

export default NodeAuthCallbackPage;
