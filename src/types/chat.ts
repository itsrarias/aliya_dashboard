export interface ChatRow {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

// 1) make sure MessageRow has file_url
export type MessageRow = {
  id: string;
  chat_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string | null;
  file_url?: string | null;   // ← add (or keep) this
  created_at: string;
};

