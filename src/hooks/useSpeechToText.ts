import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognitionCtor =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined;

interface UseSpeechToTextOptions {
  onFinalTranscript: (text: string) => void;
  language?: string;
}

export function useSpeechToText({ onFinalTranscript, language = 'en-US' }: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const callbackRef = useRef(onFinalTranscript);
  const stoppedManuallyRef = useRef(false);

  useEffect(() => {
    callbackRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const stopListening = useCallback(() => {
    stoppedManuallyRef.current = true;
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) return;

    recognitionRef.current?.abort();

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognitionRef.current = recognition;
    stoppedManuallyRef.current = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }

      if (finalText) {
        callbackRef.current(finalText);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.warn('SpeechRecognition error:', event.error);
      }
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      if (!stoppedManuallyRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
          setInterimTranscript('');
        }
        return;
      }
      setIsListening(false);
      setInterimTranscript('');
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, [language]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    isSupported: !!SpeechRecognitionCtor,
  };
}
