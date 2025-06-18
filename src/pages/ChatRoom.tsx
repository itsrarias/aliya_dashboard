import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../api/supabase';
import { loadMessages } from '../hooks/useChat';
import type { MessageRow } from '../types/chat';
import { openai } from '../api/openai';
import '../styles/ChatRoom.css';

type GPT4oMessage = {
  role: 'user' | 'assistant';
  content: 
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
        | { type: 'file'; source_type: 'base64'; mime_type: string; data: string }
      >;
};

// Utility function to convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChatRoom() {
  const { chatId = '' } = useParams();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [input, setInput] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 1️⃣ Load chat history
  useEffect(() => {
    (async () => {
      const { data } = await loadMessages(chatId);
      setMessages(data as MessageRow[]);
    })();
  }, [chatId]);

  // 2️⃣ Stage a file for upload
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    setPendingFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    if (fileRef.current) fileRef.current.value = '';
  }

  // 3️⃣ Send logic (text + optional file)
// 2) sendMessage – fixed
async function sendMessage() {
  if (!input.trim() && !pendingFile) return;

  const { data: { user } } = await supabase.auth.getUser();
  const user_id = user!.id;

  let fileMsg: MessageRow | null = null;   // outer vars (no re-declaration)
  let textMsg: MessageRow | null = null;
  let fileSignedUrl: string | null = null;
  let fileBase64: string | null = null;
  let fileMimeType = pendingFile?.type ?? '';   // save before we clear state

  // ────────────────────────── file upload ──────────────────────────
  if (pendingFile) {
    const path = `${chatId}/${Date.now()}_${pendingFile.name}`;

    const { error: upErr } = await supabase
      .storage.from('chat_uploads')
      .upload(path, pendingFile, { upsert: false });
    if (upErr) { console.error('Upload error', upErr.message); return; }

    if (fileMimeType.startsWith('image/')) {
      const { data: signed, error: urlErr } = await supabase
        .storage.from('chat_uploads')
        .createSignedUrl(path, 60 * 60);
      if (urlErr || !signed) { console.error('Signed URL error', urlErr?.message); return; }
      fileSignedUrl = signed.signedUrl;
    } else if (fileMimeType === 'application/pdf') {
      fileBase64 = await fileToBase64(pendingFile);
    }

    // DB record
    const { data: fm, error: fmErr } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        user_id,
        role: 'user',
        content: `Uploaded file: ${pendingFile.name}`,
        file_url: path,
      })
      .select()
      .single();
    if (fmErr || !fm) { console.error('File message insert error', fmErr?.message); return; }

        const newFileMsg = fm as MessageRow;
        setMessages(prev => [...prev, newFileMsg]);
        fileMsg = newFileMsg;

    // clear UI state
    setPendingFile(null);
    setPreviewUrl(null);
  }

  // ────────────────────────── text message ─────────────────────────
  if (input.trim()) {
    const { data: tm, error: tmErr } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        user_id,
        role: 'user',
        content: input.trim(),
      })
      .select()
      .single();
    if (tmErr || !tm) { console.error('Text message insert error', tmErr?.message); return; }

      const newTextMsg = tm as MessageRow;
      setMessages(prev => [...prev, newTextMsg]);
      textMsg = newTextMsg;
      setInput('');
    }

  // ────────────────────────── build context ────────────────────────
  const recent = [...messages.slice(-8), fileMsg, textMsg]
    .filter((m): m is MessageRow => m != null);

  const chatMessages: GPT4oMessage[] = recent.map(r => ({
    role: r.role,
    content: r.content ?? '',
  }));

  // add multimodal payload
  if (fileMsg && (fileSignedUrl || fileBase64)) {
    const url = fileMsg.file_url ?? '';

    if (fileSignedUrl && fileMimeType.startsWith('image/')) {
      chatMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: `Here’s the image: ${url}` },
          { type: 'image_url', image_url: { url: fileSignedUrl } },
        ],
      });
    } else if (fileBase64 && fileMimeType === 'application/pdf') {
      chatMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: `Here’s the PDF: ${url}` },
          {
            type: 'file',
            source_type: 'base64',
            mime_type: 'application/pdf',
            data: fileBase64,
          },
        ],
      });
    }
  }

  // GPT-4o call
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: chatMessages as any,
  });

  // assistant reply → DB + UI
  const aiContent = completion.choices[0].message.content;
  const { data: aiRow, error: aiErr } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      user_id,
      role: 'assistant',
      content: aiContent,
    })
    .select()
    .single();
  if (aiErr || !aiRow) { console.error('Assistant insert error', aiErr?.message); return; }
  setMessages(prev => [...prev, aiRow as MessageRow]);

  // touch chat timestamp
  await supabase.from('chats')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', chatId);
}


  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="chat-room">
      {/* Message list */}
      <div className="messages">
        {messages.map(m => (
          <div key={m.id} className={m.role}>
            {m.content}
            {m.file_url && (
              <a
                href={
                  supabase
                    .storage
                    .from('chat_uploads')
                    .getPublicUrl(m.file_url).data.publicUrl
                }
                target="_blank"
                rel="noopener"
              >
                📎 {m.file_url.split('/').pop()}
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Preview the staged file */}
      {previewUrl && pendingFile && (
        <div className="file-preview">
          {pendingFile.type.startsWith('image/') ? (
            <img
              src={previewUrl}
              alt={pendingFile.name}
              className="file-preview-thumb"
            />
          ) : (
            <div className="file-preview-doc">
              📄 {pendingFile.name}
            </div>
          )}
          <button
            className="file-preview-remove"
            onClick={() => {
              URL.revokeObjectURL(previewUrl);
              setPreviewUrl(null);
              setPendingFile(null);
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Input bar with file button, text input, and send */}
      <div className="chat-input-bar">
        <input
          id="file-upload"
          ref={fileRef}
          className="chat-upload"
          type="file"
          onChange={handleFile}
        />
        <label htmlFor="file-upload" className="upload-button">📎</label>

        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          className="chat-input"
        />

        <button onClick={sendMessage} className="send-button">➤</button>
      </div>
    </div>
  );
}