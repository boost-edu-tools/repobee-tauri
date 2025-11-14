import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

interface FormState {
  accessToken: string;
  user: string;
  baseUrl: string;
  studentReposGroup: string;
  templateGroup: string;
  yamlFile: string;
  targetFolder: string;
  assignments: string;
  directoryLayout: "by-team" | "flat" | "by-task";
  logLevels: {
    info: boolean;
    debug: boolean;
    warning: boolean;
    error: boolean;
  };
}

function App() {
  const [configLocked, setConfigLocked] = useState(true);
  const [optionsLocked, setOptionsLocked] = useState(true);
  const [outputText, setOutputText] = useState("");
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenDialogValue, setTokenDialogValue] = useState("");
  const [form, setForm] = useState<FormState>({
    accessToken: "",
    user: "",
    baseUrl: "https://gitlab.tue.nl",
    studentReposGroup: "",
    templateGroup: "",
    yamlFile: "",
    targetFolder: "",
    assignments: "",
    directoryLayout: "flat",
    logLevels: {
      info: true,
      debug: false,
      warning: true,
      error: true,
    },
  });

  const updateForm = (field: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLogLevel = (level: keyof FormState["logLevels"]) => {
    setForm((prev) => ({
      ...prev,
      logLevels: { ...prev.logLevels, [level]: !prev.logLevels[level] },
    }));
  };

  const browseYamlFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "YAML Files", extensions: ["yaml", "yml"] }],
    });
    if (selected && typeof selected === "string") {
      updateForm("yamlFile", selected);
    }
  };

  const browseTargetFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      updateForm("targetFolder", selected);
    }
  };

  const appendOutput = (text: string) => {
    setOutputText((prev) => prev + text + "\n");
  };

  const verifyConfig = async () => {
    try {
      appendOutput("Verifying configuration...");

      const result = await invoke<{ success: boolean; message: string; details?: string }>(
        "verify_config",
        {
          params: {
            access_token: form.accessToken,
            user: form.user,
            base_url: form.baseUrl,
            student_repos_group: form.studentReposGroup,
            template_group: form.templateGroup,
          },
        }
      );

      appendOutput(result.message);
      if (result.details) {
        appendOutput(result.details);
      }
    } catch (error) {
      appendOutput(`✗ Error: ${error}`);
    }
  };

  const createStudentRepos = async () => {
    try {
      appendOutput("Creating student repositories...");
      appendOutput(`Teams: ${form.yamlFile}`);
      appendOutput(`Assignments: ${form.assignments}`);
      appendOutput("");

      const result = await invoke<{ success: boolean; message: string; details?: string }>(
        "setup_repos",
        {
          params: {
            config: {
              access_token: form.accessToken,
              user: form.user,
              base_url: form.baseUrl,
              student_repos_group: form.studentReposGroup,
              template_group: form.templateGroup,
            },
            yaml_file: form.yamlFile,
            assignments: form.assignments,
          },
        }
      );

      appendOutput("");
      appendOutput(result.message);
      if (result.details) {
        appendOutput(result.details);
      }
    } catch (error) {
      appendOutput(`✗ Error: ${error}`);
    }
  };

  const cloneRepos = async () => {
    try {
      appendOutput("Cloning repositories...");

      const result = await invoke<{ success: boolean; message: string; details?: string }>(
        "clone_repos",
        {
          params: {
            config: {
              access_token: form.accessToken,
              user: form.user,
              base_url: form.baseUrl,
              student_repos_group: form.studentReposGroup,
              template_group: form.templateGroup,
            },
            yaml_file: form.yamlFile,
            assignments: form.assignments,
            target_folder: form.targetFolder,
            directory_layout: form.directoryLayout,
          },
        }
      );

      appendOutput(result.message);
      if (result.details) {
        appendOutput(result.details);
      }
    } catch (error) {
      appendOutput(`✗ Error: ${error}`);
    }
  };

  const clearHistory = () => {
    setOutputText("");
  };

  const openTokenDialog = () => {
    setTokenDialogValue(form.accessToken);
    setTokenDialogOpen(true);
  };

  const closeTokenDialog = () => {
    setTokenDialogOpen(false);
  };

  const saveToken = () => {
    updateForm("accessToken", tokenDialogValue);
    setTokenDialogOpen(false);
  };

  return (
    <div className="repobee-container">
      <h1 className="app-title">Repobee</h1>

      {/* Git Server Configuration */}
      <fieldset className="config-section">
        <legend>Git server configuration</legend>

        <div className="form-row">
          <label>Access Token</label>
          <input
            type="password"
            value={form.accessToken}
            readOnly
            placeholder="Click Edit to set token"
          />
          <button className="btn-small" onClick={openTokenDialog}>
            Edit
          </button>
          <button className="btn-icon">i</button>
        </div>

        <div className="form-row">
          <label>Locked</label>
          <button
            className="btn-lock"
            onClick={() => setConfigLocked(!configLocked)}
          >
            {configLocked ? "Unlock" : "Lock"}
          </button>
        </div>

        <div className="form-row">
          <label>User</label>
          <input
            type="text"
            value={form.user}
            onChange={(e) => updateForm("user", e.target.value)}
            disabled={configLocked}
          />
          <button className="btn-icon">i</button>
        </div>

        <div className="form-row">
          <label>Base URL</label>
          <input
            type="text"
            value={form.baseUrl}
            onChange={(e) => updateForm("baseUrl", e.target.value)}
            disabled={configLocked}
          />
          <button className="btn-icon">i</button>
        </div>

        <div className="form-row">
          <label>Student Repos Group</label>
          <input
            type="text"
            value={form.studentReposGroup}
            onChange={(e) => updateForm("studentReposGroup", e.target.value)}
            disabled={configLocked}
          />
          <button className="btn-icon">i</button>
        </div>

        <div className="form-row">
          <label>Template Group</label>
          <input
            type="text"
            value={form.templateGroup}
            onChange={(e) => updateForm("templateGroup", e.target.value)}
            disabled={configLocked}
          />
          <button className="btn-icon">i</button>
        </div>
      </fieldset>

      {/* Local Computer Configuration */}
      <fieldset className="config-section">
        <legend>Local computer configuration</legend>

        <div className="form-row">
          <label>YAML File</label>
          <input
            type="text"
            value={form.yamlFile}
            onChange={(e) => updateForm("yamlFile", e.target.value)}
            className="flex-1"
          />
          <button className="btn-small" onClick={browseYamlFile}>
            Browse
          </button>
          <button className="btn-icon">i</button>
        </div>

        <div className="form-row">
          <label>Target Folder Clone</label>
          <input
            type="text"
            value={form.targetFolder}
            onChange={(e) => updateForm("targetFolder", e.target.value)}
            className="flex-1"
          />
          <button className="btn-small" onClick={browseTargetFolder}>
            Browse
          </button>
          <button className="btn-icon">i</button>
        </div>
      </fieldset>

      {/* General Configuration */}
      <fieldset className="config-section">
        <legend>General configuration</legend>

        <div className="form-row">
          <label>Assignments</label>
          <input
            type="text"
            value={form.assignments}
            onChange={(e) => updateForm("assignments", e.target.value)}
            className="flex-1"
          />
          <button className="btn-icon">i</button>
        </div>
      </fieldset>

      {/* Options */}
      <fieldset className="config-section">
        <legend>Options</legend>

        <div className="form-row">
          <label>Locked</label>
          <button
            className="btn-lock"
            onClick={() => setOptionsLocked(!optionsLocked)}
          >
            {optionsLocked ? "Unlock" : "Lock"}
          </button>
        </div>

        <div className="options-grid">
          <fieldset className="options-subsection">
            <legend>Clone</legend>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="directoryLayout"
                  value="by-team"
                  checked={form.directoryLayout === "by-team"}
                  onChange={(e) =>
                    updateForm("directoryLayout", e.target.value)
                  }
                  disabled={optionsLocked}
                />
                By team
              </label>
              <label>
                <input
                  type="radio"
                  name="directoryLayout"
                  value="flat"
                  checked={form.directoryLayout === "flat"}
                  onChange={(e) =>
                    updateForm("directoryLayout", e.target.value)
                  }
                  disabled={optionsLocked}
                />
                Flat
              </label>
              <label>
                <input
                  type="radio"
                  name="directoryLayout"
                  value="by-task"
                  checked={form.directoryLayout === "by-task"}
                  onChange={(e) =>
                    updateForm("directoryLayout", e.target.value)
                  }
                  disabled={optionsLocked}
                />
                By task
              </label>
            </div>
          </fieldset>

          <fieldset className="options-subsection">
            <legend>Output window</legend>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={form.logLevels.info}
                  onChange={() => updateLogLevel("info")}
                  disabled={optionsLocked}
                />
                Info
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.logLevels.debug}
                  onChange={() => updateLogLevel("debug")}
                  disabled={optionsLocked}
                />
                Debug
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.logLevels.warning}
                  onChange={() => updateLogLevel("warning")}
                  disabled={optionsLocked}
                />
                Warning
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.logLevels.error}
                  onChange={() => updateLogLevel("error")}
                  disabled={optionsLocked}
                />
                Error
              </label>
            </div>
          </fieldset>
        </div>
      </fieldset>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button className="btn-action" onClick={verifyConfig}>
          Verify Config
        </button>
        <button className="btn-icon">i</button>
        <button className="btn-action" onClick={createStudentRepos}>
          Create Student Repos
        </button>
        <button className="btn-icon">i</button>
        <button className="btn-action" onClick={cloneRepos}>
          Clone
        </button>
        <button className="btn-icon">i</button>
        <div className="spacer"></div>
        <button className="btn-action" onClick={clearHistory}>
          Clear History
        </button>
        <button className="btn-action btn-exit" onClick={() => window.close()}>
          Exit
        </button>
      </div>

      {/* Output Window */}
      <div className="output-section">
        <textarea
          className="output-window"
          value={outputText}
          readOnly
          placeholder="Output will appear here..."
        />
      </div>

      {/* Token Edit Dialog */}
      {tokenDialogOpen && (
        <div className="dialog-overlay" onClick={closeTokenDialog}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Access Token</h2>
            <input
              type="text"
              value={tokenDialogValue}
              onChange={(e) => setTokenDialogValue(e.target.value)}
              placeholder="Enter access token"
              autoFocus
              className="dialog-input"
            />
            <div className="dialog-buttons">
              <button className="btn-action" onClick={saveToken}>
                OK
              </button>
              <button className="btn-action" onClick={closeTokenDialog}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
