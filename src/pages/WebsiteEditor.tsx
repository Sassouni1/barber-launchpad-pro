import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { WebsiteEditorShell } from '@/components/website/WebsiteEditorShell';
import { useWebsiteEditorEntitlement, useWebsiteTemplate } from '@/hooks/useWebsiteEditor';

/**
 * The single member Website Editor route.
 *
 * Access and template selection both come from the member's own
 * `website_editor_entitlements` row; the editing/publishing behaviour is shared
 * by every client website through `WebsiteEditorShell`.
 */
export default function WebsiteEditor() {
  const { data: entitlement, isLoading: loadingEntitlement } = useWebsiteEditorEntitlement();
  const { data: template, isLoading: loadingTemplate } = useWebsiteTemplate(entitlement?.templateKey);

  if (loadingEntitlement || (entitlement && loadingTemplate)) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!entitlement || !template) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-lg p-6">
          <Card>
            <CardHeader>
              <CardTitle>Website Editor unavailable</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The Website Editor isn't available on your account yet.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <WebsiteEditorShell template={template} entitlement={entitlement} />
    </DashboardLayout>
  );
}
