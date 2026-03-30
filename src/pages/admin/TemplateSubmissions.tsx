import { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, User } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface SubmissionRow {
  id: string;
  user_id: string;
  course_id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
  approved: boolean;
  approved_at: string | null;
}

interface MemberGroup {
  userId: string;
  fullName: string;
  email: string;
  submissions: SubmissionRow[];
  latestUpload: string;
}

export default function TemplateSubmissions() {
  const queryClient = useQueryClient();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['admin-template-submissions'],
    queryFn: async () => {
      const { data: photos, error } = await supabase
        .from('certification_photos')
        .select('id, user_id, course_id, file_name, file_url, uploaded_at, approved, approved_at')
        .order('uploaded_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((photos || []).map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Group by user
      const groupMap = new Map<string, MemberGroup>();
      for (const p of photos || []) {
        const profile = profileMap.get(p.user_id);
        if (!groupMap.has(p.user_id)) {
          groupMap.set(p.user_id, {
            userId: p.user_id,
            fullName: profile?.full_name || 'Unknown',
            email: profile?.email || '',
            submissions: [],
            latestUpload: p.uploaded_at,
          });
        }
        groupMap.get(p.user_id)!.submissions.push(p);
      }

      // Sort groups by latest upload desc
      return Array.from(groupMap.values()).sort(
        (a, b) => new Date(b.latestUpload).getTime() - new Date(a.latestUpload).getTime()
      );
    },
  });

  // Pre-load signed URLs for all photos
  const allSubmissions = useMemo(() => groups.flatMap(g => g.submissions), [groups]);

  useEffect(() => {
    const loadUrls = async () => {
      const missing = allSubmissions.filter(s => !signedUrls[s.id]);
      if (missing.length === 0) return;

      const results: Record<string, string> = {};
      await Promise.all(
        missing.map(async (s) => {
          const path = s.file_url.includes('/certification-photos/')
            ? s.file_url.split('/certification-photos/').pop()
            : s.file_url;
          if (!path) return;
          const { data } = await supabase.storage
            .from('certification-photos')
            .createSignedUrl(path, 3600);
          if (data?.signedUrl) results[s.id] = data.signedUrl;
        })
      );
      if (Object.keys(results).length > 0) {
        setSignedUrls(prev => ({ ...prev, ...results }));
      }
    };
    loadUrls();
  }, [allSubmissions]);

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      const { error } = await supabase
        .from('certification_photos')
        .update({ approved: true, approved_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
      toast.success('Submission approved');
      queryClient.invalidateQueries({ queryKey: ['admin-template-submissions'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Template Submissions</h1>
          <p className="text-muted-foreground text-sm mt-1">Review and approve member template photo submissions</p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading submissions...</p>
        ) : groups.length === 0 ? (
          <p className="text-muted-foreground">No template submissions yet.</p>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => {
              const allApproved = group.submissions.every(s => s.approved);
              const pendingCount = group.submissions.filter(s => !s.approved).length;

              return (
                <div key={group.userId} className="rounded-xl border bg-card p-5 space-y-4">
                  {/* Member header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{group.fullName}</p>
                        <p className="text-xs text-muted-foreground">{group.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {group.submissions.length} photo{group.submissions.length !== 1 ? 's' : ''}
                      </span>
                      {allApproved ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> All Approved
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Clock className="w-3 h-3 mr-1" /> {pendingCount} Pending
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Photo grid */}
                  <ScrollArea className="w-full">
                    <div className="flex gap-3 pb-2">
                      {group.submissions.map((s) => (
                        <div
                          key={s.id}
                          className="flex-shrink-0 w-40 rounded-lg border bg-secondary/20 overflow-hidden"
                        >
                          {/* Thumbnail */}
                          <div
                            className="w-full h-32 bg-muted/50 cursor-pointer relative group"
                            onClick={() => {
                              const url = signedUrls[s.id];
                              if (url) setPreviewUrl(url);
                              else toast.error('Image still loading...');
                            }}
                          >
                            {signedUrls[s.id] ? (
                              <img
                                src={signedUrls[s.id]}
                                alt={s.file_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                Loading...
                              </div>
                            )}
                            {s.approved && (
                              <div className="absolute top-1 right-1">
                                <CheckCircle2 className="w-5 h-5 text-green-400 drop-shadow-md" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-2 space-y-1.5">
                            <p className="text-xs text-muted-foreground truncate" title={s.file_name}>
                              {format(new Date(s.uploaded_at), 'MMM d, yyyy')}
                            </p>
                            {s.approved ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">
                                Approved
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                className="w-full h-7 text-xs"
                                disabled={approvingId === s.id}
                                onClick={() => handleApprove(s.id)}
                              >
                                {approvingId === s.id ? '...' : 'Approve'}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        )}

        {/* Image Preview Modal */}
        {previewUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={() => setPreviewUrl(null)}
          >
            <div className="max-w-2xl max-h-[80vh] relative" onClick={(e) => e.stopPropagation()}>
              <img src={previewUrl} alt="Template submission" className="max-w-full max-h-[80vh] rounded-lg object-contain" />
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => setPreviewUrl(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
