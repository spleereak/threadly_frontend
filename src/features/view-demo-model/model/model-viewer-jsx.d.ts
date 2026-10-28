import type { ModelViewerElement } from "@google/model-viewer";
import type * as React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<ModelViewerElement>, ModelViewerElement> & {
        "camera-controls"?: boolean;
        "touch-action"?: string;
        "shadow-intensity"?: string;
        exposure?: number;
        "environment-image"?: string;
      };
    }
  }
}
