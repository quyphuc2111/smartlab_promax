use once_cell::sync::Lazy;
use rusqlite::{Connection, Result as SqliteResult};
use std::sync::Mutex;

pub static DB: Lazy<Mutex<Connection>> = Lazy::new(|| {
    let conn = Connection::open("app_data.db").expect("Failed to open database");
    Mutex::new(conn)
});

pub fn init_db() -> SqliteResult<()> {
    let conn = DB.lock().unwrap();
    
    // Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON", [])?;

    // 1. SchoolYears - Năm học
    conn.execute(
        "CREATE TABLE IF NOT EXISTS school_years (
            school_year_id INTEGER PRIMARY KEY AUTOINCREMENT,
            school_year_name VARCHAR(50) UNIQUE NOT NULL,
            start_date DATETIME,
            end_date DATETIME
        )",
        [],
    )?;

    // 2. Grades - Khối lớp
    conn.execute(
        "CREATE TABLE IF NOT EXISTS grades (
            grade_id INTEGER PRIMARY KEY AUTOINCREMENT,
            grade_name VARCHAR(50) NOT NULL,
            school_year_id INTEGER,
            FOREIGN KEY (school_year_id) REFERENCES school_years(school_year_id)
        )",
        [],
    )?;

    // 3. Subjects - Môn học
    conn.execute(
        "CREATE TABLE IF NOT EXISTS subjects (
            subject_id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_name VARCHAR(100) NOT NULL,
            school_year_id INTEGER,
            FOREIGN KEY (school_year_id) REFERENCES school_years(school_year_id)
        )",
        [],
    )?;

    // 4. UserAccounts - Tài khoản người dùng
    conn.execute(
        "CREATE TABLE IF NOT EXISTS user_accounts (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_name VARCHAR(255) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT CHECK(role IN ('Student', 'Teacher', 'Administrator')) NOT NULL,
            status BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 5. Teachers - Giáo viên
    conn.execute(
        "CREATE TABLE IF NOT EXISTS teachers (
            teacher_id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_code CHAR(50),
            teacher_name VARCHAR(125) NOT NULL,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES user_accounts(user_id)
        )",
        [],
    )?;

    // 6. TeacherSubject - Liên kết giáo viên-môn học
    conn.execute(
        "CREATE TABLE IF NOT EXISTS teacher_subjects (
            teacher_subject_id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_id INTEGER,
            teacher_id INTEGER,
            FOREIGN KEY (subject_id) REFERENCES subjects(subject_id),
            FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id)
        )",
        [],
    )?;

    // 7. Students - Học sinh
    conn.execute(
        "CREATE TABLE IF NOT EXISTS students (
            student_id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_code CHAR(50),
            student_name VARCHAR(125) NOT NULL,
            user_id INTEGER,
            grade_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES user_accounts(user_id),
            FOREIGN KEY (grade_id) REFERENCES grades(grade_id)
        )",
        [],
    )?;

    // 8. PracticeTimeSlots - Ca thực hành
    conn.execute(
        "CREATE TABLE IF NOT EXISTS practice_time_slots (
            practice_time_slot_id INTEGER PRIMARY KEY AUTOINCREMENT,
            practice_time_slot_name VARCHAR(125),
            school_year_id INTEGER,
            start_time TIME,
            end_time TIME,
            FOREIGN KEY (school_year_id) REFERENCES school_years(school_year_id)
        )",
        [],
    )?;

    // 9. RoomComputers - Máy tính phòng máy
    conn.execute(
        "CREATE TABLE IF NOT EXISTS room_computers (
            room_computer_id INTEGER PRIMARY KEY AUTOINCREMENT,
            computer_name VARCHAR(255) NOT NULL,
            ip_address CHAR(100),
            status TEXT CHECK(status IN ('Active', 'Repairing', 'Broken')) DEFAULT 'Active'
        )",
        [],
    )?;

    // 10. ComputerHistories - Lịch sử máy tính
    conn.execute(
        "CREATE TABLE IF NOT EXISTS computer_histories (
            computer_history_id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_computer_id INTEGER,
            history_type TEXT CHECK(history_type IN ('Breakdown', 'Repair')),
            history_description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_computer_id) REFERENCES room_computers(room_computer_id)
        )",
        [],
    )?;

    // 11. MapSchoolYearGrade - Mapping năm học-khối
    conn.execute(
        "CREATE TABLE IF NOT EXISTS map_school_year_grade (
            m_school_year_grade_id INTEGER PRIMARY KEY AUTOINCREMENT,
            school_year_id INTEGER,
            grade_id INTEGER,
            UNIQUE(school_year_id, grade_id),
            FOREIGN KEY (school_year_id) REFERENCES school_years(school_year_id),
            FOREIGN KEY (grade_id) REFERENCES grades(grade_id)
        )",
        [],
    )?;

    // 12. MapSchoolYearGradeSubjects - Mapping năm học-khối-môn
    conn.execute(
        "CREATE TABLE IF NOT EXISTS map_school_year_grade_subjects (
            m_school_year_grade_subject_id INTEGER PRIMARY KEY AUTOINCREMENT,
            m_school_year_grade_id INTEGER,
            subject_id INTEGER,
            UNIQUE(m_school_year_grade_id, subject_id),
            FOREIGN KEY (m_school_year_grade_id) REFERENCES map_school_year_grade(m_school_year_grade_id),
            FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
        )",
        [],
    )?;

    // 13. MapSchoolYearGradeSubjectPracticeTimeSlots - Mapping đầy đủ
    conn.execute(
        "CREATE TABLE IF NOT EXISTS map_school_year_grade_subject_practice_time_slots (
            m_school_year_grade_subject_practice_time_slot_id INTEGER PRIMARY KEY AUTOINCREMENT,
            m_school_year_grade_subject_id INTEGER,
            practice_time_slot_id INTEGER,
            UNIQUE(m_school_year_grade_subject_id, practice_time_slot_id),
            FOREIGN KEY (m_school_year_grade_subject_id) REFERENCES map_school_year_grade_subjects(m_school_year_grade_subject_id),
            FOREIGN KEY (practice_time_slot_id) REFERENCES practice_time_slots(practice_time_slot_id)
        )",
        [],
    )?;

    // 14. PracticeSessions - Buổi thực hành
    conn.execute(
        "CREATE TABLE IF NOT EXISTS practice_sessions (
            practice_session_id INTEGER PRIMARY KEY AUTOINCREMENT,
            practice_session_name VARCHAR(255) NOT NULL,
            created_by_user_id INTEGER,
            grade_id INTEGER,
            subject_id INTEGER,
            school_year_id INTEGER,
            practice_time_slot_id INTEGER,
            m_school_year_grade_subject_practice_time_slot_id INTEGER,
            status BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by_user_id) REFERENCES user_accounts(user_id),
            FOREIGN KEY (grade_id) REFERENCES grades(grade_id),
            FOREIGN KEY (subject_id) REFERENCES subjects(subject_id),
            FOREIGN KEY (school_year_id) REFERENCES school_years(school_year_id),
            FOREIGN KEY (practice_time_slot_id) REFERENCES practice_time_slots(practice_time_slot_id),
            FOREIGN KEY (m_school_year_grade_subject_practice_time_slot_id) REFERENCES map_school_year_grade_subject_practice_time_slots(m_school_year_grade_subject_practice_time_slot_id)
        )",
        [],
    )?;

    // 15. PracticeMessages - Tin nhắn trong buổi thực hành
    conn.execute(
        "CREATE TABLE IF NOT EXISTS practice_messages (
            message_id INTEGER PRIMARY KEY AUTOINCREMENT,
            practice_session_id INTEGER,
            message_sender_name VARCHAR(125),
            message_sender_ref_code CHAR(50),
            message_receiver_name VARCHAR(125),
            message_receiver_ref_code CHAR(50),
            message_type TEXT CHECK(message_type IN ('Direct', 'All')),
            message_context TEXT,
            message_voice_file_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (practice_session_id) REFERENCES practice_sessions(practice_session_id)
        )",
        [],
    )?;

    // 16. PracticeMaterials - Tài liệu thực hành
    conn.execute(
        "CREATE TABLE IF NOT EXISTS practice_materials (
            practice_material_id INTEGER PRIMARY KEY AUTOINCREMENT,
            practice_session_id INTEGER,
            practice_material_title TEXT NOT NULL,
            practice_material_file_path TEXT,
            practice_material_description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (practice_session_id) REFERENCES practice_sessions(practice_session_id)
        )",
        [],
    )?;

    // 17. PracticeTests - Bài kiểm tra thực hành
    conn.execute(
        "CREATE TABLE IF NOT EXISTS practice_tests (
            practice_test_id INTEGER PRIMARY KEY AUTOINCREMENT,
            practice_session_id INTEGER,
            practice_test_name TEXT NOT NULL,
            start_time DATETIME,
            end_time DATETIME,
            status BOOLEAN DEFAULT 1,
            max_score REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (practice_session_id) REFERENCES practice_sessions(practice_session_id)
        )",
        [],
    )?;

    // 18. TestQuestions - Câu hỏi kiểm tra
    conn.execute(
        "CREATE TABLE IF NOT EXISTS test_questions (
            question_id INTEGER PRIMARY KEY AUTOINCREMENT,
            practice_test_id INTEGER,
            question_context TEXT NOT NULL,
            answer_a TEXT,
            answer_b TEXT,
            answer_c TEXT,
            answer_d TEXT,
            correct_answer CHAR(5),
            score REAL,
            order_index INTEGER,
            FOREIGN KEY (practice_test_id) REFERENCES practice_tests(practice_test_id)
        )",
        [],
    )?;

    // 19. StudentTestAttempts - Lần làm bài của học sinh
    conn.execute(
        "CREATE TABLE IF NOT EXISTS student_test_attempts (
            student_test_attempt_id INTEGER PRIMARY KEY AUTOINCREMENT,
            practice_test_id INTEGER,
            student_id INTEGER,
            start_time DATETIME,
            submit_time DATETIME,
            total_score REAL,
            FOREIGN KEY (practice_test_id) REFERENCES practice_tests(practice_test_id),
            FOREIGN KEY (student_id) REFERENCES students(student_id)
        )",
        [],
    )?;

    // 20. StudentAnswer - Câu trả lời của học sinh
    conn.execute(
        "CREATE TABLE IF NOT EXISTS student_answers (
            student_answer_id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_test_attempt_id INTEGER,
            question_id INTEGER,
            answer_option CHAR(5),
            score REAL,
            FOREIGN KEY (student_test_attempt_id) REFERENCES student_test_attempts(student_test_attempt_id),
            FOREIGN KEY (question_id) REFERENCES test_questions(question_id)
        )",
        [],
    )?;

    // 21. StudentEnrollments - Đăng ký học sinh vào lớp
    conn.execute(
        "CREATE TABLE IF NOT EXISTS student_enrollments (
            student_enrollment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER,
            grade_id INTEGER,
            FOREIGN KEY (student_id) REFERENCES students(student_id),
            FOREIGN KEY (grade_id) REFERENCES grades(grade_id)
        )",
        [],
    )?;

    println!("✅ Database initialized with all tables");
    Ok(())
}

// ==================== USER ACCOUNT FUNCTIONS ====================

pub fn create_user(username: &str, password_hash: &str, role: &str) -> SqliteResult<i64> {
    let conn = DB.lock().unwrap();
    conn.execute(
        "INSERT INTO user_accounts (user_name, password_hash, role) VALUES (?1, ?2, ?3)",
        [username, password_hash, role],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn find_user_by_username(username: &str) -> Option<(i64, String, String, String, bool)> {
    let conn = DB.lock().unwrap();
    conn.query_row(
        "SELECT user_id, user_name, password_hash, role, status FROM user_accounts WHERE user_name = ?1",
        [username],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
    )
    .ok()
}

pub fn find_user_by_id(id: i64) -> Option<(i64, String, String, bool)> {
    let conn = DB.lock().unwrap();
    conn.query_row(
        "SELECT user_id, user_name, role, status FROM user_accounts WHERE user_id = ?1",
        [id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    )
    .ok()
}

// ==================== ROOM COMPUTER FUNCTIONS ====================

pub fn get_all_room_computers() -> SqliteResult<Vec<(i64, String, Option<String>, String)>> {
    let conn = DB.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT room_computer_id, computer_name, ip_address, status FROM room_computers ORDER BY room_computer_id"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    })?;
    rows.collect()
}

pub fn create_room_computer(computer_name: &str, ip_address: Option<&str>, status: &str) -> SqliteResult<i64> {
    let conn = DB.lock().unwrap();
    conn.execute(
        "INSERT INTO room_computers (computer_name, ip_address, status) VALUES (?1, ?2, ?3)",
        rusqlite::params![computer_name, ip_address, status],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_room_computer(id: i64, computer_name: &str, ip_address: Option<&str>, status: &str) -> SqliteResult<usize> {
    let conn = DB.lock().unwrap();
    conn.execute(
        "UPDATE room_computers SET computer_name = ?1, ip_address = ?2, status = ?3 WHERE room_computer_id = ?4",
        rusqlite::params![computer_name, ip_address, status, id],
    )
}

pub fn delete_room_computer(id: i64) -> SqliteResult<usize> {
    let conn = DB.lock().unwrap();
    conn.execute("DELETE FROM room_computers WHERE room_computer_id = ?1", [id])
}

pub fn find_room_computer_by_ip(ip: &str) -> Option<i64> {
    let conn = DB.lock().unwrap();
    conn.query_row(
        "SELECT room_computer_id FROM room_computers WHERE ip_address = ?1",
        [ip],
        |row| row.get(0),
    ).ok()
}
