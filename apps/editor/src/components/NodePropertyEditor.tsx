import {
  useEffect,
  useMemo,
  useState,
  type FormEvent
} from "react";

import type {
  FormulaNode
} from "../model/document";

import {
  getPropertyDefinitions,
  resolveNodeProperties,
  type FormulaProperties,
  type FormulaPropertyValue,
  type PropertyFieldDefinition
} from "../domain/properties";

interface NodePropertyEditorProps {
  node: FormulaNode;

  onCommit: (
    node: FormulaNode,
    properties: FormulaProperties
  ) => Promise<void>;
}

function valuesEqual(
  left: FormulaProperties,
  right: FormulaProperties
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function PropertyField({
  field,
  value,
  onChange
}: {
  field: PropertyFieldDefinition;
  value: FormulaPropertyValue;
  onChange: (value: FormulaPropertyValue) => void;
}) {
  if (field.editor === "boolean") {
    return (
      <label className="property-checkbox">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
        />

        <span>{field.label}</span>
      </label>
    );
  }

  if (field.editor === "textarea") {
    return (
      <label className="property-field">
        <span>{field.label}</span>

        <textarea
          value={String(value ?? "")}
          placeholder={field.placeholder}
          rows={3}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      </label>
    );
  }

  if (field.editor === "select") {
    return (
      <label className="property-field">
        <span>{field.label}</span>

        <select
          value={String(value ?? "")}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        >
          {(field.options ?? []).map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.editor === "number") {
    return (
      <label className="property-field">
        <span>{field.label}</span>

        <input
          type="number"
          value={
            typeof value === "number" ||
            typeof value === "string"
              ? value
              : ""
          }
          onChange={(event) => {
            const rawValue = event.target.value;

            onChange(
              rawValue === ""
                ? ""
                : Number(rawValue)
            );
          }}
        />
      </label>
    );
  }

  return (
    <label className="property-field">
      <span>{field.label}</span>

      <input
        type="text"
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </label>
  );
}

export function NodePropertyEditor({
  node,
  onCommit
}: NodePropertyEditorProps) {
  const definitions = useMemo(
    () =>
      getPropertyDefinitions(
        node.domain,
        node.kind
      ),
    [node.domain, node.kind]
  );

  const effectiveProperties = useMemo(
    () =>
      resolveNodeProperties(
        node.domain,
        node.kind,
        node.properties
      ),
    [
      node.domain,
      node.kind,
      node.properties
    ]
  );

  const [draft, setDraft] =
    useState<FormulaProperties>(
      effectiveProperties
    );

  const [isSaving, setIsSaving] =
    useState(false);

  useEffect(() => {
    setDraft(effectiveProperties);
  }, [effectiveProperties]);

  const dirty = !valuesEqual(
    draft,
    effectiveProperties
  );

  const setProperty = (
    key: string,
    value: FormulaPropertyValue
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!dirty || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      await onCommit(node, draft);
    } finally {
      setIsSaving(false);
    }
  };

  if (definitions.length === 0) {
    return null;
  }

  return (
    <form
      className="property-editor"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <div className="property-editor-heading">
        <div>
          <span className="eyebrow">
            Semantic formula
          </span>

          <strong>Properties</strong>
        </div>

        <span>
          {definitions.length}
        </span>
      </div>

      <div className="property-field-list">
        {definitions.map((field) => (
          <PropertyField
            key={field.key}
            field={field}
            value={
              draft[field.key] ??
              field.defaultValue
            }
            onChange={(value) => {
              setProperty(field.key, value);
            }}
          />
        ))}
      </div>

      <div className="property-editor-actions">
        <button
          type="button"
          disabled={!dirty || isSaving}
          onClick={() => {
            setDraft(effectiveProperties);
          }}
        >
          Reset
        </button>

        <button
          type="submit"
          className="property-apply"
          disabled={!dirty || isSaving}
        >
          {isSaving ? "Applying…" : "Apply"}
        </button>
      </div>
    </form>
  );
}
