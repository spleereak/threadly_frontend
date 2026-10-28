import { CreateWorkspace } from "@/src/widgets/create-workspace/ui/CreateWorkspace";
import { runtimeConfig } from "@/src/shared/config/runtime-config";
import { ApiModeGate } from "@/src/widgets/api-mode/ui/ApiModeGate";
import { ApiCreateWorkspace } from "@/src/widgets/api-create-workspace/ui/ApiCreateWorkspace";

export function CreatePage() {
  return runtimeConfig.mode === "api"
    ? <ApiModeGate config={runtimeConfig} screen="create"><ApiCreateWorkspace config={runtimeConfig} /></ApiModeGate>
    : <CreateWorkspace />;
}
