import React, { useState, useEffect } from 'react';
import { Booking } from '../../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WeeklyStats, computeWeeklyStats } from '../../lib/bookingService';

interface Props {
  bookings: Booking[];
  onWeeklyStatsChange?: (stats: WeeklyStats) => void;
}

export const BookingCalendar: React.FC<Props> = ({ bookings, onWeeklyStatsChange }) => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate and report weekly stats whenever the bookings list changes
  useEffect(() => {
    if (onWeeklyStatsChange) {
      const stats = computeWeeklyStats(bookings);
      onWeeklyStatsChange(stats);
    }
  }, [bookings, onWeeklyStatsChange]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate); // 0 = Sunday

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Helper to find bookings for a specific day
  const getBookingsForDay = (day: number) => {
    return bookings.filter(b => {
      const bDate = new Date(b.start_date);
      return bDate.getDate() === day && 
             bDate.getMonth() === currentDate.getMonth() && 
             bDate.getFullYear() === currentDate.getFullYear();
    });
  };

  const getEventStyle = (status: string) => {
    switch(status) {
      case 'confirmed':
        return 'bg-brand-teal/10 text-brand-teal border-brand-teal hover:bg-brand-teal/20';
      case 'completed':
        return 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 opacity-70';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h2 className="font-bold text-lg text-brand-charcoal">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronLeft size={20} /></button>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><ChevronRight size={20} /></button>
        </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-2 text-center text-xs font-bold text-gray-400 uppercase">
            {day}
          </div>
        ))}
      </div>

      {/* Grid Body */}
      <div className="grid grid-cols-7 auto-rows-[110px] flex-1">
        {/* Empty cells for padding */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="border-r border-b border-gray-100 bg-gray-50/30" />
        ))}

        {/* Days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayBookings = getBookingsForDay(day);
          const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

          return (
            <div key={day} className={`border-r border-b border-gray-100 p-2 relative group ${isToday ? 'bg-brand-teal/5' : ''}`}>
              <span className={`text-sm font-bold block mb-1 ${isToday ? 'text-brand-teal' : 'text-gray-700'}`}>
                {day}
              </span>
              
              <div className="space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                {dayBookings.map(b => (
                  <button
                    key={b.id}
                    onClick={() => navigate(`/operator/bookings/${b.id}`)}
                    className={`w-full text-left text-xs p-1.5 rounded truncate transition-colors border-l-2 mb-1 ${getEventStyle(b.status)}`}
                    title={`${b.booking_reference} - ${b.status}`}
                  >
                    <div className="font-bold flex justify-between">
                      <span>{b.booking_reference}</span>
                    </div>
                    <div className="truncate opacity-90">{b.tours?.title}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};