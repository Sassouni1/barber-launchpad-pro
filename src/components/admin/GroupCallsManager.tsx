import { useState } from 'react';
import { useGroupCallsAdmin, GroupCall } from '@/hooks/useGroupCalls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Video, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 15, 30, 45];
const TIMEZONES = ['EST', 'EDT', 'CST', 'CDT', 'MST', 'MDT', 'PST', 'PDT'];

export function GroupCallsManager() {
  const { data: calls = [], isLoading, createCall, updateCall, deleteCall } = useGroupCallsAdmin();
  const [isOpen, setIsOpen] = useState(false);
  const [editingCall, setEditingCall] = useState<GroupCall | null>(null);
  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('Monday');
  const [callHour, setCallHour] = useState(7);
  const [callMinute, setCallMinute] = useState(0);
  const [callAmpm, setCallAmpm] = useState('PM');
  const [callTimezone, setCallTimezone] = useState('EST');
  const [zoomLink, setZoomLink] = useState('');
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setTitle('');
    setDayOfWeek('Monday');
    setCallHour(7);
    setCallMinute(0);
    setCallAmpm('PM');
    setCallTimezone('EST');
    setZoomLink('');
    setIsActive(true);
    setEditingCall(null);
  };

  const handleEdit = (call: GroupCall) => {
    setEditingCall(call);
    setTitle(call.title);
    setDayOfWeek(call.day_of_week);
    setCallHour(call.call_hour);
    setCallMinute(call.call_minute);
    setCallAmpm(call.call_ampm);
    setCallTimezone(call.call_timezone);
    setZoomLink(call.zoom_link);
    setIsActive(call.is_active);
    setIsOpen(true);
  };

  const handleSubmit = () => {
    if (!title || !zoomLink) {
      toast.error('Please fill in all fields');
      return;
    }
    const minuteStr = callMinute.toString().padStart(2, '0');
    const timeLabel = `${callHour}:${minuteStr} ${callAmpm} ${callTimezone}`;
    const payload = {
      title,
      day_of_week: dayOfWeek,
      time_label: timeLabel,
      zoom_link: zoomLink,
      is_active: isActive,
      order_index: editingCall?.order_index ?? calls.length,
      call_hour: callHour,
      call_minute: callMinute,
      call_ampm: callAmpm,
      call_timezone: callTimezone,
    };

    if (editingCall) {
      updateCall.mutate({ id: editingCall.id, ...payload }, {
        onSuccess: () => { toast.success('Call updated'); setIsOpen(false); resetForm(); },
        onError: () => toast.error('Failed to update'),
      });
    } else {
      createCall.mutate(payload, {
        onSuccess: () => { toast.success('Call added'); setIsOpen(false); resetForm(); },
        onError: () => toast.error('Failed to add'),
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteCall.mutate(id, {
      onSuccess: () => toast.success('Call deleted'),
      onError: () => toast.error('Failed to delete'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" />
          <h2 className="font-display text-xl font-semibold">Group Calls Schedule</h2>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Add Call</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCall ? 'Edit Call' : 'Add New Call'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Group Call" />
              </div>
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <div className="flex gap-2">
                  <Select value={String(callHour)} onValueChange={(v) => setCallHour(Number(v))}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOURS.map(h => <SelectItem key={h} value={String(h)}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={String(callMinute)} onValueChange={(v) => setCallMinute(Number(v))}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MINUTES.map(m => <SelectItem key={m} value={String(m)}>{String(m).padStart(2, '0')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={callAmpm} onValueChange={setCallAmpm}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={callTimezone} onValueChange={setCallTimezone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Zoom Link</Label>
                <Input value={zoomLink} onChange={(e) => setZoomLink(e.target.value)} placeholder="https://zoom.us/j/..." />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>Active (visible to members)</Label>
              </div>
              <Button onClick={handleSubmit} className="w-full" disabled={createCall.isPending || updateCall.isPending}>
                {(createCall.isPending || updateCall.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingCall ? 'Save Changes' : 'Add Call'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : calls.length === 0 ? (
        <p className="text-muted-foreground text-center py-6">No calls scheduled yet.</p>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <div key={call.id} className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{call.title}</div>
                <div className="text-sm text-muted-foreground">
                  {call.day_of_week} at {call.time_label}
                  {!call.is_active && <span className="ml-2 text-xs text-destructive">(Hidden)</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleEdit(call)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(call.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
