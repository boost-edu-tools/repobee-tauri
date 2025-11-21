import { useState, useEffect, useRef } from "react";
import { invoke, Channel } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { SettingsMenu } from "./components/SettingsMenu";
import type { GuiSettings } from "./types/settings";
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

interface LmsFormState {
  lmsType: "Canvas" | "Moodle";
  baseUrl: string;
  customUrl: string;
  urlOption: "TUE" | "CUSTOM";
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

type TabType = "lms" | "repo";

function App() {
  const settingsLoadedRef = useRef(false);
const [activeTab, setActiveTab] = useState<TabType>("lms");
  const [configLocked, setConfigLocked] = useState(true);
  const [optionsLocked, setOptionsLocked] = useState(true);
  const [outputText, setOutputText] = useState("");
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenDialogValue, setTokenDialogValue] = useState("");
  const [lmsTokenDialogOpen, setLmsTokenDialogOpen] = useState(false);
  const [lmsTokenDialogValue, setLmsTokenDialogValue] = useState("");
  const [showTokenInstructions, setShowTokenInstructions] = useState(false);
  const [tokenInstructions, setTokenInstructions] = useState("");
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [currentGuiSettings, setCurrentGuiSettings] = useState<GuiSettings | null>(null);
  const [lmsForm, setLmsForm] = useState<LmsFormState>({
    lmsType: "Canvas",
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

  // Load settings on startup (only once, even with React StrictMode)
  useEffect(() => {
    if (!settingsLoadedRef.current) {
      settingsLoadedRef.current = true;
      loadSettingsFromDisk();
    }
  }, []);

  const loadSettingsFromDisk = async () => {
    try {
      // Check if settings file exists first
      const fileExists = await invoke<boolean>("settings_exist");

      const settings = await invoke<GuiSettings>("load_settings");
      console.log("Loaded settings:", settings);

      // Check if settings have the expected structure
      if (!settings || typeof settings !== 'object') {
        throw new Error("Invalid settings structure received from backend");
      }

      // Store the full GuiSettings object
      setCurrentGuiSettings(settings);

      // Settings are flattened (due to #[serde(flatten)] in Rust)
      // All fields are at the top level - use settings directly
      const lmsBaseUrl = settings.lms_base_url || "https://canvas.tue.nl";

      // Populate LMS form from settings
      const loadedLmsForm: LmsFormState = {
        lmsType: (settings.lms_type || "Canvas") as "Canvas" | "Moodle",
        baseUrl: lmsBaseUrl,
        customUrl: settings.lms_custom_url || "",
        urlOption: (settings.lms_url_option || "TUE") as "TUE" | "CUSTOM",
        accessToken: settings.lms_access_token || "",
        courseId: settings.lms_course_id || "",
        courseName: settings.lms_course_name || "",
        yamlFile: settings.lms_yaml_file || "students.yaml",
        infoFileFolder: settings.lms_info_folder || "",
        csvFile: settings.lms_csv_file || "student-info.csv",
        xlsxFile: settings.lms_xlsx_file || "student-info.xlsx",
        memberOption: (settings.lms_member_option || "(email, gitid)") as "(email, gitid)" | "email" | "git_id",
        includeGroup: settings.lms_include_group ?? true,
        includeMember: settings.lms_include_member ?? true,
        includeInitials: settings.lms_include_initials ?? false,
        fullGroups: settings.lms_full_groups ?? true,
        csv: settings.lms_output_csv ?? false,
        xlsx: settings.lms_output_xlsx ?? false,
        yaml: settings.lms_output_yaml ?? true,
      };

      if (loadedLmsForm.lmsType !== "Canvas") {
        loadedLmsForm.urlOption = "CUSTOM";
      }

      setLmsForm(loadedLmsForm);

      // Populate Repo form from settings
      setForm({
        accessToken: settings.git_access_token || "",
        user: settings.git_user || "",
        baseUrl: settings.git_base_url || "https://gitlab.tue.nl",
        studentReposGroup: settings.git_student_repos_group || "",
        templateGroup: settings.git_template_group || "",
        yamlFile: settings.yaml_file || "students.yaml",
        targetFolder: settings.target_folder || "",
        assignments: settings.assignments || "",
        directoryLayout: (settings.directory_layout || "flat") as "by-team" | "flat" | "by-task",
        logLevels: {
          info: settings.log_info ?? true,
          debug: settings.log_debug ?? false,
          warning: settings.log_warning ?? true,
          error: settings.log_error ?? true,
        },
      });

      // GUI-specific settings
      const savedTab = settings.active_tab === "repo" ? "repo" : "lms";
      setActiveTab(savedTab as TabType);
      setConfigLocked(settings.config_locked ?? true);
      setOptionsLocked(settings.options_locked ?? true);

      // Show appropriate message based on whether file existed
      if (fileExists) {
        appendOutput("✓ Settings loaded from file");
      } else {
        appendOutput("⚠ Settings file not found, using defaults");
        appendOutput("  Click 'Save Settings' to create a settings file");
      }
    } catch (error) {
      console.error("Failed to load settings:", error);

      // User-friendly error message (inspired by gitinspectorgui)
      appendOutput("⚠ Cannot load settings file, using default settings");
      appendOutput("  Error: " + error);
      appendOutput("  Click 'Save Settings' to create a valid settings file");
    }
  };

  const handleSettingsLoaded = (settings: GuiSettings) => {
    // Update the form state from loaded settings
    setCurrentGuiSettings(settings);

    // Update LMS form
    setLmsForm({
      lmsType: (settings.lms_type || "Canvas") as "Canvas" | "Moodle",
      baseUrl: settings.lms_base_url || "https://canvas.tue.nl",
      customUrl: settings.lms_custom_url || "",
      urlOption: (settings.lms_url_option || "TUE") as "TUE" | "CUSTOM",
      accessToken: settings.lms_access_token || "",
      courseId: settings.lms_course_id || "",
      courseName: settings.lms_course_name || "",
      yamlFile: settings.lms_yaml_file || "students.yaml",
      infoFileFolder: settings.lms_info_folder || "",
      csvFile: settings.lms_csv_file || "student-info.csv",
      xlsxFile: settings.lms_xlsx_file || "student-info.xlsx",
      memberOption: (settings.lms_member_option || "(email, gitid)") as "(email, gitid)" | "email" | "git_id",
      includeGroup: settings.lms_include_group ?? true,
      includeMember: settings.lms_include_member ?? true,
      includeInitials: settings.lms_include_initials ?? false,
      fullGroups: settings.lms_full_groups ?? true,
      csv: settings.lms_output_csv ?? false,
      xlsx: settings.lms_output_xlsx ?? false,
      yaml: settings.lms_output_yaml ?? true,
    });

    // Update Repo form
    setForm({
      accessToken: settings.git_access_token || "",
      user: settings.git_user || "",
      baseUrl: settings.git_base_url || "https://gitlab.tue.nl",
      studentReposGroup: settings.git_student_repos_group || "",
      templateGroup: settings.git_template_group || "",
      yamlFile: settings.yaml_file || "students.yaml",
      targetFolder: settings.target_folder || "",
      assignments: settings.assignments || "",
      directoryLayout: (settings.directory_layout || "flat") as "by-team" | "flat" | "by-task",
      logLevels: {
        info: settings.log_info ?? true,
        debug: settings.log_debug ?? false,
        warning: settings.log_warning ?? true,
        error: settings.log_error ?? true,
      },
    });

    // Update GUI-specific state
    const tabValue = settings.active_tab === "repo" ? "repo" : "lms";
    setActiveTab(tabValue as TabType);
    setConfigLocked(settings.config_locked ?? true);
    setOptionsLocked(settings.options_locked ?? true);
  };

  const saveSettingsToDisk = async () => {
    try {
      // Note: GuiSettings has #[serde(flatten)] on common field,
      // so all fields must be at the top level, not nested under "common"
      const settings = {
        // LMS settings
        lms_type: lmsForm.lmsType,
        lms_base_url: lmsForm.baseUrl,
        lms_custom_url: lmsForm.customUrl,
        lms_url_option: lmsForm.urlOption,
        lms_access_token: lmsForm.accessToken,
        lms_course_id: lmsForm.courseId,
        lms_course_name: lmsForm.courseName,
        lms_yaml_file: lmsForm.yamlFile,
        lms_info_folder: lmsForm.infoFileFolder,
        lms_csv_file: lmsForm.csvFile,
        lms_xlsx_file: lmsForm.xlsxFile,
        lms_member_option: lmsForm.memberOption,
        lms_include_group: lmsForm.includeGroup,
        lms_include_member: lmsForm.includeMember,
        lms_include_initials: lmsForm.includeInitials,
        lms_full_groups: lmsForm.fullGroups,
        lms_output_csv: lmsForm.csv,
        lms_output_xlsx: lmsForm.xlsx,
        lms_output_yaml: lmsForm.yaml,

        // Git platform settings
        git_base_url: form.baseUrl,
        git_access_token: form.accessToken,
        git_user: form.user,
        git_student_repos_group: form.studentReposGroup,
        git_template_group: form.templateGroup,

        // Repository setup settings
        yaml_file: form.yamlFile,
        target_folder: form.targetFolder,
        assignments: form.assignments,
        directory_layout: form.directoryLayout,

        // Logging settings
        log_info: form.logLevels.info,
        log_debug: form.logLevels.debug,
        log_warning: form.logLevels.warning,
        log_error: form.logLevels.error,

        // GUI-specific settings
        active_tab: activeTab,
        config_locked: configLocked,
        options_locked: optionsLocked,
        window_width: 0,
        window_height: 0,
        window_x: 0,
        window_y: 0,
      };

      await invoke("save_settings", { settings });
      appendOutput("✓ Settings saved successfully");
    } catch (error) {
      console.error("Failed to save settings:", error);
      appendOutput(`✗ Failed to save settings: ${error}`);
    }
  };

  const updateForm = (field: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLmsForm = (field: keyof LmsFormState, value: any) => {
    setLmsForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLogLevel = (level: keyof FormState["logLevels"]) => {
    setForm((prev) => ({
      ...prev,
      logLevels: { ...prev.logLevels, [level]: !prev.logLevels[level] },
    }));
  };

  const handleLmsTypeChange = (value: "Canvas" | "Moodle") => {
    setLmsForm((prev) => {
      const next = { ...prev, lmsType: value };
      if (value !== "Canvas") {
        next.urlOption = "CUSTOM";
      } else if (prev.baseUrl.trim() === "") {
        next.baseUrl = "https://canvas.tue.nl";
      }
      return next;
    });
  };

  const openLmsTokenDialog = async () => {
    setLmsTokenDialogValue(lmsForm.accessToken);
    setLmsTokenDialogOpen(true);

    // Load instructions
    try {
      const instructions = await invoke<string>("get_token_instructions", {
        lms_type: lmsForm.lmsType,
      });
      setTokenInstructions(instructions);
      setShowTokenInstructions(false); // Start collapsed
    } catch (error) {
      console.error("Failed to load token instructions:", error);
    }
  };

  const closeLmsTokenDialog = () => {
    setLmsTokenDialogOpen(false);
  };

  const saveLmsToken = () => {
    updateLmsForm("accessToken", lmsTokenDialogValue);
    setLmsTokenDialogOpen(false);
  };

  const openLmsTokenUrl = async () => {
    try {
      const baseUrl = lmsForm.urlOption === "TUE" ? lmsForm.baseUrl : lmsForm.customUrl;
      await invoke("open_token_url", {
        base_url: baseUrl,
        lms_type: lmsForm.lmsType,
      });
      // Show instructions if they weren't visible
      setShowTokenInstructions(true);
    } catch (error) {
      console.error("Failed to open token URL:", error);
      alert(`Failed to open token URL: ${error}`);
    }
  };

  const browseLmsYamlFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "YAML Files", extensions: ["yaml", "yml"] }],
    });
    if (selected && typeof selected === "string") {
      updateLmsForm("yamlFile", selected);
    }
  };

  const browseLmsInfoFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      updateLmsForm("infoFileFolder", selected);
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

  const verifyLmsCourse = async () => {
    try {
      const lmsLabel = lmsForm.lmsType || "LMS";
      appendOutput(`Verifying ${lmsLabel} course...`);

      const result = await invoke<{ success: boolean; message: string; details?: string }>(
        "verify_lms_course",
        {
          params: {
            base_url: lmsForm.urlOption === "TUE" ? lmsForm.baseUrl : lmsForm.customUrl,
            access_token: lmsForm.accessToken,
            course_id: lmsForm.courseId,
            lms_type: lmsForm.lmsType,
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
          updateLmsForm("courseName", match[1]);
        }
      }
    } catch (error) {
      appendOutput(`✗ Error: ${error}`);
    }
  };

  const generateLmsFiles = async () => {
    try {
      const lmsLabel = lmsForm.lmsType || "LMS";
      appendOutput(`Generating files from ${lmsLabel}...`);

      const PROGRESS_PREFIX = "[PROGRESS]";
      const PROGRESS_DISPLAY_PREFIX = "(progress) ";
      const progressChannel = new Channel<string>();
      progressChannel.onmessage = (message) => {
        if (message.startsWith(PROGRESS_PREFIX)) {
          const progressText = message.slice(PROGRESS_PREFIX.length).trimStart();
          const displayLine = `${PROGRESS_DISPLAY_PREFIX}${progressText}`;
          setOutputText((prev) => {
            const lines = prev.split("\n");
            while (lines.length && lines[lines.length - 1].trim() === "") {
              lines.pop();
            }
            if (
              lines.length > 0 &&
              lines[lines.length - 1].startsWith(PROGRESS_DISPLAY_PREFIX)
            ) {
              lines[lines.length - 1] = displayLine;
            } else {
              lines.push(displayLine);
            }
            return lines.join("\n");
          });
          return;
        }

        appendOutput(message);
      };

      const result = await invoke<{ success: boolean; message: string; details?: string }>(
        "generate_lms_files",
        {
          params: {
            base_url: lmsForm.urlOption === "TUE" ? lmsForm.baseUrl : lmsForm.customUrl,
            access_token: lmsForm.accessToken,
            course_id: lmsForm.courseId,
            lms_type: lmsForm.lmsType,
            yaml_file: lmsForm.yamlFile,
            info_file_folder: lmsForm.infoFileFolder,
            csv_file: lmsForm.csvFile,
            xlsx_file: lmsForm.xlsxFile,
            member_option: lmsForm.memberOption,
            include_group: lmsForm.includeGroup,
            include_member: lmsForm.includeMember,
            include_initials: lmsForm.includeInitials,
            full_groups: lmsForm.fullGroups,
            csv: lmsForm.csv,
            xlsx: lmsForm.xlsx,
            yaml: lmsForm.yaml,
          },
          progress: progressChannel,
        }
      );

      appendOutput("");
      appendOutput(result.message);
      if (result.details) {
        appendOutput(result.details);
      }

      // If successful and YAML was generated, update the repo tab's YAML field
      if (result.success && lmsForm.yaml) {
        updateForm("yamlFile", lmsForm.yamlFile);
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

      {/* Tab Navigation */}
      <div className="tab-bar">
        <button
          className={`tab-button ${activeTab === "lms" ? "active" : ""}`}
          onClick={() => setActiveTab("lms")}
        >
          LMS Import
        </button>
        <button
          className={`tab-button ${activeTab === "repo" ? "active" : ""}`}
          onClick={() => setActiveTab("repo")}
        >
          Repository Setup
        </button>
      </div>

      <div className="tabs-container">
      {/* Tab Content Container */}
      <div className="tab-content" aria-hidden={activeTab !== "lms"}>
          {/* LMS Configuration */}
          <fieldset className="config-section">
            <legend>LMS configuration</legend>

            <div className="form-row">
              <label>LMS Type</label>
              <select
                value={lmsForm.lmsType}
                onChange={(e) => handleLmsTypeChange(e.target.value as "Canvas" | "Moodle")}
              >
                <option value="Canvas">Canvas</option>
                <option value="Moodle">Moodle</option>
              </select>
              <button className="btn-icon">i</button>
              <div></div>
            </div>

            <div className="form-row">
              <label>Base URL</label>
              <select
                value={lmsForm.urlOption}
                onChange={(e) => updateLmsForm("urlOption", e.target.value as "TUE" | "CUSTOM")}
                disabled={lmsForm.lmsType !== "Canvas"}
              >
                {lmsForm.lmsType === "Canvas" && <option value="TUE">TUE</option>}
                <option value="CUSTOM">Custom</option>
              </select>
              <input
                type="text"
                value={lmsForm.urlOption === "TUE" ? lmsForm.baseUrl : lmsForm.customUrl}
                onChange={(e) =>
                  updateLmsForm(
                    lmsForm.urlOption === "TUE" ? "baseUrl" : "customUrl",
                    e.target.value
                  )
                }
                disabled={lmsForm.urlOption === "TUE"}
              />
              <button className="btn-icon">i</button>
            </div>

            <div className="form-row">
              <label>Access Token</label>
              <input
                type="password"
                value={lmsForm.accessToken}
                readOnly
                placeholder="Click Set to add token"
              />
              <button className="btn-small" onClick={openLmsTokenDialog}>
                {lmsForm.accessToken ? "Edit" : "Set"}
              </button>
              <button className="btn-icon">i</button>
            </div>

            <div className="form-row">
              <label>Course ID</label>
              <input
                type="text"
                value={lmsForm.courseId}
                onChange={(e) => updateLmsForm("courseId", e.target.value)}
                placeholder="Enter course ID"
              />
              <button className="btn-small" onClick={verifyLmsCourse}>Verify</button>
              <button className="btn-icon">i</button>
            </div>

            {lmsForm.courseName && (
              <div className="form-row">
                <label>Course Name</label>
                <input
                  type="text"
                  value={lmsForm.courseName}
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
                value={lmsForm.infoFileFolder}
                onChange={(e) => updateLmsForm("infoFileFolder", e.target.value)}
                className="flex-1"
              />
              <button className="btn-small" onClick={browseLmsInfoFolder}>
                Browse
              </button>
              <button className="btn-icon">i</button>
            </div>

            <div className="form-row">
              <label>YAML File</label>
              <input
                type="text"
                value={lmsForm.yamlFile}
                onChange={(e) => updateLmsForm("yamlFile", e.target.value)}
                className="flex-1"
              />
              <button className="btn-small" onClick={browseLmsYamlFile}>
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
                      checked={lmsForm.csv}
                      onChange={() => updateLmsForm("csv", !lmsForm.csv)}
                    />
                    CSV
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={lmsForm.xlsx}
                      onChange={() => updateLmsForm("xlsx", !lmsForm.xlsx)}
                    />
                    Excel
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={lmsForm.yaml}
                      onChange={() => updateLmsForm("yaml", !lmsForm.yaml)}
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
                      checked={lmsForm.memberOption === "(email, gitid)"}
                      onChange={(e) => updateLmsForm("memberOption", e.target.value)}
                    />
                    (email, git_id)
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="memberOption"
                      value="email"
                      checked={lmsForm.memberOption === "email"}
                      onChange={(e) => updateLmsForm("memberOption", e.target.value)}
                    />
                    Email only
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="memberOption"
                      value="git_id"
                      checked={lmsForm.memberOption === "git_id"}
                      onChange={(e) => updateLmsForm("memberOption", e.target.value)}
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
                      checked={lmsForm.includeGroup}
                      onChange={() => updateLmsForm("includeGroup", !lmsForm.includeGroup)}
                    />
                    Group Name
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={lmsForm.includeMember}
                      onChange={() => updateLmsForm("includeMember", !lmsForm.includeMember)}
                    />
                    Member Names
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={lmsForm.includeInitials}
                      onChange={() => updateLmsForm("includeInitials", !lmsForm.includeInitials)}
                      disabled={!lmsForm.includeMember}
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
                      checked={lmsForm.fullGroups}
                      onChange={() => updateLmsForm("fullGroups", !lmsForm.fullGroups)}
                    />
                    Full Groups Only
                  </label>
                </div>
              </fieldset>
            </div>
          </fieldset>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button className="btn-action" onClick={generateLmsFiles}>
              Generate Files
            </button>
            <button className="btn-icon">i</button>
            <div className="spacer"></div>
            <button className="btn-action" onClick={() => setSettingsMenuOpen(true)}>
              Settings...
            </button>
            <button className="btn-action" onClick={saveSettingsToDisk}>
              Save Settings
            </button>
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
              placeholder="LMS import output will appear here..."
            />
          </div>
      </div>

      {/* Repository Setup Tab */}
      <div className="tab-content" aria-hidden={activeTab !== "repo"}>
          {/* Git Server Configuration */}
          <fieldset className="config-section">
        <legend>Git server configuration</legend>

        <div className="form-row">
          <label>Access Token</label>
          <input
            type="password"
            value={form.accessToken}
            readOnly
            placeholder="Click Set to add token"
          />
          <button className="btn-small" onClick={openTokenDialog}>
            {form.accessToken ? "Edit" : "Set"}
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
        <button className="btn-action" onClick={() => setSettingsMenuOpen(true)}>
          Settings...
        </button>
        <button className="btn-action" onClick={saveSettingsToDisk}>
          Save Settings
        </button>
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
      </div>
      </div>

      {/* Git Token Edit Dialog */}
      {tokenDialogOpen && (
        <div className="dialog-overlay" onClick={closeTokenDialog}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{form.accessToken ? "Edit" : "Set"} Git Access Token</h2>
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

      {/* LMS Token Edit Dialog */}
      {lmsTokenDialogOpen && (
        <div className="dialog-overlay" onClick={closeLmsTokenDialog}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{lmsForm.accessToken ? "Edit" : "Set"} {lmsForm.lmsType} Access Token</h2>

            {/* Instructions section */}
            {tokenInstructions && (
              <div style={{ marginBottom: "12px" }}>
                <button
                  onClick={() => setShowTokenInstructions(!showTokenInstructions)}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    cursor: "pointer",
                    marginBottom: "8px",
                  }}
                >
                  {showTokenInstructions ? "▼ Hide Instructions" : "▶ How to Get Token"}
                </button>
                {showTokenInstructions && (
                  <div
                    style={{
                      backgroundColor: "#f5f5f5",
                      padding: "12px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      whiteSpace: "pre-wrap",
                      maxHeight: "200px",
                      overflowY: "auto",
                      fontFamily: "monospace",
                      lineHeight: "1.5",
                    }}
                  >
                    <strong>Note: Click the "Get Token" button below to open the {lmsForm.lmsType} access token creation page in your browser</strong>
                    {"\n\n"}
                    {tokenInstructions}
                  </div>
                )}
              </div>
            )}

            <input
              type="text"
              value={lmsTokenDialogValue}
              onChange={(e) => setLmsTokenDialogValue(e.target.value)}
              placeholder="Paste copied token here"
              autoFocus={!showTokenInstructions}
              className="dialog-input"
            />
            <div className="dialog-buttons">
              <button className="btn-action" onClick={openLmsTokenUrl}>
                Get Token
              </button>
              <button className="btn-action" onClick={saveLmsToken}>
                OK
              </button>
              <button className="btn-action" onClick={closeLmsTokenDialog}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Menu */}
      <SettingsMenu
        isOpen={settingsMenuOpen}
        onClose={() => setSettingsMenuOpen(false)}
        currentSettings={currentGuiSettings || {
          lms_type: lmsForm.lmsType,
          lms_base_url: lmsForm.baseUrl,
          lms_custom_url: lmsForm.customUrl,
          lms_url_option: lmsForm.urlOption,
          lms_access_token: lmsForm.accessToken,
          lms_course_id: lmsForm.courseId,
          lms_course_name: lmsForm.courseName,
          lms_yaml_file: lmsForm.yamlFile,
          lms_info_folder: lmsForm.infoFileFolder,
          lms_csv_file: lmsForm.csvFile,
          lms_xlsx_file: lmsForm.xlsxFile,
          lms_member_option: lmsForm.memberOption,
          lms_include_group: lmsForm.includeGroup,
          lms_include_member: lmsForm.includeMember,
          lms_include_initials: lmsForm.includeInitials,
          lms_full_groups: lmsForm.fullGroups,
          lms_output_csv: lmsForm.csv,
          lms_output_xlsx: lmsForm.xlsx,
          lms_output_yaml: lmsForm.yaml,
          git_base_url: form.baseUrl,
          git_access_token: form.accessToken,
          git_user: form.user,
          git_student_repos_group: form.studentReposGroup,
          git_template_group: form.templateGroup,
          yaml_file: form.yamlFile,
          target_folder: form.targetFolder,
          assignments: form.assignments,
          directory_layout: form.directoryLayout,
          log_info: form.logLevels.info,
          log_debug: form.logLevels.debug,
          log_warning: form.logLevels.warning,
          log_error: form.logLevels.error,
          active_tab: activeTab,
          config_locked: configLocked,
          options_locked: optionsLocked,
          window_width: 0,
          window_height: 0,
          window_x: 0,
          window_y: 0,
        }}
        onSettingsLoaded={handleSettingsLoaded}
        onMessage={appendOutput}
      />
    </div>
  );
}

export default App;
