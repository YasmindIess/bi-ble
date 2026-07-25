import type {
  FormulaDomain
} from "./palette";

export type FormulaPropertyValue =
  | string
  | number
  | boolean;

export type FormulaProperties = Record<
  string,
  FormulaPropertyValue
>;

export type PropertyEditorKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "boolean"
  | "repository"
  | "revision";

export interface PropertyOption {
  value: string;
  label: string;
}

export interface PropertyFieldDefinition {
  key: string;
  label: string;
  editor: PropertyEditorKind;
  defaultValue: FormulaPropertyValue;
  placeholder?: string;
  options?: readonly PropertyOption[];
}

const environmentOptions: readonly PropertyOption[] = [
  {
    value: "unknown",
    label: "Unknown"
  },
  {
    value: "mainnet",
    label: "Mainnet"
  },
  {
    value: "testnet",
    label: "Testnet"
  },
  {
    value: "legacy",
    label: "Legacy"
  }
];

const definitions: Record<
  string,
  readonly PropertyFieldDefinition[]
> = {
  "core:input": [
    {
      key: "name",
      label: "Input name",
      editor: "text",
      defaultValue: "input"
    },
    {
      key: "valueType",
      label: "Value type",
      editor: "select",
      defaultValue: "unknown",
      options: [
        {
          value: "unknown",
          label: "Unknown"
        },
        {
          value: "string",
          label: "String"
        },
        {
          value: "number",
          label: "Number"
        },
        {
          value: "boolean",
          label: "Boolean"
        },
        {
          value: "json",
          label: "JSON"
        }
      ]
    },
    {
      key: "sampleValue",
      label: "Sample value",
      editor: "textarea",
      defaultValue: "",
      placeholder: "Optional representative value"
    }
  ],

  "core:transformation": [
    {
      key: "operation",
      label: "Operation",
      editor: "select",
      defaultValue: "map",
      options: [
        {
          value: "map",
          label: "Map"
        },
        {
          value: "filter",
          label: "Filter"
        },
        {
          value: "reduce",
          label: "Reduce"
        },
        {
          value: "validate",
          label: "Validate"
        },
        {
          value: "adapt",
          label: "Adapt"
        }
      ]
    },
    {
      key: "expression",
      label: "Formula",
      editor: "textarea",
      defaultValue: "",
      placeholder: "Describe the transformation"
    }
  ],

  "core:output": [
    {
      key: "name",
      label: "Output name",
      editor: "text",
      defaultValue: "output"
    },
    {
      key: "format",
      label: "Format",
      editor: "select",
      defaultValue: "json",
      options: [
        {
          value: "json",
          label: "JSON"
        },
        {
          value: "text",
          label: "Text"
        },
        {
          value: "receipt",
          label: "Receipt"
        },
        {
          value: "preview",
          label: "Preview"
        }
      ]
    }
  ],

  "core:authorization": [
    {
      key: "authorityMode",
      label: "Authority mode",
      editor: "select",
      defaultValue: "human_review",
      options: [
        {
          value: "simulation_only",
          label: "Simulation only"
        },
        {
          value: "human_review",
          label: "Human review"
        },
        {
          value: "effect_request",
          label: "Effect request"
        }
      ]
    },
    {
      key: "authorized",
      label: "Authorized",
      editor: "boolean",
      defaultValue: false
    }
  ],

  "core:obstruction": [
    {
      key: "code",
      label: "Obstruction code",
      editor: "text",
      defaultValue: "unclassified"
    },
    {
      key: "severity",
      label: "Severity",
      editor: "select",
      defaultValue: "blocking",
      options: [
        {
          value: "info",
          label: "Information"
        },
        {
          value: "warning",
          label: "Warning"
        },
        {
          value: "blocking",
          label: "Blocking"
        }
      ]
    },
    {
      key: "message",
      label: "Message",
      editor: "textarea",
      defaultValue: ""
    }
  ],

  "gravity:network": [
    {
      key: "networkName",
      label: "Network name",
      editor: "text",
      defaultValue: "Unknown network"
    },
    {
      key: "chainId",
      label: "Chain ID",
      editor: "number",
      defaultValue: 0
    },
    {
      key: "environment",
      label: "Environment",
      editor: "select",
      defaultValue: "unknown",
      options: environmentOptions
    }
  ],

  "gravity:asset": [
    {
      key: "symbol",
      label: "Asset symbol",
      editor: "text",
      defaultValue: "G"
    },
    {
      key: "assetClass",
      label: "Asset class",
      editor: "select",
      defaultValue: "unknown",
      options: [
        {
          value: "unknown",
          label: "Unknown"
        },
        {
          value: "native",
          label: "Native"
        },
        {
          value: "erc20",
          label: "ERC-20"
        },
        {
          value: "test-token",
          label: "Test token"
        }
      ]
    },
    {
      key: "valueStatus",
      label: "Value status",
      editor: "select",
      defaultValue: "unknown",
      options: [
        {
          value: "unknown",
          label: "Unknown"
        },
        {
          value: "live-value",
          label: "Live value"
        },
        {
          value: "test-only",
          label: "Test only"
        }
      ]
    }
  ],

  "gravity:route": [
    {
      key: "routeKind",
      label: "Route kind",
      editor: "select",
      defaultValue: "unknown",
      options: [
        {
          value: "unknown",
          label: "Unknown"
        },
        {
          value: "canonical",
          label: "Canonical bridge"
        },
        {
          value: "aggregator",
          label: "Aggregator"
        },
        {
          value: "faucet",
          label: "Faucet"
        },
        {
          value: "manual",
          label: "Manual"
        }
      ]
    },
    {
      key: "sourceNetwork",
      label: "Source network",
      editor: "text",
      defaultValue: ""
    },
    {
      key: "targetNetwork",
      label: "Target network",
      editor: "text",
      defaultValue: ""
    }
  ],

  "gravity:environment-boundary": [
    {
      key: "sourceEnvironment",
      label: "Source environment",
      editor: "select",
      defaultValue: "unknown",
      options: environmentOptions
    },
    {
      key: "targetEnvironment",
      label: "Target environment",
      editor: "select",
      defaultValue: "unknown",
      options: environmentOptions
    },
    {
      key: "crossesValueBoundary",
      label: "Crosses value boundary",
      editor: "boolean",
      defaultValue: false
    }
  ],

  "gravity:transaction-preview": [
    {
      key: "amount",
      label: "Amount",
      editor: "number",
      defaultValue: 0
    },
    {
      key: "recipient",
      label: "Recipient",
      editor: "text",
      defaultValue: ""
    },
    {
      key: "executionMode",
      label: "Execution mode",
      editor: "select",
      defaultValue: "simulation_only",
      options: [
        {
          value: "simulation_only",
          label: "Simulation only"
        }
      ]
    }
  ],

  "ael:repository-event": [
    {
      key: "eventType",
      label: "Event type",
      editor: "select",
      defaultValue: "push",
      options: [
        {
          value: "push",
          label: "Push"
        },
        {
          value: "pull_request",
          label: "Pull request"
        },
        {
          value: "release",
          label: "Release"
        },
        {
          value: "workflow",
          label: "Workflow"
        },
        {
          value: "issue",
          label: "Issue"
        }
      ]
    },
    {
      key: "repository",
      label: "Repository",
      editor: "repository",
      defaultValue: ""
    },
    {
      key: "revision",
      label: "Commit or revision",
      editor: "revision",
      defaultValue: ""
    }
  ],

  "ael:evidence": [
    {
      key: "evidenceType",
      label: "Evidence type",
      editor: "select",
      defaultValue: "diff",
      options: [
        {
          value: "diff",
          label: "Diff"
        },
        {
          value: "test",
          label: "Test"
        },
        {
          value: "screenshot",
          label: "Screenshot"
        },
        {
          value: "log",
          label: "Log"
        },
        {
          value: "architecture",
          label: "Architecture"
        }
      ]
    },
    {
      key: "sourceRef",
      label: "Source reference",
      editor: "text",
      defaultValue: ""
    },
    {
      key: "verified",
      label: "Verified",
      editor: "boolean",
      defaultValue: false
    }
  ],

  "ael:claim": [
    {
      key: "claimClass",
      label: "Claim class",
      editor: "select",
      defaultValue: "unclassified",
      options: [
        {
          value: "unclassified",
          label: "Unclassified"
        },
        {
          value: "fact",
          label: "Fact"
        },
        {
          value: "interpretation",
          label: "Interpretation"
        },
        {
          value: "aspiration",
          label: "Aspiration"
        }
      ]
    },
    {
      key: "statement",
      label: "Statement",
      editor: "textarea",
      defaultValue: ""
    },
    {
      key: "confidence",
      label: "Confidence",
      editor: "number",
      defaultValue: 0
    }
  ],

  "ael:approval": [
    {
      key: "decision",
      label: "Decision",
      editor: "select",
      defaultValue: "pending",
      options: [
        {
          value: "pending",
          label: "Pending"
        },
        {
          value: "approved",
          label: "Approved"
        },
        {
          value: "rejected",
          label: "Rejected"
        },
        {
          value: "held",
          label: "Held"
        }
      ]
    },
    {
      key: "reviewer",
      label: "Reviewer",
      editor: "text",
      defaultValue: ""
    }
  ],

  "ael:effect": [
    {
      key: "channel",
      label: "Channel",
      editor: "select",
      defaultValue: "manual",
      options: [
        {
          value: "manual",
          label: "Manual export"
        },
        {
          value: "github",
          label: "GitHub"
        },
        {
          value: "email",
          label: "Email"
        },
        {
          value: "slack",
          label: "Slack"
        }
      ]
    },
    {
      key: "authorized",
      label: "Authorized",
      editor: "boolean",
      defaultValue: false
    }
  ]
};

function definitionKey(
  domain: FormulaDomain,
  kind: string
): string {
  return `${domain}:${kind}`;
}

export function getPropertyDefinitions(
  domain: FormulaDomain,
  kind: string
): readonly PropertyFieldDefinition[] {
  return definitions[definitionKey(domain, kind)] ?? [];
}

export function createDefaultProperties(
  domain: FormulaDomain,
  kind: string
): FormulaProperties {
  return Object.fromEntries(
    getPropertyDefinitions(domain, kind).map(
      (field) => [
        field.key,
        field.defaultValue
      ]
    )
  );
}

export function resolveNodeProperties(
  domain: FormulaDomain,
  kind: string,
  storedProperties?: FormulaProperties
): FormulaProperties {
  return {
    ...createDefaultProperties(domain, kind),
    ...(storedProperties ?? {})
  };
}

export function canonicalizeProperties(
  domain: FormulaDomain,
  kind: string,
  storedProperties?: FormulaProperties
): FormulaProperties {
  return Object.fromEntries(
    Object.entries(
      resolveNodeProperties(
        domain,
        kind,
        storedProperties
      )
    ).sort(([left], [right]) =>
      left.localeCompare(right)
    )
  );
}
