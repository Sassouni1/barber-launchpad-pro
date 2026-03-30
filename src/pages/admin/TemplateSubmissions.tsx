import { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, User, MessageSquare, ArrowUpDown } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

interface SubmissionRow {
  id: string;
  user_id: string;
  course_id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
  approved: boolean;
  approved_at: string | null;
  admin_note: string | null;
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
  const [approvingUser, setApprovingUser] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sortNewestFirst, setSortNewestFirst] = useState(true);


  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['admin-template-submissions'],
    queryFn: async () => {
      const { data: photos, error } = await supabase
        .from('certification_photos')
        .select('id, user_id, course_id, file_name, file_url, uploaded_at, approved, approved_at, admin_note')
        .order('uploaded_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((photos || []).map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

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
        groupMap.get(p.user_id)!.submissions.push(p as SubmissionRow);
      }

      return Array.from(groupMap.values()).sort(
        (a, b) => new Date(b.latestUpload).getTime() - new Date(a.latestUpload).getTime()
      );
    },
  });

  // Initialize notes from existing data
  useEffect(() => {
    const existing: Record<string, string> = {};
    for (const g of groups) {
      const savedNote = g.submissions.find(s => s.admin_note)?.admin_note;
      if (savedNote && !notes[g.userId]) {
        existing[g.userId] = savedNote;
      }
    }
    if (Object.keys(existing).length > 0) {
      setNotes(prev => ({ ...existing, ...prev }));
    }
  }, [groups]);

  const sortedGroups = useMemo(() => {
    const sorted = [...groups].sort((a, b) => {
      const diff = new Date(b.latestUpload).getTime() - new Date(a.latestUpload).getTime();
      return sortNewestFirst ? diff : -diff;
    });
    return sorted;
  }, [groups, sortNewestFirst]);

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

  const handleApproveAll = async (group: MemberGroup) => {
    setApprovingUser(group.userId);
    const note = notes[group.userId]?.trim() || null;
    try {
      const pendingIds = group.submissions.filter(s => !s.approved).map(s => s.id);
      if (pendingIds.length === 0) {
        toast.info('All photos already approved');
        return;
      }
      const { error } = await supabase
        .from('certification_photos')
        .update({ approved: true, approved_at: new Date().toISOString(), admin_note: note } as any)
        .in('id', pendingIds);
      if (error) throw error;
      // Also save note on already-approved ones if note changed
      if (note) {
        const approvedIds = group.submissions.filter(s => s.approved).map(s => s.id);
        if (approvedIds.length > 0) {
          await supabase
            .from('certification_photos')
            .update({ admin_note: note } as any)
            .in('id', approvedIds);
        }
      }
      toast.success(`Approved all submissions for ${group.fullName}`);
      queryClient.invalidateQueries({ queryKey: ['admin-template-submissions'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setApprovingUser(null);
    }
  };

  const handleDisapproveAll = async (group: MemberGroup) => {
    setApprovingUser(group.userId);
    try {
      const approvedIds = group.submissions.filter(s => s.approved).map(s => s.id);
      if (approvedIds.length === 0) {
        toast.info('No approved photos to disapprove');
        return;
      }
      const { error } = await supabase
        .from('certification_photos')
        .update({ approved: false, approved_at: null } as any)
        .in('id', approvedIds);
      if (error) throw error;
      toast.success(`Disapproved submissions for ${group.fullName}`);
      queryClient.invalidateQueries({ queryKey: ['admin-template-submissions'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to disapprove');
    } finally {
      setApprovingUser(null);
    }
  };

  const handleSaveNote = async (group: MemberGroup) => {
    const note = notes[group.userId]?.trim() || null;
    try {
      const ids = group.submissions.map(s => s.id);
      const { error } = await supabase
        .from('certification_photos')
        .update({ admin_note: note } as any)
        .in('id', ids);
      if (error) throw error;
      toast.success('Note saved');
      queryClient.invalidateQueries({ queryKey: ['admin-template-submissions'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save note');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Template Submissions</h1>
            <p className="text-muted-foreground text-sm mt-1">Today is {format(new Date(), 'MMMM d, yyyy')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortNewestFirst(prev => !prev)}
            className="gap-1.5"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortNewestFirst ? 'Newest First' : 'Oldest First'}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading submissions...</p>
        ) : sortedGroups.length === 0 ? (
          <p className="text-muted-foreground">No template submissions yet.</p>
        ) : (
          <div className="space-y-6">
            {sortedGroups.map((group) => {
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
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
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
                          className="flex-shrink-0 w-40 rounded-lg border bg-secondary/20 overflow-hidden cursor-pointer"
                          onClick={() => {
                            const url = signedUrls[s.id];
                            if (url) setPreviewUrl(url);
                            else toast.error('Image still loading...');
                          }}
                        >
                          <div className="w-full h-32 bg-muted/50 relative">
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
                          <div className="p-2">
                            <p className="text-xs text-muted-foreground truncate">
                              {format(new Date(s.uploaded_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>

                  {/* Note + Approve */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Admin Note</span>
                      </div>
                      <Textarea
                        placeholder="Add a note about this submission..."
                        className="min-h-[60px] text-sm resize-none"
                        value={notes[group.userId] || ''}
                        onChange={(e) => setNotes(prev => ({ ...prev, [group.userId]: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-2 pt-5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSaveNote(group)}
                      >
                        Save Note
                      </Button>
                      <Button
                        size="sm"
                        disabled={approvingUser === group.userId}
                        onClick={() => handleApproveAll(group)}
                      >
                        {approvingUser === group.userId ? 'Approving...' : 'Approve All'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={approvingUser === group.userId}
                        onClick={() => handleDisapproveAll(group)}
                      >
                        {approvingUser === group.userId ? 'Updating...' : 'Disapprove'}
                      </Button>
                    </div>
                  </div>

                  {/* Show existing note if saved */}
                  {group.submissions[0]?.admin_note && !notes[group.userId] && (
                    <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                      {group.submissions[0].admin_note}
                    </p>
                  )}
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
