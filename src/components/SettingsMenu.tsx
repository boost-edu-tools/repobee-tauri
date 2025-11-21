import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import type { GuiSettings } from "../types/settings";
import "./SettingsMenu.css";

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: GuiSettings;
  onSettingsLoaded: (settings: GuiSettings) => void;
  onMessage: (message: string) => void;
}

export function SettingsMenu({
  isOpen,
  onClose,
  currentSettings,
  onSettingsLoaded,
  onMessage,
}: SettingsMenuProps) {
  const [settingsPath, setSettingsPath] = useState<string>("");
  const [schemaVisible, setSchemaVisible] = useState(false);
  const [schema, setSchema] = useState<any>(null);

  // Load current settings path when menu opens
  const loadSettingsPath = async () => {
    try {
      const path = await invoke<string>("get_settings_path");
      setSettingsPath(path);
    } catch (error) {
      console.error("Failed to get settings path:", error);
    }
  };

  // Load settings path when menu opens
  if (isOpen && !settingsPath) {
    loadSettingsPath();
  }

  const handleImport = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [
          { name: "JSON Files", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (filePath && typeof filePath === "string") {
        const settings = await invoke<GuiSettings>("import_settings", {
          path: filePath,
        });
        onSettingsLoaded(settings);
        onMessage(`✓ Settings imported from: ${filePath}`);
        await loadSettingsPath(); // Update displayed path
        onClose();
      }
    } catch (error) {
      onMessage(`✗ Failed to import settings: ${error}`);
    }
  };

  const handleExport = async () => {
    try {
      const filePath = await save({
        filters: [
          { name: "JSON Files", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] },
        ],
        defaultPath: "repobee-settings.json",
      });

      if (filePath) {
        await invoke("export_settings", {
          settings: currentSettings,
          path: filePath,
        });
        onMessage(`✓ Settings exported to: ${filePath}`);
      }
    } catch (error) {
      onMessage(`✗ Failed to export settings: ${error}`);
    }
  };

  const handleReset = async () => {
    if (
      !confirm(
        "Are you sure you want to reset all settings to defaults?\nThis cannot be undone."
      )
    ) {
      return;
    }

    try {
      const settings = await invoke<GuiSettings>("reset_settings");
      onSettingsLoaded(settings);
      onMessage("✓ Settings reset to defaults");
      await loadSettingsPath();
      onClose();
    } catch (error) {
      onMessage(`✗ Failed to reset settings: ${error}`);
    }
  };

  const handleResetLocation = async () => {
    if (
      !confirm(
        "Reset settings file location to default?\nCurrent settings will be preserved."
      )
    ) {
      return;
    }

    try {
      const newPath = await invoke<string>("reset_settings_location");
      setSettingsPath(newPath);
      onMessage(`✓ Settings location reset to: ${newPath}`);
    } catch (error) {
      onMessage(`✗ Failed to reset location: ${error}`);
    }
  };

  const handleViewSchema = async () => {
    if (!schema) {
      try {
        const schemaData = await invoke<any>("get_settings_schema");
        setSchema(schemaData);
      } catch (error) {
        onMessage(`✗ Failed to load schema: ${error}`);
        return;
      }
    }
    setSchemaVisible(!schemaVisible);
  };

  const handleCopyPath = () => {
    if (settingsPath) {
      navigator.clipboard.writeText(settingsPath);
      onMessage("✓ Path copied to clipboard");
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="settings-menu-overlay" onClick={onClose}>
      <div className="settings-menu" onClick={(e) => e.stopPropagation()}>
        <div className="settings-menu-header">
          <h2>Settings Management</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="settings-menu-content">
          {/* Current Settings File */}
          <section className="settings-section">
            <h3>Current Settings File</h3>
            <div className="settings-path-display">
              <input
                type="text"
                value={settingsPath}
                readOnly
                className="path-input"
              />
              <button className="btn-small" onClick={handleCopyPath}>
                Copy
              </button>
            </div>
          </section>

          {/* Import/Export */}
          <section className="settings-section">
            <h3>Import / Export</h3>
            <div className="button-group">
              <button className="btn-action" onClick={handleImport}>
                Import Settings...
              </button>
              <button className="btn-action" onClick={handleExport}>
                Export Settings...
              </button>
            </div>
            <p className="help-text">
              Import settings from a JSON file or export current settings to share or backup.
            </p>
          </section>

          {/* Reset */}
          <section className="settings-section">
            <h3>Reset</h3>
            <div className="button-group">
              <button className="btn-action btn-warning" onClick={handleReset}>
                Reset to Defaults
              </button>
              <button className="btn-action" onClick={handleResetLocation}>
                Reset Location
              </button>
            </div>
            <p className="help-text">
              Reset all settings to default values or reset the settings file location.
            </p>
          </section>

          {/* Schema (Advanced) */}
          <section className="settings-section">
            <h3>Advanced</h3>
            <button className="btn-action" onClick={handleViewSchema}>
              {schemaVisible ? "Hide" : "View"} JSON Schema
            </button>
            {schemaVisible && schema && (
              <pre className="schema-display">
                {JSON.stringify(schema, null, 2)}
              </pre>
            )}
            <p className="help-text">
              View the JSON schema for settings validation and documentation.
            </p>
          </section>
        </div>

        <div className="settings-menu-footer">
          <button className="btn-action" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
