use crate::error::*;
use super::types::*;
use reqwest::{header, Client};

/// Canvas API Client
pub struct CanvasClient {
    base_url: String,
    access_token: String,
    client: Client,
}

impl CanvasClient {
    /// Create a new Canvas API client
    pub fn new(base_url: String, access_token: String) -> Result<Self> {
        let mut headers = header::HeaderMap::new();
        headers.insert(
            header::AUTHORIZATION,
            header::HeaderValue::from_str(&format!("Bearer {}", access_token))
                .map_err(|e| PlatformError::Other(format!("Invalid token: {}", e)))?,
        );

        let client = Client::builder()
            .default_headers(headers)
            .build()
            .map_err(|e| PlatformError::Other(format!("Failed to create HTTP client: {}", e)))?;

        Ok(Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            access_token,
            client,
        })
    }

    /// Verify Canvas credentials by fetching courses
    pub async fn verify_credentials(&self) -> Result<Vec<CanvasCourse>> {
        self.get_courses().await
    }

    /// Get all courses for the authenticated user
    pub async fn get_courses(&self) -> Result<Vec<CanvasCourse>> {
        let url = format!("{}/api/v1/courses", self.base_url);
        let response = self.client
            .get(&url)
            .query(&[("per_page", "100")])
            .send()
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to fetch courses: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(PlatformError::Other(format!(
                "Canvas API error ({}): {}",
                status, error_text
            )));
        }

        let courses: Vec<CanvasCourse> = response
            .json()
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to parse courses: {}", e)))?;

        Ok(courses)
    }

    /// Get a specific course by ID
    pub async fn get_course(&self, course_id: u64) -> Result<CanvasCourse> {
        let url = format!("{}/api/v1/courses/{}", self.base_url, course_id);
        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to fetch course: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(PlatformError::Other(format!(
                "Canvas API error ({}): {}",
                status, error_text
            )));
        }

        let course: CanvasCourse = response
            .json()
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to parse course: {}", e)))?;

        Ok(course)
    }

    /// Get all users (students) for a course
    pub async fn get_course_users(&self, course_id: u64) -> Result<Vec<CanvasUser>> {
        let url = format!("{}/api/v1/courses/{}/users", self.base_url, course_id);
        let response = self.client
            .get(&url)
            .query(&[("per_page", "100"), ("enrollment_type[]", "student")])
            .send()
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to fetch users: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(PlatformError::Other(format!(
                "Canvas API error ({}): {}",
                status, error_text
            )));
        }

        let users: Vec<CanvasUser> = response
            .json()
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to parse users: {}", e)))?;

        Ok(users)
    }

    /// Get user profile (includes email and detailed info)
    pub async fn get_user_profile(&self, user_id: u64) -> Result<CanvasUserProfile> {
        let url = format!("{}/api/v1/users/{}/profile", self.base_url, user_id);
        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to fetch user profile: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            return Err(PlatformError::Other(format!(
                "Failed to fetch user profile ({})",
                status
            )));
        }

        let profile: CanvasUserProfile = response
            .json()
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to parse user profile: {}", e)))?;

        Ok(profile)
    }

    /// Get all groups for a course
    pub async fn get_course_groups(&self, course_id: u64) -> Result<Vec<CanvasGroup>> {
        let url = format!("{}/api/v1/courses/{}/groups", self.base_url, course_id);
        let response = self.client
            .get(&url)
            .query(&[("per_page", "100")])
            .send()
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to fetch groups: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(PlatformError::Other(format!(
                "Canvas API error ({}): {}",
                status, error_text
            )));
        }

        let groups: Vec<CanvasGroup> = response
            .json()
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to parse groups: {}", e)))?;

        Ok(groups)
    }

    /// Get group memberships for a group
    pub async fn get_group_memberships(&self, group_id: u64) -> Result<Vec<CanvasGroupMembership>> {
        let url = format!("{}/api/v1/groups/{}/memberships", self.base_url, group_id);
        let response = self.client
            .get(&url)
            .query(&[("per_page", "100")])
            .send()
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to fetch group memberships: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(PlatformError::Other(format!(
                "Canvas API error ({}): {}",
                status, error_text
            )));
        }

        let memberships: Vec<CanvasGroupMembership> = response
            .json()
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to parse memberships: {}", e)))?;

        Ok(memberships)
    }

    /// Get enrollments for a course
    pub async fn get_course_enrollments(&self, course_id: u64) -> Result<Vec<CanvasEnrollment>> {
        let url = format!("{}/api/v1/courses/{}/enrollments", self.base_url, course_id);
        let response = self.client
            .get(&url)
            .query(&[("per_page", "100"), ("type[]", "StudentEnrollment")])
            .send()
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to fetch enrollments: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(PlatformError::Other(format!(
                "Canvas API error ({}): {}",
                status, error_text
            )));
        }

        let enrollments: Vec<CanvasEnrollment> = response
            .json()
            .await
            .map_err(|e| PlatformError::Other(format!("Failed to parse enrollments: {}", e)))?;

        Ok(enrollments)
    }

    /// Fetch all student information for a course (including groups)
    pub async fn get_student_info(&self, course_id: u64) -> Result<Vec<StudentInfo>> {
        // Fetch all data in parallel
        let (users, groups) = tokio::try_join!(
            self.get_course_users(course_id),
            self.get_course_groups(course_id)
        )?;

        // Build a map of user_id -> group
        let mut user_to_group = std::collections::HashMap::new();
        for group in &groups {
            let memberships = self.get_group_memberships(group.id).await?;
            for membership in memberships {
                user_to_group.insert(membership.user_id, group.clone());
            }
        }

        // Fetch profiles and build student info
        let mut student_infos = Vec::new();
        for user in users {
            let profile = self.get_user_profile(user.id).await?;

            let email = profile.primary_email.clone().unwrap_or_default();
            let git_id = profile.sis_user_id.clone().unwrap_or_else(|| profile.login_id.clone().unwrap_or_default());
            let name = extract_lastname_from_email(&email);

            let student_info = StudentInfo {
                group: user_to_group.get(&user.id).cloned(),
                full_name: profile.short_name.clone().unwrap_or(profile.name.clone()),
                name,
                canvas_id: profile.login_id.clone().unwrap_or_default(),
                git_id,
                email,
            };

            student_infos.push(student_info);
        }

        Ok(student_infos)
    }
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
