import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useDynamicTodos } from '@/hooks/useDynamicTodos';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, ClipboardCheck, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';

interface ChecklistItem {
  id: string;
  list_id: string;
  title: string;
  order_index: number;
  completed?: boolean;
  module_id: string | null;
}

interface ChecklistList {
  id: string;
  title: string;
  order_index: number;
  items: ChecklistItem[];
}

export default function HairSystemChecklist() {
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);

  // Fetch checklist-specific dynamic lists (tagged with "checklist" category)
  const { data: lists = [], isLoading } = useQuery({
    queryKey: ['checklist-todos', user?.id],
    queryFn: async () => {
      const { data: listsData, error: listsError } = await supabase
        .from('dynamic_todo_lists')
        .select('*')
        .ilike('title', '%checklist%')
        .order('order_index');

      if (listsError) throw listsError;
      if (!listsData || listsData.length === 0) return [];

      const listIds = listsData.map(l => l.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('dynamic_todo_items')
        .select('*')
        .in('list_id', listIds)
        .order('order_index');

      if (itemsError) throw itemsError;

      let progressData: { item_id: string; completed: boolean }[] = [];
      if (user) {
        const { data, error: progressError } = await supabase
          .from('user_dynamic_todo_progress')
          .select('item_id, completed')
          .eq('user_id', user.id);
        if (!progressError && data) progressData = data;
      }

      const progressMap = new Map(progressData.map(p => [p.item_id, p.completed]));

      return listsData.map(list => ({
        ...list,
        items: (itemsData || [])
          .filter(item => item.list_id === list.id)
          .map(item => ({
            ...item,
            completed: progressMap.get(item.id) || false,
          })),
      })) as ChecklistList[];
    },
    enabled: true,
  });

  const toggleItem = async (itemId: string, completed: boolean) => {
    if (!user) return;

    const { data: existing } = await supabase
      .from('user_dynamic_todo_progress')
      .select('id')
      .eq('user_id', user.id)
      .eq('item_id', itemId)
      .single();

    if (existing) {
      await supabase
        .from('user_dynamic_todo_progress')
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('user_dynamic_todo_progress')
        .insert({
          user_id: user.id,
          item_id: itemId,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        });
    }
  };

  const handleDownload = () => {
    // Generate a printable text version
    setDownloading(true);
    try {
      const lines: string[] = ['HAIR SYSTEM CHECKLIST', '='.repeat(40), ''];
      lists.forEach(list => {
        lines.push(list.title.toUpperCase());
        lines.push('-'.repeat(30));
        list.items.forEach((item, i) => {
          lines.push(`  [ ] ${i + 1}. ${item.title}`);
        });
        lines.push('');
      });

      const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hair-system-checklist.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Checklist downloaded!');
    } catch {
      toast.error('Failed to download checklist');
    } finally {
      setDownloading(false);
    }
  };

  const totalItems = lists.reduce((acc, l) => acc + l.items.length, 0);
  const completedItems = lists.reduce(
    (acc, l) => acc + l.items.filter(i => i.completed).length,
    0
  );
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
          <div>
            <h1 className="font-display text-4xl font-bold mb-2 flex items-center gap-3">
              <ClipboardCheck className="w-9 h-9 text-primary" />
              Hair System Checklist
            </h1>
            <p className="text-muted-foreground text-lg">
              Your step-by-step guide for hair system installs. Use it yourself or walk your client through it.
            </p>
          </div>
          <Button
            onClick={handleDownload}
            variant="outline"
            disabled={downloading || lists.length === 0}
            className="shrink-0"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {downloading ? 'Downloading...' : 'Download Checklist'}
          </Button>
        </div>

        {/* Progress bar */}
        {totalItems > 0 && (
          <div className="glass-card p-4 rounded-xl animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedItems}/{totalItems} completed ({progressPercent}%)
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Checklist content */}
        {isLoading ? (
          <div className="glass-card p-8 rounded-xl">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          </div>
        ) : lists.length === 0 ? (
          <div className="glass-card p-12 rounded-xl text-center animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <ClipboardCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold mb-2">No Checklists Yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Checklists will appear here once they're set up. Any dynamic to-do list with "checklist" in its title will show up on this page.
            </p>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            {lists.map(list => {
              const listCompleted = list.items.filter(i => i.completed).length;
              const listTotal = list.items.length;
              return (
                <div key={list.id} className="glass-card p-6 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-xl font-semibold">{list.title}</h2>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                      {listCompleted}/{listTotal}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {list.items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 bg-background/50 rounded-lg hover:bg-background/80 transition-colors"
                      >
                        <Checkbox
                          id={`checklist-${item.id}`}
                          checked={item.completed}
                          onCheckedChange={(checked) => toggleItem(item.id, !!checked)}
                        />
                        <label
                          htmlFor={`checklist-${item.id}`}
                          className={`text-sm font-medium cursor-pointer flex-1 ${
                            item.completed ? 'line-through text-muted-foreground' : ''
                          }`}
                        >
                          {idx + 1}. {item.title}
                        </label>
                        {item.module_id && (
                          <Link
                            to={`/courses/lesson/${item.module_id}`}
                            className="text-xs text-primary underline flex items-center gap-1 shrink-0"
                          >
                            <Play className="w-3 h-3" />
                            Watch
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
