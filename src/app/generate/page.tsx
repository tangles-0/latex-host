import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { ImageGenerationStudio } from "@/components/image-generation-studio";
import { authOptions } from "@/lib/auth";
import { canUserGenerateImages } from "@/lib/image-generations/access";
import { isNodeMode } from "@/lib/self-hosted-nodes";

const GeneratePage = async () => {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect("/");
  }
  if (isNodeMode()) {
    redirect("/gallery");
  }

  const hasAccess = await canUserGenerateImages(userId);

  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
          Loading generator...
        </main>
      }
    >
      <ImageGenerationStudio hasAccess={hasAccess} />
    </Suspense>
  );
};

export default GeneratePage;
