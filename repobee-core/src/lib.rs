//! RepoBee Core Library
//!
//! This crate provides the core abstractions and types for RepoBee,
//! including platform API abstraction for GitHub, GitLab, and Gitea.

pub mod canvas;
pub mod error;
pub mod platform;
pub mod settings;
pub mod setup;
pub mod types;

// Re-export commonly used items
pub use error::{PlatformError, Result};
pub use platform::{Platform, PlatformAPI};
pub use setup::{setup_student_repos, SetupResult, SetupError};
pub use types::{Issue, IssueState, Repo, StudentRepo, StudentTeam, Team, TeamPermission, TemplateRepo};

// LMS and Canvas re-exports
pub use canvas::{
    StudentInfo, YamlConfig, MemberOption,
    generate_repobee_yaml, write_yaml_file, write_csv_file,
    create_lms_client_with_params, get_student_info,  // LMS client factory functions
};

// Re-export lms-common types (used throughout the app)
pub use lms_common::{Course, Group, GroupMembership, User, LmsClient as LmsClientTrait};

// Re-export unified LMS client
pub use lms_client::{LmsClient, LmsAuth, LmsType};

// Settings re-exports
pub use settings::{CommonSettings, GuiSettings, SettingsManager};
