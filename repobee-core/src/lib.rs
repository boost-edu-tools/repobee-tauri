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

// Canvas re-exports
pub use canvas::{
    CanvasClient, CanvasCourse, CanvasUser, CanvasUserProfile, CanvasGroup,
    CanvasGroupMembership, CanvasEnrollment, StudentInfo, YamlConfig, MemberOption,
    generate_repobee_yaml, write_yaml_file, write_csv_file,
};

// Settings re-exports
pub use settings::{CommonSettings, GuiSettings, SettingsManager};
