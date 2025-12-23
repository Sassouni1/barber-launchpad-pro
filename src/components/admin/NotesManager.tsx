import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bold, List, CheckSquare, Link, Eye, Edit } from "lucide-react";

interface NotesManagerProps {
  moduleId: string;
  initialContent?: string | null;
}

export function NotesManager({ moduleId, initialContent }: NotesManagerProps) {
  const [content, setContent] = useState(initialContent || "");
  const [isPreview, setIsPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setContent(initialContent || "");
  }, [initialContent]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("modules")
        .update({ notes_content: content || null })
        .eq("id", moduleId);

      if (error) throw error;

      toast({
        title: "Notes saved",
        description: "Your notes have been saved successfully.",
      });
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({
        title: "Error",
        description: "Failed to save notes.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const insertText = (before: string, after: string = "") => {
    const textarea = document.querySelector("textarea");
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end);
    setContent(newText);
  };

  const insertAtLineStart = (prefix: string) => {
    const textarea = document.querySelector("textarea");
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const newText = content.substring(0, lineStart) + prefix + content.substring(lineStart);
    setContent(newText);
  };

  const renderPreview = () => {
    if (!content) return <p className="text-muted-foreground italic">No notes yet...</p>;

    const lines = content.split("\n");
    const elements: JSX.Element[] = [];

    lines.forEach((line, index) => {
      // Bold section headers: **text**
      if (line.match(/^\*\*(.+)\*\*$/)) {
        const title = line.replace(/^\*\*(.+)\*\*$/, "$1");
        elements.push(
          <h4 key={index} className="font-semibold text-foreground mt-4 first:mt-0 mb-2">
            {title}
          </h4>
        );
      }
      // Checklist: - [ ] or - [x]
      else if (line.match(/^- \[([ x])\] /)) {
        const isChecked = line.includes("[x]");
        const text = line.replace(/^- \[[ x]\] /, "");
        elements.push(
          <div key={index} className="flex items-start gap-2 text-muted-foreground ml-2">
            <span className="mt-0.5">{isChecked ? "☑" : "☐"}</span>
            <span>{renderInlineLinks(text)}</span>
          </div>
        );
      }
      // Bullet points: - text
      else if (line.match(/^- /)) {
        const text = line.replace(/^- /, "");
        elements.push(
          <div key={index} className="flex items-start gap-2 text-muted-foreground ml-2">
            <span className="mt-1">•</span>
            <span>{renderInlineLinks(text)}</span>
          </div>
        );
      }
      // Empty lines
      else if (line.trim() === "") {
        elements.push(<div key={index} className="h-2" />);
      }
      // Regular text
      else {
        elements.push(
          <p key={index} className="text-muted-foreground">
            {renderInlineLinks(line)}
          </p>
        );
      }
    });

    return elements;
  };

  const renderInlineLinks = (text: string) => {
    // Match [text](url) pattern
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(
        <a
          key={match.index}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {match[1]}
        </a>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => insertText("**", "**")}
          title="Bold (Section Header)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => insertAtLineStart("- ")}
          title="Bullet Point"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => insertAtLineStart("- [ ] ")}
          title="Checklist Item"
        >
          <CheckSquare className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => insertText("[", "](url)")}
          title="Link"
        >
          <Link className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsPreview(!isPreview)}
        >
          {isPreview ? <Edit className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
          {isPreview ? "Edit" : "Preview"}
        </Button>
      </div>

      {isPreview ? (
        <div className="min-h-[200px] p-4 border rounded-md bg-background">
          {renderPreview()}
        </div>
      ) : (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`**Key Takeaways**
- First point here
- Second point with [a link](https://example.com)

**Pro Tips**
- [ ] Checklist item unchecked
- [x] Checklist item checked`}
          className="min-h-[200px] font-mono text-sm"
        />
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>**text**</strong> = Section header</p>
        <p><strong>- text</strong> = Bullet point</p>
        <p><strong>- [ ] text</strong> = Unchecked item | <strong>- [x] text</strong> = Checked item</p>
        <p><strong>[text](url)</strong> = Link</p>
      </div>

      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? "Saving..." : "Save Notes"}
      </Button>
    </div>
  );
}
