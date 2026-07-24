import type { FormulaDomain } from "./palette";

export type PortDirection = "input" | "output";

export interface PortTemplate {
  key: string;
  label: string;
  direction: PortDirection;
  dataType: string;
}

const definitions: Record<string, PortTemplate[]> = {
  "core:input": [
    {
      key: "value-output",
      label: "Value",
      direction: "output",
      dataType: "core:any"
    }
  ],

  "core:transformation": [
    {
      key: "value-input",
      label: "Input",
      direction: "input",
      dataType: "core:any"
    },
    {
      key: "value-output",
      label: "Output",
      direction: "output",
      dataType: "core:any"
    }
  ],

  "core:output": [
    {
      key: "value-input",
      label: "Value",
      direction: "input",
      dataType: "core:any"
    }
  ],

  "core:authorization": [
    {
      key: "proposal-input",
      label: "Proposal",
      direction: "input",
      dataType: "core:proposal"
    },
    {
      key: "authorized-output",
      label: "Authorized",
      direction: "output",
      dataType: "core:authorized"
    }
  ],

  "core:obstruction": [
    {
      key: "candidate-input",
      label: "Candidate",
      direction: "input",
      dataType: "core:any"
    }
  ],

  "gravity:network": [
    {
      key: "network-output",
      label: "Network",
      direction: "output",
      dataType: "gravity:network"
    }
  ],

  "gravity:asset": [
    {
      key: "network-input",
      label: "Network",
      direction: "input",
      dataType: "gravity:network"
    },
    {
      key: "asset-output",
      label: "Asset",
      direction: "output",
      dataType: "gravity:asset"
    }
  ],

  "gravity:route": [
    {
      key: "asset-input",
      label: "Asset",
      direction: "input",
      dataType: "gravity:asset"
    },
    {
      key: "route-output",
      label: "Route",
      direction: "output",
      dataType: "gravity:route"
    }
  ],

  "gravity:environment-boundary": [
    {
      key: "route-input",
      label: "Route",
      direction: "input",
      dataType: "gravity:route"
    },
    {
      key: "environment-output",
      label: "Environment",
      direction: "output",
      dataType: "gravity:environment"
    }
  ],

  "gravity:transaction-preview": [
    {
      key: "environment-input",
      label: "Environment",
      direction: "input",
      dataType: "gravity:environment"
    }
  ],

  "ael:repository-event": [
    {
      key: "event-output",
      label: "Event",
      direction: "output",
      dataType: "ael:event"
    }
  ],

  "ael:evidence": [
    {
      key: "event-input",
      label: "Event",
      direction: "input",
      dataType: "ael:event"
    },
    {
      key: "evidence-output",
      label: "Evidence",
      direction: "output",
      dataType: "ael:evidence"
    }
  ],

  "ael:claim": [
    {
      key: "evidence-input",
      label: "Evidence",
      direction: "input",
      dataType: "ael:evidence"
    },
    {
      key: "claim-output",
      label: "Claim",
      direction: "output",
      dataType: "ael:claim"
    }
  ],

  "ael:approval": [
    {
      key: "claim-input",
      label: "Claim",
      direction: "input",
      dataType: "ael:claim"
    },
    {
      key: "authorized-output",
      label: "Authorized",
      direction: "output",
      dataType: "ael:authorized"
    }
  ],

  "ael:effect": [
    {
      key: "authorized-input",
      label: "Authorized",
      direction: "input",
      dataType: "ael:authorized"
    }
  ]
};

export function getPortTemplates(
  domain: FormulaDomain,
  kind: string
): PortTemplate[] {
  return definitions[`${domain}:${kind}`] ?? [];
}
