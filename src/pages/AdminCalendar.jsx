import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import {
  ChevronLeft, ChevronRight, Calendar, MapPin, Clock, Users,
  Plus, RefreshCw, Trophy, Dumbbell, PartyPopper, Handshake
} from 'lucide-react';

// Colour + label configuration per event type (shared look with the member calendar)
const TYPE_STYLES = {
  match:    { bg: '#fef3c7', bar: '#f59e0b', text: '#92400e', label: 'Match',    icon: Trophy },
  game:     { bg: '#fef3c7', bar: '#f59e0b', text: '#92400e', label: 'Match',    icon: Trophy },
  training: { bg: '#dbeafe', bar: '#3b82f6', text: '#1e40af', label: 'Training', icon: Dumbbell },
  social:   { bg: '#d1fae5', bar: '#10b981', text: '#065f46', label: 'Social',   icon: PartyPopper },
  meeting:  { bg: '#e2e8f0', bar: '#64748b', text: '#334155', label: 'Meeting',  icon: Handshake },
  event:    { bg: '#ede9fe', bar: '#8b5cf6', text: '#5b21b6', label: 'Event',    icon: Calendar },
};

const styleForType = (t) => TYPE_STYLES[(t || '').toLowerCase()] || TYPE_STYLES.event;

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AdminCalendar() {
  const { selectedClubId, selectedClub } = useClub();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeFilter, setActiveFilter] = useState('All');

  const fetchEvents = async () => {
    if (!selectedClubId) { setLoading(false); return; }
    setLoading(true);
    try {
      const col = collection(db, 'clubs', selectedClubId, 'events');
      let snap;
      try {
        snap = await getDocs(query(col, orderBy('date', 'desc')));
      } catch {
        snap = await getDocs(col);
      }
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, [selectedClubId]);

  // ─── Date helpers ───────────────────────────────────────────────
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

  const formatDateKey = (date) => {
    if (!date) return '';
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${m}-${d}`;
  };

  const isToday = (date) =>
    !!date &&
    date.getDate() === new Date().getDate() &&
    date.getMonth() === new Date().getMonth() &&
    date.getFullYear() === new Date().getFullYear();

  const isSelected = (date) =>
    !!date &&
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear();

  const eventDate = (e) => e.date || e.startDate || '';

  // Events grouped by their YYYY-MM-DD key
  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const key = eventDate(e);
      if (!key) return;
      (map[key] = map[key] || []).push(e);
    });
    return map;
  }, [events]);

  const passesFilter = (e) => {
    if (activeFilter === 'All') return true;
    const t = (e.type || '').toLowerCase();
    if (activeFilter === 'Matches') return t === 'match' || t === 'game';
    if (activeFilter === 'Training') return t === 'training';
    if (activeFilter === 'Social') return t === 'social';
    if (activeFilter === 'Meetings') return t === 'meeting';
    if (activeFilter === 'Other') return !['match', 'game', 'training', 'social', 'meeting'].includes(t);
    return true;
  };

  const itemsForDate = (date) => {
    const list = eventsByDate[formatDateKey(date)] || [];
    return list.filter(passesFilter);
  };

  const selectedDayItems = useMemo(
    () => itemsForDate(selectedDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, eventsByDate, activeFilter]
  );

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  return (
    <div style={{ maxWidth: '1500px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h1>Calendar</h1>
          <p className="subtitle">All matches, training sessions and club events for {selectedClub?.name}</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={fetchEvents}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/events')}>
            <Plus size={16} /> <span>Manage Events</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {['All', 'Matches', 'Training', 'Social', 'Meetings', 'Other'].map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              padding: '8px 16px',
              borderRadius: '12px',
              border: `1px solid ${activeFilter === filter ? 'var(--primary)' : 'var(--border)'}`,
              background: activeFilter === filter ? 'var(--primary)' : '#ffffff',
              color: activeFilter === filter ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Colour key pinned at the top */}
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px',
          padding: '12px 16px', background: '#ffffff', border: '1px solid var(--border)',
          borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '4px', alignSelf: 'center' }}>
          Colour key:
        </span>
        {[
          { type: 'match', label: 'Matches' },
          { type: 'training', label: 'Training' },
          { type: 'social', label: 'Social' },
          { type: 'meeting', label: 'Meetings' },
          { type: 'event', label: 'Other' },
        ].map(({ type, label }) => {
          const s = styleForType(type);
          return (
            <span
              key={type}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: s.bg, color: s.text, borderLeft: `4px solid ${s.bar}`,
                borderRadius: '8px', padding: '4px 12px', fontSize: '12px', fontWeight: 600
              }}
            >
              {label}
            </span>
          );
        })}
      </div>

      {/* Month Calendar */}
      <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '18px', color: 'var(--text)' }}>
              {monthNames[month]} {year}
            </h3>
            <button
              onClick={goToToday}
              style={{
                padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                background: '#ffffff', color: 'var(--text-secondary)', fontSize: '12px',
                fontWeight: 600, cursor: 'pointer'
              }}
            >
              Today
            </button>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={prevMonth} className="btn-icon" style={{ padding: '6px', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={nextMonth} className="btn-icon" style={{ padding: '6px', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Weekday labels */}
        <div className="admin-cal-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
        </div>

        {/* Days grid */}
        <div className="admin-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
          {days.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} className="admin-cal-cell admin-cal-cell-empty" />;
            const isSel = isSelected(date);
            const isTdy = isToday(date);
            const dayItems = itemsForDate(date);
            const maxChips = 3;

            return (
              <button
                key={`day-${idx}`}
                onClick={() => setSelectedDate(date)}
                className="admin-cal-cell"
                style={{
                  minHeight: '132px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  padding: '6px 7px',
                  border: '1px solid',
                  borderColor: isSel ? 'var(--primary)' : 'var(--border-light, #f1f5f9)',
                  borderRadius: '12px',
                  background: isSel ? 'rgba(16, 185, 129, 0.08)' : (isTdy ? '#f8fafc' : '#ffffff'),
                  color: 'var(--text)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  position: 'relative',
                  overflow: 'hidden',
                  textAlign: 'left'
                }}
              >
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  alignSelf: 'flex-start', minWidth: '20px', height: '20px', padding: '0 5px',
                  borderRadius: '50%', fontSize: '12px',
                  fontWeight: isSel || isTdy ? 700 : 500,
                  background: isTdy && !isSel ? 'var(--primary)' : 'none',
                  color: isTdy && !isSel ? '#ffffff' : (isSel ? 'var(--primary)' : 'inherit')
                }}>
                  {date.getDate()}
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '3px', width: '100%', overflow: 'hidden' }}>
                  {dayItems.slice(0, maxChips).map((item, i) => {
                    const s = styleForType(item.type);
                    return (
                      <span
                        key={`chip-${i}`}
                        title={`${s.label}: ${item.title}${item.time ? ` (${item.time})` : ''}`}
                        style={{
                          display: 'block', width: '100%', background: s.bg, color: s.text,
                          borderRadius: '4px', borderLeft: `3px solid ${s.bar}`, padding: '2px 5px',
                          fontSize: '10.5px', fontWeight: 600, lineHeight: 1.3,
                          whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'left'
                        }}
                      >
                        {item.title}
                      </span>
                    );
                  })}
                  {dayItems.length > maxChips && (
                    <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-secondary)', paddingLeft: '2px' }}>
                      +{dayItems.length - maxChips} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day agenda */}
      <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, borderBottom: '1px solid var(--border)', paddingBottom: '10px', color: 'var(--text)' }}>
          Agenda for {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </h3>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '30px 0' }}>Loading events...</p>
        ) : selectedDayItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-lighter)' }}>
            <Calendar size={32} style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: 0, color: 'var(--text)' }}>No events scheduled</h4>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Pick another date or adjust the filters.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
            {selectedDayItems.map((e) => {
              const s = styleForType(e.type);
              const Icon = s.icon;
              const rsvpCount = Object.keys(e.rsvps || e.rsvp || {}).length;
              return (
                <div
                  key={e.id}
                  onClick={() => navigate('/events')}
                  style={{
                    padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light, #f1f5f9)',
                    background: '#f8fafc', cursor: 'pointer', borderLeft: `4px solid ${s.bar}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                      background: s.bg, color: s.text, textTransform: 'uppercase',
                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}>
                      <Icon size={11} /> {s.label}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {e.isAllDay ? 'All Day' : (e.time || 'TBA')}
                    </span>
                  </div>

                  <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{e.title}</h4>

                  {e.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <MapPin size={12} /> <span>{e.location}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {e.assignedGroupName && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={12} /> {e.assignedGroupName}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> {rsvpCount} RSVP{rsvpCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
