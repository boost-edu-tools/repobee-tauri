import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { Modal, Button, Input, Select, Space, Divider, Typography, Alert, App } from "antd";
import type { GuiSettings } from "../types/settings";

const { Title, Text, Paragraph } = Typography;
const { useApp } = App;

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
  const { modal } = useApp();
  const [settingsPath, setSettingsPath] = useState<string>("");
  const [schemaVisible, setSchemaVisible] = useState(false);
  const [schema, setSchema] = useState<any>(null);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState<string>("");
  const [successFlash, setSuccessFlash] = useState(false);
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

  // Show success flash animation
  const showSuccessFlash = () => {
    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 500);
  };

  const handleLoadProfile = async (name: string) => {
    try {
      const settings = await invoke<GuiSettings>("load_profile", { name });
      onSettingsLoaded(settings);
      setActiveProfile(name);
      showSuccessFlash();
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
      showSuccessFlash();
      onMessage(`✓ Saved profile: ${newProfileName}`);
      setNewProfileName("");
      await loadProfiles();
    } catch (error) {
      onMessage(`✗ Failed to save profile: ${error}`);
    }
  };

  const handleDeleteProfile = async (name: string) => {
    modal.confirm({
      title: "Delete Profile",
      content: `Delete profile "${name}"?`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      centered: true,
      onOk: async () => {
        try {
          await invoke("delete_profile", { name });
          showSuccessFlash();
          onMessage(`✓ Deleted profile: ${name}`);
          await loadProfiles();
        } catch (error) {
          onMessage(`✗ Failed to delete profile: ${error}`);
        }
      },
    });
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
        showSuccessFlash();
        onMessage(`✓ Settings imported from: ${filePath}`);
        await loadSettingsPath();
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
        showSuccessFlash();
        onMessage(`✓ Settings exported to: ${filePath}`);
      }
    } catch (error) {
      onMessage(`✗ Failed to export settings: ${error}`);
    }
  };

  const handleReset = async () => {
    modal.confirm({
      title: "Reset Settings",
      content: "Are you sure you want to reset all settings to defaults?\nThis cannot be undone.",
      okText: "Reset",
      okType: "danger",
      cancelText: "Cancel",
      centered: true,
      onOk: async () => {
        try {
          const settings = await invoke<GuiSettings>("reset_settings");
          onSettingsLoaded(settings);
          showSuccessFlash();
          onMessage("✓ Settings reset to defaults");
          await loadSettingsPath();
          onClose();
        } catch (error) {
          onMessage(`✗ Failed to reset settings: ${error}`);
        }
      },
    });
  };

  const handleViewSchema = async () => {
    if (!schema) {
      try {
        const schemaData = await invoke<any>("get_settings_schema");
        setSchema(schemaData);
        setSchemaVisible(true);
        return;
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
      showSuccessFlash();
      onMessage("✓ Path copied to clipboard");
    }
  };

  return (
    <Modal
      title="Settings Management"
      open={isOpen}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      width={600}
      styles={{
        body: {
          maxHeight: '70vh',
          overflowY: 'auto',
          transition: 'background-color 0.3s ease',
          backgroundColor: successFlash ? '#f6ffed' : 'transparent',
        }
      }}
    >
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        {/* Help text banner */}
        <Alert
          message="All operations in this menu take effect immediately"
          type="info"
          showIcon
          style={{ fontSize: '11px', padding: '4px 12px' }}
        />
        {/* Configuration Profiles */}
        <div>
          <Title level={5} style={{ marginBottom: 8 }}>Configuration Profiles</Title>
          {profiles.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 11 }}>
                Active Profile: <strong>{activeProfile || "None"}</strong>
              </Text>
              <Select
                value={activeProfile || ""}
                onChange={handleLoadProfile}
                style={{ width: "100%", marginTop: 4 }}
                size="small"
                placeholder="-- Select Profile --"
                options={[
                  { value: "", label: "-- Select Profile --" },
                  ...profiles.map((name) => ({ value: name, label: name }))
                ]}
              />
            </div>
          )}
          <Space.Compact style={{ width: "100%", marginBottom: 8 }}>
            <Input
              placeholder="New profile name"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              size="small"
              style={{ flex: 1 }}
            />
            <Button onClick={handleSaveAsProfile} size="small">
              Save As
            </Button>
          </Space.Compact>
          {activeProfile && (
            <Button
              danger
              onClick={() => handleDeleteProfile(activeProfile)}
              size="small"
              style={{ width: "100%", marginBottom: 8 }}
            >
              Delete Current Profile
            </Button>
          )}
          <Paragraph style={{ fontSize: 11, margin: 0, color: "#666" }}>
            Save different configurations for different courses or semesters.
          </Paragraph>
        </div>

        <Divider style={{ margin: "8px 0" }} />

        {/* Current Settings File */}
        <div>
          <Title level={5} style={{ marginBottom: 8 }}>Current Settings File</Title>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              value={settingsPath}
              readOnly
              size="small"
              style={{ flex: 1 }}
            />
            <Button onClick={handleCopyPath} size="small">
              Copy
            </Button>
          </Space.Compact>
        </div>

        <Divider style={{ margin: "8px 0" }} />

        {/* Import/Export */}
        <div>
          <Title level={5} style={{ marginBottom: 8 }}>Import / Export</Title>
          <Space style={{ marginBottom: 8 }}>
            <Button onClick={handleImport} size="small">
              Import Settings...
            </Button>
            <Button onClick={handleExport} size="small">
              Export Settings...
            </Button>
          </Space>
          <Paragraph style={{ fontSize: 11, margin: 0, color: "#666" }}>
            Import settings from a JSON file or export current settings to share or backup.
          </Paragraph>
        </div>

        <Divider style={{ margin: "8px 0" }} />

        {/* Reset */}
        <div>
          <Title level={5} style={{ marginBottom: 8 }}>Reset</Title>
          <Button danger onClick={handleReset} size="small" style={{ marginBottom: 8 }}>
            Reset to Defaults
          </Button>
          <Paragraph style={{ fontSize: 11, margin: 0, color: "#666" }}>
            Reset and save all settings to default values.
          </Paragraph>
        </div>

        <Divider style={{ margin: "8px 0" }} />

        {/* Advanced */}
        <div>
          <Title level={5} style={{ marginBottom: 8 }}>Advanced</Title>
          <Button onClick={handleViewSchema} size="small" style={{ marginBottom: 8 }}>
            {schemaVisible ? "Hide" : "View"} JSON Schema
          </Button>
          {schemaVisible && schema && (
            <pre
              ref={schemaRef}
              style={{
                backgroundColor: "#f5f5f5",
                padding: "8px",
                borderRadius: "4px",
                fontSize: "11px",
                maxHeight: "200px",
                overflowY: "auto",
                fontFamily: "monospace",
              }}
            >
              {JSON.stringify(schema, null, 2)}
            </pre>
          )}
          <Paragraph style={{ fontSize: 11, margin: 0, color: "#666" }}>
            View the JSON schema for settings validation and documentation.
          </Paragraph>
        </div>
      </Space>
    </Modal>
  );
}
