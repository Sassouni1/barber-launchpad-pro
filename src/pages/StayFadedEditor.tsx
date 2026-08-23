import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Redo2, Save, Undo2, ImageIcon, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  STAY_FADED_PAGES,
  applyDraft,
  decorateFields,
  elementFromKey,
  scanFields,
  setSelected,
  type StayFadedDraft,
  type StayFadedField,
  type StayFadedPageKey,
} from '@/lib/stayFadedEditor';
import {
  readLocalDraft,
  useEditorDrafts,
  useSaveEditorDraft,
  writeLocalDraft,
} from '@/hooks/useWebsiteEditorEntitlement';
import { StayFadedImageDialog } from '@/components/website/StayFadedImageDialog';

export default function StayFadedEditor() {
  const { user } = useAuth();
  const { data: cloudDraft, isLoading } = useEditorDrafts();
  const saveDraft = useSaveEditorDraft();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [page, setPage] = useState<StayFadedPageKey>('home');
  const [fields, setFields] = useState<StayFadedField[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<StayFadedDraft>({});
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<StayFadedDraft[]>([{}]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Restore cloud draft (localStorage is only an offline convenience).
  useEffect(() => {
    if (isLoading) return;
    const initial = (cloudDraft && Object.keys(cloudDraft).length ? cloudDraft : readLocalDraft()) ?? {};
    setDraft(initial);
    setHistory([initial]);
    setHistoryIndex(0);
  }, [cloudDraft, isLoading]);

  const pageDraft = draft[page] ?? {};

  const commit = useCallback(
    (next: StayFadedDraft) => {
      setDraft(next);
      writeLocalDraft(next);
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        return [...trimmed, next].slice(-60);
      });
      setHistoryIndex((i) => Math.min(i + 1, 59));
    },
    [historyIndex],
  );

  const setValue = (key: string, value: string) => {
    commit({ ...draft, [page]: { ...pageDraft, [key]: value } });
    const doc = iframeRef.current?.contentDocument;
    const el = doc ? elementFromKey(doc, key) : null;
    if (!el) return;
    if (el.tagName === 'IMG') (el as HTMLImageElement).src = value;
    else el.textContent = value;
  };

  const restore = (snapshot: StayFadedDraft) => {
    setDraft(snapshot);
    writeLocalDraft(snapshot);
    const doc = iframeRef.current?.contentDocument;
    if (doc) {
      // Reset to originals, then re-apply the snapshot.
      fields.forEach((field) => {
        const el = elementFromKey(doc, field.key);
        if (!el) return;
        if (field.kind === 'image') (el as HTMLImageElement).src = field.original;
        else el.textContent = field.original;
      });
      applyDraft(doc, snapshot[page] ?? {});
    }
  };

  const undo = () => {
    if (historyIndex === 0) return;
    const next = historyIndex - 1;
    setHistoryIndex(next);
    restore(history[next]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const next = historyIndex + 1;
    setHistoryIndex(next);
    restore(history[next]);
  };

  const handleIframeLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const scanned = scanFields(doc);
    setFields(scanned);
    decorateFields(doc, scanned);
    applyDraft(doc, draft[page] ?? {});
    setSelectedKey(null);
    setReady(true);

    doc.addEventListener(
      'click',
      (event) => {
        const target = (event.target as HTMLElement)?.closest('[data-sf-editable]') as HTMLElement | null;
        // Keep the preview static while editing.
        event.preventDefault();
        if (!target) return;
        const key = scanned.find((f) => elementFromKey(doc, f.key) === target)?.key;
        if (!key) return;
        setSelectedKey(key);
        setSelected(doc, key);
      },
      true,
    );
  };

  // Re-scan when the page tab changes.
  useEffect(() => {
    setReady(false);
    setFields([]);
  }, [page]);

  const selectedField = useMemo(
    () => fields.find((f) => f.key === selectedKey) ?? null,
    [fields, selectedKey],
  );

  const currentValue = selectedField
    ? (pageDraft[selectedField.key] ?? selectedField.original)
    : '';

  const overLimit =
    !!selectedField?.limit && currentValue.length > selectedField.limit;
  const nearLimit =
    !!selectedField?.limit && currentValue.length > selectedField.limit * 0.9;

  const handleSave = async () => {
    try {
      await saveDraft.mutateAsync(draft);
      toast.success('Draft saved to your account');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const textFields = fields.filter((f) => f.kind === 'text').length;
  const imageFields = fields.filter((f) => f.kind === 'image').length;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Stay Faded Website Editor</h1>
            <p className="text-muted-foreground">
              Tap any text or image in the preview to edit it, then save your draft.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={undo} disabled={historyIndex === 0} aria-label="Undo">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              aria-label="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button onClick={handleSave} disabled={saveDraft.isPending}>
              {saveDraft.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save draft
            </Button>
          </div>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              This editor is draft-only. It is not connected to the live stayfadedbarbershop5280.com website
              yet, so nothing you change here affects the public site.
            </p>
          </CardContent>
        </Card>

        <Tabs value={page} onValueChange={(v) => setPage(v as StayFadedPageKey)}>
          <TabsList>
            {STAY_FADED_PAGES.map((p) => (
              <TabsTrigger key={p.key} value={p.key}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <iframe
                key={page}
                ref={iframeRef}
                title="Stay Faded preview"
                src={STAY_FADED_PAGES.find((p) => p.key === page)!.src}
                onLoad={handleIframeLoad}
                className="h-[70vh] w-full border-0 bg-black"
              />
            </CardContent>
          </Card>

          <Card className="lg:sticky lg:top-4 lg:self-start">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {selectedField ? 'Edit selected item' : 'Nothing selected'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!ready ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !selectedField ? (
                <p className="text-sm text-muted-foreground">
                  Tap any highlighted text or image in the preview. {textFields} text fields and {imageFields}{' '}
                  images are editable on this page.
                </p>
              ) : selectedField.kind === 'image' ? (
                <div className="space-y-3">
                  <Badge variant="secondary">{selectedField.section}</Badge>
                  <img
                    src={pageDraft[selectedField.key] ?? selectedField.original}
                    alt={selectedField.label}
                    className="w-full rounded-md border border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Target size: {selectedField.width ?? '—'} × {selectedField.height ?? '—'}px
                  </p>
                  <Button className="w-full" onClick={() => setImageDialogOpen(true)}>
                    <ImageIcon className="mr-2 h-4 w-4" /> Replace image
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Badge variant="secondary">{selectedField.section}</Badge>
                  <Label className="block text-xs text-muted-foreground">{selectedField.label}</Label>
                  <Textarea
                    rows={currentValue.length > 160 ? 10 : 4}
                    value={currentValue}
                    maxLength={selectedField.limit}
                    onChange={(e) => setValue(selectedField.key, e.target.value)}
                  />
                  <p
                    className={`text-xs ${
                      overLimit ? 'text-destructive' : nearLimit ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {currentValue.length} / {selectedField.limit} characters
                    {nearLimit && !overLimit ? ' — close to the limit for this layout' : ''}
                    {overLimit ? ' — too long for this layout' : ''}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedField?.kind === 'image' && user && (
        <StayFadedImageDialog
          open={imageDialogOpen}
          onOpenChange={setImageDialogOpen}
          userId={user.id}
          targetWidth={selectedField.width ?? 1024}
          targetHeight={selectedField.height ?? 1024}
          currentSrc={pageDraft[selectedField.key] ?? selectedField.original}
          onApply={(url) => setValue(selectedField.key, url)}
        />
      )}
    </DashboardLayout>
  );
}
