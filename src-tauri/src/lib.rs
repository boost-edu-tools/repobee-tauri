use repobee_core::{Platform, PlatformAPI, StudentTeam};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConfigParams {
    access_token: String,
    user: String,
    base_url: String,
    student_repos_group: String,
    template_group: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SetupParams {
    config: ConfigParams,
    yaml_file: String,
    assignments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CloneParams {
    config: ConfigParams,
    yaml_file: String,
    assignments: String,
    target_folder: String,
    directory_layout: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CommandResult {
    success: bool,
    message: String,
    details: Option<String>,
}

/// Verify platform configuration and authentication
#[tauri::command]
async fn verify_config(params: ConfigParams) -> Result<CommandResult, String> {
    // Determine platform from base_url
    let platform = if params.base_url.starts_with('/') || params.base_url.contains("local") {
        // Local filesystem platform
        Platform::local(
            PathBuf::from(&params.base_url),
            params.student_repos_group.clone(),
            params.user.clone(),
        )
        .map_err(|e| format!("Failed to create Local platform: {}", e))?
    } else if params.base_url.contains("github") {
        Platform::github(
            params.base_url.clone(),
            params.access_token.clone(),
            params.student_repos_group.clone(),
            params.user.clone(),
        )
        .map_err(|e| format!("Failed to create GitHub platform: {}", e))?
    } else if params.base_url.contains("gitlab") {
        Platform::gitlab(
            params.base_url.clone(),
            params.access_token.clone(),
            params.student_repos_group.clone(),
            params.user.clone(),
        )
        .map_err(|e| format!("Failed to create GitLab platform: {}", e))?
    } else if params.base_url.contains("gitea") {
        Platform::gitea(
            params.base_url.clone(),
            params.access_token.clone(),
            params.student_repos_group.clone(),
            params.user.clone(),
        )
        .map_err(|e| format!("Failed to create Gitea platform: {}", e))?
    } else {
        return Err("Unknown platform. URL must contain 'github', 'gitlab', 'gitea', or be a filesystem path".to_string());
    };

    // Verify settings
    platform
        .verify_settings()
        .await
        .map_err(|e| format!("Verification failed: {}", e))?;

    let platform_name = if params.base_url.starts_with('/') || params.base_url.contains("local") {
        "Local (filesystem)"
    } else {
        &params.base_url
    };

    Ok(CommandResult {
        success: true,
        message: format!("✓ Configuration verified successfully for {}", params.student_repos_group),
        details: Some(format!(
            "Platform: {}\nOrganization: {}\nUser: {}",
            platform_name, params.student_repos_group, params.user
        )),
    })
}

/// Create student repositories from templates
#[tauri::command]
async fn setup_repos(params: SetupParams) -> Result<CommandResult, String> {
    // Parse YAML file to get student teams
    let yaml_content = std::fs::read_to_string(&params.yaml_file)
        .map_err(|e| format!("Failed to read YAML file: {}", e))?;

    let student_teams: Vec<StudentTeam> = serde_yaml::from_str(&yaml_content)
        .map_err(|e| format!("Failed to parse YAML file: {}", e))?;

    // Parse assignments (comma-separated template names)
    let assignments: Vec<String> = params
        .assignments
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if assignments.is_empty() {
        return Err("No assignments specified".to_string());
    }

    // Create template URLs from assignments and template group
    let template_urls: Vec<String> = assignments
        .iter()
        .map(|assignment| {
            let path = if params.config.template_group.is_empty() {
                // No template group specified, use student repos group
                format!("{}/{}/{}", params.config.base_url, params.config.student_repos_group, assignment)
            } else if params.config.template_group.starts_with('/') {
                // Template group is an absolute path, use it directly
                format!("{}/{}", params.config.template_group, assignment)
            } else {
                // Template group is relative, concatenate with base URL
                format!("{}/{}/{}", params.config.base_url, params.config.template_group, assignment)
            };

            // For local filesystem paths, git2 expects regular paths without file:// prefix
            path
        })
        .collect();

    // Determine platform
    let platform = if params.config.base_url.starts_with('/') || params.config.base_url.contains("local") {
        // Local filesystem platform
        Platform::local(
            PathBuf::from(&params.config.base_url),
            params.config.student_repos_group.clone(),
            params.config.user.clone(),
        )
        .map_err(|e| format!("Failed to create Local platform: {}", e))?
    } else if params.config.base_url.contains("github") {
        Platform::github(
            params.config.base_url.clone(),
            params.config.access_token.clone(),
            params.config.student_repos_group.clone(),
            params.config.user.clone(),
        )
        .map_err(|e| format!("Failed to create GitHub platform: {}", e))?
    } else if params.config.base_url.contains("gitlab") {
        Platform::gitlab(
            params.config.base_url.clone(),
            params.config.access_token.clone(),
            params.config.student_repos_group.clone(),
            params.config.user.clone(),
        )
        .map_err(|e| format!("Failed to create GitLab platform: {}", e))?
    } else if params.config.base_url.contains("gitea") {
        Platform::gitea(
            params.config.base_url.clone(),
            params.config.access_token.clone(),
            params.config.student_repos_group.clone(),
            params.config.user.clone(),
        )
        .map_err(|e| format!("Failed to create Gitea platform: {}", e))?
    } else {
        return Err("Unknown platform. URL must contain 'github', 'gitlab', 'gitea', or be a filesystem path".to_string());
    };

    // Create work directory
    let work_dir = PathBuf::from("./repobee-work");
    std::fs::create_dir_all(&work_dir)
        .map_err(|e| format!("Failed to create work directory: {}", e))?;

    // Run setup
    let result = repobee_core::setup_student_repos(
        &template_urls,
        &student_teams,
        &platform,
        &work_dir,
        true, // private repos
        Some(&params.config.access_token),
    )
    .await
    .map_err(|e| format!("Setup failed: {}", e))?;

    let details = format!(
        "Successfully created: {} repositories\nAlready existed: {} repositories\nErrors: {}",
        result.successful_repos.len(),
        result.existing_repos.len(),
        result.errors.len()
    );

    if result.is_success() {
        Ok(CommandResult {
            success: true,
            message: "🎉 Student repositories created successfully!".to_string(),
            details: Some(details),
        })
    } else {
        let error_details = result
            .errors
            .iter()
            .map(|e| format!("  - {}/{}: {}", e.team_name, e.repo_name, e.error))
            .collect::<Vec<_>>()
            .join("\n");

        Ok(CommandResult {
            success: false,
            message: format!("Setup completed with {} errors", result.errors.len()),
            details: Some(format!("{}\n\nErrors:\n{}", details, error_details)),
        })
    }
}

/// Clone student repositories (stub for now)
#[tauri::command]
async fn clone_repos(_params: CloneParams) -> Result<CommandResult, String> {
    // TODO: Implement clone functionality
    // For now, return a stub response
    Err("Clone functionality not yet implemented".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            verify_config,
            setup_repos,
            clone_repos
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
