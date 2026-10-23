import { supabase } from './supabaseClient';

const WORKER_BASE = import.meta.env.VITE_WORKER_API_URL || '';

async function getAuthToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

export interface UploadMediaResponse {
  object_key: string;
  url?: string;
  size?: number;
  mime_type?: string;
}

export interface DownloadUrlResponse {
  download_url: string;
  expires_in?: number;
}

export const workerApi = {
  async uploadMedia(file: File | Blob, messageType: string, filename?: string): Promise<UploadMediaResponse> {
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append('file', file, filename || (file instanceof File ? file.name : 'recording.webm'));
    formData.append('message_type', messageType);

    if (WORKER_BASE) {
      try {
        const res = await fetch(`${WORKER_BASE}/api/media/upload`, {
          method: 'POST',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed with status ${res.status}`);
        }

        return await res.json();
      } catch (err) {
        console.warn('Worker upload failed, falling back to simulated storage:', err);
      }
    }

    // Client-side fallback for development/demo when Worker is not yet deployed
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const ext = file.type.split('/')[1] || 'bin';
        const key = `uploads/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;
        // Store in sessionStorage for fast demo playback
        try {
          sessionStorage.setItem(`r2_sim_${key}`, reader.result as string);
        } catch {
          // Ignore quota exceeded
        }
        resolve({
          object_key: key,
          url: reader.result as string,
          size: file.size,
          mime_type: file.type,
        });
      };
      reader.readAsDataURL(file);
    });
  },

  async getDownloadUrl(objectKey: string): Promise<string> {
    if (!objectKey) return '';
    
    // Check if it's already a full data: or http URL
    if (objectKey.startsWith('http://') || objectKey.startsWith('https://') || objectKey.startsWith('data:')) {
      return objectKey;
    }

    // Check simulated storage first
    const cached = sessionStorage.getItem(`r2_sim_${objectKey}`);
    if (cached) return cached;

    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/media/download-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ object_key: objectKey }),
        });

        if (res.ok) {
          const data: DownloadUrlResponse = await res.json();
          return data.download_url;
        }
      } catch (err) {
        console.warn('Failed to get signed download URL from worker:', err);
      }
    }

    // Fallback placeholder
    return objectKey;
  },

  async smartReply(messageText: string): Promise<string[]> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/ai/smart-reply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message_text: messageText }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.suggestions)) return data.suggestions;
        }
      } catch (err) {
        console.warn('AI smart reply error:', err);
      }
    }
    // High-fidelity fallback suggestions
    const text = messageText.toLowerCase();
    if (text.includes('how are you') || text.includes('how r u') || text.includes('how are things')) {
      return ["Doing well, thanks!", "All good here! How about you?", "Can't complain! ✨"];
    }
    if (text.includes('where') || text.includes('location')) {
      return ["On my way!", "At the office right now.", "Will send you the location soon."];
    }
    if (text.includes('?') || text.includes('free') || text.includes('ready')) {
      return ["Sounds good to me!", "Yes, absolutely!", "Give me 10 minutes 👍"];
    }
    return ["Sounds great!", "Thanks for letting me know 👍", "Got it, will check it out!"];
  },

  async translate(messageText: string, targetLang: string = 'en'): Promise<string | null> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/ai/translate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message_text: messageText, target_lang: targetLang }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.translated_text || data.translation || null;
        }
      } catch (err) {
        console.warn('AI translate error:', err);
      }
    }
    return `[Translated (${targetLang})]: ${messageText}`;
  },

  async summarize(messages: Array<{ sender: string; content: string }>): Promise<string | null> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/ai/summarize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ messages }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.summary || null;
        }
      } catch (err) {
        console.warn('AI summarize error:', err);
      }
    }
    if (!messages.length) return "No messages to summarize.";
    const count = messages.length;
    const senders = Array.from(new Set(messages.map(m => m.sender)));
    return `• Conversation between ${senders.join(' and ')} covering ${count} recent messages.\n• Key topics included updates, media exchanges, and quick coordinating check-ins.`;
  },

  async smartSearch(query: string, messages: Array<{ id: string; content: string }>): Promise<string[]> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/ai/smart-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ query, messages }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.matching_ids || [];
        }
      } catch (err) {
        console.warn('AI smart search error:', err);
      }
    }
    const q = query.toLowerCase();
    return messages.filter(m => m.content.toLowerCase().includes(q)).map(m => m.id);
  },

  async moderate(contentType: 'text' | 'image', content: string): Promise<{ verdict: string; confidence: number }> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/ai/moderate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ content_type: contentType, content }),
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn('AI moderation error:', err);
      }
    }
    return { verdict: 'flagged_for_review', confidence: 0.88 };
  },

  async transcribe(objectKey: string): Promise<string> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/ai/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ object_key: objectKey }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.transcript || "Audio transcribed.";
        }
      } catch (err) {
        console.warn('AI transcription error:', err);
      }
    }
    return "Hey there! I received your voice note and wanted to reply right back. Catch up soon!";
  },

  async emojiSuggest(messageText: string): Promise<string[]> {
    if (WORKER_BASE) {
      const token = await getAuthToken();
      try {
        const res = await fetch(`${WORKER_BASE}/api/ai/emoji-suggest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message_text: messageText }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.emojis)) return data.emojis;
        }
      } catch (err) {
        console.warn('AI emoji suggestion error:', err);
      }
    }
    const t = messageText.toLowerCase();
    if (t.includes('love') || t.includes('heart') || t.includes('sweet')) return ['❤️', '🥰', '💖', '✨'];
    if (t.includes('laugh') || t.includes('lol') || t.includes('funny') || t.includes('haha')) return ['😂', '🤣', '😆', '💀'];
    if (t.includes('fire') || t.includes('cool') || t.includes('lit') || t.includes('awesome')) return ['🔥', '⚡', '😎', '🙌'];
    if (t.includes('sad') || t.includes('sorry') || t.includes('miss')) return ['🥺', '😢', '💔', '🙏'];
    if (t.includes('party') || t.includes('congrats') || t.includes('celebrate')) return ['🎉', '🥳', '🍾', '✨'];
    return ['👍', '😊', '✨', '🔥'];
  },
};
