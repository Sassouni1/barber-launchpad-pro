import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useDynamicTodoLists,
  useCreateDynamicList,
  useUpdateDynamicList,
  useDeleteDynamicList,
  useCreateDynamicItem,
  useDeleteDynamicItem,
  DynamicTodoList,
} from "@/hooks/useDynamicTodosAdmin";
import { Plus, Pencil, Trash2, Sparkles, X, GripVertical } from "lucide-react";
import { toast } from "sonner";

export default function DynamicTodosManager() {
  const { data: lists = [], isLoading } = useDynamicTodoLists();
  const createList = useCreateDynamicList();
  const updateList = useUpdateDynamicList();
  const deleteList = useDeleteDynamicList();
  const createItem = useCreateDynamicItem();
  const deleteItem = useDeleteDynamicItem();

  const [isListDialogOpen, setIsListDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<DynamicTodoList | null>(null);
  const [listTitle, setListTitle] = useState("");
  const [itemInputs, setItemInputs] = useState<string[]>([]);
  const [newItemInput, setNewItemInput] = useState("");

  const resetForm = () => {
    setListTitle("");
    setEditingList(null);
    setItemInputs([]);
    setNewItemInput("");
  };

  const handleOpenDialog = (list?: DynamicTodoList) => {
    if (list) {
      setEditingList(list);
      setListTitle(list.title);
      setItemInputs(list.items.map((i) => i.title));
    } else {
      resetForm();
    }
    setIsListDialogOpen(true);
  };

  const handleAddItem = () => {
    if (newItemInput.trim()) {
      setItemInputs([...itemInputs, newItemInput.trim()]);
      setNewItemInput("");
    }
  };

  const handleRemoveItem = (index: number) => {
    setItemInputs(itemInputs.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!listTitle.trim()) {
      toast.error("Please enter a list title");
      return;
    }

    try {
      if (editingList) {
        // Update list title
        await updateList.mutateAsync({ id: editingList.id, title: listTitle });

        // Delete removed items
        for (const existingItem of editingList.items) {
          if (!itemInputs.includes(existingItem.title)) {
            await deleteItem.mutateAsync(existingItem.id);
          }
        }

        // Add new items
        const existingTitles = editingList.items.map((i) => i.title);
        for (let i = 0; i < itemInputs.length; i++) {
          if (!existingTitles.includes(itemInputs[i])) {
            await createItem.mutateAsync({
              list_id: editingList.id,
              title: itemInputs[i],
              order_index: i,
            });
          }
        }

        toast.success("List updated successfully");
      } else {
        // Create new list
        const newList = await createList.mutateAsync({
          title: listTitle,
          order_index: lists.length,
        });

        // Add items
        for (let i = 0; i < itemInputs.length; i++) {
          await createItem.mutateAsync({
            list_id: newList.id,
            title: itemInputs[i],
            order_index: i,
          });
        }

        toast.success("List created successfully");
      }

      setIsListDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to save list");
    }
  };

  const handleDeleteList = async (id: string) => {
    if (confirm("Are you sure you want to delete this list and all its items?")) {
      try {
        await deleteList.mutateAsync(id);
        toast.success("List deleted successfully");
      } catch (error) {
        toast.error("Failed to delete list");
      }
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" />
              Dynamic To-Do Lists
            </h1>
            <p className="text-muted-foreground">
              Create sequential lists that unlock as users complete them
            </p>
          </div>
          <Dialog open={isListDialogOpen} onOpenChange={setIsListDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" /> Add List
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingList ? "Edit List" : "Create List"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    List Title
                  </label>
                  <Input
                    placeholder="e.g., Week 1 Setup Tasks"
                    value={listTitle}
                    onChange={(e) => setListTitle(e.target.value)}
                    required
                  />
                </div>

                {/* Items Section */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Items</label>
                  {itemInputs.length > 0 && (
                    <div className="space-y-2">
                      {itemInputs.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-primary font-medium">
                            {index + 1}.
                          </span>
                          <span className="flex-1 text-sm">{item}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add an item..."
                      value={newItemInput}
                      onChange={(e) => setNewItemInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={handleAddItem}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  {editingList ? "Update List" : "Create List"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lists Display */}
        {lists.length === 0 ? (
          <div className="glass-card p-8 rounded-xl text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No dynamic lists yet. Create your first list to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {lists.map((list, listIndex) => (
              <div key={list.id} className="glass-card p-4 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary">
                      List {listIndex + 1}:
                    </span>
                    <h3 className="font-semibold">{list.title}</h3>
                    <span className="text-xs text-muted-foreground">
                      ({list.items.length} items)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenDialog(list)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteList(list.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {list.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No items in this list
                  </p>
                ) : (
                  <div className="space-y-1 ml-4">
                    {list.items.map((item, itemIndex) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <span className="text-primary font-medium">
                          {itemIndex + 1}.
                        </span>
                        <span>{item.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
