import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import PouchDB from 'pouchdb';

const generateId = () => Math.random().toString(36).substring(2, 9);

type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'checkbox';

interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
}

interface Page {
  id: string;
  title: string;
  icon: string;
}

// Setup DB globally
const localDB = new PouchDB('axon');
const remoteDB = new PouchDB('http://admin:password@localhost:5984/axon');

// Start synchronization
localDB.sync(remoteDB, {
  live: true,
  retry: true
}).on('error', function (err) {
  console.log('Sync error', err);
});

// Helper Hook for PouchDB Documents
function usePouchDB<T>(docId: string, initialValue: T) {
  const [data, setData] = useState<T>(initialValue);
  const [rev, setRev] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const doc = await localDB.get(docId);
        if (active) {
          setData((doc as any).data);
          setRev(doc._rev);
          setLoading(false);
        }
      } catch (err: any) {
        if (err.name === 'not_found' && active) {
          try {
            const res = await localDB.put({ _id: docId, data: initialValue });
            setRev(res.rev);
          } catch (e) {}
          setLoading(false);
        }
      }
    };

    loadData();

    const changes = localDB.changes({
      since: 'now',
      live: true,
      include_docs: true,
      doc_ids: [docId]
    }).on('change', (change) => {
      if (active) {
        setData((change.doc as any).data);
        setRev(change.doc._rev);
      }
    });

    return () => {
      active = false;
      changes.cancel();
    };
  }, [docId]);

  const saveData = async (newData: T) => {
    setData(newData);
    try {
      const currentDoc = await localDB.get(docId).catch(() => null);
      if (currentDoc) {
        const res = await localDB.put({ ...currentDoc, data: newData });
        setRev(res.rev);
      } else {
        const res = await localDB.put({ _id: docId, data: newData });
        setRev(res.rev);
      }
    } catch (err: any) {
      if (err.name === 'conflict') {
        // Optimistic retry
        const latestDoc = await localDB.get(docId);
        const res = await localDB.put({ ...latestDoc, data: newData });
        setRev(res.rev);
      }
    }
  };

  return [data, saveData, loading] as const;
}

// SVG Icons
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const GripIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>;
const TextIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>;
const Heading1Icon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h8"></path><path d="M4 18V6"></path><path d="M12 18V6"></path><path d="M17 12h4"></path><path d="M21 18V6"></path></svg>;
const BulletIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const CheckSquareIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>;
const MenuIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>;

interface ContentEditableBlockProps {
  block: Block;
  innerRef: (el: HTMLDivElement | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onInput: (e: React.FormEvent<HTMLDivElement>) => void;
  onBlur: () => void;
  onFocus: () => void;
  className?: string;
}

const ContentEditableBlock = React.memo(({ block, innerRef, onKeyDown, onInput, onBlur, onFocus, className }: ContentEditableBlockProps) => {
  const contentRef = useRef(block.content);

  return (
    <div 
      ref={innerRef}
      className={`block-content ${className || ''}`}
      contentEditable
      suppressContentEditableWarning
      data-type={block.type}
      data-placeholder={block.type === 'paragraph' ? "Escribe '/' para ver comandos" : ""}
      onKeyDown={onKeyDown}
      onInput={(e) => {
        contentRef.current = e.currentTarget.textContent || '';
        onInput(e);
      }}
      onBlur={onBlur}
      onFocus={onFocus}
    >
      {contentRef.current}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.block.type === nextProps.block.type && prevProps.block.id === nextProps.block.id && prevProps.className === nextProps.className;
});

function Editor({ page, onUpdatePage, onOpenMenu }: { page: Page, onUpdatePage: (id: string, updates: Partial<Page>) => void, onOpenMenu: () => void }) {
  const [blocks, setBlocks, loading] = usePouchDB<Block[]>(`axon-blocks-${page.id}`, [{ id: generateId(), type: 'paragraph', content: '' }]);
  
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  const [dragEnabledId, setDragEnabledId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom' | null>(null);

  const blockRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const MENU_ITEMS = [
    { type: 'paragraph', title: 'Texto', desc: 'Comienza a escribir con texto plano.', icon: <TextIcon /> },
    { type: 'checkbox', title: 'Lista de tareas', desc: 'Realiza un seguimiento de las tareas con una casilla.', icon: <CheckSquareIcon /> },
    { type: 'h1', title: 'Título 1', desc: 'Título de sección grande.', icon: <Heading1Icon /> },
    { type: 'h2', title: 'Título 2', desc: 'Título de sección mediano.', icon: <Heading1Icon /> },
    { type: 'h3', title: 'Título 3', desc: 'Título de sección pequeño.', icon: <Heading1Icon /> },
    { type: 'bullet', title: 'Lista de viñetas', desc: 'Crea una lista con viñetas simple.', icon: <BulletIcon /> },
  ] as const;

  const updateBlock = (id: string, newContent: string, updates: Partial<Block> = {}) => {
    setBlocks(blocksRef.current.map(b => b.id === id ? { ...b, content: newContent, ...updates } : b));
  };

  const addBlockAfter = (id: string, newType: BlockType = 'paragraph') => {
    const currentBlocks = blocksRef.current;
    const index = currentBlocks.findIndex(b => b.id === id);
    const newBlock: Block = { id: generateId(), type: newType, content: '' };
    const newBlocks = [...currentBlocks];
    newBlocks.splice(index + 1, 0, newBlock);
    setBlocks(newBlocks);
    
    setTimeout(() => {
      blockRefs.current[newBlock.id]?.focus();
    }, 0);
  };

  const removeBlock = (id: string) => {
    const currentBlocks = blocksRef.current;
    if (currentBlocks.length === 1) return;
    
    const index = currentBlocks.findIndex(b => b.id === id);
    const prevBlock = currentBlocks[index - 1];
    
    const newBlocks = currentBlocks.filter(b => b.id !== id);
    setBlocks(newBlocks);
    
    if (prevBlock) {
      setTimeout(() => {
        const el = blockRefs.current[prevBlock.id];
        if (el) {
          el.focus();
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }, 0);
    }
  };

  const openSlashMenu = (id: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    setSlashMenuPos({ top: rect.bottom + window.scrollY + 10, left: rect.left + window.scrollX });
    setSlashMenuOpen(true);
    setSlashMenuIndex(0);
    setCurrentBlockId(id);
  };

  const closeSlashMenu = () => {
    setSlashMenuOpen(false);
    setCurrentBlockId(null);
  };

  const applyBlockType = (type: BlockType) => {
    if (!currentBlockId) return;
    
    setBlocks(blocksRef.current.map(b => b.id === currentBlockId ? { ...b, type, content: '', checked: false } : b));
    closeSlashMenu();
    
    setTimeout(() => {
      const el = blockRefs.current[currentBlockId];
      if (el) {
        el.textContent = '';
        el.focus();
      }
    }, 0);
  };

  const applyBlockTypeToFocused = (type: BlockType) => {
    if (!focusedBlockId) return;
    setBlocks(blocksRef.current.map(b => b.id === focusedBlockId ? { ...b, type, checked: false } : b));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, id: string) => {
    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashMenuIndex((prev) => (prev + 1) % MENU_ITEMS.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashMenuIndex((prev) => (prev - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        applyBlockType(MENU_ITEMS[slashMenuIndex].type as BlockType);
        return;
      }
      if (e.key === 'Escape') {
        closeSlashMenu();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const target = e.target as HTMLDivElement;
      const block = blocksRef.current.find(b => b.id === id);
      
      if (block && (block.type === 'bullet' || block.type === 'checkbox')) {
        if (target.textContent === '') {
          // Si la lista está vacía y presionas Enter, vuelve a ser un párrafo normal
          setBlocks(blocksRef.current.map(b => b.id === id ? { ...b, type: 'paragraph', checked: false } : b));
          return;
        } else {
          // Si tiene texto, continúa la lista con el mismo tipo
          addBlockAfter(id, block.type);
          return;
        }
      }
      
      addBlockAfter(id);
    } else if (e.key === 'Backspace') {
      const target = e.target as HTMLDivElement;
      if (target.textContent === '') {
        e.preventDefault();
        const block = blocksRef.current.find(b => b.id === id);
        if (block && block.type !== 'paragraph') {
          setBlocks(blocksRef.current.map(b => b.id === id ? { ...b, type: 'paragraph', checked: false } : b));
        } else {
          removeBlock(id);
        }
      }
    } else if (e.key === '/') {
      openSlashMenu(id);
    } else if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && slashMenuOpen) {
      if (e.key === ' ') closeSlashMenu();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>, id: string) => {
    const text = e.currentTarget.textContent || '';
    updateBlock(id, text);
    if (!text.includes('/')) closeSlashMenu();
  };

  if (loading) return null;

  return (
    <main className="main-content">
      <div className="top-nav">
        <button className="mobile-menu-btn" onClick={onOpenMenu}><MenuIcon /></button>
        <span>Axon Workspace / {page.title || 'Sin título'}</span>
      </div>
      
      <div className="editor-wrapper animate-fade-in">
        <div 
          className="page-icon-wrapper" 
          onClick={() => {
            const icons = ['🚀', '📄', '📝', '💡', '🔥', '⭐', '📚', '🎯'];
            const nextIcon = icons[(icons.indexOf(page.icon) + 1) % icons.length];
            onUpdatePage(page.id, { icon: nextIcon });
          }}
          title="Haz clic para cambiar el icono"
        >
          {page.icon}
        </div>
        
        <input 
          className="page-title" 
          placeholder="Título sin título"
          value={page.title}
          onChange={(e) => onUpdatePage(page.id, { title: e.target.value })}
        />

        <div className="block-list">
          {blocks.map((block) => (
            <div 
              key={block.id} 
              className={`block-row group ${draggedId === block.id ? 'dragging' : ''} ${dragOverId === block.id ? `drag-over-${dragOverPosition}` : ''} type-${block.type}`}
              draggable={dragEnabledId === block.id}
              onDragStart={(e) => {
                setDraggedId(block.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverId !== block.id) setDragOverId(block.id);
                
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                setDragOverPosition(y < rect.height / 2 ? 'top' : 'bottom');
              }}
              onDragLeave={() => {
                setDragOverId(null);
                setDragOverPosition(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverId(null);
                setDragOverPosition(null);
                setDragEnabledId(null);
                if (!draggedId || draggedId === block.id) return;
                
                const currentBlocks = blocksRef.current;
                const oldIndex = currentBlocks.findIndex(b => b.id === draggedId);
                let newIndex = currentBlocks.findIndex(b => b.id === block.id);
                
                if (dragOverPosition === 'bottom') newIndex++;
                if (oldIndex < newIndex) newIndex--;
                
                const newBlocks = [...currentBlocks];
                const [movedBlock] = newBlocks.splice(oldIndex, 1);
                newBlocks.splice(newIndex, 0, movedBlock);
                setBlocks(newBlocks);
                setDraggedId(null);
              }}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
                setDragEnabledId(null);
              }}
            >
              <div className="block-controls">
                <button className="block-btn" onClick={() => addBlockAfter(block.id)}>
                  <PlusIcon />
                </button>
                <button 
                  className="block-btn"
                  onMouseDown={() => setDragEnabledId(block.id)}
                  onMouseUp={() => setDragEnabledId(null)}
                >
                  <GripIcon />
                </button>
              </div>
              
              {block.type === 'checkbox' && (
                <input 
                  type="checkbox" 
                  className="block-checkbox"
                  checked={block.checked || false} 
                  onChange={(e) => updateBlock(block.id, block.content, { checked: e.target.checked })} 
                />
              )}

              <ContentEditableBlock
                block={block}
                className={block.type === 'checkbox' && block.checked ? 'checked-text' : ''}
                innerRef={el => blockRefs.current[block.id] = el}
                onKeyDown={(e) => handleKeyDown(e, block.id)}
                onInput={(e) => handleInput(e, block.id)}
                onFocus={() => setFocusedBlockId(block.id)}
                onBlur={() => {
                  setTimeout(closeSlashMenu, 200);
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mobile-toolbar">
        <button className="toolbar-btn" onClick={() => applyBlockTypeToFocused('checkbox')}>
          <CheckSquareIcon />
          <span>Tarea</span>
        </button>
        <button className="toolbar-btn" onClick={() => applyBlockTypeToFocused('h1')}>
          <Heading1Icon />
          <span>Título</span>
        </button>
        <button className="toolbar-btn" onClick={() => applyBlockTypeToFocused('bullet')}>
          <BulletIcon />
          <span>Lista</span>
        </button>
        <button className="toolbar-btn" onClick={() => {
           const newId = generateId();
           setBlocks([...blocksRef.current, { id: newId, type: 'paragraph', content: '' }]);
           setTimeout(() => blockRefs.current[newId]?.focus(), 0);
        }}>
          <PlusIcon />
          <span>Texto</span>
        </button>
      </div>

      {slashMenuOpen && (
        <div className="slash-menu" style={{ top: slashMenuPos.top, left: slashMenuPos.left }}>
          <div className="slash-menu-header">Bloques Básicos</div>
          {MENU_ITEMS.map((item, i) => (
            <div 
              key={item.type}
              className={`slash-menu-item ${i === slashMenuIndex ? 'selected' : ''}`}
              onMouseEnter={() => setSlashMenuIndex(i)}
              onClick={() => applyBlockType(item.type as BlockType)}
            >
              <div className="slash-menu-icon">{item.icon}</div>
              <div className="slash-menu-text">
                <span className="slash-menu-title">{item.title}</span>
                <span className="slash-menu-desc">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

// Initial LocalStorage Migration to PouchDB for Pages
const migratePages = async () => {
  try {
    await localDB.get('axon-pages');
  } catch (e: any) {
    if (e.name === 'not_found') {
      const localPages = localStorage.getItem('axon-pages');
      const defaultPage = { id: 'page-default', title: 'Mi Primera Página', icon: '🚀' };
      
      let pages = localPages ? JSON.parse(localPages) : [defaultPage];
      await localDB.put({ _id: 'axon-pages', data: pages });
      
      if (!localPages) {
        const localBlocks = localStorage.getItem('axon-blocks-page-default');
        if (localBlocks) {
          await localDB.put({ _id: 'axon-blocks-page-default', data: JSON.parse(localBlocks) });
        }
      }
    }
  }
};
migratePages();

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pages, setPages, loading] = usePouchDB<Page[]>('axon-pages', [{ id: 'page-default', title: 'Mi Primera Página', icon: '🚀' }]);

  const [currentPageId, setCurrentPageId] = useState<string>(() => {
    return localStorage.getItem('axon-current-page') || 'page-default';
  });

  useEffect(() => {
    if (!loading && pages.length > 0 && !pages.find(p => p.id === currentPageId)) {
      setCurrentPageId(pages[0].id);
    }
  }, [pages, loading, currentPageId]);

  useEffect(() => {
    localStorage.setItem('axon-current-page', currentPageId);
  }, [currentPageId]);

  const handleUpdatePage = (id: string, updates: Partial<Page>) => {
    setPages(pages.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleCreatePage = () => {
    const newPage: Page = { id: `page-${generateId()}`, title: '', icon: '📄' };
    setPages([...pages, newPage]);
    setCurrentPageId(newPage.id);
  };

  const handleDeletePage = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (pages.length === 1) return;
    
    const newPages = pages.filter(p => p.id !== id);
    setPages(newPages);
    
    if (currentPageId === id) {
      setCurrentPageId(newPages[0].id);
    }
    
    try {
      const doc = await localDB.get(`axon-blocks-${id}`);
      await localDB.remove(doc);
    } catch (err) {}
  };

  const currentPage = pages.find(p => p.id === currentPageId) || pages[0];

  return (
    <div className="app-container">
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>
      
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div style={{ width: 20, height: 20, background: 'var(--accent-color)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 12 }}>A</div>
          <span>Axon Workspace</span>
        </div>
        
        <div className="sidebar-nav">
          <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Páginas Privadas
          </div>
          
          {pages.map((page) => (
            <div 
              key={page.id}
              className={`sidebar-item ${currentPageId === page.id ? 'active' : ''}`}
              onClick={() => {
                setCurrentPageId(page.id);
                setSidebarOpen(false);
              }}
            >
              <span>{page.icon}</span>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {page.title || 'Sin título'}
              </span>
              {pages.length > 1 && (
                <button 
                  onClick={(e) => handleDeletePage(e, page.id)}
                  style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.5 }}
                  title="Eliminar página"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          ))}

          <div className="sidebar-item" onClick={handleCreatePage} style={{ marginTop: 8 }}>
            <PlusIcon />
            <span>Añadir página</span>
          </div>
        </div>
      </aside>

      {currentPage && !loading && (
        <Editor 
          key={currentPage.id} 
          page={currentPage} 
          onUpdatePage={handleUpdatePage} 
          onOpenMenu={() => setSidebarOpen(true)}
        />
      )}
    </div>
  );
}

export default App;
