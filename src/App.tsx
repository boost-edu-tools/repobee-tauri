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

interface CanvasFormState {
  baseUrl: string;
  customUrl: string;
  urlOption: "TUE" | "Custom";
  accessToken: string;
  courseId: string;
  courseName: string;
  yamlFile: string;
  infoFileFolder: string;
  csvFile: string;
  xlsxFile: string;
  memberOption: "(email, gitid)" | "email" | "git_id";
  includeGroup: boolean;
  includeMember: boolean;
  includeInitials: boolean;
  fullGroups: boolean;
  csv: boolean;
  xlsx: boolean;
  yaml: boolean;
}

type TabType = "canvas" | "repo";

function App() {
  const [activeTab, setActiveTab] = useState<TabType>("canvas");
  const [configLocked, setConfigLocked] = useState(true);
  const [optionsLocked, setOptionsLocked] = useState(true);
  const [outputText, setOutputText] = useState("");
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenDialogValue, setTokenDialogValue] = useState("");
  const [canvasTokenDialogOpen, setCanvasTokenDialogOpen] = useState(false);
  const [canvasTokenDialogValue, setCanvasTokenDialogValue] = useState("");
  const [canvasForm, setCanvasForm] = useState<CanvasFormState>({
    baseUrl: "https://canvas.tue.nl",
    customUrl: "",
    urlOption: "TUE",
    accessToken: "",
    courseId: "",
    courseName: "",
    yamlFile: "students.yaml",
    infoFileFolder: "",
    csvFile: "student-info.csv",
    xlsxFile: "student-info.xlsx",
    memberOption: "(email, gitid)",
    includeGroup: true,
    includeMember: true,
    includeInitials: false,
    fullGroups: true,
    csv: false,
    xlsx: false,
    yaml: true,
  });
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

  const updateCanvasForm = (field: keyof CanvasFormState, value: any) => {
    setCanvasForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLogLevel = (level: keyof FormState["logLevels"]) => {
    setForm((prev) => ({
      ...prev,
      logLevels: { ...prev.logLevels, [level]: !prev.logLevels[level] },
    }));
  };

  const openCanvasTokenDialog = () => {
    setCanvasTokenDialogValue(canvasForm.accessToken);
    setCanvasTokenDialogOpen(true);
  };

  const closeCanvasTokenDialog = () => {
    setCanvasTokenDialogOpen(false);
  };

  const saveCanvasToken = () => {
    updateCanvasForm("accessToken", canvasTokenDialogValue);
    setCanvasTokenDialogOpen(false);
  };

  const browseCanvasYamlFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "YAML Files", extensions: ["yaml", "yml"] }],
    });
    if (selected && typeof selected === "string") {
      updateCanvasForm("yamlFile", selected);
    }
  };

  const browseCanvasInfoFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      updateCanvasForm("infoFileFolder", selected);
    }
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

  const verifyCanvasCourse = async () => {
    try {
      appendOutput("Verifying Canvas course...");

      const result = await invoke<{ success: boolean; message: string; details?: string }>(
        "verify_canvas_course",
        {
          params: {
            base_url: canvasForm.urlOption === "TUE" ? canvasForm.baseUrl : canvasForm.customUrl,
            access_token: canvasForm.accessToken,
            course_id: parseInt(canvasForm.courseId),
          },
        }
      );

      appendOutput(result.message);
      if (result.details) {
        appendOutput(result.details);
      }

      // Extract course name from details and update form
      if (result.details) {
        const match = result.details.match(/Course Name: (.+)/);
        if (match) {
          updateCanvasForm("courseName", match[1]);
        }
      }
    } catch (error) {
      appendOutput(`✗ Error: ${error}`);
    }
  };

  const generateCanvasFiles = async () => {
    try {
      appendOutput("Generating files from Canvas...");

      const result = await invoke<{ success: boolean; message: string; details?: string }>(
        "generate_canvas_files",
        {
          params: {
            base_url: canvasForm.urlOption === "TUE" ? canvasForm.baseUrl : canvasForm.customUrl,
            access_token: canvasForm.accessToken,
            course_id: parseInt(canvasForm.courseId),
            yaml_file: canvasForm.yamlFile,
            info_file_folder: canvasForm.infoFileFolder,
            csv_file: canvasForm.csvFile,
            xlsx_file: canvasForm.xlsxFile,
            member_option: canvasForm.memberOption,
            include_group: canvasForm.includeGroup,
            include_member: canvasForm.includeMember,
            include_initials: canvasForm.includeInitials,
            full_groups: canvasForm.fullGroups,
            csv: canvasForm.csv,
            xlsx: canvasForm.xlsx,
            yaml: canvasForm.yaml,
          },
        }
      );

      appendOutput("");
      appendOutput(result.message);
      if (result.details) {
        appendOutput(result.details);
      }

      // If successful and YAML was generated, update the repo tab's YAML field
      if (result.success && canvasForm.yaml) {
        updateForm("yamlFile", canvasForm.yamlFile);
      }
    } catch (error) {
      appendOutput(`✗ Error: ${error}`);
    }
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

      {/* Tab Navigation */}
      <div className="tab-bar">
        <button
          className={`tab-button ${activeTab === "canvas" ? "active" : ""}`}
          onClick={() => setActiveTab("canvas")}
        >
          Canvas Import
        </button>
        <button
          className={`tab-button ${activeTab === "repo" ? "active" : ""}`}
          onClick={() => setActiveTab("repo")}
        >
          Repository Setup
        </button>
      </div>

      {/* Canvas Import Tab */}
      {activeTab === "canvas" && (
        <>
          {/* Canvas Configuration */}
          <fieldset className="config-section">
            <legend>Canvas configuration</legend>

            <div className="form-row">
              <label>Base URL</label>
              <select
                value={canvasForm.urlOption}
                onChange={(e) => updateCanvasForm("urlOption", e.target.value as "TUE" | "Custom")}
              >
                <option value="TUE">TUE</option>
                <option value="Custom">Custom</option>
              </select>
              <input
                type="text"
                value={canvasForm.urlOption === "TUE" ? canvasForm.baseUrl : canvasForm.customUrl}
                onChange={(e) =>
                  updateCanvasForm(
                    canvasForm.urlOption === "TUE" ? "baseUrl" : "customUrl",
                    e.target.value
                  )
                }
                disabled={canvasForm.urlOption === "TUE"}
              />
              <button className="btn-icon">i</button>
            </div>

            <div className="form-row">
              <label>Access Token</label>
              <input
                type="password"
                value={canvasForm.accessToken}
                readOnly
                placeholder="Click Edit to set token"
              />
              <button className="btn-small" onClick={openCanvasTokenDialog}>
                Edit
              </button>
              <button className="btn-icon">i</button>
            </div>

            <div className="form-row">
              <label>Course ID</label>
              <input
                type="text"
                value={canvasForm.courseId}
                onChange={(e) => updateCanvasForm("courseId", e.target.value)}
                placeholder="Enter course ID"
              />
              <button className="btn-small" onClick={verifyCanvasCourse}>Verify</button>
              <button className="btn-icon">i</button>
            </div>

            {canvasForm.courseName && (
              <div className="form-row">
                <label>Course Name</label>
                <input
                  type="text"
                  value={canvasForm.courseName}
                  readOnly
                />
              </div>
            )}
          </fieldset>

          {/* Output Configuration */}
          <fieldset className="config-section">
            <legend>Output configuration</legend>

            <div className="form-row">
              <label>Info File Folder</label>
              <input
                type="text"
                value={canvasForm.infoFileFolder}
                onChange={(e) => updateCanvasForm("infoFileFolder", e.target.value)}
                className="flex-1"
              />
              <button className="btn-small" onClick={browseCanvasInfoFolder}>
                Browse
              </button>
              <button className="btn-icon">i</button>
            </div>

            <div className="form-row">
              <label>YAML File</label>
              <input
                type="text"
                value={canvasForm.yamlFile}
                onChange={(e) => updateCanvasForm("yamlFile", e.target.value)}
                className="flex-1"
              />
              <button className="btn-small" onClick={browseCanvasYamlFile}>
                Browse
              </button>
              <button className="btn-icon">i</button>
            </div>

            <div className="options-grid" style={{ marginTop: "8px" }}>
              <fieldset className="options-subsection">
                <legend>Output Formats</legend>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={canvasForm.csv}
                      onChange={() => updateCanvasForm("csv", !canvasForm.csv)}
                    />
                    CSV
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={canvasForm.xlsx}
                      onChange={() => updateCanvasForm("xlsx", !canvasForm.xlsx)}
                    />
                    Excel
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={canvasForm.yaml}
                      onChange={() => updateCanvasForm("yaml", !canvasForm.yaml)}
                    />
                    YAML (RepoBee)
                  </label>
                </div>
              </fieldset>

              <fieldset className="options-subsection">
                <legend>Member ID Format</legend>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="memberOption"
                      value="(email, gitid)"
                      checked={canvasForm.memberOption === "(email, gitid)"}
                      onChange={(e) => updateCanvasForm("memberOption", e.target.value)}
                    />
                    (email, git_id)
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="memberOption"
                      value="email"
                      checked={canvasForm.memberOption === "email"}
                      onChange={(e) => updateCanvasForm("memberOption", e.target.value)}
                    />
                    Email only
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="memberOption"
                      value="git_id"
                      checked={canvasForm.memberOption === "git_id"}
                      onChange={(e) => updateCanvasForm("memberOption", e.target.value)}
                    />
                    Git ID only
                  </label>
                </div>
              </fieldset>
            </div>
          </fieldset>

          {/* Repository Naming */}
          <fieldset className="config-section">
            <legend>Repository naming</legend>

            <div className="options-grid">
              <fieldset className="options-subsection">
                <legend>Include in Name</legend>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={canvasForm.includeGroup}
                      onChange={() => updateCanvasForm("includeGroup", !canvasForm.includeGroup)}
                    />
                    Group Name
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={canvasForm.includeMember}
                      onChange={() => updateCanvasForm("includeMember", !canvasForm.includeMember)}
                    />
                    Member Names
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={canvasForm.includeInitials}
                      onChange={() => updateCanvasForm("includeInitials", !canvasForm.includeInitials)}
                      disabled={!canvasForm.includeMember}
                    />
                    Use Initials
                  </label>
                </div>
              </fieldset>

              <fieldset className="options-subsection">
                <legend>Filters</legend>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={canvasForm.fullGroups}
                      onChange={() => updateCanvasForm("fullGroups", !canvasForm.fullGroups)}
                    />
                    Full Groups Only
                  </label>
                </div>
              </fieldset>
            </div>
          </fieldset>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button className="btn-action" onClick={generateCanvasFiles}>
              Generate Files
            </button>
            <button className="btn-icon">i</button>
            <div className="spacer"></div>
            <button className="btn-action" onClick={clearHistory}>
              Clear History
            </button>
          </div>

          {/* Output Window */}
          <div className="output-section">
            <textarea
              className="output-window"
              value={outputText}
              readOnly
              placeholder="Canvas import output will appear here..."
            />
          </div>
        </>
      )}

      {/* Repository Setup Tab */}
      {activeTab === "repo" && (
        <>
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

        </>
      )}

      {/* Git Token Edit Dialog */}
      {tokenDialogOpen && (
        <div className="dialog-overlay" onClick={closeTokenDialog}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Git Access Token</h2>
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

      {/* Canvas Token Edit Dialog */}
      {canvasTokenDialogOpen && (
        <div className="dialog-overlay" onClick={closeCanvasTokenDialog}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Canvas Access Token</h2>
            <input
              type="text"
              value={canvasTokenDialogValue}
              onChange={(e) => setCanvasTokenDialogValue(e.target.value)}
              placeholder="Enter Canvas access token"
              autoFocus
              className="dialog-input"
            />
            <div className="dialog-buttons">
              <button className="btn-action" onClick={saveCanvasToken}>
                OK
              </button>
              <button className="btn-action" onClick={closeCanvasTokenDialog}>
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
