import { GalleryPage } from "@/src/screens/gallery/ui/GalleryPage";
import { runtimeConfig } from "@/src/shared/config/runtime-config";
import { ApiModeGate } from "@/src/widgets/api-mode/ui/ApiModeGate";
import { ApiGalleryPage } from "@/src/screens/gallery/ui/ApiGalleryPage";

export default function GalleryRoute() {
  return runtimeConfig.mode === "api"
    ? <ApiModeGate config={runtimeConfig} screen="gallery"><ApiGalleryPage config={runtimeConfig} /></ApiModeGate>
    : <GalleryPage />;
}
