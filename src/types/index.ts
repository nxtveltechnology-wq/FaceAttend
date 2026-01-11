export interface ClassItem {
  id: string;
  name: string;
}

export interface Student {
  id: string;
  name: string;
  roll_number: string;
  class_id: string;
  face_embedding: string | null;
  classes?: { name: string } | null;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  subject: string;
}
