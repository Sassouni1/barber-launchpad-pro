import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const topicColors: Record<string, string> = {
  'Suggestion topic for group call': 'bg-primary/20 text-primary',
  'I need help or have a question': 'bg-destructive/20 text-destructive',
  'How can we make your experience better': 'bg-accent text-accent-foreground',
};

export function FeedbackViewer() {
  const { data: feedback = [], isLoading } = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_feedback')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h2 className="font-display text-xl font-semibold">Member Feedback</h2>
        {feedback.length > 0 && (
          <Badge variant="secondary" className="ml-auto">{feedback.length}</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : feedback.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No feedback submissions yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedback.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {format(new Date(f.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell className="text-sm">{f.email}</TableCell>
                  <TableCell>
                    <Badge className={topicColors[f.topic] || 'bg-secondary text-secondary-foreground'}>
                      {f.topic}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">{f.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
