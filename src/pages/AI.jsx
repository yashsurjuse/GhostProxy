import { Fragment, useMemo, useState, useEffect, useRef } from 'react';
import {
  ArrowUp,
  Check,
  Copy,
  Ellipsis,
  MessageSquare,
  Moon,
  Settings,
  PanelLeft,
  Plus,
  RefreshCw,
  Sparkles,
  Sun,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { X } from 'lucide-react';
import ComboBox from '/src/components/settings/components/Combobox';
import Input from '/src/components/settings/components/Input';
import { useOptions } from '/src/utils/optionsContext';
import { showConfirm } from '/src/utils/uiDialog';

const STORAGE_KEY = 'ghostAiConversations';
const ACTIVE_CHAT_KEY = 'ghostAiActiveChatId';
const THEME_KEY = 'ghostAiTheme';
const SEND_COOLDOWN_MS = 5000;

const createId = () => `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const GHOST_AI_ENDPOINT = 'https://api.edisonlearningcenter.me/';

const SYSTEM_MESSAGE = { role: 'system', content: 'You are Ghost AI, a concise and helpful assistant.' };

const createNewChat = () => ({
  id: createId(),
  title: 'Chat',
  updatedAt: Date.now(),
  messages: [
    {
      id: createId(),
      role: 'assistant',
      content: 'Hello! How can I help you today?',
    },
  ],
});

const getStoredChats = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    return [createNewChat()];
  }
  return [createNewChat()];
};

const stripThinkingBlock = (text) => {
  const raw = String(text || '');

  const withoutClosedTag = raw.replace(/<think>[\s\S]*?<\/think>(\r?\n)?/gi, '');
  const withoutRepeatedOpenTag = withoutClosedTag.replace(/<think>[\s\S]*?<think>(\r?\n)?/gi, '');

  return withoutRepeatedOpenTag.trimStart();
};

const requestAiReply = async (chatMessages) => {
  const apiMessages = [
    SYSTEM_MESSAGE,
    ...chatMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content })),
  ];
  // Read AI profile from localStorage so this function can be called from anywhere.
  const raw = (() => {
    try {
      return JSON.parse(localStorage.getItem('ghostAiProfile') || '{}') || {};
    } catch {
      return {};
    }
  })();

  // If user selected a custom API, call it directly and NEVER fallback to default.
  if (raw.apiChoice === 'another') {
    const key = String(raw.apiKey || '').trim();
    const provider = String(raw.provider || 'openai').trim().toLowerCase();
    const model = String(raw.model || '').trim();
    if (!key) throw new Error('No API key configured for the selected provider.');

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: model || 'gpt-4o-mini', messages: apiMessages, temperature: 0.7 }),
      });
      if (res.status === 429) throw new Error('You are sending messages too fast.');
      if (!res.ok) throw new Error('AI provider returned an error.');
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
      if (!reply) throw new Error('AI returned an empty response.');
      return stripThinkingBlock(String(reply));
    }

    if (provider === 'anthropic') {
      // Anthropic completion endpoint (best-effort). Uses x-api-key header.
      const prompt = apiMessages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      const res = await fetch('https://api.anthropic.com/v1/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({ model: model || 'claude-2.1', prompt, max_tokens: 1000, temperature: 0.7 }),
      });
      if (res.status === 429) throw new Error('You are sending messages too fast.');
      if (!res.ok) throw new Error('AI provider returned an error.');
      const data = await res.json();
      const reply = data?.completion || data?.completion?.text || '';
      if (!reply) throw new Error('AI returned an empty response.');
      return stripThinkingBlock(String(reply));
    }

    // Unsupported provider selected.
    throw new Error('Selected AI provider is not supported.');
  }

  // Default: use internal GHOST_AI_ENDPOINT (legacy / fallback). This runs when apiChoice !== 'another'.
  const res = await fetch(GHOST_AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: apiMessages }),
    mode: 'cors',
  });

  if (res.status === 429) {
    throw new Error('You are sending messages too fast.');
  }
  if (!res.ok) {
    throw new Error('AI is temporarily unavailable.');
  }

  const data = await res.json();
  const reply = typeof data?.reply === 'string' ? stripThinkingBlock(data.reply).trim() : '';
  if (!reply) throw new Error('AI returned an empty response.');
  return reply;
};

const renderInlineMarkdown = (text, keyPrefix) => {
  const raw = String(text || '');
  const tokenRegex = /(\$[^$\n]+\$|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g;
  const parts = [];
  let lastIndex = 0;
  let m;

  while ((m = tokenRegex.exec(raw)) !== null) {
    if (m.index > lastIndex) {
      parts.push(<Fragment key={`${keyPrefix}-txt-${lastIndex}`}>{raw.slice(lastIndex, m.index)}</Fragment>);
    }
    const token = m[0];
    if (token.startsWith('$') && token.endsWith('$')) {
      parts.push(
        <span
          key={`${keyPrefix}-math-${m.index}`}
          className="px-1.5 py-0.5 rounded bg-black/25 text-[0.88em] font-mono"
        >
          {token.slice(1, -1)}
        </span>,
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={`${keyPrefix}-code-${m.index}`} className="px-1 py-0.5 rounded bg-black/30 text-[0.88em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`${keyPrefix}-strong-${m.index}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('__') && token.endsWith('__')) {
      parts.push(
        <span key={`${keyPrefix}-underline-${m.index}`} className="underline underline-offset-2">
          {token.slice(2, -2)}
        </span>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={`${keyPrefix}-em-${m.index}`} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    lastIndex = m.index + token.length;
  }

  if (lastIndex < raw.length) {
    parts.push(<Fragment key={`${keyPrefix}-txt-end`}>{raw.slice(lastIndex)}</Fragment>);
  }

  return parts.length > 0 ? parts : raw;
};

const renderMessageContent = (content, keyPrefix) => {
  const text = String(content || '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const nodes = [];
  let i = 0;

  const pushGraphBlock = (graphLines, marker) => {
    nodes.push(
      <div key={`${keyPrefix}-graph-${marker}`} className="my-2 rounded-lg border border-white/10 bg-black/30 p-3 overflow-x-auto">
        <div className="text-[0.72rem] opacity-70 mb-1">Graph</div>
        <pre className="text-[0.85rem] leading-6 whitespace-pre-wrap font-mono">{graphLines.join('\n')}</pre>
      </div>,
    );
  };

  const parseTableRow = (row) =>
    String(row || '')
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*---+\s*$/.test(line)) {
      nodes.push(<hr key={`${keyPrefix}-hr-${i}`} className="border-white/15 my-2" />);
      i += 1;
      continue;
    }

    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1])
    ) {
      const headers = parseTableRow(line);
      i += 2;
      const bodyRows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        bodyRows.push(parseTableRow(lines[i]));
        i += 1;
      }

      nodes.push(
        <div key={`${keyPrefix}-table-${i}`} className="my-2 overflow-x-auto">
          <table className="min-w-full text-sm border border-white/10 rounded-lg overflow-hidden">
            <thead className="bg-black/25">
              <tr>
                {headers.map((header, idx) => (
                  <th key={`${keyPrefix}-th-${i}-${idx}`} className="px-3 py-2 text-left font-semibold border-b border-white/10">
                    {renderInlineMarkdown(header, `${keyPrefix}-th-inline-${i}-${idx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIndex) => (
                <tr key={`${keyPrefix}-tr-${i}-${rowIndex}`} className="border-t border-white/10">
                  {headers.map((_, colIndex) => (
                    <td key={`${keyPrefix}-td-${i}-${rowIndex}-${colIndex}`} className="px-3 py-2 align-top">
                      {renderInlineMarkdown(row[colIndex] || '', `${keyPrefix}-td-inline-${i}-${rowIndex}-${colIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|pie)\b/i.test(line)) {
      const graphLines = [];
      while (i < lines.length && lines[i].trim()) {
        graphLines.push(lines[i]);
        i += 1;
      }
      pushGraphBlock(graphLines, i);
      continue;
    }

    if (/^\$\$\s*$/.test(line)) {
      const block = [];
      i += 1;
      while (i < lines.length && !/^\$\$\s*$/.test(lines[i])) {
        block.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && /^\$\$\s*$/.test(lines[i])) i += 1;
      nodes.push(
        <div key={`${keyPrefix}-math-block-${i}`} className="my-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 overflow-x-auto">
          <pre className="text-[0.88rem] leading-6 font-mono whitespace-pre-wrap">{block.join('\n')}</pre>
        </div>,
      );
      continue;
    }

    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim();
      const code = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && /^```/.test(lines[i])) i += 1;

      if (['mermaid', 'graph', 'chart', 'plot'].includes(lang.toLowerCase())) {
        pushGraphBlock(code, `${i}-${lang}`);
        continue;
      }

      nodes.push(
        <div key={`${keyPrefix}-code-wrap-${i}`} className="my-2">
          {lang && <div className="text-[0.72rem] opacity-70 mb-1">{lang}</div>}
          <pre className="rounded-lg border border-white/10 bg-black/35 p-3 overflow-x-auto text-[0.85rem] leading-6">
            <code>{code.join('\n')}</code>
          </pre>
        </div>,
      );
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const headingClass = level === 1 ? 'text-[1.05rem]' : level === 2 ? 'text-[1rem]' : 'text-[0.95rem]';
      nodes.push(
        <p key={`${keyPrefix}-h-${i}`} className={`font-semibold mt-1 ${headingClass}`}>
          {renderInlineMarkdown(headingText, `${keyPrefix}-h-inline-${i}`)}
        </p>,
      );
      i += 1;
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i += 1;
      }
      nodes.push(
        <ul key={`${keyPrefix}-ul-${i}`} className="list-disc pl-5 space-y-1 my-1">
          {items.map((item, idx) => (
            <li key={`${keyPrefix}-ul-item-${i}-${idx}`}>{renderInlineMarkdown(item, `${keyPrefix}-ul-inline-${i}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      nodes.push(
        <ol key={`${keyPrefix}-ol-${i}`} className="list-decimal pl-5 space-y-1 my-1">
          {items.map((item, idx) => (
            <li key={`${keyPrefix}-ol-item-${i}-${idx}`}>{renderInlineMarkdown(item, `${keyPrefix}-ol-inline-${i}-${idx}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (!line.trim()) {
      nodes.push(<div key={`${keyPrefix}-sp-${i}`} className="h-2" />);
      i += 1;
      continue;
    }

    const paragraph = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^```/.test(lines[i]) &&
      !/^\$\$\s*$/.test(lines[i]) &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }

    nodes.push(
      <p key={`${keyPrefix}-p-${i}`} className="leading-7">
        {renderInlineMarkdown(paragraph.join(' '), `${keyPrefix}-p-inline-${i}`)}
      </p>,
    );
  }

  return <div className="space-y-1">{nodes}</div>;
};

export default function AIPage() {
  const [chats, setChats] = useState(() => getStoredChats());
  const [activeChatId, setActiveChatId] = useState(() => localStorage.getItem(ACTIVE_CHAT_KEY) || '');
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const [openMenuId, setOpenMenuId] = useState(null);
  const [feedbackByMessage, setFeedbackByMessage] = useState({});
  const [copiedMessageId, setCopiedMessageId] = useState('');
  const [reloadingMessageId, setReloadingMessageId] = useState('');
  const copyTimerRef = useRef(null);
  const endRef = useRef(null);
  const [aiSettingsMounted, setAiSettingsMounted] = useState(false);
  const [aiSettingsVisible, setAiSettingsVisible] = useState(false);
  const buttonRef = useRef(null);
  const transitionLockRef = useRef(false);
  const lastToggleAtRef = useRef(0);
  const [aiProfile, setAiProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ghostAiProfile') || '{}') || {};
    } catch {
      return {};
    }
  });
  const aiSettingsRef = useRef(null);
  const { options } = useOptions();

  useEffect(() => {
    if (!aiSettingsMounted) return;
    const onDown = (e) => {
      // Ignore pointer events during transition lock to avoid flicker
      if (transitionLockRef.current) return;
      if (aiSettingsRef.current?.contains(e.target)) return;
      if (buttonRef.current?.contains(e.target)) return;
      // start close animation
      closeAiSettings();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [aiSettingsMounted]);

  const openAiSettings = () => {
    const now = Date.now();
    if (now - lastToggleAtRef.current < 400) return;
    lastToggleAtRef.current = now;
    // prevent outside-click handler from immediately closing while we open
    transitionLockRef.current = true;
    setAiSettingsMounted(true);
    // make visible immediately to avoid mount/visible race
    setAiSettingsVisible(true);
    // release lock after animation window
    setTimeout(() => {
      transitionLockRef.current = false;
    }, 350);
  };

  const closeAiSettings = () => {
    const now = Date.now();
    if (now - lastToggleAtRef.current < 200) return;
    lastToggleAtRef.current = now;
    // lock transitions to prevent immediate reopen while close animation plays
    transitionLockRef.current = true;
    setAiSettingsVisible(false);
    // wait for exit animation before unmount
    setTimeout(() => {
      setAiSettingsMounted(false);
      // release lock shortly after unmount
      setTimeout(() => {
        transitionLockRef.current = false;
      }, 120);
    }, 240);
  };

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  useEffect(() => {
    if (!chats.some((chat) => chat.id === activeChatId)) {
      const fallback = chats[0]?.id || '';
      setActiveChatId(fallback);
      localStorage.setItem(ACTIVE_CHAT_KEY, fallback);
    }
  }, [chats, activeChatId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, 100)));
  }, [chats]);

  useEffect(() => {
    if (activeChatId) localStorage.setItem(ACTIVE_CHAT_KEY, activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('ghostAiProfile', JSON.stringify(aiProfile || {}));
    } catch { }
  }, [aiProfile]);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) || chats[0],
    [chats, activeChatId],
  );

  const messages = activeChat?.messages || [];

  const updateActiveChat = (updater) => {
    if (!activeChat) return;
    setChats((prev) => prev.map((chat) => (chat.id === activeChat.id ? updater(chat) : chat)));
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const cooldownRemaining = Math.max(0, SEND_COOLDOWN_MS - (tick - lastSentAt));
  const cooldownLabel = (cooldownRemaining / 1000).toFixed(1);
  const canSend = useMemo(
    () => input.trim().length > 0 && !loading && cooldownRemaining === 0,
    [input, loading, cooldownRemaining],
  );

  const isLight = theme === 'light';
  const ui = isLight
    ? {
      page: 'bg-[#f3f5f8] text-[#0f172a]',
      side: 'bg-[#f7f8fb] border-black/10',
      panel: 'bg-white border-black/10',
      muted: 'text-[#5b6474]',
      input: 'bg-white border-black/10',
      card: 'bg-white border-black/10 hover:border-black/20',
      bubbleUser: 'bg-[#e2e8f0] text-[#0f172a] border-black/10',
      bubbleAssistant: 'bg-white text-[#0f172a] border-black/10',
    }
    : {
      page: 'bg-[#030507] text-white',
      side: 'bg-[#0c0d10] border-white/10',
      panel: 'bg-[#030507] border-white/10',
      muted: 'text-white/55',
      input: 'bg-[#05070b] border-white/15',
      card: 'bg-[#05070b] border-white/15 hover:border-white/30',
      bubbleUser: 'bg-[#27272a] text-white border-white/10',
      bubbleAssistant: 'bg-[#07090d] text-white border-white/10',
    };

  const createChat = () => {
    const next = createNewChat();
    setChats((prev) => [next, ...prev]);
    setActiveChatId(next.id);
    setOpenMenuId(null);
    setInput('');
  };

  const deleteChat = async (id) => {
    const confirmed = await showConfirm('Delete this chat? This action cannot be undone.', 'Delete chat');
    if (!confirmed) return;

    const remaining = chats.filter((chat) => chat.id !== id);
    if (remaining.length === 0) {
      const fresh = createNewChat();
      setChats([fresh]);
      setActiveChatId(fresh.id);
      return;
    }
    setChats(remaining);
    if (activeChatId === id) setActiveChatId(remaining[0].id);
    setOpenMenuId(null);
  };

  const setFeedback = (messageId, value) => {
    setFeedbackByMessage((prev) => ({
      ...prev,
      [messageId]: prev[messageId] === value ? null : value,
    }));
  };

  const copyMessage = async (messageId, content) => {
    try {
      await navigator.clipboard.writeText(String(content || ''));
      setCopiedMessageId(messageId);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedMessageId(''), 1100);
    } catch { }
  };

  const regenerateMessage = async (messageId) => {
    if (loading || reloadingMessageId) return;
    const assistantIndex = messages.findIndex((message) => message.id === messageId);
    if (assistantIndex < 0) return;

    let userIndex = -1;
    for (let idx = assistantIndex - 1; idx >= 0; idx -= 1) {
      if (messages[idx]?.role === 'user') {
        userIndex = idx;
        break;
      }
    }
    if (userIndex < 0) return;

    const context = messages.slice(0, userIndex + 1);
    setReloadingMessageId(messageId);

    try {
      const refreshed = await requestAiReply(context);
      updateActiveChat((chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: chat.messages.map((message) =>
          message.id === messageId ? { ...message, content: refreshed } : message,
        ),
      }));
    } catch (error) {
      updateActiveChat((chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: [
          ...chat.messages,
          { id: createId(), role: 'system', content: `Error: ${error?.message || 'Unable to regenerate response.'}` },
        ],
      }));
    } finally {
      setReloadingMessageId('');
    }
  };

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;

    if (Date.now() - lastSentAt < SEND_COOLDOWN_MS) {
      const waitMsg = { id: createId(), role: 'system', content: 'You are sending messages too fast.' };
      updateActiveChat((chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: [...chat.messages, waitMsg],
      }));
      return;
    }

    setLastSentAt(Date.now());

    const nextUser = { id: createId(), role: 'user', content: prompt };
    const optimistic = [...messages, nextUser];
    updateActiveChat((chat) => ({
      ...chat,
      title:
        chat.title === 'Chat'
          ? prompt.slice(0, 38) || 'Chat'
          : chat.title,
      updatedAt: Date.now(),
      messages: optimistic,
    }));
    setInput('');
    setLoading(true);

    try {
      const text = await requestAiReply(optimistic);
      updateActiveChat((chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: [...chat.messages, { id: createId(), role: 'assistant', content: text }],
      }));
    } catch (error) {
      updateActiveChat((chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: [
          ...chat.messages,
          { id: createId(), role: 'system', content: `Error: ${error?.message || 'Unable to complete request.'}` },
        ],
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`h-full w-full overflow-hidden ${ui.page}`}>
      <div className="h-full flex min-w-0">
        <aside
          className={`h-full border-r overflow-hidden transition-all duration-300 ease-out ${ui.side} ${sidebarOpen ? 'w-[260px]' : 'w-0 border-r-0'
            }`}
        >
          <div className="h-full w-[260px] flex flex-col">
            <div className="px-3 pt-5 pb-0">
              <div className="flex items-center gap-2.5 pl-1.5 mb-3">
                <img src="/ghost.png" alt="Ghost AI" className={`h-7 w-7 ${isLight ? '' : 'invert'}`} />
                <span className="font-semibold text-[1.35rem] leading-none">Ghost AI</span>
              </div>
            </div>

            <div className="px-3 pt-2 pb-3 overflow-y-auto flex-1 space-y-1">
              <div className="mb-3">
                <button
                  onClick={createChat}
                  className={`w-full h-9 rounded-xl border px-3 text-[0.96rem] font-medium transition-all duration-200 flex items-center gap-2 ${ui.card}`}
                >
                  <Plus size={14} />
                  <span className="text-[0.96rem]">New Chat</span>
                </button>
              </div>
              {chats
                .slice()
                .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
                .map((chat) => (
                  <div
                    key={chat.id}
                    className={`group rounded-xl border transition-all duration-200 ${chat.id === activeChat?.id
                      ? isLight
                        ? 'bg-[#e5e7eb] border-black/10'
                        : 'bg-[#22252b] border-white/10'
                      : 'border-transparent hover:border-white/10'
                      }`}
                  >
                    <div
                      onClick={() => {
                        setActiveChatId(chat.id);
                        setOpenMenuId(null);
                      }}
                      className="h-8 px-3 flex items-center justify-between cursor-pointer"
                    >
                      <p className="text-[0.92rem] truncate">{chat.title || 'Chat'}</p>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuId((prev) => (prev === chat.id ? null : chat.id));
                          }}
                          className="h-7 w-7 rounded-md grid place-items-center opacity-70 hover:opacity-100 transition-opacity"
                        >
                          <Ellipsis size={15} />
                        </button>
                        {openMenuId === chat.id && (
                          <div className={`absolute right-0 top-8 w-36 rounded-xl border z-20 p-1.5 shadow-xl ${ui.card}`}>
                            <button
                              type="button"
                              className="w-full h-8 rounded-lg px-2.5 text-left text-[0.92rem] opacity-50 cursor-not-allowed"
                              disabled
                            >
                              Archive
                            </button>
                            <button
                              type="button"
                              className="w-full h-8 rounded-lg px-2.5 text-left text-[0.92rem] text-red-400 hover:bg-red-500/10"
                              onClick={async (event) => {
                                event.stopPropagation();
                                await deleteChat(chat.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 h-full flex flex-col">
          <div className={`h-14 border-b px-4 flex items-center justify-between ${ui.panel}`}>
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="h-8 w-8 rounded-md grid place-items-center transition-all duration-200 hover:bg-white/10"
              title="Toggle chat sidebar"
            >
              <PanelLeft size={17} />
            </button>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  ref={buttonRef}
                  type="button"
                  onClick={() => {
                    if (transitionLockRef.current) return;
                    if (aiSettingsMounted && aiSettingsVisible) closeAiSettings();
                    else openAiSettings();
                  }}
                  className="h-8 w-8 rounded-md grid place-items-center transition-all duration-200 hover:bg-white/6"
                  title="AI Settings"
                >
                  <Settings size={16} />
                </button>
                {aiSettingsMounted && (
                  <div
                    ref={aiSettingsRef}
                    className={`absolute right-0 top-9 w-80 rounded-xl border z-30 p-3 shadow-2xl ${ui.card} ${aiSettingsVisible ? 'ghost-anim-card' : 'ghost-anim-leave'
                      } ai-settings-no-outline text-white`}
                    style={{ minWidth: '18rem', backgroundColor: options.settingsContainerColor || '#2f363b' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="text-lg font-semibold">AI Settings</div>
                      <button type="button" onClick={() => closeAiSettings()} className="p-1 rounded-md hover:bg-white/6">
                        <X size={14} />
                      </button>
                    </div>

                    <div className="mb-3">
                      <div className="text-[0.85rem] mb-1">Default Theme</div>
                      <ComboBox
                        config={[{ option: 'Dark', value: 'dark' }, { option: 'Light', value: 'light' }]}
                        selectedValue={aiProfile.defaultTheme || 'dark'}
                        action={(v) => setAiProfile((s) => ({ ...(s || {}), defaultTheme: v }))}
                      />
                    </div>

                    <div className="mb-3">
                      <div className="text-[0.85rem] mb-1">API Choice</div>
                      <ComboBox
                        config={[{ option: 'Default API', value: 'default' }, { option: 'Another API', value: 'another' }]}
                        selectedValue={aiProfile.apiChoice || 'default'}
                        action={(v) => setAiProfile((s) => ({ ...(s || {}), apiChoice: v }))}
                      />
                    </div>

                    {aiProfile.apiChoice === 'another' && (
                      <>
                        <div className="mb-3">
                          <div className="text-[0.85rem] mb-1">AI Provider</div>
                          <ComboBox
                            config={[{ option: 'OpenAI', value: 'openai' }, { option: 'Gemini', value: 'gemini' }]}
                            selectedValue={aiProfile.provider || 'openai'}
                            action={(v) => setAiProfile((s) => ({ ...(s || {}), provider: v }))}
                          />
                        </div>

                        <div className="mb-3">
                          <div className="text-[0.85rem] mb-1">Model</div>
                          <Input
                            defValue={aiProfile.model || ''}
                            onChange={(v) => setAiProfile((s) => ({ ...(s || {}), model: v }))}
                            placeholder="e.g. gpt-4o-mini"
                          />
                        </div>

                        <div className="mb-3">
                          <div className="text-[0.85rem] mb-1">API Key</div>
                          <Input
                            defValue={aiProfile.apiKey || ''}
                            onChange={(v) => setAiProfile((s) => ({ ...(s || {}), apiKey: v }))}
                            placeholder="Paste your API key"
                            inputType="password"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (aiProfile?.defaultTheme) setTheme(aiProfile.defaultTheme);
                          closeAiSettings();
                        }}
                        className="px-3 py-1 rounded-md border text-sm"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => closeAiSettings()}
                        className="px-3 py-1 rounded-md text-sm opacity-70"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                className={`h-8 w-14 rounded-full border p-1 transition-all duration-300 flex items-center ${isLight ? 'justify-start border-black/15 bg-[#dbe1ea]' : 'justify-end border-white/20 bg-[#1b1f28]'
                  }`}
                title="Toggle light/dark mode"
              >
                <span
                  className={`h-6 w-6 rounded-full grid place-items-center transition-transform duration-300 ${isLight ? 'bg-[#f8fafc] text-[#0f172a]' : 'bg-[#0b1020] text-[#f8fafc]'
                    }`}
                >
                  {isLight ? <Sun size={13} /> : <Moon size={13} />}
                </span>
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 md:px-8 pt-6 pb-5">
            {messages.length <= 1 && (
              <div className="max-w-[900px] mx-auto mt-8 mb-8">
                <h1 className="text-5xl font-semibold tracking-tight mb-2">Hello there!</h1>
                <p className={`text-4xl ${ui.muted}`}>How can I help you today?</p>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInput('How do you solve a parabola')}
                    className={`h-16 rounded-2xl border px-4 text-left transition-all duration-200 hover:translate-y-[-1px] ${ui.card}`}
                  >
                    <p className="text-[0.95rem] font-semibold">How do you solve</p>
                    <p className={`text-[0.9rem] ${ui.muted}`}>a parabola</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInput('Explain React hooks like useState and useEffect')}
                    className={`h-16 rounded-2xl border px-4 text-left transition-all duration-200 hover:translate-y-[-1px] ${ui.card}`}
                  >
                    <p className="text-[0.95rem] font-semibold">Explain React hooks</p>
                    <p className={`text-[0.9rem] ${ui.muted}`}>like useState and useEffect</p>
                  </button>
                </div>
              </div>
            )}

            <div className="max-w-[900px] mx-auto space-y-4 pb-2">
              {messages
                .filter((message, idx) => !(idx === 0 && message.role === 'assistant' && message.content?.includes('Hello!')))
                .map((message) => {
                  const richMessage = message.role === 'assistant' || message.role === 'system';
                  const feedback = feedbackByMessage[message.id] || null;
                  const copied = copiedMessageId === message.id;
                  const reloading = reloadingMessageId === message.id;
                  return (
                    <div key={message.id} className={message.role === 'user' ? 'ml-auto w-fit max-w-[86%]' : 'w-fit max-w-[86%]'}>
                      <div
                        className={`rounded-2xl border px-4 py-3 text-[0.95rem] transition-all duration-200 ${message.role === 'user'
                          ? `${ui.bubbleUser}`
                          : message.role === 'assistant'
                            ? `${ui.bubbleAssistant}`
                            : isLight
                              ? 'border-red-200 text-red-700 bg-red-100'
                              : 'border-red-500/50 text-red-300 bg-red-900/20'
                          }`}
                      >
                        {richMessage ? renderMessageContent(message.content, message.id) : (
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        )}
                      </div>

                      {message.role === 'assistant' && (
                        <div className={`mt-1.5 px-1 flex items-center gap-1.5 ${ui.muted}`}>
                          <button
                            type="button"
                            onClick={() => copyMessage(message.id, message.content)}
                            title={copied ? 'Copied' : 'Copy'}
                            className={`h-7 w-7 rounded-md grid place-items-center transition-all duration-200 ${copied ? 'text-emerald-400 scale-105' : 'hover:bg-white/10'}`}
                          >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setFeedback(message.id, 'like')}
                            title="Like"
                            className={`h-7 w-7 rounded-md grid place-items-center transition-all duration-200 ${feedback === 'like' ? 'text-emerald-400' : 'hover:bg-white/10'}`}
                          >
                            <ThumbsUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setFeedback(message.id, 'dislike')}
                            title="Dislike"
                            className={`h-7 w-7 rounded-md grid place-items-center transition-all duration-200 ${feedback === 'dislike' ? 'text-red-400' : 'hover:bg-white/10'}`}
                          >
                            <ThumbsDown size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => regenerateMessage(message.id)}
                            title="Regenerate"
                            disabled={loading || !!reloadingMessageId}
                            className={`h-7 w-7 rounded-md grid place-items-center transition-all duration-200 ${loading || reloadingMessageId ? 'opacity-45 cursor-not-allowed' : 'hover:bg-white/10'}`}
                          >
                            <RefreshCw size={14} className={reloading ? 'animate-spin' : ''} />
                          </button>
                        </div>
                      )}
                      {message.role !== 'user' && message.role !== 'assistant' && (
                        <div className="h-1" />
                      )}
                    </div>
                  );
                })}

              {loading && (
                <div className={`w-fit rounded-2xl border px-4 py-3 text-[1.05rem] animate-pulse flex items-center gap-2 ${ui.bubbleAssistant}`}>
                  <Sparkles size={15} />
                  <span>Generating…</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <div className={`border-t px-6 md:px-8 py-4 ${ui.panel}`}>
            <div className="max-w-[900px] mx-auto">
              <div className={`rounded-2xl border px-4 py-3 transition-all duration-300 ${ui.input}`}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={loading ? 'Waiting for response...' : 'Send a message...'}
                  className={`w-full h-10 bg-transparent outline-none text-[0.95rem] ${isLight ? 'placeholder:text-[#111827]' : 'placeholder:text-white/60'
                    }`}
                />

                <div className="h-9 mt-1 flex items-center justify-between">
                  <button
                    type="button"
                    disabled
                    title="Upload disabled"
                    className="h-8 w-8 rounded-md grid place-items-center opacity-45 cursor-not-allowed"
                  >
                    <Plus size={20} />
                  </button>

                  <button
                    type="button"
                    onClick={send}
                    disabled={!canSend}
                    title={cooldownRemaining > 0 ? `Wait ${cooldownLabel}s` : 'Send'}
                    className={`h-8 w-8 rounded-md grid place-items-center transition-all duration-200 ${canSend ? 'opacity-85 hover:opacity-100 hover:translate-y-[-1px]' : 'opacity-35 cursor-not-allowed'
                      }`}
                  >
                    <ArrowUp size={18} />
                  </button>
                </div>
              </div>

              {cooldownRemaining > 0 && !loading && (
                <p className={`text-[0.9rem] mt-2 ${ui.muted}`}>Rate limit active: wait {cooldownLabel}s</p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
