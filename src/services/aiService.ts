import { supabase } from '../api/supabaseClient';
import { TaskPriority } from '../types';

export interface AISubtaskSuggestion {
  title: string;
  description?: string;
  priority: TaskPriority;
}

export interface AIPriorityRecommendation {
  priority: TaskPriority;
  reason: string;
}

/**
 * Invokes the 'teamflow-ai' Supabase Edge Function to break down a feature into subtasks.
 */
export async function aiBreakdownTask(params: {
  taskTitle: string;
  taskDescription?: string;
  projectContext?: string;
}): Promise<{ subtasks: AISubtaskSuggestion[]; note?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('teamflow-ai', {
      body: {
        action: 'breakdown',
        taskTitle: params.taskTitle,
        taskDescription: params.taskDescription,
        projectContext: params.projectContext,
      },
    });

    if (error) throw error;

    if (data?.data && Array.isArray(data.data)) {
      return { subtasks: data.data };
    } else if (data?.subtasks && Array.isArray(data.subtasks)) {
      return { subtasks: data.subtasks, note: data.note };
    }

    // Fallback if data is raw string
    return {
      subtasks: [
        { title: `Design & plan ${params.taskTitle}`, priority: 'high', description: 'Define architecture and acceptance criteria.' },
        { title: `Implement core functionality`, priority: 'high', description: 'Code database models and service methods.' },
        { title: `Quality testing and edge cases`, priority: 'medium', description: 'Verify unit logic and UI interactions.' },
      ],
      note: 'Fallback subtasks generated.',
    };
  } catch (err: any) {
    console.error('aiBreakdownTask failed:', err);
    return {
      subtasks: [
        { title: `Design & plan ${params.taskTitle}`, priority: 'high', description: 'Define architecture and acceptance criteria.' },
        { title: `Implement core functionality`, priority: 'high', description: 'Code database models and service methods.' },
        { title: `Quality testing and edge cases`, priority: 'medium', description: 'Verify unit logic and UI interactions.' },
      ],
      error: err.message,
    };
  }
}

/**
 * Invokes 'teamflow-ai' to format and enrich raw task notes into a professional agile description.
 */
export async function aiEnhanceDescription(params: {
  taskTitle: string;
  taskDescription?: string;
  projectContext?: string;
}): Promise<{ content: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('teamflow-ai', {
      body: {
        action: 'enhance',
        taskTitle: params.taskTitle,
        taskDescription: params.taskDescription,
        projectContext: params.projectContext,
      },
    });

    if (error) throw error;
    return { content: data?.content || data?.data || '' };
  } catch (err: any) {
    console.error('aiEnhanceDescription failed:', err);
    return { content: '', error: err.message };
  }
}

/**
 * Invokes 'teamflow-ai' to recommend task priority.
 */
export async function aiSuggestPriority(params: {
  taskTitle: string;
  taskDescription?: string;
  dueDate?: string;
}): Promise<{ recommendation?: AIPriorityRecommendation; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('teamflow-ai', {
      body: {
        action: 'suggest_priority',
        taskTitle: params.taskTitle,
        taskDescription: params.taskDescription,
        dueDate: params.dueDate,
      },
    });

    if (error) throw error;
    if (data?.data?.priority) {
      return { recommendation: data.data };
    }
    return { recommendation: { priority: 'medium', reason: 'Default baseline priority.' } };
  } catch (err: any) {
    console.error('aiSuggestPriority failed:', err);
    return { error: err.message };
  }
}
