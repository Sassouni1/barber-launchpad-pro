import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, Copy, Globe, ImageIcon, Info, Loader2, Redo2, Save, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  ITEM_ATTR,
  ITEM_POS_ATTR,
  applyDraft,
  applyLayout,
  currentOrder,
  decorateFields,
  elementFromKey,
  itemKeys,
  readLayout,
  remapItemDraft,
  scanFields,
  setSelected,
  writeLayout,
  type EditableField,
  type EditorDraft,
  type PageDraft,
  type RepeatOriginals,
  type RepeatRule,
  type WebsiteTemplateConfig,
} from '@/lib/websiteEditor';
import {
  readLocalDraft,
  useEditorDraft,
  usePublishWebsite,
  useSaveEditorDraft,
  writeLocalDraft,
  type WebsiteEntitlement,
} from '@/hooks/useWebsiteEditor';
import { EditorImageDialog } from '@/components/website/EditorImageDialog';

type Props = {
  template: WebsiteTemplateConfig;
  entitlement: WebsiteEntitlement;
};

type ActiveItem = { rule: RepeatRule; position: number; total: number };

/**
 * The one member editor surface. Every template renders through this shell —
 * page tabs, iframe editing, limits, undo/redo, images, repeatable cards, Save
 * and Save & Publish are implemented once and shared by all client websites.
 */
export function WebsiteEditorShell({ template, entitlement }: Props) {
  const { user } = useAuth();
  const { data: cloudDraft, isLoading } = useEditorDraft(template.templateKey);
  const saveDraft = useSaveEditorDraft(template.templateKey);
  const publish = usePublishWebsite(template);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pageKey, setPageKey] = useState(template.pages[0]?.key ?? '');
  const [fields, setFields] = useState<EditableField[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditorDraft>({});
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<EditorDraft[]>([{}]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);

  // Pristine copies of every configured repeatable item, per page.
  const originalsRef = useRef<Record<string, RepeatOriginals>>({});
  const fieldsRef = useRef<EditableField[]>([]);
  const draftRef = useRef<EditorDraft>({});
  draftRef.current = draft;

  const repeatRules = useMemo(() => template.repeatRules ?? [], [template.repeatRules]);
  const page = template.pages.find((p) => p.key === pageKey) ?? template.pages[0];

  // Restore the cloud draft (localStorage is only an offline convenience).
  useEffect(() => {
    if (isLoading) return;
    const initial =
      (cloudDraft && Object.keys(cloudDraft).length ? cloudDraft : readLocalDraft(template.templateKey)) ?? {};
    setDraft(initial);
    setHistory([initial]);
    setHistoryIndex(0);
  }, [cloudDraft, isLoading, template.templateKey]);

  const pageDraft = draft[pageKey] ?? {};

  const commit = useCallback(
    (next: EditorDraft) => {
      setDraft(next);
      writeLocalDraft(template.templateKey, next);
      setHistory((prev) => [...prev.slice(0, historyIndex + 1), next].slice(-60));
      setHistoryIndex((i) => Math.min(i + 1, 59));
    },
    [historyIndex, template.templateKey],
  );

  /** Rebuilds structure, re-scans fields and re-applies the member's content. */
  const hydrate = useCallback(
    (doc: Document, nextPageDraft: PageDraft): EditableField[] => {
      const originals = originalsRef.current[pageKey] ?? {};
      originalsRef.current[pageKey] = applyLayout(doc, repeatRules, readLayout(nextPageDraft), originals);
      const scanned = scanFields(doc, template.fieldRules);
      decorateFields(doc, scanned);
      applyDraft(doc, nextPageDraft);
      fieldsRef.current = scanned;
      setFields(scanned);
      return scanned;
    },
    [pageKey, repeatRules, template.fieldRules],
  );

  const setValue = (key: string, value: string) => {
    commit({ ...draft, [pageKey]: { ...pageDraft, [key]: value } });
    const doc = iframeRef.current?.contentDocument;
    const el = doc ? elementFromKey(doc, key) : null;
    if (!el) return;
    if (el.tagName === 'IMG') el.setAttribute('src', value);
    else el.textContent = value;
  };

  const restore = (snapshot: EditorDraft) => {
    setDraft(snapshot);
    writeLocalDraft(template.templateKey, snapshot);
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    fieldsRef.current.forEach((field) => {
      const el = elementFromKey(doc, field.key);
      if (!el) return;
      if (field.kind === 'image') el.setAttribute('src', field.original);
      else el.textContent = field.original;
    });
    hydrate(doc, snapshot[pageKey] ?? {});
    setSelectedKey(null);
    setSelected(doc, null);
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
    originalsRef.current[pageKey] = {};
    hydrate(doc, draftRef.current[pageKey] ?? {});
    setSelectedKey(null);
    setReady(true);

    doc.addEventListener(
      'click',
      (event) => {
        const node = event.target as HTMLElement | null;
        const target = node?.closest('[data-we-editable]') as HTMLElement | null;
        // Keep the preview static while editing.
        event.preventDefault();
        // Clicking anywhere inside a repeatable card selects that card.
        const fallbackItem = !target ? (node?.closest(`[${ITEM_ATTR}]`) as HTMLElement | null) : null;
        const resolved =
          target ?? (fallbackItem?.querySelector('[data-we-editable]') as HTMLElement | null) ?? null;
        if (!resolved) return;
        const key = fieldsRef.current.find((f) => elementFromKey(doc, f.key) === resolved)?.key;
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
    fieldsRef.current = [];
    setSelectedKey(null);
  }, [pageKey]);

  const selectedField = useMemo(() => fields.find((f) => f.key === selectedKey) ?? null, [fields, selectedKey]);

  /** Which configured repeatable card (if any) the selection lives inside. */
  const activeItem: ActiveItem | null = useMemo(() => {
    if (!selectedKey || !ready) return null;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return null;
    const el = elementFromKey(doc, selectedKey);
    const item = (el as HTMLElement | null)?.closest(`[${ITEM_ATTR}]`) as HTMLElement | null;
    if (!item) return null;
    const rule = repeatRules.find((r) => r.key === item.getAttribute(ITEM_ATTR));
    if (!rule) return null;
    const position = Number(item.getAttribute(ITEM_POS_ATTR) ?? '0');
    const originals = originalsRef.current[pageKey]?.[rule.key] ?? [];
    const total = currentOrder(readLayout(pageDraft), rule.key, originals.length).length;
    return { rule, position, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, ready, repeatRules, pageKey, pageDraft]);

  const runItemOp = (kind: 'duplicate' | 'earlier' | 'later') => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || !activeItem) return;
    const { rule, position } = activeItem;
    const originals = originalsRef.current[pageKey]?.[rule.key] ?? [];
    const layout = readLayout(pageDraft);
    const order = currentOrder(layout, rule.key, originals.length);

    let nextOrder: number[];
    let mapping: number[];
    let nextPosition: number;

    if (kind === 'duplicate') {
      if (rule.max && order.length >= rule.max) {
        toast.error(`You can have up to ${rule.max} ${rule.label} cards here.`);
        return;
      }
      nextOrder = [...order.slice(0, position + 1), order[position], ...order.slice(position + 1)];
      mapping = [];
      for (let i = 0; i <= position; i += 1) mapping.push(i);
      mapping.push(position);
      for (let i = position + 1; i < order.length; i += 1) mapping.push(i);
      nextPosition = position + 1;
    } else {
      const target = kind === 'earlier' ? position - 1 : position + 1;
      if (target < 0 || target >= order.length) return;
      nextOrder = [...order];
      [nextOrder[position], nextOrder[target]] = [nextOrder[target], nextOrder[position]];
      mapping = order.map((_, i) => (i === position ? target : i === target ? position : i));
      nextPosition = target;
    }

    const oldKeys = itemKeys(doc, rule);
    const nextLayout = { ...layout, [rule.key]: nextOrder };
    originalsRef.current[pageKey] = applyLayout(
      doc,
      repeatRules,
      nextLayout,
      originalsRef.current[pageKey] ?? {},
    );
    const newKeys = itemKeys(doc, rule);

    const remapped = writeLayout(remapItemDraft(pageDraft, oldKeys, newKeys, mapping), nextLayout);
    const nextDraft = { ...draft, [pageKey]: remapped };
    commit(nextDraft);
    const scanned = hydrate(doc, remapped);

    const prefix = newKeys[nextPosition];
    const nextField = prefix ? scanned.find((f) => f.key.startsWith(`${prefix}.`) || f.key === prefix) : undefined;
    setSelectedKey(nextField?.key ?? null);
    setSelected(doc, nextField?.key ?? null);
    toast.success(
      kind === 'duplicate'
        ? `Duplicated this ${rule.label} — edit the new card below.`
        : `Moved this ${rule.label} ${kind === 'earlier' ? 'earlier' : 'later'}.`,
    );
  };

  const currentValue = selectedField ? (pageDraft[selectedField.key] ?? selectedField.original) : '';
  const overLimit = !!selectedField?.limit && currentValue.length > selectedField.limit;
  const nearLimit = !!selectedField?.limit && currentValue.length > selectedField.limit * 0.9;

  const handleSave = async () => {
    try {
      await saveDraft.mutateAsync(draft);
      toast.success('Draft saved to your account');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const handlePublish = async () => {
    try {
      const result = await publish.mutateAsync(draft);
      setLiveUrl(result.liveUrl);
      if (result.deploymentStatus === 'domain_pending') {
        toast.success('Published to your temporary address while your domain finishes connecting');
      } else {
        toast.success('Website published');
      }
      if (result.customDomainError) toast.warning(result.customDomainError);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Publish failed');
    }
  };

  const textFields = fields.filter((f) => f.kind === 'text').length;
  const imageFields = fields.filter((f) => f.kind === 'image').length;
  const busy = saveDraft.isPending || publish.isPending;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Website Editor</h1>
          <p className="text-muted-foreground">
            {template.displayName} — tap any text or image in the preview to edit it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <Button variant="outline" onClick={handleSave} disabled={busy}>
            {saveDraft.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save draft
          </Button>
          <Button onClick={handlePublish} disabled={busy}>
            {publish.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Globe className="mr-2 h-4 w-4" />
            )}
            Save &amp; publish
          </Button>
        </div>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            {entitlement.customDomain
              ? `Saving keeps your changes private. Save & publish is what updates ${entitlement.customDomain}.`
              : 'Saving keeps your changes private. Save & publish puts them online.'}
            {liveUrl ? ` Last published to ${liveUrl}.` : ''}
          </p>
        </CardContent>
      </Card>

      <Tabs value={pageKey} onValueChange={setPageKey}>
        <TabsList>
          {template.pages.map((p) => (
            <TabsTrigger key={p.key} value={p.key}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {page && (
              <iframe
                key={page.key}
                ref={iframeRef}
                title={`${template.displayName} preview`}
                src={page.source}
                onLoad={handleIframeLoad}
                className="h-[70vh] w-full border-0 bg-black"
              />
            )}
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
                Tap any highlighted text or image in the preview. {textFields} text fields and {imageFields} images
                are editable on this page.
              </p>
            ) : (
              <>
                {activeItem && (
                  <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                    <p className="text-xs font-medium text-foreground">
                      {activeItem.rule.label.replace(/\b\w/g, (c) => c.toUpperCase())} card{' '}
                      {activeItem.position + 1} of {activeItem.total}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="min-h-9"
                        onClick={() => runItemOp('duplicate')}
                        aria-label={`Duplicate this ${activeItem.rule.label}`}
                      >
                        <Copy className="mr-2 h-4 w-4" /> Duplicate {activeItem.rule.label}
                      </Button>
                      {activeItem.position > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-9"
                          onClick={() => runItemOp('earlier')}
                          aria-label={`Move this ${activeItem.rule.label} earlier`}
                        >
                          <ArrowUp className="mr-2 h-4 w-4" /> Move earlier
                        </Button>
                      )}
                      {activeItem.position < activeItem.total - 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-9"
                          onClick={() => runItemOp('later')}
                          aria-label={`Move this ${activeItem.rule.label} later`}
                        >
                          <ArrowDown className="mr-2 h-4 w-4" /> Move later
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {selectedField.kind === 'image' ? (
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
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedField?.kind === 'image' && user && (
        <EditorImageDialog
          open={imageDialogOpen}
          onOpenChange={setImageDialogOpen}
          userId={user.id}
          targetWidth={selectedField.width ?? 1024}
          targetHeight={selectedField.height ?? 1024}
          currentSrc={pageDraft[selectedField.key] ?? selectedField.original}
          onApply={(url) => setValue(selectedField.key, url)}
        />
      )}
    </div>
  );
}
