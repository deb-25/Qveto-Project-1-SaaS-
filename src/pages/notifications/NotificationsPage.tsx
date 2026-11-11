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
  Trash2, 
  RefreshCw, 
  Loader2, 
  ExternalLink,
  Mail,
  Shield,
  Filter,
  CheckCircle2,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useOrg } from '../../context/OrgContext';
import { useOverdueEngine } from '../../hooks/useOverdueEngine';
import { TaskWithAssignee, Task } from '../../types';
import { TaskDetailModal } from '../../components/task/TaskDetailModal';

interface NotificationItem {
  id: string;
  type: string;
  task_id?: string | null;
  payload_json?: any;
  dedupe_key?: string | null;
  read_at?: string | null;
  email_status?: string | null;
  created_at: string;
}

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const { scanning, triggerOverdueScan, lastScanned, lastScanResult } = useOverdueEngine();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'overdue' | 'comments' | 'assigned' | 'email_log'>('all');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modal for inspecting task directly from notification
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignee | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const fetchNotifications = async () => {
    if (!user || !currentOrg) return;
    try {
      setLoading(true);
      const { data, error } = await (supabase.from('notifications') as any)
        .select('*')
        .eq('recipient_id', user.id)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
      notify(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (user?.id && currentOrg?.id) {
      const channel = supabase
        .channel(`user-notifications-${user.id}`)
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'notifications', 
            filter: `recipient_id=eq.${user.id}` 
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

  const markAsRead = async (id: string) => {
    try {
      const readAt = new Date().toISOString();
      await (supabase.from('notifications') as any)
        .update({ read_at: readAt })
        .eq('id', id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: readAt } : n))
      );
    } catch (err: any) {
      notify('Failed to update notification.');
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
      notify('All notifications marked as read.');
    } catch (err: any) {
      notify('Failed to mark all as read.');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await (supabase.from('notifications') as any).delete().eq('id', id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      notify('Notification removed.');
    } catch (err: any) {
      notify('Failed to delete notification.');
    }
  };

  const clearReadNotifications = async () => {
    if (!user || !currentOrg) return;
    try {
      await (supabase.from('notifications') as any)
        .delete()
        .eq('recipient_id', user.id)
        .eq('org_id', currentOrg.id)
        .not('read_at', 'is', null);

      setNotifications((prev) => prev.filter((n) => !n.read_at));
      notify('Cleared all read notifications.');
    } catch (err: any) {
      notify('Failed to clear read notifications.');
    }
  };

  const handleOpenTask = async (taskId: string) => {
    if (!taskId) return;
    setLoadingTaskId(taskId);
    try {
      const { data: taskData, error } = await (supabase.from('tasks') as any)
        .select('*')
        .eq('id', taskId)
        .single();

      if (error || !taskData) {
        throw new Error('Task not found or archived.');
      }

      // If task has assignee, fetch details
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
    } catch (err: any) {
      notify(err.message || 'Could not open task details.');
    } finally {
      setLoadingTaskId(null);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const overdueCount = notifications.filter((n) => n.type === 'overdue' && !n.read_at).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.read_at;
    if (activeTab === 'overdue') return n.type === 'overdue';
    if (activeTab === 'comments') return n.type === 'comment' || n.type === 'mention';
    if (activeTab === 'assigned') return n.type === 'assigned';
    return true;
  });

  const getNotificationTheme = (type: string) => {
    switch (type) {
      case 'overdue':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
          badge: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
          titleColor: 'text-rose-200',
          label: 'OVERDUE DEADLINE',
        };
      case 'assigned':
        return {
          icon: <UserCheck className="w-4 h-4 text-blue-400" />,
          badge: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
          titleColor: 'text-blue-200',
          label: 'TASK ASSIGNED',
        };
      case 'comment':
        return {
          icon: <MessageSquare className="w-4 h-4 text-purple-400" />,
          badge: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
          titleColor: 'text-purple-200',
          label: 'NEW COMMENT',
        };
      case 'mention':
        return {
          icon: <MessageSquare className="w-4 h-4 text-amber-400" />,
          badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
          titleColor: 'text-amber-200',
          label: 'MENTIONED',
        };
      case 'due_date':
        return {
          icon: <Calendar className="w-4 h-4 text-cyan-400" />,
          badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
          titleColor: 'text-cyan-200',
          label: 'DEADLINE UPDATED',
        };
      case 'status_change':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
          titleColor: 'text-emerald-200',
          label: 'STATUS CHANGE',
        };
      default:
        return {
          icon: <Clock className="w-4 h-4 text-slate-400" />,
          badge: 'bg-slate-800 text-slate-300 border-slate-700',
          titleColor: 'text-slate-200',
          label: type.replace('_', ' ').toUpperCase(),
        };
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 font-mono">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              MODULE 7
            </span>
            <span className="text-xs text-slate-400">Collaboration & Alert Telemetry</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Bell className="w-6 h-6 text-amber-400" />
              <span>Notification Center</span>
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 animate-pulse">
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => triggerOverdueScan()}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-200 transition disabled:opacity-50"
            title="Scan database for overdue tasks and generate alerts"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-rose-400 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Auditing Overdue...' : 'Run Overdue Audit'}</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow-sm active:scale-95"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}

          <button
            onClick={clearReadNotifications}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-400 hover:text-rose-400 transition"
            title="Clear all read notifications"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 font-mono">
          <Info className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3 font-mono text-xs">
        {[
          { id: 'all', label: 'All Alerts', count: notifications.length },
          { id: 'unread', label: 'Unread', count: unreadCount },
          { id: 'overdue', label: 'Overdue Deadlines', count: overdueCount, highlight: true },
          { id: 'comments', label: 'Comments & Mentions' },
          { id: 'assigned', label: 'Assignments' },
          { id: 'email_log', label: 'Simulated Email Log (FR-NTF-05)' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold transition ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  tab.highlight && tab.count > 0 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold' 
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB: SIMULATED EMAIL DISPATCH LOG (FR-NTF-05) */}
      {activeTab === 'email_log' ? (
        <div className="p-6 rounded-2xl bg-[#0c1018] border border-slate-800 space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Simulated SMTP Dispatch Pipeline (FR-NTF-05)
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              SIMULATED MODE ACTIVE
            </span>
          </div>

          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            Per requirement <strong>FR-NTF-05</strong>, when an external SMTP server is not provisioned, 
            TeamFlow dispatches emails in simulated mode. Every email notification payload is verified, recorded, 
            and tagged with delivery telemetry for transparent QA inspection.
          </p>

          <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-900/40 border border-slate-800 overflow-hidden text-xs">
            {notifications.map((n) => {
              const emailData = n.payload_json?.email_simulated;
              return (
                <div key={n.id} className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">
                      {emailData?.subject || `[TeamFlow] ${n.payload_json?.title || n.type}`}
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {n.email_status || 'simulated_sent'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>Recipient: {user?.email}</span>
                    <span>&middot;</span>
                    <span>Dispatched: {new Date(n.created_at).toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* NOTIFICATIONS LIST */
        <div className="space-y-3 font-mono">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
              <span>Streaming notification telemetry...</span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-16 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl bg-[#0c1018]">
              No notifications matching the selected filter. You're completely up to date!
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const theme = getNotificationTheme(n.type);
              const isRead = !!n.read_at;

              return (
                <div
                  key={n.id}
                  className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isRead 
                      ? 'bg-[#0c1018]/60 border-slate-850 opacity-70' 
                      : 'bg-[#0c1018] border-slate-750 shadow-md hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                      {theme.icon}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${theme.badge}`}>
                          {theme.label}
                        </span>

                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        )}

                        <span className="text-[10px] text-slate-500">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &middot; {new Date(n.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 className={`text-xs font-bold ${theme.titleColor}`}>
                        {n.payload_json?.title || n.type.replace('_', ' ')}
                      </h4>

                      <p className="text-xs text-slate-300 font-sans leading-relaxed">
                        {n.payload_json?.message || 'Activity reported on assigned project asset.'}
                      </p>

                      {n.task_id && (
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            onClick={() => handleOpenTask(n.task_id!)}
                            disabled={loadingTaskId === n.task_id}
                            className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 underline font-bold"
                          >
                            {loadingTaskId === n.task_id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <ExternalLink className="w-3 h-3" />
                            )}
                            <span>Open Task Details</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center font-mono text-xs">
                    {!isRead && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                        title="Mark read"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Mark Read</span>
                      </button>
                    )}

                    <button
                      onClick={() => deleteNotification(n.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition"
                      title="Dismiss alert"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Task Detail Modal (Module 6 & Module 7 Integration) */}
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
    </div>
  );
};
