// src/pages/ChatHome.tsx
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../api/supabase';
import { useChats } from '../hooks/useChat';
import { useNavigate } from 'react-router-dom';
import '../styles/ChatHome.css';
import { FiMoreHorizontal } from 'react-icons/fi';

export default function ChatHome() {
  const { chats, loading, reloadChats } = useChats();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

    // ref to the currently open menu’s <ul>
  const menuRef = useRef<HTMLUListElement>(null);

  // whenever menuOpen changes, (un)register a document click handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      // if click is outside the menuRef, close it
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    // cleanup on unmount
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);


  async function newChat() {
    const user_id = (await supabase.auth.getUser()).data.user?.id!;
    const { data, error } = await supabase
      .from('chats')
      .insert({ user_id })
      .select()
      .single();
    if (!error && data) nav(`/chat/${data.id}`);
  }

  async function deleteChat(id: string) {
    await supabase.from('chats').delete().eq('id', id);
    reloadChats();
  }

  async function renameChat(id: string, current: string | null) {
    const newTitle = prompt('New name:', current || '');
    if (newTitle != null) {
      await supabase.from('chats').update({ title: newTitle }).eq('id', id);
      reloadChats();
    }
  }

  return (
    <div className="chat-home-container">
      <div className="chat-home-header">
        <button className="chat-home-button" onClick={newChat}>New Chat</button>
        <button className="chat-home-button" onClick={reloadChats}>Refresh</button>
      </div>

      {loading ? (
        <p className="chat-home-loading">Loading…</p>
      ) : (
        <ul className="chat-list">
          {chats.map(c => (
            <li key={c.id} className="chat-list-item">
              <div
                className="chat-list-content"
                onClick={() => nav(`/chat/${c.id}`)}
              >
                <span className="chat-title">{c.title || 'Untitled Chat'}</span>
                <span className="chat-date">
                  {new Date(c.updated_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>

              <div className="chat-options">
                <button
                  className="options-button"
                  onClick={() =>
                    setMenuOpen(menuOpen === c.id ? null : c.id)
                  }
                >
                  <FiMoreHorizontal size={18} />
                </button>
                {menuOpen === c.id && (
                  <ul ref={menuRef} className="options-menu">
                    <li
                      onClick={() => {
                        renameChat(c.id, c.title);
                        setMenuOpen(null);
                      }}
                    >
                      Rename
                    </li>
                    <li
                      onClick={() => {
                        if (
                          window.confirm('Delete this chat?')
                        ) {
                          deleteChat(c.id);
                        }
                        setMenuOpen(null);
                      }}
                    >
                      Delete
                    </li>
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="chat-home-info">
        You can safely paste Aliya’s sensitive data into these chats. The OpenAI API does not store or collect messages sent through it. Your messages are securely stored in our private Aliya database.
        <br></br>
        To avoid cluttering the database, you're limited to 10 chats. Creating a new chat after reaching this limit will automatically delete the oldest one. You can also delete chats manually
      </p>
    </div>
  );
}
