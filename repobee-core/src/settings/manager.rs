use super::gui::GuiSettings;
use crate::error::{PlatformError, Result};
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

    /// Load settings from disk
    pub fn load(&self) -> Result<GuiSettings> {
        if !self.settings_file.exists() {
            // File doesn't exist, return defaults
            eprintln!("Settings file not found, using defaults: {}", self.settings_file.display());
            return Ok(GuiSettings::default());
        }

        let contents = fs::read_to_string(&self.settings_file)
            .map_err(|e| PlatformError::Other(format!("Failed to read settings file: {}", e)))?;

        let settings: GuiSettings = serde_json::from_str(&contents)
            .map_err(|e| {
                eprintln!("Failed to parse settings file: {}", e);
                eprintln!("Using defaults instead");
                // Return default settings if parsing fails
                return PlatformError::Other(format!("Invalid settings file, using defaults: {}", e));
            })?;

        Ok(settings)
    }

    /// Save settings to disk
    pub fn save(&self, settings: &GuiSettings) -> Result<()> {
        let json = serde_json::to_string_pretty(settings)
            .map_err(|e| PlatformError::Other(format!("Failed to serialize settings: {}", e)))?;

        fs::write(&self.settings_file, json)
            .map_err(|e| PlatformError::Other(format!("Failed to write settings file: {}", e)))?;

        Ok(())
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
}
