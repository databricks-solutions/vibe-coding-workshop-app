import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../api/client';

interface Options {
  step: number;
  tag: string;
  industry: string;
  useCase: string;
  sessionId: string | null;
  savedPrompt?: string;
  previousOutputs?: Record<string, string>;
  onGenerated: (step: number, text: string) => void;
}

export type PromptStatus = 'idle' | 'streaming' | 'ready' | 'error';

/** Streams one moment's instructions through the same endpoint the Technical view uses. */
export function useMomentPrompt({ step, tag, industry, useCase, sessionId, savedPrompt, previousOutputs, onGenerated }: Options) {
  const [text, setText] = useState(savedPrompt ?? '');
  const [status, setStatus] = useState<PromptStatus>(savedPrompt ? 'ready' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const bufferRef = useRef('');
  const controllerRef = useRef<AbortController | null>(null);
  const rafRef = useRef(0);
  const onGeneratedRef = useRef(onGenerated);
  useEffect(() => { onGeneratedRef.current = onGenerated; }, [onGenerated]);

  useEffect(() => {
    if (status === 'streaming') return;
    setText(savedPrompt ?? '');
    setStatus(savedPrompt ? 'ready' : 'idle');
    setError(null);
    // Only re-sync when the moment or its saved prompt changes, never mid-stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, savedPrompt]);

  useEffect(() => () => {
    controllerRef.current?.abort();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const generate = useCallback(() => {
    if (!industry || !useCase) {
      setError('Your project is missing its questions. Go back and add at least one.');
      setStatus('error');
      return;
    }
    controllerRef.current?.abort();
    bufferRef.current = '';
    setText('');
    setError(null);
    setRetrying(false);
    setStatus('streaming');

    controllerRef.current = apiClient.generatePromptStream(
      industry,
      useCase,
      tag,
      chunk => {
        setRetrying(false);
        bufferRef.current += chunk;
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = 0;
            setText(bufferRef.current);
          });
        }
      },
      () => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
        const final = bufferRef.current;
        setText(final);
        if (final.trim()) {
          setStatus('ready');
          onGeneratedRef.current(step, final);
        } else {
          setStatus('error');
          setError('The instructions came back empty. Try again in a moment.');
        }
      },
      err => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
        setStatus('error');
        setError(err || 'Something went wrong while writing your instructions.');
      },
      previousOutputs,
      sessionId,
      () => setRetrying(true),
    );
  }, [industry, useCase, tag, previousOutputs, sessionId, step]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setStatus(savedPrompt ? 'ready' : 'idle');
    setText(savedPrompt ?? '');
  }, [savedPrompt]);

  return { text, status, error, retrying, generate, cancel };
}
