import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getAppSettings } from "@/lib/metadata-store"
import { isPublicBlobConfigured } from "@/lib/public-blob"
import UploadDropzone from "@/components/upload-dropzone"
import AlertBanner from "@/components/ui/alert-banner"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { SectionHeader } from "@/components/ui/section-header"

const UploadPage = async () => {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/")
  }

  const settings = await getAppSettings()

  return (
    <PageScaffold width="narrow">
      <SectionHeader
        title="upload"
        subtitle={`Logged in as ${session.user.email ?? "user"}.`}
      />

      {!settings.uploadsEnabled ? (
        <AlertBanner>Uploads are currently disabled by the administrator.</AlertBanner>
      ) : null}

      <UploadDropzone
        uploadsEnabled={settings.uploadsEnabled}
        resumableThresholdBytes={settings.resumableThresholdBytes}
        publicUploadsEnabled={isPublicBlobConfigured()}
      />
    </PageScaffold>
  )
}

export default UploadPage
