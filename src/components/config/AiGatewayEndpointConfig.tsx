import { MarkdownWithCopy } from '../MarkdownWithCopy';
import { ExpandableOutputModal } from '../ExpandableOutputModal';
import adminMd from '../../content/ai-gateway-admin.md?raw';

interface AiGatewayEndpointConfigProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

export function AiGatewayEndpointConfig({ onToast }: AiGatewayEndpointConfigProps) {
  function handleCopy(ok: boolean) {
    if (ok) onToast('Copied to clipboard', 'success');
    else onToast('Copy failed', 'error');
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">Set up AI Gateway Endpoint</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Admin setup steps for configuring a Databricks AI Gateway endpoint that Claude Code will route through.
              Once set up, users can select the <strong>VS Code + Databricks AI Gateway</strong> option in the workflow and follow the user setup guide.
            </p>
          </div>
          <div className="flex-shrink-0 pt-1">
            <ExpandableOutputModal
              content={adminMd}
              title="Set up AI Gateway Endpoint"
              buttonColor="primary"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden p-5 mb-10">
          <MarkdownWithCopy content={adminMd} onCopy={handleCopy} />
        </div>
      </div>
    </div>
  );
}
