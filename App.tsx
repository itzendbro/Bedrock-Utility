import React, { useState, useEffect } from 'react';
import { GeneratedFile, UploadedFile, AssetMapping } from './types';
import Header from './components/Header';
import Home from './components/Home';
import ModeHome from './components/ModeHome';
import AddonCreator from './components/AddonCreator';
import ItemCreator from './components/ItemCreator';
import AddonCombiner from './components/AddonCombiner';
import AddonFixer from './components/AddonFixer';
import AddonDev from './components/AddonDev';
import FunctionWriter from './components/FunctionWriter';
import CommandHelper from './components/CommandHelper';
import BuildingHelper from './components/BuildingHelper';
import Chatbot from './components/Chatbot';
import ExplorerView from './components/ExplorerView';
import StatusBar from './components/StatusBar';
import McaddonConverter from './components/McaddonConverter';
import AddonSummarizer from './components/AddonSummarizer';
import NotificationContainer from './components/NotificationContainer';
import CraftingRecipeEditor from './components/CraftingRecipeEditor';
import SoundAdder from './components/SoundAdder';
import TextureGenerator from './components/TextureGenerator';
import TradeEditor from './components/TradeEditor';
import { useNotification } from './contexts/NotificationContext';
import ManifestCreator from './components/ManifestCreator';
import SplashCreator from './components/SplashCreator';
import Login from './components/Login';

const THEMES = ['dark', 'light', 'high-contrast', 'solarized-dark', 'monokai', 'nord'];

const homeTab = { id: 'home', name: 'Home', icon: '🏠' };

const automaticModeTab = { id: 'automatic_mode', name: 'Automatic AI Mode', icon: '🚀' };
const manualModeTab = { id: 'manual_mode', name: 'Manual Mode', icon: '✍️' };

const automaticTools = [
    { id: 'create', name: 'Addon Creator', icon: '✨', description: 'Create addons from a simple prompt, a detailed plan, or complex script logic.' },
    { id: 'texture', name: 'AI Texture Generator', icon: '🖼️', description: 'Create high-quality textures using a simple text prompt.' },
    { id: 'fix', name: 'Addon Fixer', icon: '🛠️', description: 'Automatically repair broken add-ons and update outdated add-ons to the latest game version.' },
    { id: 'summary', name: 'Addon Summary', icon: '📊', description: 'Get a detailed summary, compatibility and error report for any addon.' },
    { id: 'combine', name: 'Combine', icon: '🔗', description: 'Merge multiple addons into a single, functional pack, automatically resolving conflicts.' },
    { id: 'mcaddon', name: 'Pack Converter', icon: '📦', description: 'Convert resource and behavior packs into a single, easy-to-install .mcaddon file.' },
    { id: 'develop', name: 'Develop', icon: '🤖', description: 'Load an existing addon and use AI to refactor, add features, or fix bugs.' },
    { id: 'command', name: 'Commands', icon: '💬', description: 'A chatbot expert for generating any Minecraft Bedrock command you need.' },
    { id: 'building', name: 'Building', icon: '🏡', description: 'Get visual inspiration for your builds by generating images from a description.' },
    { id: 'chatbot', name: 'Chatbot', icon: '❓', description: 'Your go-to expert for any Minecraft-related questions, with real-time web access.' },
];

const manualTools = [
    { id: 'item_creator', name: 'Item Creator', icon: '⚔️', description: 'Create custom items with 2D or 3D models using a simple form.' },
    { id: 'manifest_creator', name: 'Manifest Creator', icon: '📜', description: 'Generate manifest.json files for resource, behavior packs and skin packs.' },
    { id: 'splash_creator', name: 'Splash Creator', icon: '💦', description: 'Create custom splash texts that appear on Minecraft Bedrock main menu.' },
    { id: 'function', name: 'Function', icon: '⚙️', description: 'Create .mcfunction files by entering commands.' },
    { id: 'crafting', name: 'Crafting', icon: '🔨', description: 'Create your own crafting recipes.' },
    { id: 'trades', name: 'Trades', icon: '🔁', description: 'Design custom villager trade tables for your NPCs.' },
    { id: 'sounds', name: 'Sounds', icon: '🎵', description: 'Easily package custom .ogg sound files into a complete resource pack.' },
];

const ALL_TOOLS_MAP = [...automaticTools, ...manualTools, homeTab, automaticModeTab, manualModeTab].reduce((acc, tool) => {
    acc[tool.id] = tool;
    return acc;
}, {} as { [key: string]: { id: string, name: string, icon: string }});


const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeView, setActiveView] = useState('home');
  const [activityBarMode, setActivityBarMode] = useState<'home' | 'automatic' | 'manual'>('home');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [assetMappings, setAssetMappings] = useState<AssetMapping[]>([]);
  const [addonName, setAddonName] = useState('');
  const [theme, setTheme] = useState(localStorage.getItem('addon-gen-theme') || 'dark');
  const { addNotification } = useNotification();

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('addon-gen-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (sessionStorage.getItem('isAuthenticated') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLoginSuccess = () => {
    sessionStorage.setItem('isAuthenticated', 'true');
    setIsAuthenticated(true);
  };

  const handleThemeChange = () => {
    const currentIndex = THEMES.indexOf(theme);
    const nextIndex = (currentIndex + 1) % THEMES.length;
    setTheme(THEMES[nextIndex]);
  };
  
  const handleViewChange = (viewId: string) => {
    // Handle top-level navigation and mode switching
    if (viewId === 'home') {
        setActivityBarMode('home');
        setActiveView('home');
        return;
    }
    if (viewId === 'automatic_mode') {
        setActivityBarMode('automatic');
        setActiveView('automatic_mode_home');
        return;
    }
    if (viewId === 'manual_mode') {
        setActivityBarMode('manual');
        setActiveView('manual_mode_home');
        return;
    }

    // Handle tool selection
    const isAutomaticTool = automaticTools.some(t => t.id === viewId);
    const isManualTool = manualTools.some(t => t.id === viewId);

    if (isAutomaticTool) {
        setActivityBarMode('automatic');
    } else if (isManualTool) {
        setActivityBarMode('manual');
    }

    if (activeView === viewId) {
        setSidebarVisible(!sidebarVisible);
    } else {
        setActiveView(viewId);
        setSidebarVisible(true);
    }
  };

  const handleGenerationComplete = (
    newGeneratedFiles: GeneratedFile[],
    newUploadedFiles: UploadedFile[],
    newAssetMappings: AssetMapping[],
    newAddonName: string
  ) => {
    setGeneratedFiles(newGeneratedFiles);
    setUploadedFiles(newUploadedFiles);
    setAssetMappings(newAssetMappings);
    setAddonName(newAddonName);
    if (newGeneratedFiles.length > 0) {
      setActivityBarMode('automatic');
      handleViewChange('develop');
    }
  };

  const handleLoadFilesForDev = (
    newGeneratedFiles: GeneratedFile[],
    newUploadedFiles: UploadedFile[],
    newAddonName: string
  ) => {
    setGeneratedFiles(newGeneratedFiles);
    setUploadedFiles(newUploadedFiles);
    setAssetMappings([]); // Reset asset mappings as they are not relevant for dev loading
    setAddonName(newAddonName);
    if (newGeneratedFiles.length > 0) {
        setActivityBarMode('automatic');
        setActiveView('develop');
        setSidebarVisible(true);
    }
  }

  const renderSidebarContent = () => {
    switch (activeView) {
      case 'combine':
        return <AddonCombiner onGenerationComplete={handleGenerationComplete} />;
      case 'fix':
        return <AddonFixer onGenerationComplete={handleGenerationComplete} />;
      case 'develop':
        return <AddonDev files={generatedFiles} onFilesUpdate={setGeneratedFiles} onLoadFiles={handleLoadFilesForDev} />;
      // Tools that render in the main panel don't need sidebar content
      case 'home':
      case 'automatic_mode_home':
      case 'manual_mode_home':
      case 'create':
      case 'item_creator':
      case 'manifest_creator':
      case 'function':
      case 'command':
      case 'building':
      case 'chatbot':
      case 'mcaddon':
      case 'summary':
      case 'crafting':
      case 'trades':
      case 'sounds':
      case 'texture':
      case 'splash_creator':
      default:
        return null; 
    }
  };

  const renderMainContent = () => {
    const toolRequiresExplorer = ['combine', 'fix', 'develop'].includes(activeView);

    if (toolRequiresExplorer) {
      return (
        <ExplorerView
          files={generatedFiles}
          uploadedFiles={uploadedFiles}
          assetMappings={assetMappings}
          addonName={addonName}
          onFilesUpdate={setGeneratedFiles}
        />
      );
    }

    // Render standalone tools in the main panel
    switch (activeView) {
      case 'home':
        return <Home onToolSelect={handleViewChange} />;
      case 'automatic_mode_home':
        return <ModeHome title="Automatic AI Mode" tools={automaticTools} onToolSelect={handleViewChange} onGoBack={() => handleViewChange('home')} />;
      case 'manual_mode_home':
        return <ModeHome title="Manual Mode" tools={manualTools} onToolSelect={handleViewChange} onGoBack={() => handleViewChange('home')} />;
      case 'create':
        return <div className="p-6 overflow-y-auto"><AddonCreator onGenerationComplete={handleGenerationComplete} /></div>;
      case 'item_creator':
        return <div className="p-6 overflow-y-auto"><ItemCreator onGenerationComplete={handleGenerationComplete} /></div>;
      case 'function':
        return <div className="p-6 overflow-y-auto"><FunctionWriter /></div>;
      case 'command':
        return <div className="p-6 h-full flex flex-col"><CommandHelper /></div>;
      case 'building':
        return <div className="p-6 overflow-y-auto"><BuildingHelper /></div>;
      case 'texture':
          return <TextureGenerator />; // This tool manages its own padding
      case 'crafting':
          return <div className="p-6 overflow-y-auto"><CraftingRecipeEditor /></div>;
      case 'trades':
          return <div className="p-6 overflow-y-auto"><TradeEditor /></div>;
      case 'sounds':
          return <div className="p-6 overflow-y-auto"><SoundAdder /></div>;
      case 'chatbot':
          return <div className="p-6 h-full flex flex-col"><Chatbot /></div>;
      case 'mcaddon':
          return <div className="p-6 overflow-y-auto"><McaddonConverter /></div>;
      case 'summary':
          return <div className="p-6 overflow-y-auto"><AddonSummarizer /></div>;
      case 'manifest_creator':
          return <div className="p-6 overflow-y-auto"><ManifestCreator /></div>;
      case 'splash_creator':
          return <div className="p-6 overflow-y-auto"><SplashCreator /></div>;
      default:
        return <Home onToolSelect={handleViewChange} />;
    }
  };
  
  const sidebarContent = renderSidebarContent();

  const getCurrentTabs = () => {
    switch (activityBarMode) {
        case 'automatic':
            return [homeTab, automaticModeTab, ...automaticTools];
        case 'manual':
            return [homeTab, manualModeTab, ...manualTools];
        case 'home':
        default:
            return [homeTab, automaticModeTab, manualModeTab];
    }
  }

  const isTabActive = (tabId: string) => {
    if (activeView === tabId) return true;
    if (tabId === 'automatic_mode' && activeView === 'automatic_mode_home') return true;
    if (tabId === 'manual_mode' && activeView === 'manual_mode_home') return true;
    return false;
  }
  
  const currentTabs = getCurrentTabs();

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-200">
      <Header theme={theme} onThemeChange={handleThemeChange} onGoHome={() => handleViewChange('home')} />
      <div className="flex flex-grow overflow-hidden">
        {/* Activity Bar */}
        <nav className="w-16 bg-[var(--bg-panel-secondary)] border-r border-[var(--border-primary)] flex flex-col items-center py-4 gap-2 flex-shrink-0 overflow-y-auto">
          <div key={activityBarMode} className="flex flex-col items-center gap-2">
            {currentTabs.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => handleViewChange(tab.id)}
                title={tab.name}
                className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg transition-colors duration-200 flex-shrink-0 ${
                  isTabActive(tab.id)
                    ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
                style={{ animation: `activity-bar-item-enter 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${index * 50}ms both` }}
              >
                <span className="text-2xl">{tab.icon}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Responsive Wrapper for Sidebar and Main Content */}
        <div className="flex-grow flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
          {/* Sidebar */}
          {sidebarVisible && sidebarContent && (
            <aside className="w-full md:w-[450px] lg:w-[500px] flex-shrink-0 bg-[var(--bg-panel)] md:border-r border-b md:border-b-0 border-[var(--border-primary)] flex flex-col">
              <div className="p-6 border-b border-[var(--border-primary)] flex-shrink-0">
                <h2 className="text-xl font-bold flex items-center gap-3">
                  <span className="text-2xl">{ALL_TOOLS_MAP[activeView]?.icon}</span>
                  {ALL_TOOLS_MAP[activeView]?.name} Tool
                </h2>
              </div>
              <div className="flex-grow p-6 overflow-y-auto">
                {sidebarContent}
              </div>
            </aside>
          )}
          
          {/* Main Content */}
          <main className="flex-grow flex flex-col overflow-y-auto">
              {renderMainContent()}
          </main>
        </div>
      </div>
      <StatusBar addonName={addonName} fileCount={generatedFiles.length} />
      <NotificationContainer />
    </div>
  );
};

export default App;