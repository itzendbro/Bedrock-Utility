import React, { useMemo, useState, useEffect } from 'react';
import { GeneratedFile } from '../types';

interface FileExplorerProps {
  files: GeneratedFile[];
  selectedFile: GeneratedFile | null;
  onSelectFile: (file: GeneratedFile) => void;
}

// Tree node structure used internally
interface TreeNode {
  name: string;
  file?: GeneratedFile;
  children?: Tree;
}
interface Tree {
  [key: string]: TreeNode;
}

const ChevronIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
    <svg className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
);

const FolderIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[var(--accent-yellow)] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        {isOpen ? (
            <>
                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H2V6z" clipRule="evenodd" />
                <path d="M2 8v8a2 2 0 002 2h12a2 2 0 002-2V8H2z" />
            </>
        ) : (
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        )}
    </svg>
);


const FileIcon: React.FC<{ name: string; }> = ({ name }) => {
    const iconClass = "w-4 text-center flex-shrink-0";
    if (name.endsWith('.json')) return <span className={iconClass} style={{color: 'var(--accent-yellow)'}}>{"{ }"}</span>;
    if (name.endsWith('.js') || name.endsWith('.tsx')) return <span className={`${iconClass} font-bold text-xs`} style={{color: '#ffd700'}}>JS</span>;
    if (name.endsWith('.mcfunction')) return <span className={iconClass}>⚙️</span>;
    if (name.endsWith('.lang')) return <span className={iconClass}>🌐</span>;
    if (/\.(png|jpe?g|gif|tga)$/i.test(name)) return <span className={iconClass}>🖼️</span>;
  
    return <span className={`${iconClass} text-[var(--text-tertiary)]`}>📄</span>;
};


const FileExplorer: React.FC<FileExplorerProps> = ({ files, selectedFile, onSelectFile }) => {
  const [openFolders, setOpenFolders] = useState(new Set<string>());

  const fileTree = useMemo(() => {
    const tree: Tree = {};

    files.forEach(file => {
      let currentLevel = tree;
      const pathParts = file.path.split('/');
      pathParts.forEach((part, index) => {
        if (index < pathParts.length - 1) { // It's a folder
          if (!currentLevel[part]) {
            currentLevel[part] = { name: part, children: {} };
          }
          currentLevel = currentLevel[part].children!;
        } else { // It's a file
          currentLevel[part] = { name: part, file };
        }
      });
    });
    return tree;
  }, [files]);

  useEffect(() => {
    const initialOpenFolders = new Set<string>();
    files.forEach(file => {
        const pathParts = file.path.split('/');
        for (let i = 1; i < pathParts.length; i++) {
            initialOpenFolders.add(pathParts.slice(0, i).join('/'));
        }
    });
    setOpenFolders(initialOpenFolders);
}, [files]);

  const toggleFolder = (path: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderTree = (tree: Tree, pathPrefix: string = '', level: number = 0) => {
    const entries = Object.values(tree).sort((a, b) => {
        if (a.children && !b.children) return -1;
        if (!a.children && b.children) return 1;
        return a.name.localeCompare(b.name);
    });

    return entries.map(node => {
      const currentPath = pathPrefix ? `${pathPrefix}/${node.name}` : node.name;
      const isFolder = !!node.children;
      const isOpen = openFolders.has(currentPath);

      if (isFolder) {
        return (
          <div key={currentPath}>
            <div
              onClick={() => toggleFolder(currentPath)}
              className="flex items-center gap-1 py-0.5 rounded-md cursor-pointer hover:bg-[var(--bg-hover)]"
              style={{ paddingLeft: `${level * 12}px` }}
            >
              <ChevronIcon isOpen={isOpen} />
              <FolderIcon isOpen={isOpen} />
              <span className="text-sm text-[var(--text-primary)] truncate ml-1">{node.name}</span>
            </div>
            {isOpen && renderTree(node.children!, currentPath, level + 1)}
          </div>
        );
      } else {
        return (
          <div
            key={currentPath}
            onClick={() => onSelectFile(node.file!)}
            title={currentPath}
            className={`flex items-center gap-1.5 py-0.5 rounded-md cursor-pointer ${selectedFile?.path === node.file?.path ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'}`}
            style={{ paddingLeft: `${(level * 12) + 16}px` }}
          >
            <FileIcon name={node.name} />
            <span className={`text-sm truncate ${selectedFile?.path === node.file?.path ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{node.name}</span>
          </div>
        );
      }
    });
  };

  if (files.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-[var(--text-secondary)]">
        No files generated yet.
      </div>
    );
  }

  return (
    <div className="p-2 flex flex-col gap-0.5">
      {renderTree(fileTree)}
    </div>
  );
};

export default FileExplorer;