import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Trash2, 
  StickyNote, 
  Link as LinkIcon, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  GripVertical
} from 'lucide-react';
import {
  useModuleNotes,
  useCreateNoteSection,
  useUpdateNoteSection,
  useDeleteNoteSection,
  useCreateNoteItem,
  useUpdateNoteItem,
  useDeleteNoteItem,
  type NoteSection,
  type NoteItem
} from '@/hooks/useModuleNotes';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface NotesManagerProps {
  moduleId: string;
}

export function NotesManager({ moduleId }: NotesManagerProps) {
  const { data: sections = [], isLoading } = useModuleNotes(moduleId);
  const createSection = useCreateNoteSection();
  const updateSection = useUpdateNoteSection();
  const deleteSection = useDeleteNoteSection();
  const createItem = useCreateNoteItem();
  const updateItem = useUpdateNoteItem();
  const deleteItem = useDeleteNoteItem();

  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) {
      toast.error('Please enter a section title');
      return;
    }

    try {
      await createSection.mutateAsync({
        moduleId,
        title: newSectionTitle.trim(),
        orderIndex: sections.length
      });
      setNewSectionTitle('');
      toast.success('Section added');
    } catch (error) {
      toast.error('Failed to add section');
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    try {
      await deleteSection.mutateAsync({ id: sectionId, moduleId });
      toast.success('Section deleted');
    } catch (error) {
      toast.error('Failed to delete section');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <StickyNote className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Lesson Notes</h3>
      </div>

      {/* Existing Sections */}
      {sections.map((section) => (
        <NoteSectionCard
          key={section.id}
          section={section}
          moduleId={moduleId}
          isExpanded={expandedSections.has(section.id)}
          onToggle={() => toggleSection(section.id)}
          onDelete={() => handleDeleteSection(section.id)}
          onUpdateTitle={(title) => updateSection.mutateAsync({ id: section.id, title, moduleId })}
          editingItem={editingItem}
          setEditingItem={setEditingItem}
          editingSection={editingSection}
          setEditingSection={setEditingSection}
          createItem={createItem}
          updateItem={updateItem}
          deleteItem={deleteItem}
        />
      ))}

      {/* Add New Section */}
      <div className="flex gap-2 p-3 rounded-lg bg-secondary/30 border border-dashed border-border">
        <Input
          placeholder="New section title (e.g., Key Takeaways, Pro Tips)"
          value={newSectionTitle}
          onChange={(e) => setNewSectionTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
          className="flex-1"
        />
        <Button 
          onClick={handleAddSection} 
          disabled={createSection.isPending}
          size="sm"
        >
          {createSection.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

interface NoteSectionCardProps {
  section: NoteSection;
  moduleId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdateTitle: (title: string) => Promise<void>;
  editingItem: string | null;
  setEditingItem: (id: string | null) => void;
  editingSection: string | null;
  setEditingSection: (id: string | null) => void;
  createItem: ReturnType<typeof useCreateNoteItem>;
  updateItem: ReturnType<typeof useUpdateNoteItem>;
  deleteItem: ReturnType<typeof useDeleteNoteItem>;
}

function NoteSectionCard({
  section,
  moduleId,
  isExpanded,
  onToggle,
  onDelete,
  onUpdateTitle,
  editingItem,
  setEditingItem,
  editingSection,
  setEditingSection,
  createItem,
  updateItem,
  deleteItem,
}: NoteSectionCardProps) {
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemLinkUrl, setNewItemLinkUrl] = useState('');
  const [newItemLinkText, setNewItemLinkText] = useState('');
  const [showLinkFields, setShowLinkFields] = useState(false);
  const [editTitle, setEditTitle] = useState(section.title);

  const handleAddItem = async () => {
    if (!newItemContent.trim()) {
      toast.error('Please enter note content');
      return;
    }

    try {
      await createItem.mutateAsync({
        sectionId: section.id,
        content: newItemContent.trim(),
        linkUrl: newItemLinkUrl.trim() || undefined,
        linkText: newItemLinkText.trim() || undefined,
        orderIndex: section.items.length,
        moduleId
      });
      setNewItemContent('');
      setNewItemLinkUrl('');
      setNewItemLinkText('');
      setShowLinkFields(false);
      toast.success('Note added');
    } catch (error) {
      toast.error('Failed to add note');
    }
  };

  const handleSaveTitle = async () => {
    if (!editTitle.trim()) return;
    try {
      await onUpdateTitle(editTitle.trim());
      setEditingSection(null);
      toast.success('Section updated');
    } catch (error) {
      toast.error('Failed to update section');
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-lg bg-secondary/20 border border-border overflow-hidden">
        <div className="flex items-center gap-2 p-3">
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
          
          {editingSection === section.id ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
              className="flex-1 h-8"
              autoFocus
            />
          ) : (
            <span 
              className="flex-1 font-medium cursor-pointer hover:text-primary"
              onClick={() => {
                setEditTitle(section.title);
                setEditingSection(section.id);
              }}
            >
              {section.title}
            </span>
          )}

          <span className="text-xs text-muted-foreground">
            {section.items.length} item{section.items.length !== 1 ? 's' : ''}
          </span>

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="border-t border-border p-3 space-y-3">
            {/* Existing Items */}
            {section.items.map((item) => (
              <NoteItemRow
                key={item.id}
                item={item}
                moduleId={moduleId}
                isEditing={editingItem === item.id}
                onEdit={() => setEditingItem(item.id)}
                onCancelEdit={() => setEditingItem(null)}
                onUpdate={updateItem}
                onDelete={deleteItem}
              />
            ))}

            {/* Add New Item */}
            <div className="space-y-2 p-2 rounded-lg bg-background/50 border border-dashed border-border">
              <Textarea
                placeholder="Add a new note..."
                value={newItemContent}
                onChange={(e) => setNewItemContent(e.target.value)}
                rows={2}
                className="resize-none"
              />
              
              {showLinkFields && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Link URL</Label>
                    <Input
                      placeholder="https://..."
                      value={newItemLinkUrl}
                      onChange={(e) => setNewItemLinkUrl(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Link Text</Label>
                    <Input
                      placeholder="Click here"
                      value={newItemLinkText}
                      onChange={(e) => setNewItemLinkText(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLinkFields(!showLinkFields)}
                  className="text-xs"
                >
                  <LinkIcon className="w-3 h-3 mr-1" />
                  {showLinkFields ? 'Hide Link' : 'Add Link'}
                </Button>
                <div className="flex-1" />
                <Button 
                  onClick={handleAddItem} 
                  disabled={createItem.isPending}
                  size="sm"
                >
                  {createItem.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Plus className="w-4 h-4 mr-1" />
                  )}
                  Add
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface NoteItemRowProps {
  item: NoteItem;
  moduleId: string;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: ReturnType<typeof useUpdateNoteItem>;
  onDelete: ReturnType<typeof useDeleteNoteItem>;
}

function NoteItemRow({ item, moduleId, isEditing, onEdit, onCancelEdit, onUpdate, onDelete }: NoteItemRowProps) {
  const [editContent, setEditContent] = useState(item.content);
  const [editLinkUrl, setEditLinkUrl] = useState(item.link_url || '');
  const [editLinkText, setEditLinkText] = useState(item.link_text || '');

  const handleSave = async () => {
    try {
      await onUpdate.mutateAsync({
        id: item.id,
        content: editContent.trim(),
        linkUrl: editLinkUrl.trim() || undefined,
        linkText: editLinkText.trim() || undefined,
        moduleId
      });
      onCancelEdit();
      toast.success('Note updated');
    } catch (error) {
      toast.error('Failed to update note');
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete.mutateAsync({ id: item.id, moduleId });
      toast.success('Note deleted');
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-2 p-2 rounded-lg bg-background/50 border border-primary/30">
        <Textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={2}
          className="resize-none"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Link URL</Label>
            <Input
              placeholder="https://..."
              value={editLinkUrl}
              onChange={(e) => setEditLinkUrl(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Link Text</Label>
            <Input
              placeholder="Click here"
              value={editLinkText}
              onChange={(e) => setEditLinkText(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancelEdit}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={onUpdate.isPending}>
            {onUpdate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-background/30 group">
      <span className="text-muted-foreground mt-1">•</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{item.content}</p>
        {item.link_url && (
          <a 
            href={item.link_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
          >
            <LinkIcon className="w-3 h-3" />
            {item.link_text || item.link_url}
          </a>
        )}
      </div>
      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
          <span className="text-xs">✏️</span>
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

