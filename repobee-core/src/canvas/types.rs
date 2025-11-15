use serde::{Deserialize, Serialize};

/// Canvas User/Student information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasUser {
    pub id: u64,
    pub name: String,
    pub short_name: Option<String>,
    pub login_id: Option<String>,
    pub sis_user_id: Option<String>,
}

/// Canvas User Profile (detailed information)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasUserProfile {
    pub id: u64,
    pub name: String,
    pub short_name: Option<String>,
    pub primary_email: Option<String>,
    pub login_id: Option<String>,
    pub sis_user_id: Option<String>,
}

/// Canvas Course information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasCourse {
    pub id: u64,
    pub name: String,
    pub course_code: Option<String>,
}

/// Canvas Group information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasGroup {
    pub id: u64,
    pub name: String,
    pub members_count: Option<u32>,
    pub max_membership: Option<u32>,
}

/// Canvas Group Membership
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasGroupMembership {
    pub id: u64,
    pub user_id: u64,
    pub group_id: u64,
}

/// Canvas Enrollment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasEnrollment {
    pub id: u64,
    pub user_id: u64,
    pub course_id: u64,
    #[serde(rename = "type")]
    pub enrollment_type: String,
    pub role: String,
}

/// Student information mapped from Canvas
#[derive(Debug, Clone)]
pub struct StudentInfo {
    pub group: Option<CanvasGroup>,
    pub full_name: String,
    pub name: String,           // Last name
    pub canvas_id: String,      // login_id
    pub git_id: String,         // sis_user_id
    pub email: String,          // primary_email
}

/// Configuration for YAML generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YamlConfig {
    pub member_option: MemberOption,
    pub include_group: bool,
    pub include_member: bool,
    pub include_initials: bool,
    pub full_groups: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MemberOption {
    #[serde(rename = "(email, gitid)")]
    Both,
    #[serde(rename = "email")]
    Email,
    #[serde(rename = "git_id")]
    GitId,
}

impl MemberOption {
    pub fn from_str(s: &str) -> Self {
        match s {
            "(email, gitid)" => Self::Both,
            "email" => Self::Email,
            "git_id" => Self::GitId,
            _ => Self::Both,
        }
    }
}
