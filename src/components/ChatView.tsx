import React, { useEffect, useState } from 'react';
import { User, ChatMessage } from '../types';
import { deleteChatMessage, getChatMessages, sendChatMessage } from '../utils/storage';
import { Send, MessageSquare, Trash2 } from 'lucide-react';

interface ChatViewProps {
  currentUser: User;
  onDataChanged?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ currentUser, onDataChanged }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    let active = true;

    const refreshMessages = async () => {
      const list = await getChatMessages();
      if (active) setMessages(list);
    };

    void refreshMessages();
    const interval = window.setInterval(() => {
      void refreshMessages();
    }, 4000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const inputEl = form.querySelector('input') as HTMLInputElement | null;
    const nextValue = (inputEl?.value || inputText).trim();
    if (!nextValue) return;

    const newMsg = await sendChatMessage(currentUser, nextValue);
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    if (inputEl) inputEl.value = '';
    if (onDataChanged) onDataChanged();
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm('Supprimer ce message pour tout le monde ?')) return;
    const ok = await deleteChatMessage(msgId, currentUser);
    if (!ok) return;
    const list = await getChatMessages();
    setMessages(list);
    if (onDataChanged) onDataChanged();
  };

  return (
    <div className="chat-view h-[calc(100vh-180px)] flex flex-col animate-pop pb-24">
      {/* Header */}
      <div className="flex items-center space-x-2 pb-3 border-b border-white/10 shrink-0">
        <MessageSquare className="w-5 h-5 text-red-500" />
        <div>
          <h1 className="chat-title text-lg font-black uppercase text-white tracking-tight">Messagerie Équipe</h1>
          <p className="chat-subtitle text-[10px] text-gray-400 font-bold">Discussion en direct avec le réseau terrain</p>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUser.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center space-x-1.5 mb-1 px-1">
                <span className="chat-meta-name text-[9px] font-black text-gray-400 uppercase">{msg.sender_name}</span>
                <span className="chat-meta-time text-[8px] font-bold text-gray-500">{msg.timestamp}</span>
                {(currentUser.role === 'admin' || currentUser.role === 'super_admin') && (
                  <button
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="chat-delete-btn p-0.5 rounded text-gray-500 hover:text-red-400"
                    title="Supprimer le message"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div
                className={`max-w-[82%] px-4 py-3 rounded-2xl text-xs font-semibold leading-relaxed shadow-md ${
                  isMe
                    ? 'chat-bubble-me bg-red-600 text-white rounded-br-none shadow-red-600/30'
                    : 'chat-bubble-other bg-white/10 text-gray-100 rounded-bl-none border border-white/10'
                }`}
              >
                {msg.message}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="chat-input-shell sticky bottom-0 z-20 mt-3 shrink-0 flex items-center space-x-2 bg-zinc-950/95 backdrop-blur border border-white/10 rounded-2xl p-2 shadow-[0_-10px_30px_rgba(0,0,0,0.25)]">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Écrire à l'équipe terrain..."
          className="chat-input flex-1 bg-transparent border-0 px-3 py-2 text-white text-xs font-medium focus:outline-none placeholder:text-gray-500"
        />
        <button
          type="submit"
          className="w-10 h-10 bg-red-600 hover:bg-red-500 text-white rounded-xl flex items-center justify-center transition-all shadow-md"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
