///! Factory for creating unified LMS clients from settings

use crate::error::{PlatformError, Result};
use crate::settings::CommonSettings;
use crate::canvas::types::StudentInfo;
use lms_client::{LmsAuth, LmsClient, LmsType};
use lms_common::LmsClient as _;  // Import trait to call its methods
use std::collections::HashMap;

/// Create an LMS client based on settings
pub fn create_lms_client(settings: &CommonSettings) -> Result<LmsClient> {
    // Determine LMS type from settings
    let lms_type = match settings.lms_type.as_str() {
        "Canvas" => LmsType::Canvas,
        "Moodle" => LmsType::Moodle,
        _ => {
            return Err(PlatformError::Other(format!(
                "Unknown LMS type: {}. Supported: Canvas, Moodle",
                settings.lms_type
            )))
        }
    };

    // Determine base URL (Canvas allows TUE shortcut or custom)
    let base_url = if settings.lms_type == "Canvas" {
        if settings.canvas_url_option == "TUE" {
            settings.canvas_base_url.clone()
        } else {
            settings.canvas_custom_url.clone()
        }
    } else {
        // For Moodle, use canvas_custom_url field (or add dedicated fields)
        settings.canvas_custom_url.clone()
    };

    // Create authentication (both Canvas and Moodle use token auth)
    let auth = LmsAuth::Token {
        url: base_url,
        token: settings.canvas_access_token.clone(),
    };

    // Create the unified client
    LmsClient::new(lms_type, auth).map_err(|e| PlatformError::Other(e.to_string()))
}

/// Create an LMS client with explicit parameters (for Tauri commands)
pub fn create_lms_client_with_params(
    lms_type: &str,
    base_url: String,
    access_token: String,
) -> Result<LmsClient> {
    let lms_type = match lms_type {
        "Canvas" => LmsType::Canvas,
        "Moodle" => LmsType::Moodle,
        _ => {
            return Err(PlatformError::Other(format!(
                "Unknown LMS type: {}. Supported: Canvas, Moodle",
                lms_type
            )))
        }
    };

    let auth = LmsAuth::Token {
        url: base_url,
        token: access_token,
    };

    LmsClient::new(lms_type, auth).map_err(|e| PlatformError::Other(e.to_string()))
}

/// Fetch all student information for a course using the unified LMS client
pub async fn get_student_info(client: &LmsClient, course_id: &str) -> Result<Vec<StudentInfo>> {
    // Fetch all data in parallel
    let (users, groups) = tokio::try_join!(
        client.get_users(course_id),
        client.get_groups(course_id)
    )
    .map_err(|e| PlatformError::Other(format!("Failed to fetch course data: {}", e)))?;

    // Build a map of user_id -> group
    let mut user_to_group = HashMap::new();
    for group in &groups {
        let memberships = client
            .get_group_members(&group.id)
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to fetch group memberships: {}", e)))?;

        for membership in memberships {
            user_to_group.insert(membership.user_id.clone(), group.clone());
        }
    }

    // Build student info from users
    let mut student_infos = Vec::new();
    for user in users {
        let email = user.email.clone().unwrap_or_default();
        let git_id = user.login_id.clone().unwrap_or_default();
        let name = extract_lastname_from_email(&email);

        let student_info = StudentInfo {
            group: user_to_group.get(&user.id).cloned(),
            full_name: user.name.clone(),
            name,
            canvas_id: user.login_id.unwrap_or_default(),
            git_id,
            email,
        };

        student_infos.push(student_info);
    }

    Ok(student_infos)
}

/// Extract lastname from email (e.g., "john.doe@uni.nl" -> "doe")
fn extract_lastname_from_email(email: &str) -> String {
    email
        .split('@')
        .next()
        .unwrap_or("")
        .split('.')
        .last()
        .unwrap_or("")
        .to_string()
}
