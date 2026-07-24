export type FormulaDomain = "core" | "gravity" | "ael";

export interface PaletteItem {
  id: string;
  label: string;
  kind: string;
  domain: FormulaDomain;
}

export interface PaletteGroup {
  id: FormulaDomain;
  label: string;
  items: PaletteItem[];
}

export const paletteGroups: PaletteGroup[] = [
  {
    id: "core",
    label: "Core",
    items: [
      {
        id: "core-input",
        label: "Input",
        kind: "input",
        domain: "core"
      },
      {
        id: "core-transformation",
        label: "Transformation",
        kind: "transformation",
        domain: "core"
      },
      {
        id: "core-output",
        label: "Output",
        kind: "output",
        domain: "core"
      },
      {
        id: "core-authorization",
        label: "Authorization",
        kind: "authorization",
        domain: "core"
      },
      {
        id: "core-obstruction",
        label: "Obstruction",
        kind: "obstruction",
        domain: "core"
      }
    ]
  },
  {
    id: "gravity",
    label: "Gravity",
    items: [
      {
        id: "gravity-network",
        label: "Network",
        kind: "network",
        domain: "gravity"
      },
      {
        id: "gravity-asset",
        label: "Asset",
        kind: "asset",
        domain: "gravity"
      },
      {
        id: "gravity-route",
        label: "Route",
        kind: "route",
        domain: "gravity"
      },
      {
        id: "gravity-boundary",
        label: "Environment boundary",
        kind: "environment-boundary",
        domain: "gravity"
      },
      {
        id: "gravity-preview",
        label: "Transaction preview",
        kind: "transaction-preview",
        domain: "gravity"
      }
    ]
  },
  {
    id: "ael",
    label: "AEL",
    items: [
      {
        id: "ael-event",
        label: "Repository event",
        kind: "repository-event",
        domain: "ael"
      },
      {
        id: "ael-evidence",
        label: "Evidence",
        kind: "evidence",
        domain: "ael"
      },
      {
        id: "ael-claim",
        label: "Claim",
        kind: "claim",
        domain: "ael"
      },
      {
        id: "ael-approval",
        label: "Approval",
        kind: "approval",
        domain: "ael"
      },
      {
        id: "ael-effect",
        label: "Effect",
        kind: "effect",
        domain: "ael"
      }
    ]
  }
];
