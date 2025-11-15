use serde::{Deserialize, Serialize};
use schemars::JsonSchema;

/// Common settings shared between GUI and CLI
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct CommonSettings {
    // ===== Canvas Settings =====
    #[serde(default = "defaults::canvas_base_url")]
    pub canvas_base_url: String,

    #[serde(default)]
    pub canvas_custom_url: String,

    #[serde(default = "defaults::canvas_url_option")]
    pub canvas_url_option: String, // "TUE" or "Custom"

    #[serde(default)]
    pub canvas_access_token: String,

    #[serde(default)]
    pub canvas_course_id: String,

    #[serde(default)]
    pub canvas_course_name: String,

    #[serde(default = "defaults::canvas_yaml_file")]
    pub canvas_yaml_file: String,

    #[serde(default)]
    pub canvas_info_folder: String,

    #[serde(default = "defaults::canvas_csv_file")]
    pub canvas_csv_file: String,

    #[serde(default = "defaults::canvas_xlsx_file")]
    pub canvas_xlsx_file: String,

    #[serde(default = "defaults::canvas_member_option")]
    pub canvas_member_option: String, // "(email, gitid)", "email", "git_id"

    #[serde(default = "defaults::canvas_include_group")]
    pub canvas_include_group: bool,

    #[serde(default = "defaults::canvas_include_member")]
    pub canvas_include_member: bool,

    #[serde(default)]
    pub canvas_include_initials: bool,

    #[serde(default = "defaults::canvas_full_groups")]
    pub canvas_full_groups: bool,

    #[serde(default)]
    pub canvas_output_csv: bool,

    #[serde(default)]
    pub canvas_output_xlsx: bool,

    #[serde(default = "defaults::canvas_output_yaml")]
    pub canvas_output_yaml: bool,

    // ===== Git Platform Settings =====
    #[serde(default = "defaults::git_base_url")]
    pub git_base_url: String,

    #[serde(default)]
    pub git_access_token: String,

    #[serde(default)]
    pub git_user: String,

    #[serde(default)]
    pub git_student_repos_group: String,

    #[serde(default)]
    pub git_template_group: String,

    // ===== Repository Setup Settings =====
    #[serde(default = "defaults::yaml_file")]
    pub yaml_file: String,

    #[serde(default)]
    pub target_folder: String,

    #[serde(default)]
    pub assignments: String,

    #[serde(default = "defaults::directory_layout")]
    pub directory_layout: String, // "by-team", "flat", "by-task"

    // ===== Logging Settings =====
    #[serde(default = "defaults::log_info")]
    pub log_info: bool,

    #[serde(default)]
    pub log_debug: bool,

    #[serde(default = "defaults::log_warning")]
    pub log_warning: bool,

    #[serde(default = "defaults::log_error")]
    pub log_error: bool,
}

impl Default for CommonSettings {
    fn default() -> Self {
        Self {
            // Canvas settings
            canvas_base_url: defaults::canvas_base_url(),
            canvas_custom_url: String::new(),
            canvas_url_option: defaults::canvas_url_option(),
            canvas_access_token: String::new(),
            canvas_course_id: String::new(),
            canvas_course_name: String::new(),
            canvas_yaml_file: defaults::canvas_yaml_file(),
            canvas_info_folder: String::new(),
            canvas_csv_file: defaults::canvas_csv_file(),
            canvas_xlsx_file: defaults::canvas_xlsx_file(),
            canvas_member_option: defaults::canvas_member_option(),
            canvas_include_group: defaults::canvas_include_group(),
            canvas_include_member: defaults::canvas_include_member(),
            canvas_include_initials: false,
            canvas_full_groups: defaults::canvas_full_groups(),
            canvas_output_csv: false,
            canvas_output_xlsx: false,
            canvas_output_yaml: defaults::canvas_output_yaml(),

            // Git platform settings
            git_base_url: defaults::git_base_url(),
            git_access_token: String::new(),
            git_user: String::new(),
            git_student_repos_group: String::new(),
            git_template_group: String::new(),

            // Repository setup settings
            yaml_file: defaults::yaml_file(),
            target_folder: String::new(),
            assignments: String::new(),
            directory_layout: defaults::directory_layout(),

            // Logging settings
            log_info: defaults::log_info(),
            log_debug: false,
            log_warning: defaults::log_warning(),
            log_error: defaults::log_error(),
        }
    }
}

/// Default values for settings
mod defaults {
    pub fn canvas_base_url() -> String {
        "https://canvas.tue.nl".to_string()
    }

    pub fn canvas_url_option() -> String {
        "TUE".to_string()
    }

    pub fn canvas_yaml_file() -> String {
        "students.yaml".to_string()
    }

    pub fn canvas_csv_file() -> String {
        "student-info.csv".to_string()
    }

    pub fn canvas_xlsx_file() -> String {
        "student-info.xlsx".to_string()
    }

    pub fn canvas_member_option() -> String {
        "(email, gitid)".to_string()
    }

    pub fn canvas_include_group() -> bool {
        true
    }

    pub fn canvas_include_member() -> bool {
        true
    }

    pub fn canvas_full_groups() -> bool {
        true
    }

    pub fn canvas_output_yaml() -> bool {
        true
    }

    pub fn git_base_url() -> String {
        "https://gitlab.tue.nl".to_string()
    }

    pub fn yaml_file() -> String {
        "students.yaml".to_string()
    }

    pub fn directory_layout() -> String {
        "flat".to_string()
    }

    pub fn log_info() -> bool {
        true
    }

    pub fn log_warning() -> bool {
        true
    }

    pub fn log_error() -> bool {
        true
    }
}
