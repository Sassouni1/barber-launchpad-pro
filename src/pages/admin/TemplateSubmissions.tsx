import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Image as ImageIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SubmissionRow {
  id: string;
  user_id: string;
  course_id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
  approved: boolean;
  approved_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
}

export default function TemplateSubmissions() {
  const queryClient = useQueryClient();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['admin-template-submissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certification_photos')
        .select('id, user_id, course_id, file_name, file_url, uploaded_at, approved, approved_at, profiles!certification_photos_user_id_fkey(full_name, email)')
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SubmissionRow[];
    },
  });

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

  const getSignedUrl = async (fileUrl: string) => {
    const path = fileUrl.includes('/certification-photos/') 
      ? fileUrl.split('/certification-photos/').pop() 
      : fileUrl;
    if (!path) return null;
    const { data } = await supabase.storage
      .from('certification-photos')
      .createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  };

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Template Submissions</h1>
          <p className="text-muted-foreground text-sm mt-1">Review and approve member template photo submissions</p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading submissions...</p>
        ) : submissions.length === 0 ? (
          <p className="text-muted-foreground">No template submissions yet.</p>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Photo</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{s.profiles?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{s.profiles?.email || ''}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const url = await getSignedUrl(s.file_url);
                          if (url) {
                            setPreviewUrl(url);
                          } else {
                            toast.error('Could not load image');
                          }
                        }}
                      >
                        <ImageIcon className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(s.uploaded_at), 'MMM d, yyyy h:mm a')}
                    </TableCell>
                    <TableCell>
                      {s.approved ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Clock className="w-3 h-3 mr-1" /> Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!s.approved && (
                        <Button
                          size="sm"
                          disabled={approvingId === s.id}
                          onClick={() => handleApprove(s.id)}
                        >
                          {approvingId === s.id ? 'Approving...' : 'Approve'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
