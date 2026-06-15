/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Student {
  student_id: number;
  name: string;
  department: string;
  year: number; // 1-4
  email: string;
  phone: string;
  password_hash?: string;
  password_salt?: string;
  reset_token?: string;
}

export interface Event {
  event_id: number;
  event_name: string;
  event_date: string; // YYYY-MM-DD
  venue: string;
  description: string;
  max_capacity: number;
}

export interface Organizer {
  organizer_id: number;
  organizer_name: string;
  organizer_role: string;
  event_id: number;
  phone: string;
  email?: string;
  password_hash?: string;
  password_salt?: string;
  reset_token?: string;
}

export interface Registration {
  registration_id: number;
  student_id: number;
  event_id: number;
  attendance_status: 'Present' | 'Absent' | 'Registered';
  registered_at?: string; // ISO or human date
}

export interface Feedback {
  feedback_id: number;
  student_id: number;
  event_id: number;
  rating: number; // 1-5
  comments: string;
}

export interface Classroom {
  classroom_id: number;
  block_name: string;
  room_number: string;
  capacity: number;
  availability_status: 'Available' | 'Occupied';
}

export interface ClassroomBooking {
  booking_id: number;
  event_id: number;
  classroom_id: number;
  booking_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  booking_status: 'Confirmed' | 'Cancelled';
}

export interface InAppNotification {
  notification_id: number;
  user_id: number; // student_id or organizer_id, or -1 for global broadcast
  role: 'student' | 'organizer' | 'all';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'reminder' | 'update' | 'feedback_request' | 'success';
}

export interface EmailLog {
  email_id: number;
  user_id: number;
  to_email: string;
  subject: string;
  body_text: string;
  sent_at: string;
  type: 'registration_confirm' | 'today_reminder' | 'feedback_request' | 'security_reset' | 'new_event';
}

export interface SQLWorkloadQuery {
  id: string;
  title: string;
  description: string;
  sql: string;
}

export interface DatabaseState {
  students: Student[];
  events: Event[];
  organizers: Organizer[];
  registrations: Registration[];
  feedbacks: Feedback[];
  classrooms: Classroom[];
  bookings: ClassroomBooking[];
  notifications: InAppNotification[];
  emails: EmailLog[];
}
