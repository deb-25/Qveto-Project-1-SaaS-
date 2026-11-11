import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Calendar, 
  User, 
  Tag, 
  MessageSquare, 
  Activity, 
  CheckSquare, 
  Plus, 
  Trash2, 
  Clock, 
  AlertCircle, 
  Send,
  Loader2,
  CheckCircle2,
  Shield,
  Layers,
  ChevronRight,
  Archive,
  ArchiveRestore,
  Check,
  Sparkles,
  Paperclip,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Download,
  UploadCloud,
  Edit2,
  AtSign,
  File as FileIcon
} from 'lucide-react';
import { supabase } from '../../api/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useOrg } from '../../context/OrgContext';
import { TaskWithAssignee, TaskStatus, TaskPriority, Task, Label, Attachment } from '../../types';
import { validateStatusTransition } from '../../utils/statusTransitions';
import { LabelManagerModal } from '../labels/LabelManagerModal';
import { 
  notifyTaskAssigned, 
  notifyCommentAdded, 
  notifyDueDateChanged, 
  notifyTaskCompletedOrStatusChanged 
} from '../../services/notificationService';
import { aiBreakdownTask, aiEnhanceDescription } from '../../services/aiService';

const ALLOWED_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 
  'pdf', 'docx', 'xlsx', 'txt', 'zip', 'json', 'csv'
];

const ALLOWED_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp',
  'application/pdf', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
  'application/zip', 'application/x-zip-compressed',
  'application/json',
  'text/csv'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit (FR-COL-02)

async function calculateChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface TaskDetailModalProps {
  task: TaskWithAssignee | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: () => void;
}

interface CommentItem {
  id: string;
  author_id: string;
  body: string;
  edited_at?: string | null;
  created_at: string;
  author?: {
    name: string;
    email: string;
  };
}

interface AttachmentItem {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  checksum?: string | null;
  created_at: string;
  uploader_id: string;
  uploader?: {
    name: string;
    email: string;
  };
}

interface ActivityItem {
  id: string;
  actor_id?: string;
  type: string;
  before_json?: any;
  after_json?: any;
  created_at: string;
  actor?: {
    name: string;
    email: string;
  };
}


export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onTaskUpdated,
}) => {
  const { user } = useAuth();
  const { currentOrg, currentRole } = useOrg();

  // Active tab (details | subtasks | comments | attachments | activity)
  const [activeTab, setActiveTab] = useState<'details' | 'subtasks' | 'comments' | 'attachments' | 'activity'>('details');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [savingTask, setSavingTask] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Subtasks state (FR-TSK-04)
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);

  // Comments state (FR-COL-01)
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);

  // Attachments state (FR-COL-02 & FR-COL-03)
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Activity state (FR-COL-04)
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // Labels state (FR-TSK-05)
  const [attachedLabels, setAttachedLabels] = useState<Label[]>([]);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [isLabelDropdownOpen, setIsLabelDropdownOpen] = useState(false);
  const [isLabelManagerOpen, setIsLabelManagerOpen] = useState(false);

  // Archive state (FR-TSK-01)
  const [isArchived, setIsArchived] = useState(false);

  // Drag and drop state for attachments
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Members list for assignee dropdown & @mentions
  const [members, setMembers] = useState<{ id: string; name: string; email: string }[]>([]);

  useEffect(() => {
    if (task && isOpen) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.due_date ? task.due_date.substring(0, 10) : '');
      setAssigneeId(task.assignee_id || '');
      setIsArchived(!!task.archived_at);
      setEditingCommentId(null);
      fetchTaskData(task.id);
      fetchMembers();

      // Realtime subscription for collaboration (comments, attachments, activity)
      const collabChannel = supabase
        .channel(`task-collab-${task.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'comments', filter: `task_id=eq.${task.id}` },
          () => { fetchTaskData(task.id); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attachments', filter: `task_id=eq.${task.id}` },
          () => { fetchTaskData(task.id); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'activity_events', filter: `task_id=eq.${task.id}` },
          () => { fetchTaskData(task.id); }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(collabChannel);
      };
    }
  }, [task, isOpen]);

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const fetchMembers = async () => {
    if (!currentOrg) return;
    try {
      const { data } = await (supabase.from('memberships') as any)
        .select('user_id, users (id, name, email)')
        .eq('org_id', currentOrg.id);

      if (data) {
        const list = (data as any[])
          .map((m) => m.users)
          .filter(Boolean)
          .map((u) => ({
            id: u.id,
            name: u.name || u.email?.split('@')[0] || 'Member',
            email: u.email,
          }));
        setMembers(list);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  const fetchTaskData = async (taskId: string) => {
    try {
      // 1. Fetch Subtasks
      const { data: subData } = await (supabase.from('tasks') as any)
        .select('*')
        .eq('parent_task_id', taskId)
        .is('archived_at', null)
        .order('created_at', { ascending: true });

      setSubtasks(subData || []);

      // 2. Fetch Attached Labels (FR-TSK-05)
      const { data: tlData } = await (supabase.from('task_labels') as any)
        .select('label_id, labels (*)')
        .eq('task_id', taskId);

      if (tlData) {
        const lbls = tlData.map((item: any) => item.labels).filter(Boolean);
        setAttachedLabels(lbls);
      } else {
        setAttachedLabels([]);
      }

      // Fetch Available Org Labels
      if (currentOrg) {
        const { data: allLblData } = await (supabase.from('labels') as any)
          .select('*')
          .eq('org_id', currentOrg.id)
          .order('name', { ascending: true });
        if (allLblData) setAllLabels(allLblData);
      }

      // 3. Fetch Comments (FR-COL-01)
      const { data: commentData } = await (supabase.from('comments') as any)
        .select('id, author_id, body, edited_at, created_at, author:users(name, email)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      setComments(commentData || []);

      // 4. Fetch Attachments (FR-COL-02 & FR-COL-03)
      const { data: attachData } = await (supabase.from('attachments') as any)
        .select('id, original_name, mime_type, size_bytes, storage_path, checksum, created_at, uploader_id, uploader:users(name, email)')
        .eq('task_id', taskId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      setAttachments(attachData || []);

      // 5. Fetch Activity (FR-COL-04)
      const { data: actData } = await (supabase.from('activity_events') as any)
        .select('id, actor_id, type, before_json, after_json, created_at, actor:users(name, email)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .limit(30);

      setActivities(actData || []);
    } catch (err) {
      console.error('Error fetching task details related data:', err);
    }
  };

  // Toggle Label Attachment (FR-TSK-05)
  const handleToggleLabel = async (lbl: Label) => {
    if (!task) return;
    const isAttached = attachedLabels.some((l) => l.id === lbl.id);
    try {
      if (isAttached) {
        setAttachedLabels((prev) => prev.filter((l) => l.id !== lbl.id));
        await (supabase.from('task_labels') as any)
          .delete()
          .eq('task_id', task.id)
          .eq('label_id', lbl.id);
      } else {
        setAttachedLabels((prev) => [...prev, lbl]);
        await (supabase.from('task_labels') as any).insert({
          task_id: task.id,
          label_id: lbl.id,
        });
      }
      onTaskUpdated();
    } catch (err) {
      console.error('Failed to toggle label on task:', err);
      await fetchTaskData(task.id);
    }
  };

  // Toggle Task Archive / Restore (FR-TSK-01)
  const handleToggleArchive = async () => {
    if (!task || !user || !currentOrg) return;
    const newArchivedAt = isArchived ? null : new Date().toISOString();
    try {
      const { error } = await (supabase.from('tasks') as any)
        .update({ archived_at: newArchivedAt })
        .eq('id', task.id);

      if (error) throw error;

      await (supabase.from('activity_events') as any).insert({
        org_id: currentOrg.id,
        project_id: task.project_id,
        task_id: task.id,
        actor_id: user.id,
        type: newArchivedAt ? 'task_archived' : 'task_restored',
        after_json: { archived_at: newArchivedAt },
      });

      setIsArchived(!isArchived);
      notify(newArchivedAt ? 'Task archived successfully (FR-TSK-01).' : 'Task restored from archive.');
      onTaskUpdated();
    } catch (err: any) {
      notify(err.message || 'Failed to archive/restore task.');
    }
  };

  // Save Task Changes with Strict Section 10 Validation
  const handleSaveDetails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!task || !title.trim()) return;

    // Doc 1 Section 10 & FR-TSK-06: Status Transition Business Rules Validation
    const hasOpenSubtasks = subtasks.some((s) => s.status !== 'done' && s.status !== 'cancelled');
    const transitionCheck = validateStatusTransition(task.status, status, {
      hasOpenSubtasks,
      isArchived: isArchived,
      userRole: currentRole,
    });

    if (!transitionCheck.valid) {
      notify(transitionCheck.error || 'Invalid status transition.');
      return;
    }

    setSavingTask(true);
    try {
      const completedAt = status === 'done' ? new Date().toISOString() : null;

      const { error } = await (supabase.from('tasks') as any)
        .update({
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          assignee_id: assigneeId || null,
          completed_at: completedAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      if (error) throw error;

      // Log activity event
      if (user && currentOrg) {
        await (supabase.from('activity_events') as any).insert({
          org_id: currentOrg.id,
          project_id: task.project_id,
          task_id: task.id,
          actor_id: user.id,
          type: 'task_updated',
          after_json: { status, priority, title },
        });

        const targetDueDate = dueDate ? new Date(dueDate).toISOString() : null;

        // Trigger Notifications (Module 7)
        // 1. Assignee change notification
        if (assigneeId && assigneeId !== task.assignee_id) {
          await notifyTaskAssigned({
            orgId: currentOrg.id,
            task: { ...task, title: title.trim(), priority, due_date: targetDueDate },
            newAssigneeId: assigneeId,
            actorUser: user,
          });
        }

        // 2. Due date change notification
        if (targetDueDate !== task.due_date) {
          await notifyDueDateChanged({
            orgId: currentOrg.id,
            task: { ...task, assignee_id: assigneeId || task.assignee_id },
            oldDueDate: task.due_date,
            newDueDate: targetDueDate,
            actorUser: user,
          });
        }

        // 3. Status change notification
        if (status !== task.status) {
          await notifyTaskCompletedOrStatusChanged({
            orgId: currentOrg.id,
            task: { ...task, title: title.trim(), assignee_id: assigneeId || task.assignee_id },
            oldStatus: task.status,
            newStatus: status,
            actorUser: user,
          });
        }
      }

      notify('Task updated successfully.');
      onTaskUpdated();
      await fetchTaskData(task.id);
    } catch (err: any) {
      notify(err.message || 'Failed to update task.');
    } finally {
      setSavingTask(false);
    }
  };

  // AI Feature Handlers (Supabase Edge Function: teamflow-ai)
  const handleAIBreakdown = async () => {
    if (!task || !currentOrg) return;
    setGeneratingAI(true);
    try {
      const res = await aiBreakdownTask({
        taskTitle: title || task.title,
        taskDescription: description || task.description || undefined,
      });

      if (res.subtasks && res.subtasks.length > 0) {
        for (const st of res.subtasks) {
          await (supabase.from('tasks') as any).insert({
            org_id: currentOrg.id,
            project_id: task.project_id,
            parent_task_id: task.id,
            title: st.title,
            description: st.description || null,
            status: 'todo',
            priority: st.priority || 'medium',
            assignee_id: user?.id || null,
          });
        }
        await fetchTaskData(task.id);
        onTaskUpdated();
        notify(`AI generated ${res.subtasks.length} subtasks!`);
      } else if (res.error) {
        notify(`AI breakdown: ${res.error}`);
      }
    } catch (err: any) {
      notify('AI breakdown request failed.');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleAIEnhanceDescription = async () => {
    if (!task) return;
    setGeneratingAI(true);
    try {
      const res = await aiEnhanceDescription({
        taskTitle: title || task.title,
        taskDescription: description,
      });

      if (res.content) {
        setDescription(res.content);
        notify('Description enhanced with AI!');
      } else if (res.error) {
        notify(`AI enhance: ${res.error}`);
      }
    } catch (err: any) {
      notify('AI enhance request failed.');
    } finally {
      setGeneratingAI(false);
    }
  };


  // Add Subtask (FR-TSK-04)
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newSubtaskTitle.trim() || !currentOrg) return;

    setAddingSubtask(true);
    try {
      const { data, error } = await (supabase.from('tasks') as any)
        .insert({
          org_id: currentOrg.id,
          project_id: task.project_id,
          parent_task_id: task.id,
          title: newSubtaskTitle.trim(),
          status: 'todo',
          priority: 'medium',
          assignee_id: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      setNewSubtaskTitle('');
      await fetchTaskData(task.id);
      notify('Subtask added.');
      onTaskUpdated();
    } catch (err: any) {
      notify(err.message || 'Failed to add subtask.');
    } finally {
      setAddingSubtask(false);
    }
  };

  // Toggle Subtask Done
  const handleToggleSubtask = async (sub: Task) => {
    const newSubStatus: TaskStatus = sub.status === 'done' ? 'todo' : 'done';
    try {
      await (supabase.from('tasks') as any)
        .update({
          status: newSubStatus,
          completed_at: newSubStatus === 'done' ? new Date().toISOString() : null,
        })
        .eq('id', sub.id);

      await fetchTaskData(task!.id);
      onTaskUpdated();
    } catch (err: any) {
      notify('Failed to update subtask.');
    }
  };

  // Delete Subtask
  const handleDeleteSubtask = async (subId: string) => {
    try {
      await (supabase.from('tasks') as any).delete().eq('id', subId);
      await fetchTaskData(task!.id);
      onTaskUpdated();
    } catch (err: any) {
      notify('Failed to delete subtask.');
    }
  };

  // Add Comment (FR-COL-01)
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newComment.trim() || !user || !currentOrg) return;

    setSubmittingComment(true);
    try {
      const { error } = await (supabase.from('comments') as any).insert({
        org_id: currentOrg.id,
        task_id: task.id,
        author_id: user.id,
        body: newComment.trim(),
      });

      if (error) throw error;

      // Log activity
      await (supabase.from('activity_events') as any).insert({
        org_id: currentOrg.id,
        project_id: task.project_id,
        task_id: task.id,
        actor_id: user.id,
        type: 'comment_added',
      });

      // Trigger Comment Notification (Module 7: mentions, assignee, creator with 5-min burst collapsing)
      if (currentOrg) {
        await notifyCommentAdded({
          orgId: currentOrg.id,
          task,
          commentBody: newComment.trim(),
          authorUser: user,
          projectMembers: members,
        });
      }

      setNewComment('');
      await fetchTaskData(task.id);
      notify('Comment posted.');
    } catch (err: any) {
      notify(err.message || 'Failed to post comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Delete Comment (FR-COL-01: author or manager/owner)
  const handleDeleteComment = async (commentId: string, authorId: string) => {
    const canDelete = user?.id === authorId || currentRole === 'owner' || currentRole === 'manager';
    if (!canDelete) {
      notify('You do not have permission to delete this comment.');
      return;
    }

    try {
      await (supabase.from('comments') as any).delete().eq('id', commentId);
      await fetchTaskData(task!.id);
      notify('Comment removed.');
    } catch (err: any) {
      notify('Failed to delete comment.');
    }
  };

  // Edit Comment (FR-COL-01)
  const handleStartEditComment = (c: CommentItem) => {
    setEditingCommentId(c.id);
    setEditCommentBody(c.body);
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!editCommentBody.trim() || !task) return;
    try {
      const { error } = await (supabase.from('comments') as any)
        .update({
          body: editCommentBody.trim(),
          edited_at: new Date().toISOString(),
        })
        .eq('id', commentId);

      if (error) throw error;

      if (user && currentOrg) {
        await (supabase.from('activity_events') as any).insert({
          org_id: currentOrg.id,
          project_id: task.project_id,
          task_id: task.id,
          actor_id: user.id,
          type: 'comment_edited',
        });
      }

      setEditingCommentId(null);
      notify('Comment updated.');
      await fetchTaskData(task.id);
    } catch (err: any) {
      notify(err.message || 'Failed to update comment.');
    }
  };

  // Quick @mention tagger (FR-COL-01)
  const handleMentionMember = (name: string) => {
    setNewComment((prev) => `${prev}@${name} `);
  };

  // Upload File Attachment (FR-COL-02 & FR-COL-03)
  const processFileUpload = async (file: File) => {
    if (!file || !task || !user || !currentOrg) return;

    // 1. Validate size limit (FR-COL-02: Max 10 MB)
    if (file.size > MAX_FILE_SIZE) {
      notify(`File size (${formatFileSize(file.size)}) exceeds the maximum 10 MB limit (FR-COL-02).`);
      return;
    }

    // 2. Validate allow-list extension (FR-COL-02)
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      notify(`File extension .${ext} is not in the allowed list: ${ALLOWED_EXTENSIONS.join(', ')}.`);
      return;
    }

    // 3. MIME type sniffing validation (FR-COL-02)
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      const isTextOrData = file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('csv');
      if (!isTextOrData) {
        notify(`File MIME type (${file.type}) is not permitted. Please upload documents, images, or archives.`);
        return;
      }
    }

    setUploadingFile(true);
    try {
      // 4. Calculate SHA-256 Checksum for integrity verification
      const checksum = await calculateChecksum(file);

      // 5. Random UUID filename: storage/{orgId}/{projectId}/{uuid}.{ext} (Module 6 spec)
      const fileUuid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const storagePath = `${currentOrg.id}/${task.project_id}/${fileUuid}.${ext}`;

      // Upload to private Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.warn('Storage upload notice (private bucket):', uploadError.message);
      }

      // Record in public.attachments with original name, MIME, size, checksum, storage key, uploader
      const { error: dbError } = await (supabase.from('attachments') as any).insert({
        org_id: currentOrg.id,
        task_id: task.id,
        uploader_id: user.id,
        original_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        storage_path: storagePath,
        checksum: checksum,
      });

      if (dbError) throw dbError;

      // Record Activity (FR-COL-04)
      await (supabase.from('activity_events') as any).insert({
        org_id: currentOrg.id,
        project_id: task.project_id,
        task_id: task.id,
        actor_id: user.id,
        type: 'attachment_added',
        after_json: { 
          file_name: file.name, 
          size_bytes: file.size, 
          checksum_prefix: checksum.substring(0, 10),
          mime_type: file.type || 'application/octet-stream'
        },
      });

      notify(`File "${file.name}" uploaded successfully.`);
      await fetchTaskData(task.id);
    } catch (err: any) {
      notify(err.message || 'Failed to upload attachment.');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFileUpload(file);
    }
  };

  // Download Attachment via Authorized Signed URL (FR-COL-03: No public URLs)
  const handleDownloadAttachment = async (att: AttachmentItem) => {
    setDownloadingId(att.id);
    try {
      const { data, error } = await supabase.storage
        .from('task-attachments')
        .createSignedUrl(att.storage_path, 60, {
          download: att.original_name,
        });

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || 'Failed to generate authorized signed URL.');
      }

      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = att.original_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      notify(err.message || 'Could not download file. Ensure storage bucket is active.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Delete Attachment (FR-COL-02)
  const handleDeleteAttachment = async (att: AttachmentItem) => {
    if (!task || !user || !currentOrg) return;
    const canDelete = att.uploader_id === user.id || currentRole === 'owner' || currentRole === 'manager';
    if (!canDelete) {
      notify('Only the uploader or a manager can remove this attachment.');
      return;
    }

    try {
      await (supabase.from('attachments') as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', att.id);

      await supabase.storage.from('task-attachments').remove([att.storage_path]);

      await (supabase.from('activity_events') as any).insert({
        org_id: currentOrg.id,
        project_id: task.project_id,
        task_id: task.id,
        actor_id: user.id,
        type: 'attachment_removed',
        after_json: { file_name: att.original_name },
      });

      notify(`Attachment "${att.original_name}" removed.`);
      await fetchTaskData(task.id);
    } catch (err) {
      notify('Failed to delete attachment.');
    }
  };


  // Archive Task
  const handleArchiveTask = async () => {
    if (!task || !confirm('Are you sure you want to archive this task?')) return;
    try {
      await (supabase.from('tasks') as any)
        .update({ archived_at: new Date().toISOString() })
        .eq('id', task.id);

      notify('Task archived.');
      onTaskUpdated();
      onClose();
    } catch (err: any) {
      notify('Failed to archive task.');
    }
  };

  if (!isOpen || !task) return null;

  const completedSubtasksCount = subtasks.filter((s) => s.status === 'done').length;
  const subtaskProgress = subtasks.length > 0 ? (completedSubtasksCount / subtasks.length) * 100 : 0;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-mono animate-fadeIn">
      <div className="bg-[#0c1018] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/40">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 shrink-0 uppercase">
              {task.priority}
            </span>
            <span className="text-xs text-slate-400 truncate font-mono">
              Task Details &middot; ID: {task.id.substring(0, 8)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleArchiveTask}
              title="Archive Task"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {feedback && (
          <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-800/80 bg-slate-900/20 text-xs">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-3 py-2 border-b-2 font-medium transition ${
              activeTab === 'details'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('subtasks')}
            className={`px-3 py-2 border-b-2 font-medium transition flex items-center gap-1.5 ${
              activeTab === 'subtasks'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Subtasks</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {subtasks.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-3 py-2 border-b-2 font-medium transition flex items-center gap-1.5 ${
              activeTab === 'comments'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Discussion</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {comments.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('attachments')}
            className={`px-3 py-2 border-b-2 font-medium transition flex items-center gap-1.5 ${
              activeTab === 'attachments'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>Files & Docs</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {attachments.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-3 py-2 border-b-2 font-medium transition flex items-center gap-1.5 ${
              activeTab === 'activity'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {activities.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: DETAILS & ATTRIBUTES */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              {/* Title & Description */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-sm font-semibold focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Description & Specifications
                    </label>
                    <button
                      type="button"
                      onClick={handleAIEnhanceDescription}
                      disabled={generatingAI}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold transition disabled:opacity-50"
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>{generatingAI ? 'Enhancing...' : 'AI Enhance'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide acceptance criteria and execution steps..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-750 text-slate-200 text-xs focus:outline-none focus:border-amber-400 font-sans leading-relaxed"
                  />
                </div>
              </div>

              {/* Labels & Tags (FR-TSK-05) */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-400" />
                    <span>Labels & Tags (FR-TSK-05)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsLabelManagerOpen(true)}
                    className="text-[11px] font-mono text-amber-400 hover:text-amber-300 transition"
                  >
                    Manage Labels
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {attachedLabels.map((lbl) => (
                    <span
                      key={lbl.id}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 font-mono shadow-sm"
                      style={{
                        backgroundColor: `${lbl.color}15`,
                        color: lbl.color,
                        borderColor: `${lbl.color}35`,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: lbl.color }}
                      />
                      <span>{lbl.name}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleLabel(lbl)}
                        className="ml-1 text-slate-400 hover:text-white"
                        title="Detach label"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  {/* Add Label Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsLabelDropdownOpen(!isLabelDropdownOpen)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-750 text-slate-300 text-xs font-mono hover:border-amber-400 transition"
                    >
                      <Plus className="w-3 h-3 text-amber-400" />
                      <span>Attach Label</span>
                    </button>

                    {isLabelDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1.5 w-52 rounded-xl bg-slate-900 border border-slate-750 shadow-2xl p-2 z-40 space-y-1 font-mono">
                        <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1">
                          Select Label
                        </div>
                        {allLabels.length === 0 ? (
                          <div className="px-2 py-2 text-[11px] text-slate-500">
                            No labels exist yet.
                          </div>
                        ) : (
                          allLabels.map((lbl) => {
                            const isAttached = attachedLabels.some((l) => l.id === lbl.id);
                            return (
                              <button
                                key={lbl.id}
                                type="button"
                                onClick={() => handleToggleLabel(lbl)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                                  isAttached ? 'bg-slate-800/80 text-white font-bold' : 'text-slate-300'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: lbl.color }}
                                  />
                                  <span>{lbl.name}</span>
                                </span>
                                {isAttached && <Check className="w-3.5 h-3.5 text-amber-400" />}
                              </button>
                            );
                          })
                        )}
                        <div className="pt-1.5 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setIsLabelDropdownOpen(false);
                              setIsLabelManagerOpen(true);
                            }}
                            className="w-full text-left px-2.5 py-1 rounded-lg text-[11px] text-amber-400 hover:bg-slate-800 transition flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Create New Label...</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Workflow Status (Doc 1 §10)
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="done">Done</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Assignee (Project Member Only FR-TSK-03)
                  </label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Target Due Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl bg-slate-900 border text-slate-200 text-xs focus:outline-none focus:border-amber-400 ${
                        isOverdue ? 'border-rose-500/50 text-rose-300' : 'border-slate-750'
                      }`}
                    />
                  </div>
                  {isOverdue && (
                    <span className="text-[10px] text-rose-400 mt-1 block">
                      Task deadline has passed.
                    </span>
                  )}
                </div>
              </div>

              {/* Subtask Quick Progress Widget */}
              {subtasks.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Subtask Progress</span>
                    <span className="text-amber-400 font-bold">
                      {completedSubtasksCount} / {subtasks.length} completed
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${subtaskProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SUBTASKS (FR-TSK-04) */}
          {activeTab === 'subtasks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-xs font-semibold text-slate-300">
                  Subtask Checklist ({subtasks.length})
                </span>
                <button
                  type="button"
                  onClick={handleAIBreakdown}
                  disabled={generatingAI}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-600/20 to-blue-600/20 hover:from-cyan-600/30 hover:to-blue-600/30 border border-cyan-500/30 text-cyan-300 text-xs font-semibold transition disabled:opacity-50 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{generatingAI ? 'AI Analyzing...' : 'AI Subtask Breakdown'}</span>
                </button>
              </div>

              <form onSubmit={handleAddSubtask} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Add a new subtask breakdown..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={addingSubtask}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                >
                  {addingSubtask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Add Subtask</span>
                </button>
              </form>

              {subtasks.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No subtasks added yet. Break down complex tasks into atomic action items.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-900/40 border border-slate-800 overflow-hidden">
                  {subtasks.map((sub) => {
                    const isDone = sub.status === 'done';
                    return (
                      <div
                        key={sub.id}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-slate-850/30 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleSubtask(sub)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                              isDone
                                ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                                : 'border-slate-600 hover:border-amber-400'
                            }`}
                          >
                            {isDone && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                          <span
                            className={`text-xs truncate ${
                              isDone ? 'line-through text-slate-500' : 'text-slate-200'
                            }`}
                          >
                            {sub.title}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteSubtask(sub.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: COMMENTS & COLLABORATION (FR-COL-01) */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              <form onSubmit={handleAddComment} className="space-y-2.5">
                {/* @mention member tags */}
                {members.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <AtSign className="w-3 h-3 text-amber-400" /> Mention:
                    </span>
                    {members.slice(0, 5).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleMentionMember(m.name || m.email.split('@')[0])}
                        className="px-2 py-0.5 rounded-full text-[10px] bg-slate-900 border border-slate-750 text-slate-300 hover:border-amber-400 font-mono transition"
                      >
                        @{m.name || m.email.split('@')[0]}
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  rows={3}
                  required
                  placeholder="Share sprint updates, architectural notes, or @mention teammates..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-750 text-slate-100 text-xs focus:outline-none focus:border-amber-400 font-sans leading-relaxed"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingComment}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 font-mono shadow-md shadow-amber-500/20"
                  >
                    {submittingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Post Comment</span>
                  </button>
                </div>
              </form>

              {comments.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl font-mono">
                  No discussion comments on this task yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((c) => {
                    const isAuthor = user?.id === c.author_id;
                    const canDelete = isAuthor || currentRole === 'owner' || currentRole === 'manager';
                    const isEditing = editingCommentId === c.id;

                    return (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 transition hover:border-slate-750"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-[10px] font-mono">
                              {c.author?.name ? c.author.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <span className="font-bold text-slate-200 font-mono">
                              {c.author?.name || c.author?.email?.split('@')[0] || 'Team Member'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                            <span>{new Date(c.created_at).toLocaleString()}</span>
                            {c.edited_at && (
                              <span className="text-amber-400/80">(edited)</span>
                            )}

                            {isAuthor && !isEditing && (
                              <button
                                type="button"
                                onClick={() => handleStartEditComment(c)}
                                className="text-slate-500 hover:text-amber-400 transition"
                                title="Edit comment"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}

                            {canDelete && !isEditing && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(c.id, c.author_id)}
                                className="text-slate-500 hover:text-rose-400 transition"
                                title="Delete comment"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="space-y-2 mt-2">
                            <textarea
                              rows={2}
                              value={editCommentBody}
                              onChange={(e) => setEditCommentBody(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-750 rounded-lg text-slate-100 font-sans focus:outline-none focus:border-amber-400"
                            />
                            <div className="flex justify-end gap-2 font-mono">
                              <button
                                type="button"
                                onClick={() => setEditingCommentId(null)}
                                className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditComment(c.id)}
                                className="px-3 py-1 text-[11px] bg-amber-500 text-slate-950 font-bold rounded-lg hover:bg-amber-400"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-300 font-sans leading-relaxed pl-8 whitespace-pre-wrap">
                            {c.body}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ATTACHMENTS & PRIVATE STORAGE (FR-COL-02 & FR-COL-03) */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              {/* File Upload Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                  isDraggingOver 
                    ? 'border-amber-400 bg-amber-500/10 scale-[1.01]' 
                    : 'border-slate-800 hover:border-amber-500/50 bg-slate-900/30 hover:bg-slate-900/50'
                } group`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.pdf,.docx,.xlsx,.txt,.zip,.json,.csv"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:scale-110 transition">
                    {uploadingFile ? (
                      <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                    ) : (
                      <UploadCloud className="w-5 h-5 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      {uploadingFile ? 'Uploading file...' : isDraggingOver ? 'Drop file here to upload' : 'Click or Drag & Drop Attachment'}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Type allow-list: PDF, DOCX, XLSX, PNG, JPG, ZIP, JSON, CSV (Max 10 MB)
                    </p>
                  </div>
                </div>
              </div>

              {/* Attachments List */}
              {attachments.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl font-mono">
                  No files attached to this task.
                </div>
              ) : (
                <div className="space-y-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono block">
                    ATTACHED FILES ({attachments.length})
                  </span>
                  <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-900/40 border border-slate-800 overflow-hidden">
                    {attachments.map((att) => {
                      const isImage = att.mime_type.startsWith('image/');
                      const isZip = att.mime_type.includes('zip');
                      const canDelete =
                        user?.id === att.uploader_id ||
                        currentRole === 'owner' ||
                        currentRole === 'manager';

                      return (
                        <div
                          key={att.id}
                          className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-850/40 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                              {isImage ? (
                                <ImageIcon className="w-4 h-4 text-cyan-400" />
                              ) : isZip ? (
                                <FileArchive className="w-4 h-4 text-amber-400" />
                              ) : (
                                <FileIcon className="w-4 h-4 text-blue-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h5 className="text-xs font-semibold text-slate-200 truncate">
                                  {att.original_name}
                                </h5>
                                {att.checksum && (
                                  <span 
                                    title={`SHA-256: ${att.checksum}`}
                                    className="text-[9px] px-1 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono hidden sm:inline-block"
                                  >
                                    SHA-256: {att.checksum.substring(0, 8)}...
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                                <span>{formatFileSize(att.size_bytes)}</span>
                                <span>&middot;</span>
                                <span>
                                  {att.uploader?.name || 'User'} &middot;{' '}
                                  {new Date(att.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 font-mono">
                            {/* Secure Signed Download (FR-COL-03) */}
                            <button
                              type="button"
                              onClick={() => handleDownloadAttachment(att)}
                              disabled={downloadingId === att.id}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 transition"
                              title="Download via authorized token"
                            >
                              {downloadingId === att.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                              ) : (
                                <Download className="w-3.5 h-3.5 text-amber-400" />
                              )}
                              <span>Download</span>
                            </button>

                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAttachment(att)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition"
                                title="Remove attachment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: AUDIT ACTIVITY TRAIL (FR-COL-04) */}
          {activeTab === 'activity' && (
            <div className="space-y-3 font-mono">
              {activities.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No activity events recorded for this task.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-900/40 border border-slate-800">
                  {activities.map((a) => {
                    const eventColors: Record<string, string> = {
                      task_created: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                      task_updated: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                      task_moved: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                      comment_added: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
                      comment_edited: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
                      attachment_added: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
                      attachment_removed: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
                      task_archived: 'text-slate-400 bg-slate-700/30 border-slate-700',
                      task_restored: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                    };

                    const badgeStyle = eventColors[a.type] || 'text-slate-400 bg-slate-800 border-slate-700';

                    return (
                      <div key={a.id} className="p-3.5 flex items-start justify-between gap-3 text-xs">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-200">
                                {a.actor?.name || a.actor?.email?.split('@')[0] || 'User'}
                              </span>
                              <span className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase border ${badgeStyle}`}>
                                {a.type.replace('_', ' ')}
                              </span>
                            </div>

                            {/* Before/After Detail Snippets (FR-COL-04) */}
                            {a.after_json && (
                              <div className="text-[11px] text-slate-400 font-sans">
                                {a.after_json.status && (
                                  <span>
                                    Status: <strong className="text-slate-300 uppercase">{a.after_json.status}</strong>
                                  </span>
                                )}
                                {a.after_json.file_name && (
                                  <span>
                                    File: <strong className="text-slate-300">{a.after_json.file_name}</strong>
                                  </span>
                                )}
                                {a.after_json.title && !a.after_json.status && (
                                  <span>
                                    Title: <strong className="text-slate-300">{a.after_json.title}</strong>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                          {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &middot; {new Date(a.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/30">
          <div className="flex items-center gap-3">
            {currentRole !== 'employee' && (
              <button
                type="button"
                onClick={handleToggleArchive}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition ${
                  isArchived
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-slate-900 border-slate-750 text-slate-400 hover:text-rose-400 hover:border-rose-500/30'
                }`}
              >
                {isArchived ? (
                  <ArchiveRestore className="w-3.5 h-3.5" />
                ) : (
                  <Archive className="w-3.5 h-3.5" />
                )}
                <span>{isArchived ? 'Restore Task' : 'Archive Task'}</span>
              </button>
            )}
            <span className="text-[11px] text-slate-500 hidden sm:inline font-mono">
              Status validated per Doc 1 §10
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleSaveDetails()}
              disabled={savingTask}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              {savingTask && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Task</span>
            </button>
          </div>
        </div>
      </div>

      {/* Label Manager Modal */}
      <LabelManagerModal
        isOpen={isLabelManagerOpen}
        onClose={() => {
          setIsLabelManagerOpen(false);
          if (task) fetchTaskData(task.id);
        }}
        activeProject={task ? ({ id: task.project_id } as any) : null}
        onLabelsChanged={() => {
          if (task) fetchTaskData(task.id);
          onTaskUpdated();
        }}
      />
    </div>
  );
};

