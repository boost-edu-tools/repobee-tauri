//! RepoBee CLI - Command-line interface for RepoBee
//!
//! This CLI provides commands for managing student repositories across
//! GitHub, GitLab, Gitea, and local filesystem platforms.

use anyhow::{Context, Result};
use clap::{Parser, Subcommand, ValueEnum};
use repobee_core::{setup_student_repos, Platform, PlatformAPI, StudentTeam};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "repobee")]
#[command(author, version, about, long_about = None)]
#[command(propagate_version = true)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Set up student repositories from templates
    Setup {
        /// Platform to use (github, gitlab, gitea, local)
        #[arg(short, long, value_enum)]
        platform: PlatformType,

        /// Organization name
        #[arg(short, long)]
        org: String,

        /// Base URL (e.g., https://github.com)
        #[arg(short, long)]
        base_url: String,

        /// Authentication token (or use REPOBEE_TOKEN env var)
        #[arg(short, long, env = "REPOBEE_TOKEN")]
        token: Option<String>,

        /// User name (typically the teacher/admin)
        #[arg(short, long)]
        user: String,

        /// Template repository URLs (can be specified multiple times)
        #[arg(long = "template", required = true)]
        templates: Vec<String>,

        /// Student teams file (JSON format)
        #[arg(long)]
        teams_file: Option<PathBuf>,

        /// Working directory for cloning templates
        #[arg(long, default_value = "./repobee-work")]
        work_dir: PathBuf,

        /// Create private repositories
        #[arg(long, default_value = "true")]
        private: bool,

        /// Student teams in format "name:member1,member2" (can be specified multiple times)
        #[arg(long = "team")]
        teams: Vec<String>,
    },

    /// Verify platform settings and authentication
    Verify {
        /// Platform to use
        #[arg(short, long, value_enum)]
        platform: PlatformType,

        /// Organization name
        #[arg(short, long)]
        org: String,

        /// Base URL
        #[arg(short, long)]
        base_url: String,

        /// Authentication token
        #[arg(short, long, env = "REPOBEE_TOKEN")]
        token: String,

        /// User name
        #[arg(short, long)]
        user: String,
    },
}

#[derive(Debug, Clone, ValueEnum)]
enum PlatformType {
    GitHub,
    GitLab,
    Gitea,
    Local,
}

/// Parse team string in format "name:member1,member2" or "member1,member2" (auto-generated name)
fn parse_team(team_str: &str) -> Result<StudentTeam> {
    if let Some((name, members_str)) = team_str.split_once(':') {
        let members: Vec<String> = members_str
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();
        Ok(StudentTeam::with_name(name.to_string(), members))
    } else {
        let members: Vec<String> = team_str.split(',').map(|s| s.trim().to_string()).collect();
        Ok(StudentTeam::new(members))
    }
}

/// Load teams from a JSON file
fn load_teams_from_file(path: &PathBuf) -> Result<Vec<StudentTeam>> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("Failed to read teams file: {}", path.display()))?;

    let teams: Vec<StudentTeam> =
        serde_json::from_str(&content).with_context(|| "Failed to parse teams JSON")?;

    Ok(teams)
}

async fn run_setup(
    platform: PlatformType,
    org: String,
    base_url: String,
    token: Option<String>,
    user: String,
    templates: Vec<String>,
    teams_file: Option<PathBuf>,
    team_strings: Vec<String>,
    work_dir: PathBuf,
    private: bool,
) -> Result<()> {
    // Load student teams
    let student_teams = if let Some(file) = teams_file {
        load_teams_from_file(&file)?
    } else if !team_strings.is_empty() {
        team_strings
            .iter()
            .map(|s| parse_team(s))
            .collect::<Result<Vec<_>>>()?
    } else {
        anyhow::bail!("Either --teams-file or --team arguments must be provided");
    };

    println!("RepoBee Setup");
    println!("=============");
    println!("Platform: {:?}", platform);
    println!("Organization: {}", org);
    println!("Templates: {:?}", templates);
    println!("Teams: {}", student_teams.len());
    println!();

    // Create platform instance
    let api = match platform {
        PlatformType::GitHub => {
            let token_str = token.as_ref().context("Token required for GitHub")?;
            Platform::github(base_url, token_str.clone(), org, user)?
        }
        PlatformType::GitLab => {
            let token_str = token.as_ref().context("Token required for GitLab")?;
            Platform::gitlab(base_url, token_str.clone(), org, user)?
        }
        PlatformType::Gitea => {
            let token_str = token.as_ref().context("Token required for Gitea")?;
            Platform::gitea(base_url, token_str.clone(), org, user)?
        }
        PlatformType::Local => Platform::local(PathBuf::from(&base_url), org, user)?,
    };

    // Verify settings
    println!("Verifying platform settings...");
    api.verify_settings()
        .await
        .context("Failed to verify platform settings")?;
    println!("✓ Platform settings verified\n");

    // Create work directory
    std::fs::create_dir_all(&work_dir)
        .with_context(|| format!("Failed to create work directory: {}", work_dir.display()))?;

    // Run setup
    let result = setup_student_repos(
        &templates,
        &student_teams,
        &api,
        &work_dir,
        private,
        token.as_deref(),
    )
    .await?;

    // Print summary
    println!("\n=== Final Summary ===");
    println!(
        "✓ Successfully created: {} repositories",
        result.successful_repos.len()
    );
    if !result.existing_repos.is_empty() {
        println!(
            "  Already existed: {} repositories",
            result.existing_repos.len()
        );
    }
    if !result.errors.is_empty() {
        println!("✗ Errors: {} repositories", result.errors.len());
        for error in &result.errors {
            eprintln!(
                "  - {}/{}: {}",
                error.team_name, error.repo_name, error.error
            );
        }
    }

    if result.is_success() {
        println!("\n🎉 Setup completed successfully!");
        Ok(())
    } else {
        anyhow::bail!("Setup completed with {} errors", result.errors.len());
    }
}

async fn run_verify(
    platform: PlatformType,
    org: String,
    base_url: String,
    token: String,
    user: String,
) -> Result<()> {
    println!("Verifying platform settings...");
    println!("Platform: {:?}", platform);
    println!("Organization: {}", org);
    println!();

    let api = match platform {
        PlatformType::GitHub => Platform::github(base_url, token, org, user)?,
        PlatformType::GitLab => Platform::gitlab(base_url, token, org, user)?,
        PlatformType::Gitea => Platform::gitea(base_url, token, org, user)?,
        PlatformType::Local => Platform::local(PathBuf::from(&base_url), org, user)?,
    };

    api.verify_settings().await?;
    println!("✓ Verification successful!");
    println!("  Can access organization: {}", api.org_name());

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Setup {
            platform,
            org,
            base_url,
            token,
            user,
            templates,
            teams_file,
            work_dir,
            private,
            teams,
        } => {
            run_setup(
                platform, org, base_url, token, user, templates, teams_file, teams, work_dir,
                private,
            )
            .await
        }
        Commands::Verify {
            platform,
            org,
            base_url,
            token,
            user,
        } => run_verify(platform, org, base_url, token, user).await,
    }
}
