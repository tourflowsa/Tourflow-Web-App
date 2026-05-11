
import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Check, 
  ExternalLink, 
  Clock, 
  CalendarCheck, 
  CalendarX, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Star, 
  CreditCard, 
  AlertTriangle,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { listNotifications, getUnreadCount, markAsRead, markAllAsRead, Notification } from '../lib/notificationService';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    const [list, count] = await Promise.all([
      listNotifications(user.id, 10),
      getUnreadCount(user.id)
    ]);
    setNotifications(list);
    setUnreadCount(count);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ASSIGNED_TO_BOOKING': return <CalendarCheck size={14} />;
      case 'REMOVED_FROM_BOOKING': return <CalendarX size={14} />;
      case 'ASSIGNMENT_ACCEPTED': return <CheckCircle size={14} />;
      case 'ASSIGNMENT_REJECTED': return <XCircle size={14} />;
      case 'NEW_DOCUMENT_UPLOADED': return <FileText size={14} />;
      case 'DOCUMENT_APPROVED': return <CheckCircle size={14} />;
      case 'DOCUMENT_REJECTED': return <XCircle size={14} />;
      case 'NEW_REVIEW': return <Star size={14} />;
      case 'PAYOUT_APPROVED': return <CreditCard size={14} />;
      case 'PAYOUT_PAID': return <CreditCard size={14} />;
      case 'PAYOUT_HOLD': return <AlertTriangle size={14} />;
      case 'NEW_DISPUTE': return <AlertTriangle size={14} />;
      case 'DISPUTE_RESOLVED': return <CheckCircle size={14} />;
      case 'WITHDRAWAL_REQUESTED': return <CreditCard size={14} />;
      case 'WITHDRAWAL_APPROVED': return <CheckCircle size={14} />;
      case 'WITHDRAWAL_REJECTED': return <XCircle size={14} />;
      case 'BOOKING_CANCELLED': return <CalendarX size={14} />;
      case 'BOOKING_NO_SHOW': return <AlertTriangle size={14} />;
      default: return <Bell size={14} />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'ASSIGNMENT_ACCEPTED':
      case 'DOCUMENT_APPROVED':
      case 'DISPUTE_RESOLVED':
      case 'WITHDRAWAL_APPROVED':
      case 'PAYOUT_PAID':
        return 'text-green-600 bg-green-50';
      
      case 'ASSIGNMENT_REJECTED':
      case 'DOCUMENT_REJECTED':
      case 'REMOVED_FROM_BOOKING':
      case 'WITHDRAWAL_REJECTED':
      case 'BOOKING_CANCELLED':
      case 'BOOKING_NO_SHOW':
        return 'text-red-600 bg-red-50';
      
      case 'PAYOUT_HOLD':
      case 'NEW_DISPUTE':
        return 'text-amber-600 bg-amber-50';
      
      case 'ASSIGNED_TO_BOOKING':
      case 'NEW_DOCUMENT_UPLOADED':
      case 'NEW_REVIEW':
      case 'PAYOUT_APPROVED':
      case 'WITHDRAWAL_REQUESTED':
        return 'text-brand-teal bg-brand-teal/10';
      
      default:
        return 'text-gray-500 bg-gray-50';
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleUpdate = () => fetchNotifications();
    window.addEventListener('NOTIFICATIONS_UPDATED', handleUpdate);
    
    // Refresh every minute
    const interval = setInterval(fetchNotifications, 60000);

    return () => {
      window.removeEventListener('NOTIFICATIONS_UPDATED', handleUpdate);
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    setIsOpen(false);
    if (notification.link && notification.link !== '#') {
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllAsRead(user.id);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-brand-teal transition-colors rounded-full hover:bg-gray-100"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-bold text-brand-charcoal text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-brand-teal hover:underline font-medium flex items-center gap-1"
              >
                <Check size={12} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                  <Bell size={32} className="text-gray-300" />
                </div>
                <h4 className="font-bold text-brand-charcoal text-sm mb-1">No notifications yet</h4>
                <p className="text-xs text-gray-500 max-w-[200px] mx-auto leading-relaxed">
                  Important updates about bookings, documents, payouts, and reviews will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-4 hover:bg-gray-50/80 cursor-pointer transition-colors relative ${!n.is_read ? 'bg-brand-teal/[0.03]' : ''}`}
                  >
                    {!n.is_read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-teal" />
                    )}
                    <div className="flex gap-3">
                      <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${getNotificationColor(n.type)}`}>
                        {getNotificationIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h4 className={`text-sm font-bold truncate ${!n.is_read ? 'text-brand-charcoal' : 'text-gray-600'}`}>
                            {n.title}
                          </h4>
                          {n.link && n.link !== '#' && (
                            <ExternalLink size={12} className="text-gray-300 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase tracking-wider font-bold">
                          <Clock size={10} />
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-100 text-center bg-gray-50/50">
            <button className="text-xs font-bold text-gray-400 hover:text-brand-teal transition-colors">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
