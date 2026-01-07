// ==================== ENUMS ====================

export enum UserRole {
  STUDENT = 'Student',
  TEACHER = 'Teacher',
  ADMINISTRATOR = 'Administrator'
}

export enum ComputerStatus {
  ACTIVE = 'Active',
  REPAIRING = 'Repairing',
  BROKEN = 'Broken'
}

export enum HistoryType {
  BREAKDOWN = 'Breakdown',
  REPAIR = 'Repair'
}

export enum MessageType {
  DIRECT = 'Direct',
  ALL = 'All'
}

// ==================== USER & AUTH ====================

export interface User {
  user_id: number;
  user_name: string;
  role: UserRole;
  status: boolean;
}

export interface RegisterRequest {
  username: string;
  password: string;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}

// ==================== SCHOOL YEAR ====================

export interface SchoolYear {
  school_year_id?: number;
  school_year_name: string;
  start_date?: string;
  end_date?: string;
}

// ==================== GRADE ====================

export interface Grade {
  grade_id?: number;
  grade_name: string;
  school_year_id?: number;
}

// ==================== SUBJECT ====================

export interface Subject {
  subject_id?: number;
  subject_name: string;
  school_year_id?: number;
}

// ==================== TEACHER ====================

export interface Teacher {
  teacher_id?: number;
  teacher_code?: string;
  teacher_name: string;
  user_id?: number;
  created_at?: string;
}

export interface TeacherSubject {
  teacher_subject_id?: number;
  subject_id: number;
  teacher_id: number;
}

// ==================== STUDENT ====================

export interface Student {
  student_id?: number;
  student_code?: string;
  student_name: string;
  user_id?: number;
  grade_id?: number;
  created_at?: string;
}

export interface StudentEnrollment {
  student_enrollment_id?: number;
  student_id: number;
  grade_id: number;
}

// ==================== PRACTICE TIME SLOT ====================

export interface PracticeTimeSlot {
  practice_time_slot_id?: number;
  practice_time_slot_name?: string;
  school_year_id?: number;
  start_time?: string;
  end_time?: string;
}

// ==================== ROOM COMPUTER ====================

export interface RoomComputer {
  room_computer_id?: number;
  computer_name: string;
  ip_address?: string;
  status?: ComputerStatus;
}

export interface ComputerHistory {
  computer_history_id?: number;
  room_computer_id: number;
  history_type?: HistoryType;
  history_description?: string;
  created_at?: string;
}

// ==================== MAPPING TABLES ====================

export interface MapSchoolYearGrade {
  m_school_year_grade_id?: number;
  school_year_id: number;
  grade_id: number;
}

export interface MapSchoolYearGradeSubject {
  m_school_year_grade_subject_id?: number;
  m_school_year_grade_id: number;
  subject_id: number;
}

export interface MapSchoolYearGradeSubjectPracticeTimeSlot {
  m_school_year_grade_subject_practice_time_slot_id?: number;
  m_school_year_grade_subject_id: number;
  practice_time_slot_id: number;
}

// ==================== PRACTICE SESSION ====================

export interface PracticeSession {
  practice_session_id?: number;
  practice_session_name: string;
  created_by_user_id?: number;
  grade_id?: number;
  subject_id?: number;
  school_year_id?: number;
  practice_time_slot_id?: number;
  m_school_year_grade_subject_practice_time_slot_id?: number;
  status?: boolean;
  created_at?: string;
}

export interface PracticeMessage {
  message_id?: number;
  practice_session_id: number;
  message_sender_name?: string;
  message_sender_ref_code?: string;
  message_receiver_name?: string;
  message_receiver_ref_code?: string;
  message_type?: MessageType;
  message_context?: string;
  message_voice_file_path?: string;
  created_at?: string;
}

export interface PracticeMaterial {
  practice_material_id?: number;
  practice_session_id: number;
  practice_material_title: string;
  practice_material_file_path?: string;
  practice_material_description?: string;
  created_at?: string;
}

// ==================== PRACTICE TEST ====================

export interface PracticeTest {
  practice_test_id?: number;
  practice_session_id: number;
  practice_test_name: string;
  start_time?: string;
  end_time?: string;
  status?: boolean;
  max_score?: number;
  created_at?: string;
}

export interface TestQuestion {
  question_id?: number;
  practice_test_id: number;
  question_context: string;
  answer_a?: string;
  answer_b?: string;
  answer_c?: string;
  answer_d?: string;
  correct_answer?: string;
  score?: number;
  order_index?: number;
}

export interface StudentTestAttempt {
  student_test_attempt_id?: number;
  practice_test_id: number;
  student_id: number;
  start_time?: string;
  submit_time?: string;
  total_score?: number;
}

export interface StudentAnswer {
  student_answer_id?: number;
  student_test_attempt_id: number;
  question_id: number;
  answer_option?: string;
  score?: number;
}

// ==================== NETWORK & UTILITY ====================

export interface HostInfo {
  ip: string;
  is_alive: boolean;
}

export interface PingResult {
  ip: string;
  success: boolean;
  latency_ms: number | null;
  error: string | null;
}

export interface HostWithPing extends HostInfo {
  pingResult?: PingResult;
  pinging?: boolean;
}

// ==================== API RESPONSE ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ==================== LEGACY (for backward compatibility) ====================

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  role: UserRole;
}

export interface Document {
  id: string;
  title: string;
  type: 'pdf' | 'doc' | 'video' | 'zip';
  size: string;
  uploadedAt: string;
  ownerId: string;
}
