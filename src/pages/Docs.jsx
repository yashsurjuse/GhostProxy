import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Search } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import docsCatalog from '/src/data/docs/catalog.json';
import dictionaryEntries from '/src/data/docs/dictionary.json';

const escapeHtml = (input) =>
  String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const inlineMarkdown = (line) =>
  escapeHtml(line)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

const renderMarkdown = (markdown) => {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let listBuffer = [];
  let codeBuffer = [];
  let inCode = false;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    out.push(`<ul>${listBuffer.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
    listBuffer = [];
  };

  const flushCode = () => {
    if (!inCode) return;
    out.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
    codeBuffer = [];
    inCode = false;
  };

  for (const rawLine of lines) {
    const line = rawLine || '';

    if (line.trim().startsWith('```')) {
      if (inCode) flushCode();
      else {
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^\s*[-*]\s+/, ''));
      continue;
    }

    flushList();

    if (!line.trim()) {
      out.push('<div class="spacer"></div>');
      continue;
    }

    if (/^###\s+/.test(line)) {
      out.push(`<h3>${inlineMarkdown(line.replace(/^###\s+/, ''))}</h3>`);
      continue;
    }

    if (/^##\s+/.test(line)) {
      out.push(`<h2>${inlineMarkdown(line.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }

    if (/^#\s+/.test(line)) {
      out.push(`<h1>${inlineMarkdown(line.replace(/^#\s+/, ''))}</h1>`);
      continue;
    }

    out.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  flushList();
  flushCode();
  return out.join('');
};

const Docs = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { category, topicId } = useParams();
  const [query, setQuery] = useState('');
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [dictionaryQuery, setDictionaryQuery] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);
  const isMac = typeof navigator !== 'undefined' ? /Mac|iPhone|iPad|iPod/i.test(navigator.platform) : false;
  const shortcutLabel = isMac ? 'Cmd+K' : 'Ctrl+K';
  const inGhostBrowserMode = new URLSearchParams(location.search).get('ghost') === '1';

  const categories = useMemo(() => (Array.isArray(docsCatalog) ? docsCatalog : []), []);

  const activeCategory = useMemo(
    () => categories.find((item) => item.id === category) || null,
    [categories, category],
  );

  const activeTopic = useMemo(
    () => activeCategory?.topics?.find((item) => String(item.id) === String(topicId)) || null,
    [activeCategory, topicId],
  );

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((section) => ({
        ...section,
        topics: (section.topics || []).filter((item) => item.title.toLowerCase().includes(q)),
      }))
      .filter((section) => section.title.toLowerCase().includes(q) || (section.topics || []).length > 0);
  }, [categories, query]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const useMod = isMac ? e.metaKey : e.ctrlKey;
      if (useMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMac]);

  useEffect(() => {
    if (!activeTopic?.file) {
      setMarkdown('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(activeTopic.file)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('missing markdown'))))
      .then((text) => {
        if (cancelled) return;
        setMarkdown(text);
      })
      .catch(() => {
        if (cancelled) return;
        setMarkdown('# Missing Document\n\nThis markdown file was not found yet.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTopic?.file]);

  const openTopic = (catId, itemId) => {
    const search = inGhostBrowserMode ? '?ghost=1' : '';
    navigate(`/docs/${catId}/${itemId}${search}`);
  };

  const renderedMarkdown = useMemo(() => renderMarkdown(markdown), [markdown]);
  const filteredDictionaryEntries = useMemo(() => {
    const q = dictionaryQuery.trim().toLowerCase();
    if (!q) return dictionaryEntries;
    return dictionaryEntries.filter(
      (entry) => entry.word.toLowerCase().includes(q) || entry.definition.toLowerCase().includes(q),
    );
  }, [dictionaryQuery]);

  if (topicId) {
    return (
      <div className="min-h-screen px-4 md:px-8 pt-6 pb-10">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => navigate(`/docs${inGhostBrowserMode ? '?ghost=1' : ''}`)}
            className="h-9 px-3 rounded-md bg-[#ffffff12] hover:bg-[#ffffff1f] text-sm inline-flex items-center gap-2"
          >
            <ArrowLeft size={15} /> Back
          </button>

          <div className="mt-4 rounded-xl border border-white/10 bg-[#0d131b] p-5">
            <div className="mb-3 text-xs opacity-70 inline-flex items-center gap-2">
              <BookOpen size={13} />
              <span>{activeCategory?.title || 'Docs'}</span>
            </div>
            <h1 className="text-2xl font-semibold mb-4">{activeTopic?.title || 'Document'}</h1>
            {loading ? (
              <p className="text-sm opacity-80">Loading markdown…</p>
            ) : (
              <article className="ghost-doc-markdown" dangerouslySetInnerHTML={{ __html: renderedMarkdown }} />
            )}
          </div>
        </div>

        <style>{`
          .ghost-doc-markdown h1 { font-size: 1.8rem; font-weight: 700; margin: 0 0 0.75rem; }
          .ghost-doc-markdown h2 { font-size: 1.3rem; font-weight: 600; margin: 1rem 0 0.6rem; }
          .ghost-doc-markdown h3 { font-size: 1.05rem; font-weight: 600; margin: 0.9rem 0 0.5rem; }
          .ghost-doc-markdown p { margin: 0.45rem 0; opacity: 0.96; }
          .ghost-doc-markdown ul { margin: 0.5rem 0 0.6rem 1.2rem; list-style: disc; }
          .ghost-doc-markdown li { margin: 0.25rem 0; }
          .ghost-doc-markdown code { background: rgba(255,255,255,0.12); padding: 0.1rem 0.3rem; border-radius: 0.28rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
          .ghost-doc-markdown pre { background: rgba(0,0,0,0.32); padding: 0.7rem; border-radius: 0.5rem; overflow-x: auto; }
          .ghost-doc-markdown pre code { background: transparent; padding: 0; }
          .ghost-doc-markdown a { text-decoration: underline; text-underline-offset: 2px; }
          .ghost-doc-markdown .spacer { height: 0.3rem; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {!inGhostBrowserMode && (
        <div
          className="sticky top-0 z-50 border-b border-white/10 backdrop-blur"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.07)' }}
        >
          <div className="h-20 px-4 md:px-8 flex items-center justify-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="h-9 px-3 rounded-md bg-[#ffffff12] hover:bg-[#ffffff1f] text-sm flex items-center gap-2"
            >
              <ArrowLeft size={15} /> Return to Ghost
            </button>

            <div className="h-9 w-[360px] max-w-[58vw] rounded-md border border-white/12 bg-[#ffffff10] px-3 flex items-center gap-2">
              <Search size={15} className="opacity-70" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search docs"
                className="w-full bg-transparent outline-none text-sm"
              />
              <span className="text-[11px] px-1.5 py-0.5 rounded border border-white/20 opacity-70">{shortcutLabel}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 md:px-8 pt-6 pb-10">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0f141c] p-8 mb-7">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(135deg, #ffffff0c, #ffffff0c 2px, transparent 2px, transparent 16px)' }} />
          <div className="absolute inset-0 opacity-12" style={{ backgroundImage: 'radial-gradient(circle at 20% 15%, #ffffff18 0 2px, transparent 3px), radial-gradient(circle at 70% 60%, #ffffff16 0 2px, transparent 3px)' }} />
          <div className="relative z-10">
            <div className="mb-3">
              <img
                src="/ghost.png"
                alt="Ghost"
                className="w-9 h-9 object-contain"
                style={{ filter: 'invert(1) brightness(2)' }}
              />
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">Ghost Docs</h1>
            <p className="text-sm md:text-base opacity-75 mt-2">Help for all things Ghost.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSections.map((section) => (
            <div key={section.id} className="rounded-xl border border-white/10 bg-[#0d131b] p-4 ghost-anim-card">
              <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
              <ul className="space-y-2.5 text-sm opacity-90">
                {(section.topics || []).map((item, index) => (
                  <li key={`${section.id}-${item.id}`} className="flex items-start gap-2">
                    <span className="mt-[2px] inline-flex w-5 h-5 items-center justify-center rounded-full bg-white/8 text-[11px]">{index + 1}</span>
                    <button
                      type="button"
                      className="text-left hover:underline underline-offset-2"
                      onClick={() => openTopic(section.id, item.id)}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-[#0d131b] p-5 flex items-center justify-between gap-4 ghost-anim-card">
          <div>
            <h3 className="text-xl font-semibold">Dictionary</h3>
            <p className="text-sm opacity-80 mt-1">Learn what terms for Ghost and Proxying in general mean</p>
          </div>
          <button
            type="button"
            className="h-10 px-4 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-sm"
            onClick={() => setDictionaryOpen(true)}
          >
            View
          </button>
        </div>
      </div>

      {dictionaryOpen && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4 ghost-doc-popup-wrap">
          <button type="button" className="absolute inset-0 bg-black/50 ghost-doc-popup-backdrop" onClick={() => setDictionaryOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-xl border border-white/10 bg-[#121a25] p-4 max-h-[80vh] overflow-y-auto ghost-doc-popup-panel">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Dictionary</h2>
              <button
                type="button"
                className="h-8 px-3 rounded-md border border-white/15 hover:bg-white/10 text-sm"
                onClick={() => setDictionaryOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mb-3 h-9 rounded-md border border-white/12 bg-[#ffffff10] px-3 flex items-center gap-2">
              <Search size={15} className="opacity-70" />
              <input
                value={dictionaryQuery}
                onChange={(e) => setDictionaryQuery(e.target.value)}
                placeholder="Search dictionary"
                className="w-full bg-transparent outline-none text-sm"
              />
            </div>
            <div className="space-y-2">
              {filteredDictionaryEntries.map((entry) => (
                <div key={entry.word} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="text-sm font-semibold">{entry.word}</p>
                  <p className="text-sm opacity-85 mt-1">{entry.definition}</p>
                </div>
              ))}
              {filteredDictionaryEntries.length === 0 && (
                <p className="text-sm opacity-75">No matching terms found.</p>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`
        .ghost-doc-popup-backdrop {
          animation: ghostDocsFadeIn 0.18s ease-out;
        }
        .ghost-doc-popup-panel {
          animation: ghostDocsPopupIn 0.22s ease-out;
          transform-origin: center;
        }
        @keyframes ghostDocsFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ghostDocsPopupIn {
          from { opacity: 0; transform: scale(0.965) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
});

Docs.displayName = 'Docs';
export default Docs;
