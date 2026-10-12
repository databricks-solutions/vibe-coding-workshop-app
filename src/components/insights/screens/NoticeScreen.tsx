import { ArrowRight, Code2 } from 'lucide-react';
import { ART } from '../../ideate/art';
import { FadeIn, PrimaryButton, SecondaryButton } from '../ui';

interface NoticeScreenProps {
  title: string;
  body: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  onSwitchToTechnical: () => void;
}

export function NoticeScreen({ title, body, primaryLabel, onPrimary, onSwitchToTechnical }: NoticeScreenProps) {
  return (
    <div className="max-w-xl mx-auto px-1 py-12 sm:py-16 text-center space-y-6">
      <FadeIn>
        <img src={ART.empty} alt="" width={240} height={160} className="mx-auto w-56 rounded-3xl" />
      </FadeIn>
      <FadeIn delay={0.05} className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-ui-lg text-muted-foreground leading-relaxed">{body}</p>
      </FadeIn>
      <FadeIn delay={0.1} className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
        {primaryLabel && onPrimary && (
          <PrimaryButton size="lg" onClick={onPrimary}>
            {primaryLabel} <ArrowRight className="w-4 h-4" />
          </PrimaryButton>
        )}
        <SecondaryButton onClick={onSwitchToTechnical} className="h-12 px-5">
          <Code2 className="w-4 h-4" /> Continue in Technical
        </SecondaryButton>
      </FadeIn>
    </div>
  );
}
