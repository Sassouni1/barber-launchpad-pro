import { useState } from "react";
import { Bell, Loader2, Send } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function PushNotifications() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/dashboard");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and message are required");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-notifications", {
        body: { title: title.trim(), body: body.trim(), url: url.trim() || "/" },
      });
      if (error) throw error;
      const result = data as { delivered?: number; failed?: number; attempted?: number };
      toast.success(`Sent to ${result?.delivered ?? 0} of ${result?.attempted ?? 0} devices`);
      setTitle("");
      setBody("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout isAdminView>
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="animate-fade-up">
          <h1 className="font-display text-4xl font-bold mb-2">Push Notifications</h1>
          <p className="text-muted-foreground text-lg">
            Broadcast updates, announcements, and call reminders to every member who opted in.
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-5 animate-fade-up">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="font-display text-xl font-semibold">New notification</h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="push-title">Title</Label>
            <Input
              id="push-title"
              value={title}
              maxLength={120}
              placeholder="Live call starting soon"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="push-body">Message</Label>
            <Textarea
              id="push-body"
              value={body}
              maxLength={500}
              rows={3}
              placeholder="Join us in 10 minutes for this week's group call."
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="push-url">Page to open</Label>
            <Input
              id="push-url"
              value={url}
              placeholder="/dashboard"
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Must be an internal path starting with “/”.
            </p>
          </div>

          <Button onClick={handleSend} disabled={sending} className="w-full">
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send to all members
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
