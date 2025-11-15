//! Settings management module for RepoBee
//!
//! This module provides persistent settings storage with:
//! - Platform-specific config directories
//! - JSON serialization
//! - Default values
//! - Graceful error handling

mod common;
mod gui;
mod manager;

pub use common::CommonSettings;
pub use gui::GuiSettings;
pub use manager::SettingsManager;
