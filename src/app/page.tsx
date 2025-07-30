
"use client";

import { useState, useRef, useCallback, type ChangeEvent, useMemo, useEffect } from "react";
import {
  BrainCircuit,
  Plus,
  Link2,
  Trash2,
  Download,
  Upload,
  Loader2,
  Palette,
  ChevronUp,
  ChevronDown,
  Folder,
  Paintbrush,
  Sun,
  Moon,
  PanelBottom,
  PanelBottomClose,
  Type,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { MindMapNode, MindMapLink } from "@/lib/types";
import { suggestConcepts } from "@/ai/flows/suggest-concepts";
import { storage } from "@/lib/firebase";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const hslToHex = (h: number, s: number, l: number): string => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');   // convert to Hex and prefix "0" if needed
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

const hexToHsl = (hex: string): { h: number, s: number, l: number } => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex[1] + hex[2], 16);
        g = parseInt(hex[3] + hex[4], 16);
        b = parseInt(hex[5] + hex[6], 16);
    }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const wrapText = (text: string, charsPerLine: number) => {
    const lines: string[] = [];
    if (!text) return lines;
    for (let i = 0; i < text.length; i += charsPerLine) {
        lines.push(text.substring(i, i + charsPerLine));
    }
    return lines;
};

const initialNodes: MindMapNode[] = [
  {
    id: "1",
    x: 20,
    y: 20,
    text: "Central Idea",
    type: "folder",
    color: "#60a5fa",
    width: 150,
    height: 30,
    textColor: "#FFFFFF",
  },
];

const initialLinks: MindMapLink[] = [];

const defaultGlobalSettings = {
    canvasColor: "#0D0D0D",
    nodeTextColor: "#FFFFFF",
    iconOffsetX: 0,
    iconOffsetY: 0,
    theme: {
        backgroundHsl: "0 0% 5%",
        foregroundHsl: "210 40% 98%",
        primaryHsl: "308 30% 27%",
        accentHsl: "240 10% 80%",
        borderHsl: "308 30% 27%",
    }
}

export default function MindMapEditor() {
  const { toast } = useToast();
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [links, setLinks] = useState<MindMapLink[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [linkingState, setLinkingState] = useState<{ sourceId: string } | null>(
    null
  );
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [theme, setTheme] = useState("dark");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(true);
  const [globalSettings, setGlobalSettings] = useState(defaultGlobalSettings);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const db = getFirestore(storage.app);
  const mindMapDocRef = doc(db, "mindmaps", "main");

  const saveData = useCallback(async (nodesToSave: MindMapNode[], linksToSave: MindMapLink[]) => {
      if (!isLoaded) return;
      try {
        await setDoc(mindMapDocRef, { nodes: nodesToSave, links: linksToSave, globalSettings });
      } catch (error) {
        console.error("Error saving mind map:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not save changes to the cloud.",
        });
      }
  }, [mindMapDocRef, toast, isLoaded, globalSettings]);

  useEffect(() => {
    const loadData = async () => {
        try {
            const docSnap = await getDoc(mindMapDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setNodes(data.nodes || initialNodes);
                setLinks(data.links || initialLinks);
                setGlobalSettings(data.globalSettings || defaultGlobalSettings);
            } else {
                setNodes(initialNodes);
                setLinks(initialLinks);
                setGlobalSettings(defaultGlobalSettings);
            }
        } catch (error) {
            console.error("Error loading mind map:", error);
            setNodes(initialNodes);
            setLinks(initialLinks);
             toast({
                variant: "destructive",
                title: "Load Error",
                description: "Could not load data from the cloud.",
            });
        } finally {
            setIsLoaded(true);
        }
    };
    loadData();
  }, []);

  useEffect(() => {
    if(isLoaded) {
        saveData(nodes, links);
    }
  }, [nodes, links, globalSettings, saveData, isLoaded]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const root = document.documentElement;
        const { backgroundHsl, foregroundHsl, primaryHsl, accentHsl, borderHsl } = globalSettings.theme;

        const setVar = (name: string, value: string) => {
             if (!value) return;
             const [h, s, l] = value.split(' ').map(v => v.replace('%', ''));
             root.style.setProperty(name, `${h} ${s}% ${l}%`);
             if (name === '--background') {
                 root.style.setProperty('--card', `${h} ${s}% ${l}%`);
                 root.style.setProperty('--popover', `${h} ${s}% ${l}%`);
             }
             if (name === '--foreground') {
                  root.style.setProperty('--card-foreground', `${h} ${s}% ${l}%`);
                  root.style.setProperty('--popover-foreground', `${h} ${s}% ${l}%`);
             }
        }
        setVar('--background', backgroundHsl);
        setVar('--foreground', foregroundHsl);
        if (primaryHsl) setVar('--primary', primaryHsl);
        setVar('--accent', accentHsl);
        setVar('--border', borderHsl);
        root.style.setProperty('--input', borderHsl);
    }
  }, [globalSettings.theme]);


  useEffect(() => {
    const savedTheme = "dark";
    setTheme(savedTheme);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };
  
  const handleUpdateGlobalSettings = (newSettings: Partial<typeof globalSettings>) => {
    setGlobalSettings(prev => ({ ...prev, ...newSettings }));
  };

  const handleUpdateThemeColor = (colorName: keyof typeof globalSettings.theme, hexValue: string) => {
    const { h, s, l } = hexToHsl(hexValue);
    const hslString = `${h} ${s}% ${l}%`;
    setGlobalSettings(prev => ({
        ...prev,
        theme: {
            ...prev.theme,
            [colorName]: hslString
        }
    }));
  };
  
  const getHexFromHsl = (hslString: string) => {
      if (!hslString) return '#000000';
      const [h, s, l] = hslString.split(' ').map(v => parseFloat(v.replace('%', '')));
      return hslToHex(h, s, l);
  }

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId), [nodes, selectedNodeId]);

  const toggleNodeCollapse = (nodeId: string) => {
    setNodes(prevNodes => 
        prevNodes.map(n => 
            n.id === nodeId && n.type === 'folder' 
            ? { ...n, isCollapsed: !n.isCollapsed } 
            : n
        )
    );
  };
  
  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();

    if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
        toggleNodeCollapse(nodeId);
    } else {
        clickTimeoutRef.current = setTimeout(() => {
            if (linkingState) {
                if (linkingState.sourceId !== nodeId) {
                    setLinks((prev) => [
                        ...prev,
                        {
                            id: `l-${Date.now()}`,
                            sourceId: linkingState.sourceId,
                            targetId: nodeId,
                        },
                    ]);
                }
                setLinkingState(null);
            } else {
                setSelectedNodeId(nodeId);
            }
            clickTimeoutRef.current = null;
        }, 250);
    }
  };

  const getDescendantIds = useCallback((nodeId: string): string[] => {
    const directChildren = links.filter(l => l.sourceId === nodeId).map(l => l.targetId);
    let allDescendants = [...directChildren];
    directChildren.forEach(childId => {
        allDescendants = [...allDescendants, ...getDescendantIds(childId)];
    });
    return allDescendants;
  }, [links]);
  
  const { visibleNodes, visibleLinks } = useMemo(() => {
    let reorderedVisibleNodes: MindMapNode[] = [];
    const hiddenNodeIds = new Set<string>();
  
    nodes.forEach(node => {
        if (node.isCollapsed) {
            const descendants = getDescendantIds(node.id);
            descendants.forEach(id => hiddenNodeIds.add(id));
        }
    });

    const currentVisibleNodes = nodes.map(n => {
        if (n.type === 'canvas') {
            const lines = wrapText(n.text, 12).length || 1;
            const newHeight = Math.max(60, lines * 20 + 20); // Base height + padding
            return {...n, height: newHeight};
        }
        return n;
    }).filter(n => !hiddenNodeIds.has(n.id));

    const visibleNodeIds = new Set(currentVisibleNodes.map(n => n.id));
    const finalVisibleLinks = links.filter(l => visibleNodeIds.has(l.sourceId) && visibleNodeIds.has(l.targetId));
    
    const rootNodes = currentVisibleNodes.filter(n => !links.some(l => l.targetId === n.id));
    
    let currentY = 20;
    const nodeGap = 20;
    const indent = 40;

    function processNode(node: MindMapNode, x: number): void {
        if (hiddenNodeIds.has(node.id)) return;
        
        const nodeWithNewPosition = { ...node, x, y: currentY };
        reorderedVisibleNodes.push(nodeWithNewPosition);
        
        currentY += node.height + nodeGap;
        
        if (!node.isCollapsed) {
            const children = links
                .filter(l => l.sourceId === node.id)
                .map(l => currentVisibleNodes.find(n => n.id === l.targetId))
                .filter((n): n is MindMapNode => !!n);
            
            children.forEach(child => {
                processNode(child, x + indent);
            });
        }
    }

    rootNodes.forEach(rootNode => {
        processNode(rootNode, 20);
    });

    return { visibleNodes: reorderedVisibleNodes, visibleLinks: finalVisibleLinks };
  }, [nodes, links, getDescendantIds]);

  const handleAddNode = (type: 'folder' | 'canvas') => {
    let newNode: MindMapNode;
    let newLink: MindMapLink | null = null;
  
    const parentNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;
    const nodeWidth = 150;
    const nodeGap = 20;
    const indent = 40;

    let newX: number;
    let newY: number;

    const folderHeight = 30;
    const canvasHeight = 60;
    
    if (type === 'folder') {
      const lastNode = visibleNodes.length > 0 ? visibleNodes[visibleNodes.length - 1] : null;
      newY = lastNode ? lastNode.y + lastNode.height + nodeGap : 20;

      if (parentNode && parentNode.type === 'folder') { // creating a child folder
        newX = parentNode.x + indent;
      } else { // creating a root folder
        newX = 20;
      }
      
      newNode = {
        id: `n-${Date.now()}`,
        x: newX,
        y: newY,
        text: "New Folder",
        type: "folder",
        color: "#60a5fa",
        width: nodeWidth,
        height: folderHeight,
        textColor: globalSettings.nodeTextColor
      };

      if (parentNode) {
         newLink = {
          id: `l-${Date.now()}`,
          sourceId: parentNode.id,
          targetId: newNode.id,
        };
      }
  
    } else { // canvas
      const canvasParentNode = parentNode || nodes.find(n => n.id === '1');
  
      if (!canvasParentNode) return;
  
      const parentVisibleNode = visibleNodes.find(n => n.id === canvasParentNode.id);
      
      newX = (parentVisibleNode?.x ?? canvasParentNode.x) + canvasParentNode.width + 50;
      newY = parentVisibleNode?.y ?? canvasParentNode.y;
  
      newNode = {
        id: `n-${Date.now()}`,
        x: newX,
        y: newY,
        text: "New Canvas",
        type: type,
        color: "#a7f3d0",
        width: nodeWidth,
        height: canvasHeight,
        textColor: globalSettings.nodeTextColor
      };
  
      if (canvasParentNode) {
        newLink = {
          id: `l-${Date.now()}`,
          sourceId: canvasParentNode.id,
          targetId: newNode.id,
        };
      }
    }
    
    setNodes(prev => [...prev, newNode]);
    if (newLink) {
        setLinks(prev => [...prev, newLink!]);
    }
    setSelectedNodeId(newNode.id);
  };
  
  const handleUpdateNode = (id: string, newProps: Partial<MindMapNode>) => {
    setNodes(nodes.map(n => n.id === id ? {...n, ...newProps} : n));
  };
  
  useEffect(() => {
    setNodes(prevNodes => 
        prevNodes.map(node => ({
            ...node,
            textColor: globalSettings.nodeTextColor,
        }))
    )
  }, [globalSettings.nodeTextColor]);

  const handleDeleteNode = () => {
    if (!selectedNodeId) return;
    const descendantIds = getDescendantIds(selectedNodeId);
    const idsToDelete = [selectedNodeId, ...descendantIds];

    setNodes(nodes.filter((n) => !idsToDelete.includes(n.id)));
    setLinks(
      links.filter(
        (l) => !idsToDelete.includes(l.sourceId) && !idsToDelete.includes(l.targetId)
      )
    );
    setSelectedNodeId(null);
  };

  const handleStartLinking = () => {
    if (!selectedNodeId) return;
    setLinkingState({ sourceId: selectedNodeId });
    setSelectedNodeId(null);
  };

  const handleSuggestConcepts = async () => {
    if (!selectedNode) return;
    setIsLoadingAi(true);
    setAiSuggestions([]);
    try {
      const result = await suggestConcepts({ nodeText: selectedNode.text });
      setAiSuggestions(result.suggestions);
    } catch (error) {
      console.error("AI suggestion error:", error);
      toast({
        variant: "destructive",
        title: "AI Error",
        description: "Could not fetch suggestions. Please try again.",
      });
    } finally {
      setIsLoadingAi(false);
    }
  };
  
  const handleAddSuggestedNode = (text: string) => {
    if (!selectedNodeId) return;
    const sourceNode = nodes.find(n => n.id === selectedNodeId);
    if (!sourceNode) return;

    const newNode: MindMapNode = {
      id: `n-${Date.now()}`,
      x: sourceNode.x + sourceNode.width + 100,
      y: sourceNode.y,
      text,
      type: "canvas",
      color: "#fde68a",
      width: 150,
      height: 60,
      textColor: globalSettings.nodeTextColor,
    };
    const newLink: MindMapLink = {
        id: `l-${Date.now()}`,
        sourceId: selectedNodeId,
        targetId: newNode.id,
    }

    setNodes(prev => [...prev, newNode]);
    setLinks(prev => [...prev, newLink]);
    setAiSuggestions(prev => prev.filter(s => s !== text));
  }

  const handleSave = () => {
    const data = JSON.stringify({ nodes, links, globalSettings }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mind-map.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Mind map saved successfully." });
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.nodes && data.links) {
          setNodes(data.nodes);
          setLinks(data.links);
          if (data.globalSettings) {
              setGlobalSettings(data.globalSettings);
          }
          setSelectedNodeId(null);
          toast({ title: "Success", description: "Mind map loaded successfully." });
        } else {
            throw new Error("Invalid file format");
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load mind map. Invalid file format.",
        });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };
  
  const getLinkPath = (link: MindMapLink) => {
    const sourceNode = visibleNodes.find(n => n.id === link.sourceId);
    const targetNode = visibleNodes.find(n => n.id === link.targetId);

    if (!sourceNode || !targetNode) return "";
    
    if (sourceNode.type === 'folder' && targetNode.type === 'folder') {
        return "";
    }

    const startX = sourceNode.x + sourceNode.width;
    const startY = sourceNode.y + sourceNode.height / 2;
    const endX = targetNode.x;
    const endY = targetNode.y + targetNode.height / 2;
    
    const c1x = startX + (endX - startX) * 0.5;
    const c1y = startY;
    const c2x = endX - (endX - startX) * 0.5;
    const c2y = endY;

    return `M ${startX},${startY} C ${c1x},${c1y} ${c2x},${c2y} ${endX},${endY}`;
  };

  const hasChildren = (nodeId: string) => links.some(link => link.sourceId === nodeId);

  if (!isLoaded) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-body">
      <header className="flex items-center justify-between p-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-bold font-headline">Mind Weaver</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleAddNode('folder')}><Folder className="mr-2 h-4 w-4" /> New Folder</Button>
          <Button variant="outline" size="sm" onClick={() => handleAddNode('canvas')}><Paintbrush className="mr-2 h-4 w-4" /> New Canvas</Button>
          <Button variant="outline" size="sm" onClick={handleSave}><Download className="mr-2 h-4 w-4" /> Save</Button>
          <Button variant="outline" size="sm" onClick={handleLoadClick}><Upload className="mr-2 h-4 w-4" /> Load</Button>
          <Button variant="outline" size="icon" onClick={toggleTheme}>
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 relative" style={{ backgroundColor: globalSettings.canvasColor }}>
          <svg
            ref={svgRef}
            className="w-full h-full cursor-default"
            onClick={() => { setSelectedNodeId(null); setLinkingState(null); }}
          >
            <defs>
              <marker
                id="arrowhead"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground/60" />
              </marker>
            </defs>

            {visibleLinks.map((link) => (
              <path
                key={link.id}
                d={getLinkPath(link)}
                strokeWidth="2"
                className="stroke-muted-foreground/60 fill-none"
                markerEnd={nodes.find(n => n.id === link.sourceId)?.type === 'folder' && nodes.find(n => n.id === link.targetId)?.type === 'folder' ? "" : "url(#arrowhead)"}
              />
            ))}
            {visibleNodes.map((node) => {
              const textLines = wrapText(node.text, 12);
              return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={(e) => handleNodeClick(e, node.id)}
                className="cursor-pointer group"
              >
                {node.type === 'canvas' ? (
                  <rect
                    width={node.width}
                    height={node.height}
                    rx="10"
                    ry="10"
                    fill={node.color}
                    className={cn(
                      "transition-all duration-200",
                      selectedNodeId === node.id || (linkingState && linkingState.sourceId === node.id)
                        ? "stroke-primary stroke-[3px]"
                        : "stroke-black/30 dark:stroke-white/30 stroke-2",
                      "group-hover:stroke-primary group-hover:stroke-2"
                    )}
                  />
                ) : (
                   <rect
                      width={node.width}
                      height={node.height}
                      fill="transparent"
                      className={cn(
                        (selectedNodeId === node.id || (linkingState && linkingState.sourceId === node.id)) && "stroke-primary/50 stroke-2 rounded-md"
                      )}
                    />
                )}

                {node.type === 'folder' ? (
                   <g transform={`translate(0, ${node.height / 2})`}>
                      <Folder className="w-5 h-5" style={{ transform: `translateY(-50%)`, color: node.textColor }} />
                      <text
                        x={28}
                        y={0}
                        textAnchor="start"
                        dominantBaseline="central"
                        className="font-semibold pointer-events-none select-none"
                        style={{ fill: node.textColor }}
                      >
                        {node.text}
                      </text>
                      {hasChildren(node.id) && (
                        <g
                           transform={`translate(${node.width - 12 + (globalSettings.iconOffsetX || 0)}, ${globalSettings.iconOffsetY || 0})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleNodeCollapse(node.id);
                          }}
                        >
                          <rect width="16" height="16" rx="4" ry="4" className="fill-transparent" style={{transform: "translate(-8px, -8px)"}} />
                          {node.isCollapsed
                            ? <Plus className="w-4 h-4 text-white" />
                            : <Minus className="w-4 h-4 text-white" />}
                        </g>
                      )}
                   </g>
                ) : (
                  <text
                    x={node.width / 2}
                    y={node.height / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="font-semibold pointer-events-none select-none"
                    style={{ fill: node.textColor }}
                  >
                   {textLines.map((line, index) => (
                      <tspan
                          key={index}
                          x={node.width / 2}
                          dy={index === 0 ? (textLines.length > 1 ? `-${(textLines.length - 1) * 0.6}em` : 0) : "1.2em"}
                      >
                          {line}
                      </tspan>
                  ))}
                  </text>
                )}
              </g>
            )})}
             {linkingState && nodes.find(n => n.id === linkingState.sourceId) && (
                <path d="" className="stroke-primary stroke-2 stroke-dashed" fill="none" pointerEvents="none" />
             )}
          </svg>
           {linkingState && <div className="absolute top-4 left-4 bg-primary text-primary-foreground rounded-md px-3 py-1 text-sm shadow-lg">Select a target node to create a link. Click background to cancel.</div>}
        </div>

        <div className="relative border-t bg-background">
             <Button 
                variant="ghost" 
                size="icon" 
                className="absolute -top-10 right-2 z-10"
                onClick={() => setIsPropertiesPanelOpen(prev => !prev)}
            >
                {isPropertiesPanelOpen ? <PanelBottomClose /> : <PanelBottom />}
                <span className="sr-only">Toggle Properties Panel</span>
             </Button>
            {isPropertiesPanelOpen && (
                 <div className="p-4 flex flex-row gap-6 overflow-x-auto h-auto">
                    {selectedNode ? (
                        <Card className="min-w-80">
                        <CardHeader>
                            <CardTitle>Node Properties</CardTitle>
                            <CardDescription>
                            Type: {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                            <Label htmlFor="node-text">Text</Label>
                            <Textarea
                                id="node-text"
                                value={selectedNode.text}
                                onChange={(e) => handleUpdateNode(selectedNodeId!, {text: e.target.value})}
                            />
                            </div>
                            {selectedNode.type === 'canvas' && <div className="space-y-2">
                            <Label htmlFor="node-color">Color</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                id="node-color"
                                type="color"
                                value={selectedNode.color}
                                onChange={(e) => handleUpdateNode(selectedNodeId!, {color: e.target.value})}
                                className="p-1 h-10"
                                />
                                <Palette className="h-5 w-5 text-muted-foreground" />
                            </div>
                            </div>}
                            <div className="space-y-2">
                                <Label htmlFor="node-text-color">Text Color</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                    id="node-text-color"
                                    type="color"
                                    value={selectedNode.textColor}
                                    onChange={(e) => handleUpdateNode(selectedNodeId!, {textColor: e.target.value})}
                                    className="p-1 h-10"
                                    />
                                    <Type className="h-5 w-5 text-muted-foreground" />
                                </div>
                            </div>
                            <Separator />
                            <div className="flex gap-2">
                                <Button onClick={handleStartLinking} size="sm" className="w-full">
                                    <Link2 className="mr-2 h-4 w-4" /> Link Node
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={handleDeleteNode}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Delete node</span>
                                </Button>
                            </div>
                        </CardContent>
                        </Card>
                    ) : (
                       <Card className="min-w-80 w-80">
                            <CardHeader>
                                <CardTitle>Global Settings</CardTitle>
                                <CardDescription>Manage the look and feel of the entire application.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                 <div className="grid grid-cols-[auto_min-content] gap-x-4 gap-y-2 items-center">
                                    <Label>Mind Map Background</Label>
                                    <Input type="color" value={globalSettings.canvasColor} onChange={(e) => handleUpdateGlobalSettings({canvasColor: e.target.value})} className="p-0 h-6 w-6" />
                                
                                    <Label>Default Node Text</Label>
                                    <Input type="color" value={globalSettings.nodeTextColor} onChange={(e) => handleUpdateGlobalSettings({nodeTextColor: e.target.value})} className="p-0 h-6 w-6" />
                                
                                    <div className="col-span-2"><Separator className="my-2"/></div>
                                    
                                    <Label className="text-sm font-medium">Piktogramos X ašis</Label>
                                    <Input type="number" value={globalSettings.iconOffsetX} onChange={(e) => handleUpdateGlobalSettings({iconOffsetX: parseInt(e.target.value, 10) || 0})} className="h-8" />
                                    
                                    <Label className="text-sm font-medium">Piktogramos Y ašis</Label>
                                    <Input type="number" value={globalSettings.iconOffsetY} onChange={(e) => handleUpdateGlobalSettings({iconOffsetY: parseInt(e.target.value, 10) || 0})} className="h-8" />

                                    <div className="col-span-2"><Separator className="my-2"/></div>

                                    <Label className="text-sm font-medium col-span-2">App Theme</Label>
                                    
                                    <Label>App Background</Label>
                                    <Input type="color" value={getHexFromHsl(globalSettings.theme.backgroundHsl)} onChange={(e) => handleUpdateThemeColor('backgroundHsl', e.target.value)} className="p-0 h-6 w-6" />
                                    
                                    <Label>App Text</Label>
                                    <Input type="color" value={getHexFromHsl(globalSettings.theme.foregroundHsl)} onChange={(e) => handleUpdateThemeColor('foregroundHsl', e.target.value)} className="p-0 h-6 w-6" />
                                   
                                    <Label>Primary</Label>
                                    <Input type="color" value={getHexFromHsl(globalSettings.theme.primaryHsl)} onChange={(e) => handleUpdateThemeColor('primaryHsl', e.target.value)} className="p-0 h-6 w-6" />
                                   
                                    <Label>Accent</Label>
                                    <Input type="color" value={getHexFromHsl(globalSettings.theme.accentHsl)} onChange={(e) => handleUpdateThemeColor('accentHsl', e.target.value)} className="p-0 h-6 w-6" />
                                   
                                    <Label>Borders & Separators</Label>
                                    <Input type="color" value={getHexFromHsl(globalSettings.theme.borderHsl)} onChange={(e) => handleUpdateThemeColor('borderHsl', e.target.value)} className="p-0 h-6 w-6" />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {selectedNode && (
                        <Card className="min-w-80">
                        <CardHeader>
                            <CardTitle>AI Concept Suggestions</CardTitle>
                            <CardDescription>Generate related ideas for the selected node.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button onClick={handleSuggestConcepts} disabled={isLoadingAi} className="w-full">
                            {isLoadingAi ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <BrainCircuit className="mr-2 h-4 w-4" />
                            )}
                            Suggest Concepts
                            </Button>
                            {aiSuggestions.length > 0 && (
                            <div className="space-y-2">
                                <Label>Suggestions:</Label>
                                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                                {aiSuggestions.map((suggestion, i) => (
                                    <Button
                                    key={i}
                                    variant="ghost"
                                    size="sm"
                                    className="justify-start"
                                    onClick={() => handleAddSuggestedNode(suggestion)}
                                    >
                                        <Plus className="mr-2 h-4 w-4" /> {suggestion}
                                    </Button>
                                ))}
                                </div>
                            </div>
                            )}
                        </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
      </main>
    </div>
  );
}

    

    

