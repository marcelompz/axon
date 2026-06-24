import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';

const generateId = () => Math.random().toString(36).substring(2, 9);

type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet';

interface Block {
  id: string;
  type: BlockType;
  content: string;
}

interface Page {
  id: string;
  title: string;
  icon: string;
}

// SVG Icons
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const GripIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>;
const TextIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>;
const Heading1Icon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h8"></path><path d="M4 18V6"></path><path d="M12 18V6"></path><path d="M17 12h4"></path><path d="M21 18V6"></path></svg>;
const BulletIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const FileIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;


interface ContentEditableBlockProps {
  block: Block;
  innerRef: (el: HTMLDivElement | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onInput: (e: React.FormEvent<HTMLDivElement>) => void;
  onBlur: () => void;
}

const ContentEditableBlock = React.memo(({ block, innerRef, onKeyDown, onInput, onBlur }: ContentEditableBlockProps) => {
  const contentRef = useRef(block.content);

  return (
    <div 
      ref={innerRef}
      className="block-content"
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
    >
      {contentRef.current}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.block.type === nextProps.block.type && prevProps.block.id === nextProps.block.id;
});

function Editor({ page, onUpdatePage }: { page: Page, onUpdatePage: (id: string, updates: Partial<Page>) => void }) {
  const [blocks, setBlocks] = useState<Block[]>(() => {
    const saved = localStorage.getItem(`axon-blocks-${page.id}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [{ id: generateId(), type: 'paragraph', content: '' }];
  });
  
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  useEffect(() => {
    localStorage.setItem(`axon-blocks-${page.id}`, JSON.stringify(blocks));
  }, [blocks, page.id]);
  
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);

  const [dragEnabledId, setDragEnabledId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom' | null>(null);

  const blockRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const MENU_ITEMS = [
    { type: 'paragraph', title: 'Texto', desc: 'Comienza a escribir con texto plano.', icon: <TextIcon /> },
    { type: 'h1', title: 'Título 1', desc: 'Título de sección grande.', icon: <Heading1Icon /> },
    { type: 'h2', title: 'Título 2', desc: 'Título de sección mediano.', icon: <Heading1Icon /> },
    { type: 'h3', title: 'Título 3', desc: 'Título de sección pequeño.', icon: <Heading1Icon /> },
    { type: 'bullet', title: 'Lista de viñetas', desc: 'Crea una lista con viñetas simple.', icon: <BulletIcon /> },
  ] as const;

  const updateBlock = (id: string, newContent: string) => {
    setBlocks(blocksRef.current.map(b => b.id === id ? { ...b, content: newContent } : b));
  };

  const addBlockAfter = (id: string) => {
    const currentBlocks = blocksRef.current;
    const index = currentBlocks.findIndex(b => b.id === id);
    const newBlock: Block = { id: generateId(), type: 'paragraph', content: '' };
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

  const openSlashMenu = (e: React.KeyboardEvent | React.ChangeEvent, id: string) => {
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
    
    setBlocks(blocksRef.current.map(b => b.id === currentBlockId ? { ...b, type, content: '' } : b));
    closeSlashMenu();
    
    setTimeout(() => {
      const el = blockRefs.current[currentBlockId];
      if (el) {
        el.textContent = '';
        el.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, id: string) => {
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
      addBlockAfter(id);
    } else if (e.key === 'Backspace') {
      const target = e.target as HTMLDivElement;
      if (target.textContent === '') {
        e.preventDefault();
        const block = blocksRef.current.find(b => b.id === id);
        if (block && block.type !== 'paragraph') {
          setBlocks(blocksRef.current.map(b => b.id === id ? { ...b, type: 'paragraph' } : b));
        } else {
          removeBlock(id);
        }
      }
    } else if (e.key === '/') {
      openSlashMenu(e, id);
    } else if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && slashMenuOpen) {
      if (e.key === ' ') closeSlashMenu();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>, id: string) => {
    const text = e.currentTarget.textContent || '';
    updateBlock(id, text);
    if (!text.includes('/')) closeSlashMenu();
  };

  return (
    <main className="main-content">
      <div className="top-nav">
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
              className={`block-row group ${draggedId === block.id ? 'dragging' : ''} ${dragOverId === block.id ? `drag-over-${dragOverPosition}` : ''}`}
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
              
              <ContentEditableBlock
                block={block}
                innerRef={el => blockRefs.current[block.id] = el}
                onKeyDown={(e) => handleKeyDown(e, block.id)}
                onInput={(e) => handleInput(e, block.id)}
                onBlur={() => {
                  setTimeout(closeSlashMenu, 200);
                }}
              />
            </div>
          ))}
        </div>
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

function App() {
  const [pages, setPages] = useState<Page[]>(() => {
    const saved = localStorage.getItem('axon-pages');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    
    // Migración transparente si venían de la versión de 1 sola página
    const oldTitle = localStorage.getItem('axon-title');
    const oldBlocks = localStorage.getItem('axon-blocks');
    const defaultPage: Page = { id: 'page-default', title: oldTitle || 'Mi Primera Página', icon: '🚀' };
    
    if (oldBlocks) {
      localStorage.setItem(`axon-blocks-page-default`, oldBlocks);
      localStorage.removeItem('axon-blocks');
      localStorage.removeItem('axon-title');
    }
    
    return [defaultPage];
  });

  const [currentPageId, setCurrentPageId] = useState<string>(() => {
    return localStorage.getItem('axon-current-page') || pages[0]?.id || 'page-default';
  });

  useEffect(() => {
    localStorage.setItem('axon-pages', JSON.stringify(pages));
  }, [pages]);

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

  const handleDeletePage = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Evitar que seleccione la página al hacer click en borrar
    if (pages.length === 1) return; // No borrar la última
    
    const newPages = pages.filter(p => p.id !== id);
    setPages(newPages);
    
    // Si borramos la que estaba activa, cambiar a otra
    if (currentPageId === id) {
      setCurrentPageId(newPages[0].id);
    }
    
    // Limpiar bloques huérfanos
    localStorage.removeItem(`axon-blocks-${id}`);
  };

  const currentPage = pages.find(p => p.id === currentPageId) || pages[0];

  return (
    <div className="app-container">
      <aside className="sidebar">
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
              onClick={() => setCurrentPageId(page.id)}
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

      {/* Editor component with key to completely unmount and remount state when switching pages */}
      {currentPage && (
        <Editor 
          key={currentPage.id} 
          page={currentPage} 
          onUpdatePage={handleUpdatePage} 
        />
      )}
    </div>
  );
}

export default App;
