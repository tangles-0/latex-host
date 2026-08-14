import { listAlbums } from "@/lib/metadata-store";
import { withApiV1Route } from "@/lib/api-v1/handler";
import { apiV1Json } from "@/lib/api-v1/errors";

export const runtime = "nodejs";

export const GET = withApiV1Route(async (_request, auth) => {
  const albums = await listAlbums(auth.userId);
  return apiV1Json({
    albums: albums.map((album) => ({
      id: album.id,
      name: album.name,
      createdAt: album.createdAt,
    })),
  });
});

export const OPTIONS = GET;
