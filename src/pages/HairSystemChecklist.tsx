import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, ClipboardCheck, Loader2, Play, AlertTriangle, Copy, MessageSquare, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface ChecklistItem {
  id: string;
  list_id: string;
  title: string;
  order_index: number;
  completed?: boolean;
  module_id: string | null;
  section_title: string | null;
  is_important: boolean;
}

interface ChecklistList {
  id: string;
  title: string;
  order_index: number;
  items: ChecklistItem[];
}

export default function HairSystemChecklist() {
  const { user } = useAuth();
  const { listId } = useParams<{ listId?: string }>();
  const [downloading, setDownloading] = useState(false);
  const [searchParams] = useSearchParams();
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ['checklist-todos', user?.id, listId],
    queryFn: async () => {
      let query = supabase
        .from('dynamic_todo_lists')
        .select('*')
        .order('order_index');

      if (listId) {
        query = query.eq('id', listId);
      } else {
        query = query.ilike('title', '%checklist%');
      }

      const { data: listsData, error: listsError } = await query;
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

  useEffect(() => {
    if (searchParams.get('scrollBottom') === 'true' && !isLoading && lists.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
    }
  }, [searchParams, isLoading, lists]);

  const toggleMutation = useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string; completed: boolean }) => {
      if (!user) throw new Error('Not authenticated');

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
    },
    onMutate: async ({ itemId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['checklist-todos', user?.id, listId] });
      const prev = queryClient.getQueryData<ChecklistList[]>(['checklist-todos', user?.id, listId]);
      queryClient.setQueryData<ChecklistList[]>(['checklist-todos', user?.id, listId], old =>
        old?.map(list => ({
          ...list,
          items: list.items.map(item =>
            item.id === itemId ? { ...item, completed } : item
          ),
        }))
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['checklist-todos', user?.id, listId], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-todos'] });
    },
  });

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const isInstallation = lists.some(l => l.title.toLowerCase().includes('installation') && !l.title.toLowerCase().includes('after'));
      
      if (isInstallation) {
        const response = await fetch('/files/Barber_Installation_Checklist_Mobile.pdf');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Installation_Checklist.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const lines: string[] = [];
        lists.forEach(list => {
          lines.push(list.title.toUpperCase());
          lines.push('='.repeat(40));
          lines.push('');
          list.items.forEach((item, i) => {
            lines.push(`  [ ] ${i + 1}. ${item.title}`);
          });
          lines.push('');
        });

        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${lists[0]?.title || 'checklist'}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      toast.success('Checklist downloaded!');
    } catch {
      toast.error('Failed to download checklist');
    } finally {
      setDownloading(false);
    }
  };

  const isClientAfterInstall = lists.some(l => l.title.toLowerCase().includes('after install'));
  const clientMessage = `Here's everything you need to maintain your hair system, please watch it all the way as it's very important.\n\nhttps://www.menshairexpert.com/thank-you`;

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(clientMessage).then(() => {
      toast.success('Message copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy message');
    });
  };

  const totalItems = lists.reduce((acc, l) => acc + l.items.length, 0);
  const completedItems = lists.reduce(
    (acc, l) => acc + l.items.filter(i => i.completed).length, 0
  );
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const pageTitle = listId && lists.length === 1 ? lists[0].title : 'Checklists';

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
          <div>
            <h1 className="font-display text-2xl sm:text-4xl font-bold mb-2 flex items-center gap-3">
              <ClipboardCheck className="w-7 h-7 sm:w-9 sm:h-9 text-primary" />
              {pageTitle}
            </h1>
            {!listId && (
              <p className="text-muted-foreground text-lg">
                Your step-by-step guides. Use them yourself or walk your client through it.
              </p>
            )}
          </div>
          {!isClientAfterInstall && (
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
              {downloading ? 'Downloading...' : 'Download'}
            </Button>
          )}
        </div>

        {totalItems > 0 && !listId && (
          <div className="glass-card p-4 rounded-xl animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedItems}/{totalItems} ({progressPercent}%)
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
            <h3 className="text-lg font-semibold mb-2">No Checklist Items Yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Items will appear here once they're added in the admin panel.
            </p>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            {lists.map(list => {
              const listCompleted = list.items.filter(i => i.completed).length;
              const listTotal = list.items.length;
              return (
                <div key={list.id} className={listId ? 'space-y-4' : 'glass-card p-6 rounded-xl space-y-4'}>
                  {!listId && (
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-xl font-semibold">{list.title}</h2>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                        {listCompleted}/{listTotal}
                      </span>
                    </div>
                  )}
                  <div className="space-y-4">
                    {(() => {
                      const sections: { title: string | null; items: ChecklistItem[] }[] = [];
                      list.items.forEach(item => {
                        const last = sections[sections.length - 1];
                        if (last && last.title === (item.section_title || null)) {
                          last.items.push(item);
                        } else {
                          sections.push({ title: item.section_title || null, items: [item] });
                        }
                      });
                      let globalIdx = 0;
                      return sections.map((section, sIdx) => {
                        const sectionIsImportant = section.items.every(i => i.is_important);
                        return (
                        <div key={sIdx} className={`space-y-2 ${sectionIsImportant ? 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-5 shadow-lg shadow-primary/5 animate-wiggle' : ''}`}>
                          {section.title && !sectionIsImportant && (
                            <h3 className={`pt-1 flex items-center gap-2 ${
                              section.title.toLowerCase().includes('instructions')
                                ? 'text-xs font-medium text-muted-foreground italic'
                                : 'text-sm font-semibold text-primary uppercase tracking-wide'
                            }`}>
                              {section.title}
                            </h3>
                          )}
                          {sectionIsImportant && section.title && (
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="text-base font-bold text-primary">{section.title}</h3>
                                <p className="text-xs text-muted-foreground">This grows your business — don't skip it!</p>
                              </div>
                              <span className="ml-auto text-[10px] font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-full uppercase tracking-wider">Don't Skip</span>
                            </div>
                          )}
                          {section.items.map(item => {
                            const idx = globalIdx++;
                            const important = item.is_important && !sectionIsImportant;
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                  important
                                    ? 'bg-primary/10 border border-primary/30 hover:bg-primary/15'
                                    : 'bg-background/50 hover:bg-background/80'
                                }`}
                              >
                                <Checkbox
                                  id={`checklist-${item.id}`}
                                  checked={item.completed}
                                  onCheckedChange={(checked) =>
                                    toggleMutation.mutate({ itemId: item.id, completed: !!checked })
                                  }
                                />
                                {important && <AlertTriangle className="w-4 h-4 text-primary shrink-0" />}
                                <label
                                  htmlFor={`checklist-${item.id}`}
                                  className={`text-sm cursor-pointer flex-1 ${
                                    item.completed
                                      ? 'line-through text-muted-foreground font-medium'
                                      : important
                                        ? 'font-bold text-primary'
                                        : 'font-medium'
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
                                {item.title.toLowerCase().includes('text client checklist') && (
                                  <Link
                                    to="/checklist/345e249b-5f4f-4191-b140-c5cae86aac54"
                                    className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-md flex items-center gap-1 shrink-0 font-medium"
                                  >
                                    <ClipboardCheck className="w-3 h-3" />
                                    Click Here
                                  </Link>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
           </div>
        )}

        {!isLoading && isClientAfterInstall && (
          <div className="glass-card p-6 rounded-xl space-y-4 animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold">Send Your Client This Text</h3>
                <p className="text-xs text-muted-foreground">Copy and send after install</p>
              </div>
            </div>
            <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm whitespace-pre-line">
              {clientMessage}
            </div>
            <Button onClick={handleCopyMessage} variant="outline" className="w-full">
              <Copy className="w-4 h-4 mr-2" />
              Copy Message
            </Button>
            <Link to="/checklist/b0a7264d-1184-4a24-a6ed-f3352d916e49?scrollBottom=true">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back to Installation Checklist
              </Button>
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
