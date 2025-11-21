import { useState, useRef, useEffect } from "react";
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
  const [profiles, setProfiles] = useState<string[]>([]);
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState<string>("");
  const schemaRef = useRef<HTMLPreElement>(null);

  // Auto-scroll to schema when it becomes visible
  useEffect(() => {
    if (schemaVisible && schemaRef.current) {
      schemaRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [schemaVisible]);

  // Load current settings path when menu opens
  const loadSettingsPath = async () => {
    try {
      const path = await invoke<string>("get_settings_path");
      setSettingsPath(path);
    } catch (error) {
      console.error("Failed to get settings path:", error);
    }
  };

  // Load profiles and active profile
  const loadProfiles = async () => {
    try {
      const profileList = await invoke<string[]>("list_profiles");
      setProfiles(profileList);
      const active = await invoke<string | null>("get_active_profile");
      setActiveProfile(active);
    } catch (error) {
      console.error("Failed to load profiles:", error);
    }
  };

  // Load settings path and profiles when menu opens
  if (isOpen && !settingsPath) {
    loadSettingsPath();
    loadProfiles();
  }

  const handleLoadProfile = async (name: string) => {
    try {
      const settings = await invoke<GuiSettings>("load_profile", { name });
      onSettingsLoaded(settings);
      setActiveProfile(name);
      onMessage(`✓ Loaded profile: ${name}`);
    } catch (error) {
      onMessage(`✗ Failed to load profile: ${error}`);
    }
  };

  const handleSaveAsProfile = async () => {
    if (!newProfileName.trim()) {
      onMessage("✗ Please enter a profile name");
      return;
    }
    try {
      await invoke("save_profile", { name: newProfileName, settings: currentSettings });
      onMessage(`✓ Saved profile: ${newProfileName}`);
      setNewProfileName("");
      await loadProfiles();
    } catch (error) {
      onMessage(`✗ Failed to save profile: ${error}`);
    }
  };

  const handleDeleteProfile = async (name: string) => {
    if (!confirm(`Delete profile "${name}"?`)) return;
    try {
      await invoke("delete_profile", { name });
      onMessage(`✓ Deleted profile: ${name}`);
      await loadProfiles();
    } catch (error) {
      onMessage(`✗ Failed to delete profile: ${error}`);
    }
  };

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
        setSchemaVisible(true); // Show immediately after loading
        return; // Don't toggle below
      } catch (error) {
        onMessage(`✗ Failed to load schema: ${error}`);
        return;
      }
    }
    // Schema already loaded, just toggle visibility
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
          {/* Configuration Profiles */}
          <section className="settings-section">
            <h3>Configuration Profiles</h3>
            {profiles.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "12px" }}>
                  Active Profile: <strong>{activeProfile || "None"}</strong>
                </label>
                <select
                  value={activeProfile || ""}
                  onChange={(e) => handleLoadProfile(e.target.value)}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                >
                  <option value="">-- Select Profile --</option>
                  {profiles.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <input
                type="text"
                placeholder="New profile name"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                style={{ flex: 1, padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
              <button className="btn-small" onClick={handleSaveAsProfile}>
                Save As
              </button>
            </div>
            {activeProfile && (
              <button
                className="btn-action btn-warning"
                style={{ width: "100%", fontSize: "12px" }}
                onClick={() => handleDeleteProfile(activeProfile)}
              >
                Delete Current Profile
              </button>
            )}
            <p className="help-text">
              Save different configurations for different courses or semesters.
            </p>
          </section>

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
              Reset and save all settings to default values, or reset and save the settings file location.
            </p>
          </section>

          {/* Schema (Advanced) */}
          <section className="settings-section">
            <h3>Advanced</h3>
            <button className="btn-action" onClick={handleViewSchema}>
              {schemaVisible ? "Hide" : "View"} JSON Schema
            </button>
            {schemaVisible && schema && (
              <pre ref={schemaRef} className="schema-display">
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
