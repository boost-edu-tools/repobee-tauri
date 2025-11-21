use super::atomic::atomic_write_json;
use super::error::{ConfigError, ConfigResult};
use super::gui::GuiSettings;
use super::location::LocationManager;
use super::normalization::Normalize;
use super::validation::Validate;
use schemars::schema_for;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

/// Settings manager for loading, saving, and managing application settings
pub struct SettingsManager {
    config_dir: PathBuf,
    location_manager: LocationManager,
}

impl SettingsManager {
    /// Create a new settings manager
    pub fn new() -> ConfigResult<Self> {
        let config_dir = Self::get_config_dir()?;
        let location_manager = LocationManager::new(&config_dir, "repobee");

        // Ensure config directory exists
        fs::create_dir_all(&config_dir).map_err(|e| {
            ConfigError::CreateDirError {
                path: config_dir.clone(),
                source: e,
            }
        })?;

        Ok(Self {
            config_dir,
            location_manager,
        })
    }

    /// Get platform-specific config directory
    fn get_config_dir() -> ConfigResult<PathBuf> {
        // Try using directories crate first for better XDG compliance
        if let Some(proj_dirs) = directories::ProjectDirs::from("", "", "repobee-tauri") {
            return Ok(proj_dirs.config_dir().to_path_buf());
        }

        // Fallback to dirs crate
        let config_dir = if cfg!(target_os = "macos") {
            dirs::home_dir()
                .ok_or_else(|| ConfigError::ConfigDirError {
                    message: "Could not find home directory".to_string(),
                })?
                .join("Library")
                .join("Application Support")
                .join("repobee-tauri")
        } else if cfg!(target_os = "windows") {
            dirs::config_dir()
                .ok_or_else(|| ConfigError::ConfigDirError {
                    message: "Could not find config directory".to_string(),
                })?
                .join("repobee-tauri")
        } else {
            // Linux and other Unix-like systems
            dirs::config_dir()
                .ok_or_else(|| ConfigError::ConfigDirError {
                    message: "Could not find config directory".to_string(),
                })?
                .join("repobee-tauri")
        };

        Ok(config_dir)
    }

    /// Validate JSON data against GuiSettings schema
    fn validate_settings(&self, json_value: &Value) -> ConfigResult<Vec<String>> {
        // Generate schema for GuiSettings
        let schema = schema_for!(GuiSettings);
        let schema_json = serde_json::to_value(&schema)
            .map_err(|e| ConfigError::SchemaSerializationError { source: e })?;

        // Compile the schema
        let compiled = jsonschema::JSONSchema::compile(&schema_json)
            .map_err(|e| ConfigError::SchemaCompileError {
                message: e.to_string(),
            })?;

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
    pub fn load(&self) -> ConfigResult<GuiSettings> {
        let location = self.location_manager.load()?;
        let settings_file = location.settings_path();

        if !settings_file.exists() {
            // File doesn't exist, return defaults silently
            return Ok(GuiSettings::default());
        }

        let contents = fs::read_to_string(settings_file).map_err(|e| ConfigError::ReadError {
            path: settings_file.to_path_buf(),
            source: e,
        })?;

        // Parse as generic JSON first
        let json_value: Value =
            serde_json::from_str(&contents).map_err(|e| ConfigError::JsonParseError {
                path: settings_file.to_path_buf(),
                source: e,
            })?;

        // Validate against schema
        let validation_errors = self.validate_settings(&json_value)?;
        if !validation_errors.is_empty() {
            return Err(ConfigError::ValidationError {
                errors: validation_errors,
            });
        }

        // Deserialize to GuiSettings
        let mut settings: GuiSettings =
            serde_json::from_value(json_value).map_err(|e| ConfigError::JsonParseError {
                path: settings_file.to_path_buf(),
                source: e,
            })?;

        // Normalize the settings
        settings.normalize();

        // Validate the settings
        settings.validate()?;

        Ok(settings)
    }

    /// Save settings to disk
    pub fn save(&self, settings: &GuiSettings) -> ConfigResult<()> {
        // Validate settings before saving
        settings.validate()?;

        let json_value = serde_json::to_value(settings).map_err(|e| ConfigError::JsonParseError {
            path: self.settings_file_path().to_path_buf(),
            source: e,
        })?;

        let validation_errors = self.validate_settings(&json_value)?;
        if !validation_errors.is_empty() {
            return Err(ConfigError::ValidationError {
                errors: validation_errors,
            });
        }

        let location = self.location_manager.load()?;
        let settings_file = location.settings_path();

        // Use atomic write for safety
        atomic_write_json(settings_file, settings)?;

        Ok(())
    }

    /// Save settings to a specific file
    pub fn save_to(&self, settings: &GuiSettings, path: &Path) -> ConfigResult<()> {
        // Validate settings before saving
        settings.validate()?;

        let json_value = serde_json::to_value(settings).map_err(|e| ConfigError::JsonParseError {
            path: path.to_path_buf(),
            source: e,
        })?;

        let validation_errors = self.validate_settings(&json_value)?;
        if !validation_errors.is_empty() {
            return Err(ConfigError::ValidationError {
                errors: validation_errors,
            });
        }

        // Use atomic write for safety
        atomic_write_json(path, settings)?;

        // Update location file to point to this new file
        self.location_manager.save(path)?;

        Ok(())
    }

    /// Load settings from a specific file
    pub fn load_from(&self, path: &Path) -> ConfigResult<GuiSettings> {
        if !path.exists() {
            return Err(ConfigError::FileNotFound {
                path: path.to_path_buf(),
            });
        }

        let contents = fs::read_to_string(path).map_err(|e| ConfigError::ReadError {
            path: path.to_path_buf(),
            source: e,
        })?;

        let json_value: Value =
            serde_json::from_str(&contents).map_err(|e| ConfigError::JsonParseError {
                path: path.to_path_buf(),
                source: e,
            })?;

        let validation_errors = self.validate_settings(&json_value)?;
        if !validation_errors.is_empty() {
            return Err(ConfigError::ValidationError {
                errors: validation_errors,
            });
        }

        let mut settings: GuiSettings =
            serde_json::from_value(json_value).map_err(|e| ConfigError::JsonParseError {
                path: path.to_path_buf(),
                source: e,
            })?;

        settings.normalize();
        settings.validate()?;

        // Update location file to point to this file
        self.location_manager.save(path)?;

        Ok(settings)
    }

    /// Get the JSON Schema for GuiSettings
    pub fn get_schema() -> ConfigResult<Value> {
        let schema = schema_for!(GuiSettings);
        serde_json::to_value(&schema).map_err(|e| ConfigError::SchemaSerializationError { source: e })
    }

    /// Reset settings to defaults
    pub fn reset(&self) -> ConfigResult<GuiSettings> {
        let settings = GuiSettings::default();
        self.save(&settings)?;
        Ok(settings)
    }

    /// Reset settings file location to default
    pub fn reset_location(&self) -> ConfigResult<()> {
        self.location_manager.reset()
    }

    /// Get the path to the settings file
    pub fn settings_file_path(&self) -> PathBuf {
        self.location_manager
            .load()
            .map(|loc| loc.settings_path().to_path_buf())
            .unwrap_or_else(|_| self.location_manager.default_settings_file_path().to_path_buf())
    }

    /// Get the config directory path
    pub fn config_dir_path(&self) -> &PathBuf {
        &self.config_dir
    }

    /// Get the location manager
    pub fn location_manager(&self) -> &LocationManager {
        &self.location_manager
    }

    /// Check if settings file exists
    pub fn settings_exist(&self) -> bool {
        self.settings_file_path().exists()
    }
}

impl Default for SettingsManager {
    fn default() -> Self {
        Self::new().expect("Failed to create SettingsManager")
    }
}

/// Load strategy for error handling
pub enum LoadStrategy {
    /// Return error on any failure
    Strict,
    /// Return default config on error
    DefaultOnError,
}

impl SettingsManager {
    /// Load settings with a specific error handling strategy
    pub fn load_with_strategy(&self, strategy: LoadStrategy) -> ConfigResult<GuiSettings> {
        match self.load() {
            Ok(settings) => Ok(settings),
            Err(e) => match strategy {
                LoadStrategy::Strict => Err(e),
                LoadStrategy::DefaultOnError => {
                    log::warn!("Failed to load settings, using defaults: {}", e);
                    Ok(GuiSettings::default())
                }
            },
        }
    }

    /// Load settings or return defaults (never fails)
    pub fn load_or_default(&self) -> GuiSettings {
        self.load_with_strategy(LoadStrategy::DefaultOnError)
            .unwrap_or_default()
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
        assert_eq!(settings.common.lms_base_url, "https://canvas.tue.nl");
        assert_eq!(settings.common.git_base_url, "https://gitlab.tue.nl");
        assert_eq!(settings.active_tab, crate::settings::ActiveTab::Canvas);
    }

    #[test]
    fn test_serialize_deserialize() {
        let settings = GuiSettings::default();
        let json = serde_json::to_string(&settings).unwrap();
        let deserialized: GuiSettings = serde_json::from_str(&json).unwrap();

        assert_eq!(settings.common.lms_base_url, deserialized.common.lms_base_url);
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
                "lms_base_url": 12345,  // Should be string
                "log_info": "not a boolean"  // Should be boolean
            },
            "active_tab": "canvas",
            "window_width": "not a number"  // Should be number
        });

        let errors = manager.validate_settings(&invalid_json).unwrap();
        assert!(
            !errors.is_empty(),
            "Invalid settings should produce validation errors"
        );
    }

    #[test]
    fn test_save_with_validation() {
        use tempfile::TempDir;

        // Create a temporary directory for testing
        let temp_dir = TempDir::new().unwrap();

        // Create manager with temporary directory
        let manager = SettingsManager::new().unwrap();

        // Valid settings should save successfully
        let valid_settings = GuiSettings::default();
        assert!(manager.save(&valid_settings).is_ok());
    }
}
