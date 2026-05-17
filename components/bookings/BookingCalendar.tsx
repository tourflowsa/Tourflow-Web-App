import React, { useState, useEffect } from 'react';
import { Booking } from '../../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WeeklyStats, computeWeeklyStats } from '../../lib/bookingService';

interface Props {
  bookings: Booking[];
  assignments?: Record<string, { 
    driverStatus?: string; 
    driverName?: string;
    guideStatus?: string; 
    guideName?: string;
  }>;
  onWeeklyStatsChange?: (stats: WeeklyStats) => void;
}

export const BookingCalendar: React.FC<Props> = ({ 
  bookings, 
  assignments = {}, 
  onWeeklyStatsChange 
}) => {
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
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    targetDate.setHours(0, 0, 0, 0);

    return bookings.filter(b => {
      const start = new Date(b.start_date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(b.end_date);
      end.setHours(0, 0, 0, 0);
      
      return targetDate >= start && targetDate <= end;
    });
  };

  const getAssignmentColor = (status?: string) => {
    if (!status) return 'bg-gray-50 text-gray-400 border-gray-200';
    switch (status.toLowerCase()) {
      case 'accepted': return 'bg-green-50 text-green-700 border-green-100';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const getEventStyle = (status: string) => {
    switch(status) {
      case 'confirmed':
        return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100';
      case 'draft':
        return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100';
      case 'completed':
        return 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 opacity-70';
      case 'in_progress':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100';
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
                {dayBookings.map(b => {
                  const assignment = assignments[b.id] || {};
                  const vehicle = b.vehicles;
                  const isMultiDay = b.start_date.split('T')[0] !== b.end_date.split('T')[0];
                  
                  const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                  const dayStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
                  
                  const isStart = b.start_date.split('T')[0] === dayStr;
                  const isEnd = b.end_date.split('T')[0] === dayStr;

                  return (
                    <button
                      key={`${b.id}-${day}`}
                      onClick={() => {
                        navigate(`/operator/bookings/${b.id}`);
                      }}
                      className={`w-full text-left text-xs p-1.5 rounded truncate transition-colors border-l-2 mb-1 shadow-sm ${getEventStyle(b.status)} ${isMultiDay ? 'opacity-90' : ''}`}
                      title={`${b.booking_reference} - ${b.status} (${b.start_date} to ${b.end_date})`}
                    >
                      <div className="font-bold flex justify-between items-center gap-1">
                        <span className="truncate">{b.booking_reference}</span>
                        {isMultiDay && (
                          <span className="text-[8px] opacity-70 whitespace-nowrap shrink-0">
                            {isStart ? 'Start' : isEnd ? 'End' : 'Trip'}
                          </span>
                        )}
                      </div>
                      <div className="truncate opacity-80 mb-1">{b.tours?.title}</div>
                      
                      {/* Resource Tags */}
                      <div className="flex flex-wrap gap-1 mt-1">
                         <span className={`px-1 rounded-[2px] text-[8px] font-bold border ${getAssignmentColor(assignment.driverStatus)}`} title={`Driver: ${assignment.driverName || 'Unassigned'}`}>
                           D{assignment.driverName ? `:${assignment.driverName.split(' ')[0]}` : ''}
                         </span>
                         <span className={`px-1 rounded-[2px] text-[8px] font-bold border ${getAssignmentColor(assignment.guideStatus)}`} title={`Guide: ${assignment.guideName || 'Unassigned'}`}>
                           G{assignment.guideName ? `:${assignment.guideName.split(' ')[0]}` : ''}
                         </span>
                         <span className={`px-1 rounded-[2px] text-[8px] font-bold border ${b.vehicle_id ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-gray-50 text-gray-400 border-gray-200'}`} title={`Vehicle: ${vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.license_plate})` : 'Unassigned'}`}>
                           V{vehicle ? `:${vehicle.license_plate}` : ''}
                         </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};