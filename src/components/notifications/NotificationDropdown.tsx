import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Clock, 
  AlertTriangle, 
  MessageSquare, 
  UserCheck, 
  X,
  ExternalLink,
  Loader2,
  Calendar,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useOrg } from '../../context/OrgContext';
import { TaskWithAssignee } from '../../types';
import { TaskDetailModal } from '../task/TaskDetailModal';

interface NotificationItem {
  id: string;
  type: string;
  task_id?: string | null;
  payload_json?: any;
  read_at?: string | null;
  created_at: string;
}

export const NotificationDropdown: React.FC = () => {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'overdue'>('all');

  // Modal for inspecting task directly from notification
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignee | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!user || !currentOrg) return;
    try {
      setLoading(true);
      const { data, error } = await (supabase.from('notifications') as any)
        .select('*')
        .eq('recipient_id', user.id)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .limit(25);

      if (!error && data) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (user?.id && currentOrg?.id) {
      const channel = supabase
        .channel(`dropdown-notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${user.id}`,
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id, currentOrg?.id]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const overdueCount = notifications.filter((n) => n.type === 'overdue' && !n.read_at).length;

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const readAt = new Date().toISOString();
      await (supabase.from('notifications') as any)
        .update({ read_at: readAt })
        .eq('id', id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: readAt } : n))
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user || !currentOrg) return;
    try {
      const readAt = new Date().toISOString();
      await (supabase.from('notifications') as any)
        .update({ read_at: readAt })
        .eq('recipient_id', user.id)
        .eq('org_id', currentOrg.id)
        .is('read_at', null);

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: readAt }))
      );
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.read_at) {
      markAsRead(n.id);
    }

    if (n.task_id) {
      try {
        const { data: taskData } = await (supabase.from('tasks') as any)
          .select('*')
          .eq('id', n.task_id)
          .single();

        if (taskData) {
          let assignee = null;
          if (taskData.assignee_id) {
            const { data: userData } = await (supabase.from('users') as any)
              .select('*')
              .eq('id', taskData.assignee_id)
              .single();
            assignee = userData;
          }
          setSelectedTask({ ...taskData, assignee });
          setIsTaskModalOpen(true);
          setIsOpen(false);
        }
      } catch (err) {
        console.warn('Could not open task:', err);
      }
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'assigned':
        return <UserCheck className="w-3.5 h-3.5 text-blue-400" />;
      case 'overdue':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
      case 'comment':
      case 'mention':
        return <MessageSquare className="w-3.5 h-3.5 text-purple-400" />;
      case 'due_date':
        return <Calendar className="w-3.5 h-3.5 text-cyan-400" />;
      case 'status_change':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read_at;
    if (filter === 'overdue') return n.type === 'overdue';
    return true;
  });

  return (
    <>
      <div className="relative font-mono">
        {/* Bell Button */}
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) fetchNotifications();
          }}
          title="Notifications"
          className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-850 transition"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className={`absolute top-1 right-1 w-4 h-4 rounded-full text-slate-950 text-[10px] font-black flex items-center justify-center shadow-md ${
              overdueCount > 0 ? 'bg-rose-500 text-white animate-bounce' : 'bg-amber-500 animate-pulse'
            }`}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-[#0c1018] border border-slate-800 shadow-2xl z-50 overflow-hidden animate-fadeIn">
              {/* Header */}
              <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {/* Sub-Filters */}
              <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-800/80 bg-slate-950/60 text-[11px]">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'unread', label: `Unread (${unreadCount})` },
                  { id: 'overdue', label: `Overdue (${overdueCount})`, isOverdue: true },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id as any)}
                    className={`px-2 py-0.5 rounded-md transition ${
                      filter === f.id
                        ? f.isOverdue && overdueCount > 0
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold'
                          : 'bg-slate-800 text-amber-400 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80">
                {loading ? (
                  <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Loading alerts...</span>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No notifications for this filter.
                  </div>
                ) : (
                  filteredNotifications.map((n) => {
                    const isRead = !!n.read_at;
                    const isOverdue = n.type === 'overdue';

                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3.5 flex items-start justify-between gap-3 transition cursor-pointer ${
                          isRead
                            ? 'bg-transparent opacity-65 hover:opacity-100 hover:bg-slate-900/40'
                            : isOverdue
                            ? 'bg-rose-500/5 hover:bg-rose-500/10'
                            : 'bg-amber-500/5 hover:bg-amber-500/10'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${
                            isOverdue ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-800 border-slate-700'
                          }`}>
                            {getIconForType(n.type)}
                          </div>
                          <div className="truncate">
                            <p className={`text-xs font-medium truncate ${isOverdue ? 'text-rose-200 font-bold' : 'text-slate-200'}`}>
                              {n.payload_json?.title || n.type.replace('_', ' ')}
                            </p>
                            <p className="text-[10px] text-slate-400 font-sans mt-0.5 line-clamp-1">
                              {n.payload_json?.message || 'Activity on assigned task'}
                            </p>
                            <span className="text-[9px] text-slate-500 font-mono mt-1 block">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &middot; {new Date(n.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {!isRead && (
                          <button
                            onClick={(e) => markAsRead(n.id, e)}
                            title="Mark read"
                            className="p-1 rounded text-slate-400 hover:text-amber-400 transition shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-2.5 border-t border-slate-800 bg-slate-900/60 text-center">
                <Link
                  to="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-[11px] text-amber-400 hover:underline flex items-center justify-center gap-1 font-bold"
                >
                  <span>Open Full Notification Center</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Task Detail Modal */}
      {isTaskModalOpen && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
          onTaskUpdated={fetchNotifications}
        />
      )}
    </>
  );
};
