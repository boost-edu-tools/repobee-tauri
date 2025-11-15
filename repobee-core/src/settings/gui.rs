use super::common::CommonSettings;
use serde::{Deserialize, Serialize};

/// GUI-specific settings (extends CommonSettings)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuiSettings {
    /// Common settings shared with CLI
    #[serde(flatten)]
    pub common: CommonSettings,

    // ===== GUI-Only Settings =====
    #[serde(default = "defaults::active_tab")]
    pub active_tab: String, // "canvas" or "repo"

    #[serde(default)]
    pub config_locked: bool,

    #[serde(default)]
    pub options_locked: bool,

    #[serde(default)]
    pub window_width: u32,

    #[serde(default)]
    pub window_height: u32,

    #[serde(default)]
    pub window_x: i32,

    #[serde(default)]
    pub window_y: i32,
}

impl Default for GuiSettings {
    fn default() -> Self {
        Self {
            common: CommonSettings::default(),
            active_tab: defaults::active_tab(),
            config_locked: true,
            options_locked: true,
            window_width: 0,
            window_height: 0,
            window_x: 0,
            window_y: 0,
        }
    }
}

impl GuiSettings {
    /// Create new GUI settings with default values
    pub fn new() -> Self {
        Self::default()
    }

    /// Create GUI settings from common settings
    pub fn from_common(common: CommonSettings) -> Self {
        Self {
            common,
            ..Default::default()
        }
    }
}

mod defaults {
    pub fn active_tab() -> String {
        "canvas".to_string()
    }
}
