import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send } from 'lucide-react';

export function AionChatCard() {
  const [input, setInput] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    // Navigate to full Aion page, passing the message
    navigate('/aion', { state: { initialMessage: text || undefined } });
  };

  return (
    <Card className="glass-card border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" />
          Talk to Aion
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          The Barber Launch Support AI — instant answers to your questions.
        </p>
      </CardHeader>
      <CardContent>
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Ask about training, certification, hair systems, or anything else.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Aion anything..."
              className="flex-1"
            />
            <Button type="submit" size="icon" className="gold-gradient">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
