import React, { useState } from 'react';
import { User, ChatMessage } from '../types';
import { getChatMessages, sendChatMessage } from '../utils/storage';
import { Send, MessageSquare } from 'lucide-react';

interface ChatViewProps {
  currentUser: User;
}

export const ChatView: React.FC<ChatViewProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(getChatMessages());
  const [inputText, setInputText] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg = sendChatMessage(currentUser, inputText.trim());
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
  };

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col animate-pop pb-24">
      {/* Header */}
      <div className="flex items-center space-x-2 pb-3 border-b border-white/10 shrink-0">
        <MessageSquare className="w-5 h-5 text-red-500" />
        <div>
          <h1 className="text-lg font-black uppercase text-white tracking-tight">Messagerie Équipe</h1>
          <p className="text-[10px] text-gray-400 font-bold">Discussion en direct avec le réseau terrain</p>
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
                <span className="text-[9px] font-black text-gray-400 uppercase">{msg.sender_name}</span>
                <span className="text-[8px] font-bold text-gray-500">{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[82%] px-4 py-3 rounded-2xl text-xs font-semibold leading-relaxed shadow-md ${
                  isMe
                    ? 'bg-red-600 text-white rounded-br-none shadow-red-600/30'
                    : 'bg-white/10 text-gray-100 rounded-bl-none border border-white/10'
                }`}
              >
                {msg.message}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="shrink-0 flex items-center space-x-2 bg-white/5 border border-white/10 rounded-2xl p-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Écrire à l'équipe terrain..."
          className="flex-1 bg-transparent border-0 px-3 py-2 text-white text-xs font-medium focus:outline-none placeholder:text-gray-500"
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
