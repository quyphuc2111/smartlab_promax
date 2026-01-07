use serde::{Deserialize, Serialize};

// ==================== USER & AUTH ====================

#[derive(Debug, Clone, Serialize)]
pub struct User {
    pub user_id: i64,
    pub user_name: String,
    pub role: String,
    pub status: bool,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub role: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub success: bool,
    pub message: String,
    pub token: Option<String>,
    pub user: Option<User>,
}

// ==================== SCHOOL YEAR ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchoolYear {
    pub school_year_id: Option<i64>,
    pub school_year_name: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

// ==================== GRADE ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Grade {
    pub grade_id: Option<i64>,
    pub grade_name: String,
    pub school_year_id: Option<i64>,
}

// ==================== SUBJECT ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subject {
    pub subject_id: Option<i64>,
    pub subject_name: String,
    pub school_year_id: Option<i64>,
}

// ==================== TEACHER ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Teacher {
    pub teacher_id: Option<i64>,
    pub teacher_code: Option<String>,
    pub teacher_name: String,
    pub user_id: Option<i64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeacherSubject {
    pub teacher_subject_id: Option<i64>,
    pub subject_id: i64,
    pub teacher_id: i64,
}

// ==================== STUDENT ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Student {
    pub student_id: Option<i64>,
    pub student_code: Option<String>,
    pub student_name: String,
    pub user_id: Option<i64>,
    pub grade_id: Option<i64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentEnrollment {
    pub student_enrollment_id: Option<i64>,
    pub student_id: i64,
    pub grade_id: i64,
}

// ==================== PRACTICE TIME SLOT ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PracticeTimeSlot {
    pub practice_time_slot_id: Option<i64>,
    pub practice_time_slot_name: Option<String>,
    pub school_year_id: Option<i64>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
}

// ==================== ROOM COMPUTER ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomComputer {
    pub room_computer_id: Option<i64>,
    pub computer_name: String,
    pub ip_address: Option<String>,
    pub status: Option<String>, // 'Active', 'Repairing', 'Broken'
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputerHistory {
    pub computer_history_id: Option<i64>,
    pub room_computer_id: i64,
    pub history_type: Option<String>, // 'Breakdown', 'Repair'
    pub history_description: Option<String>,
    pub created_at: Option<String>,
}

// ==================== MAPPING TABLES ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MapSchoolYearGrade {
    pub m_school_year_grade_id: Option<i64>,
    pub school_year_id: i64,
    pub grade_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MapSchoolYearGradeSubject {
    pub m_school_year_grade_subject_id: Option<i64>,
    pub m_school_year_grade_id: i64,
    pub subject_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MapSchoolYearGradeSubjectPracticeTimeSlot {
    pub m_school_year_grade_subject_practice_time_slot_id: Option<i64>,
    pub m_school_year_grade_subject_id: i64,
    pub practice_time_slot_id: i64,
}

// ==================== PRACTICE SESSION ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PracticeSession {
    pub practice_session_id: Option<i64>,
    pub practice_session_name: String,
    pub created_by_user_id: Option<i64>,
    pub grade_id: Option<i64>,
    pub subject_id: Option<i64>,
    pub school_year_id: Option<i64>,
    pub practice_time_slot_id: Option<i64>,
    pub m_school_year_grade_subject_practice_time_slot_id: Option<i64>,
    pub status: Option<bool>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PracticeMessage {
    pub message_id: Option<i64>,
    pub practice_session_id: i64,
    pub message_sender_name: Option<String>,
    pub message_sender_ref_code: Option<String>,
    pub message_receiver_name: Option<String>,
    pub message_receiver_ref_code: Option<String>,
    pub message_type: Option<String>, // 'Direct', 'All'
    pub message_context: Option<String>,
    pub message_voice_file_path: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PracticeMaterial {
    pub practice_material_id: Option<i64>,
    pub practice_session_id: i64,
    pub practice_material_title: String,
    pub practice_material_file_path: Option<String>,
    pub practice_material_description: Option<String>,
    pub created_at: Option<String>,
}

// ==================== PRACTICE TEST ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PracticeTest {
    pub practice_test_id: Option<i64>,
    pub practice_session_id: i64,
    pub practice_test_name: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub status: Option<bool>,
    pub max_score: Option<f64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestQuestion {
    pub question_id: Option<i64>,
    pub practice_test_id: i64,
    pub question_context: String,
    pub answer_a: Option<String>,
    pub answer_b: Option<String>,
    pub answer_c: Option<String>,
    pub answer_d: Option<String>,
    pub correct_answer: Option<String>,
    pub score: Option<f64>,
    pub order_index: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentTestAttempt {
    pub student_test_attempt_id: Option<i64>,
    pub practice_test_id: i64,
    pub student_id: i64,
    pub start_time: Option<String>,
    pub submit_time: Option<String>,
    pub total_score: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentAnswer {
    pub student_answer_id: Option<i64>,
    pub student_test_attempt_id: i64,
    pub question_id: i64,
    pub answer_option: Option<String>,
    pub score: Option<f64>,
}

// ==================== NETWORK & UTILITY ====================

#[derive(Debug, Clone, Serialize)]
pub struct HostInfo {
    pub ip: String,
    pub is_alive: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct PingResult {
    pub ip: String,
    pub success: bool,
    pub latency_ms: Option<f64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ComputerStatusResult {
    pub ip: String,
    pub online: bool,
    pub message: String,
}

// ==================== API RESPONSE ====================

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(message: &str) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.to_string()),
        }
    }
}
