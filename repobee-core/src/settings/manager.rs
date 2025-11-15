use super::gui::GuiSettings;
use crate::error::{PlatformError, Result};
use schemars::schema_for;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

/// Settings manager for loading, saving, and managing application settings
pub struct SettingsManager {
    config_dir: PathBuf,
    settings_file: PathBuf,
}

impl SettingsManager {
    /// Create a new settings manager
    pub fn new() -> Result<Self> {
        let config_dir = Self::get_config_dir()?;
        let settings_file = config_dir.join("repobee.json");

        // Ensure config directory exists
        fs::create_dir_all(&config_dir)
            .map_err(|e| PlatformError::Other(format!("Failed to create config directory: {}", e)))?;

        Ok(Self {
            config_dir,
            settings_file,
        })
    }

    /// Get platform-specific config directory
    fn get_config_dir() -> Result<PathBuf> {
        let config_dir = if cfg!(target_os = "macos") {
            dirs::home_dir()
                .ok_or_else(|| PlatformError::Other("Could not find home directory".to_string()))?
                .join("Library")
                .join("Application Support")
                .join("repobee-tauri")
        } else if cfg!(target_os = "windows") {
            dirs::config_dir()
                .ok_or_else(|| PlatformError::Other("Could not find config directory".to_string()))?
                .join("repobee-tauri")
        } else {
            // Linux and other Unix-like systems
            dirs::config_dir()
                .ok_or_else(|| PlatformError::Other("Could not find config directory".to_string()))?
                .join("repobee-tauri")
        };

        Ok(config_dir)
    }

    /// Validate JSON data against GuiSettings schema
    fn validate_settings(&self, json_value: &Value) -> Result<Vec<String>> {
        // Generate schema for GuiSettings
        let schema = schema_for!(GuiSettings);
        let schema_json = serde_json::to_value(&schema)
            .map_err(|e| PlatformError::Other(format!("Failed to serialize schema: {}", e)))?;

        // Compile the schema
        let compiled = jsonschema::JSONSchema::compile(&schema_json)
            .map_err(|e| PlatformError::Other(format!("Failed to compile schema: {}", e)))?;

        // Validate the JSON
        let mut errors = Vec::new();
        if let Err(validation_errors) = compiled.validate(json_value) {
            for error in validation_errors {
                errors.push(format!("{} at {}", error, error.instance_path));
            }
        }

        Ok(errors)
    }

    /// Load settings from disk
    /// Returns default settings if file doesn't exist (no error)
    pub fn load(&self) -> Result<GuiSettings> {
        if !self.settings_file.exists() {
            // File doesn't exist, return defaults silently
            return Ok(GuiSettings::default());
        }

        let contents = fs::read_to_string(&self.settings_file)
            .map_err(|e| PlatformError::Other(format!("Failed to read settings file: {}", e)))?;

        // Parse as generic JSON first
        let json_value: Value = serde_json::from_str(&contents)
            .map_err(|e| PlatformError::Other(format!("Invalid JSON in settings file: {}", e)))?;

        // Validate against schema
        let validation_errors = self.validate_settings(&json_value)?;
        if !validation_errors.is_empty() {
            // Return error with validation details
            let error_msg = format!(
                "Settings validation errors:\n{}",
                validation_errors.join("\n")
            );
            return Err(PlatformError::Other(error_msg));
        }

        // Deserialize to GuiSettings
        let settings: GuiSettings = serde_json::from_value(json_value)
            .map_err(|e| PlatformError::Other(format!("Invalid settings structure: {}", e)))?;

        Ok(settings)
    }

    /// Save settings to disk
    pub fn save(&self, settings: &GuiSettings) -> Result<()> {
        // Validate settings before saving
        let json_value = serde_json::to_value(settings)
            .map_err(|e| PlatformError::Other(format!("Failed to serialize settings: {}", e)))?;

        let validation_errors = self.validate_settings(&json_value)?;
        if !validation_errors.is_empty() {
            let error_msg = format!(
                "Settings validation failed:\n{}",
                validation_errors.join("\n")
            );
            return Err(PlatformError::Other(error_msg));
        }

        let json = serde_json::to_string_pretty(settings)
            .map_err(|e| PlatformError::Other(format!("Failed to serialize settings: {}", e)))?;

        fs::write(&self.settings_file, json)
            .map_err(|e| PlatformError::Other(format!("Failed to write settings file: {}", e)))?;

        Ok(())
    }

    /// Get the JSON Schema for GuiSettings
    pub fn get_schema() -> Result<Value> {
        let schema = schema_for!(GuiSettings);
        serde_json::to_value(&schema)
            .map_err(|e| PlatformError::Other(format!("Failed to serialize schema: {}", e)))
    }

    /// Reset settings to defaults
    pub fn reset(&self) -> Result<GuiSettings> {
        let settings = GuiSettings::default();
        self.save(&settings)?;
        Ok(settings)
    }

    /// Get the path to the settings file
    pub fn settings_file_path(&self) -> &PathBuf {
        &self.settings_file
    }

    /// Get the config directory path
    pub fn config_dir_path(&self) -> &PathBuf {
        &self.config_dir
    }

    /// Check if settings file exists
    pub fn settings_exist(&self) -> bool {
        self.settings_file.exists()
    }
}

impl Default for SettingsManager {
    fn default() -> Self {
        Self::new().expect("Failed to create SettingsManager")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_config_dir() {
        let config_dir = SettingsManager::get_config_dir().unwrap();
        assert!(config_dir.to_string_lossy().contains("repobee-tauri"));
    }

    #[test]
    fn test_default_settings() {
        let settings = GuiSettings::default();
        assert_eq!(settings.common.canvas_base_url, "https://canvas.tue.nl");
        assert_eq!(settings.common.git_base_url, "https://gitlab.tue.nl");
        assert_eq!(settings.active_tab, "canvas");
    }

    #[test]
    fn test_serialize_deserialize() {
        let settings = GuiSettings::default();
        let json = serde_json::to_string(&settings).unwrap();
        let deserialized: GuiSettings = serde_json::from_str(&json).unwrap();

        assert_eq!(settings.common.canvas_base_url, deserialized.common.canvas_base_url);
        assert_eq!(settings.active_tab, deserialized.active_tab);
    }

    #[test]
    fn test_schema_generation() {
        let schema = SettingsManager::get_schema();
        assert!(schema.is_ok());
        let schema_value = schema.unwrap();
        assert!(schema_value.is_object());
    }

    #[test]
    fn test_valid_settings_validation() {
        let manager = SettingsManager::new().unwrap();
        let settings = GuiSettings::default();
        let json_value = serde_json::to_value(&settings).unwrap();

        let errors = manager.validate_settings(&json_value).unwrap();
        assert!(errors.is_empty(), "Default settings should be valid");
    }

    #[test]
    fn test_invalid_settings_validation() {
        let manager = SettingsManager::new().unwrap();

        // Create invalid JSON with wrong types
        let invalid_json = serde_json::json!({
            "common": {
                "canvas_base_url": 12345,  // Should be string
                "log_info": "not a boolean"  // Should be boolean
            },
            "active_tab": "canvas",
            "window_width": "not a number"  // Should be number
        });

        let errors = manager.validate_settings(&invalid_json).unwrap();
        assert!(!errors.is_empty(), "Invalid settings should produce validation errors");
    }

    #[test]
    fn test_save_with_validation() {
        use tempfile::TempDir;

        // Create a temporary directory for testing
        let temp_dir = TempDir::new().unwrap();
        let settings_file = temp_dir.path().join("repobee.json");

        let manager = SettingsManager {
            config_dir: temp_dir.path().to_path_buf(),
            settings_file: settings_file.clone(),
        };

        // Valid settings should save successfully
        let valid_settings = GuiSettings::default();
        assert!(manager.save(&valid_settings).is_ok());
        assert!(settings_file.exists());
    }
}
