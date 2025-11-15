use repobee_core::{
    Platform, PlatformAPI, StudentTeam,
    CanvasClient, MemberOption, YamlConfig,
    generate_repobee_yaml, write_yaml_file, write_csv_file,
    GuiSettings, SettingsManager,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// Canvas-related parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
struct CanvasConfigParams {
    base_url: String,
    access_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct VerifyCourseParams {
    base_url: String,
    access_token: String,
    course_id: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GenerateFilesParams {
    base_url: String,
    access_token: String,
    course_id: u64,
    yaml_file: String,
    info_file_folder: String,
    csv_file: String,
    xlsx_file: String,
    member_option: String,
    include_group: bool,
    include_member: bool,
    include_initials: bool,
    full_groups: bool,
    csv: bool,
    xlsx: bool,
    yaml: bool,
}

// Git platform related parameters
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

// ===== Settings Commands =====

/// Load settings from disk
#[tauri::command]
async fn load_settings() -> Result<GuiSettings, String> {
    let manager = SettingsManager::new()
        .map_err(|e| format!("Failed to create settings manager: {}", e))?;

    let settings = manager.load()
        .map_err(|e| format!("Failed to load settings: {}", e))?;

    Ok(settings)
}

/// Save settings to disk
#[tauri::command]
async fn save_settings(settings: GuiSettings) -> Result<(), String> {
    let manager = SettingsManager::new()
        .map_err(|e| format!("Failed to create settings manager: {}", e))?;

    manager.save(&settings)
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

/// Reset settings to defaults
#[tauri::command]
async fn reset_settings() -> Result<GuiSettings, String> {
    let manager = SettingsManager::new()
        .map_err(|e| format!("Failed to create settings manager: {}", e))?;

    let settings = manager.reset()
        .map_err(|e| format!("Failed to reset settings: {}", e))?;

    Ok(settings)
}

/// Get settings file path
#[tauri::command]
async fn get_settings_path() -> Result<String, String> {
    let manager = SettingsManager::new()
        .map_err(|e| format!("Failed to create settings manager: {}", e))?;

    Ok(manager.settings_file_path().to_string_lossy().to_string())
}

// ===== Canvas Commands =====

/// Verify Canvas course credentials and fetch course information
#[tauri::command]
async fn verify_canvas_course(params: VerifyCourseParams) -> Result<CommandResult, String> {
    let client = CanvasClient::new(params.base_url.clone(), params.access_token)
        .map_err(|e| format!("Failed to create Canvas client: {}", e))?;

    let course = client
        .get_course(params.course_id)
        .await
        .map_err(|e| format!("Failed to verify course: {}", e))?;

    Ok(CommandResult {
        success: true,
        message: format!("✓ Course verified: {}", course.name),
        details: Some(format!(
            "Course ID: {}\nCourse Name: {}\nCourse Code: {}",
            course.id,
            course.name,
            course.course_code.as_deref().unwrap_or("N/A")
        )),
    })
}

/// Generate student files from Canvas course
#[tauri::command]
async fn generate_canvas_files(params: GenerateFilesParams) -> Result<CommandResult, String> {
    // Create Canvas client
    let client = CanvasClient::new(params.base_url, params.access_token)
        .map_err(|e| format!("Failed to create Canvas client: {}", e))?;

    // Fetch student information
    let students = client
        .get_student_info(params.course_id)
        .await
        .map_err(|e| format!("Failed to fetch student info: {}", e))?;

    let student_count = students.len();
    let mut generated_files = Vec::new();

    // Generate YAML file if requested
    if params.yaml {
        let config = YamlConfig {
            member_option: MemberOption::from_str(&params.member_option),
            include_group: params.include_group,
            include_member: params.include_member,
            include_initials: params.include_initials,
            full_groups: params.full_groups,
        };

        let teams = generate_repobee_yaml(&students, &config)
            .map_err(|e| format!("Failed to generate YAML: {}", e))?;

        let yaml_path = PathBuf::from(&params.yaml_file);
        write_yaml_file(&teams, &yaml_path)
            .map_err(|e| format!("Failed to write YAML file: {}", e))?;

        generated_files.push(format!("YAML: {} ({} teams)", params.yaml_file, teams.len()));
    }

    // Generate CSV file if requested
    if params.csv {
        let csv_path = PathBuf::from(&params.info_file_folder).join(&params.csv_file);
        write_csv_file(&students, &csv_path)
            .map_err(|e| format!("Failed to write CSV file: {}", e))?;

        generated_files.push(format!("CSV: {}", csv_path.display()));
    }

    // Generate Excel file if requested (TODO: implement Excel writer)
    if params.xlsx {
        return Err("Excel file generation not yet implemented".to_string());
    }

    Ok(CommandResult {
        success: true,
        message: format!("✓ Successfully generated {} file(s)", generated_files.len()),
        details: Some(format!(
            "Students processed: {}\n\nGenerated files:\n{}",
            student_count,
            generated_files.join("\n")
        )),
    })
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
            load_settings,
            save_settings,
            reset_settings,
            get_settings_path,
            verify_canvas_course,
            generate_canvas_files,
            verify_config,
            setup_repos,
            clone_repos
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
