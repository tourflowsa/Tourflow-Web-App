
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, User, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { BookingMessage } from '../../types';
import { listBookingMessages, sendBookingMessage, subscribeToBookingMessages } from '../../lib/messageService';

interface Props {
  bookingId: string;
  bookingReference?: string;
}

export const BookingChat: React.FC<Props> = ({ bookingId, bookingReference }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const data = await listBookingMessages(bookingId);
        setMessages(data);
        setError(null);
      } catch (err: any) {
        setError('Failed to load messages');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    const subscription = subscribeToBookingMessages(bookingId, (msg) => {
      setMessages((prev) => {
        // Prevent duplicates if we already have it (though insert shouldn't happen twice)
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [bookingId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setSending(true);
    setNewMessage('');
    
    try {
      const msg = await sendBookingMessage(bookingId, content);
      if (msg) {
        setMessages((prev) => {
          // Double check although subscription also handles it
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    } catch (err: any) {
      setNewMessage(content); // Restore if failed
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-2" />
        <p className="text-sm">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-brand-teal" />
          <h3 className="font-bold text-brand-charcoal text-sm">Booking Chat</h3>
          {bookingReference && (
              <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                  {bookingReference}
              </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm border border-gray-100">
              <MessageSquare size={24} className="text-gray-300" />
            </div>
            <p className="text-sm text-gray-500 font-medium">No messages yet.</p>
            <p className="text-xs text-gray-400 mt-1">Start the conversation with other participants.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === user?.id;
            return (
              <div 
                key={msg.id} 
                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                  isOwn 
                    ? 'bg-brand-teal text-white rounded-tr-none' 
                    : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                }`}>
                  {!isOwn && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider truncate max-w-[120px]">
                        {msg.sender_name_snapshot}
                      </span>
                      <span className="text-[9px] bg-gray-100 text-gray-500 px-1 rounded font-medium capitalize">
                        {msg.sender_role_snapshot}
                      </span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
                <span className="text-[9px] text-gray-400 mt-1 px-1">
                  {format(new Date(msg.created_at), 'HH:mm • MMM d')}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 bg-white">
        <div className="relative flex items-center gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value.slice(0, 2000))}
            placeholder="Type a message..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal transition-all resize-none max-h-32 min-h-[44px]"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="w-10 h-10 rounded-xl bg-brand-teal text-white flex items-center justify-center hover:bg-brand-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <div className="flex justify-between items-center mt-2 px-1">
            <p className="text-[9px] text-gray-400 font-medium">
                {newMessage.length}/2000 characters
            </p>
            <p className="text-[9px] text-gray-400 italic">
                Press Enter to send
            </p>
        </div>
      </form>
    </div>
  );
};
