import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot } from 'lucide-react';
import { AionChat } from './AionChat';

export function AionChatCard() {
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
        <AionChat />
      </CardContent>
    </Card>
  );
}
