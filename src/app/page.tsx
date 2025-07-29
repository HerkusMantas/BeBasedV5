"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import type { ChangeEvent } from "react";
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

const initialNodes: MindMapNode[] = [
  {
    id: "1",
    x: 300,
    y: 200,
    text: "Central Idea",
    type: "folder",
    color: "#60a5fa",
    width: 150,
    height: 60,
  },
  {
    id: "2",
    x: 550,
    y: 150,
    text: "Sub-topic 1",
    type: "canvas",
    color: "#93c5fd",
    width: 150,
    height: 50,
  },
  {
    id: "3",
    x: 550,
    y: 250,
    text: "Sub-topic 2",
    type: "canvas",
    color: "#93c5fd",
    width: 150,
    height: 50,
  },
];

const initialLinks: MindMapLink[] = [
  { id: "l1", sourceId: "1", targetId: "2" },
  { id: "l2", sourceId: "1", targetId: "3" },
];

export default function MindMapEditor() {
  const { toast } = useToast();
  const [nodes, setNodes] = useState<MindMapNode[]>(initialNodes);
  const [links, setLinks] = useState<MindMapLink[]>(initialLinks);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [linkingState, setLinkingState] = useState<{ sourceId: string } | null>(
    null
  );
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId), [nodes, selectedNodeId]);

  const handleNodeMouseDown = (
    e: React.MouseEvent<SVGGElement>,
    nodeId: string
  ) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !svgRef.current) return;
    
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return;

    const mouseX = (e.clientX - CTM.e) / CTM.a;
    const mouseY = (e.clientY - CTM.f) / CTM.d;

    setDraggingNode({ id: nodeId, offsetX: mouseX - node.x, offsetY: mouseY - node.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingNode || !svgRef.current) return;
    e.preventDefault();
    
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return;
    
    const mouseX = (e.clientX - CTM.e) / CTM.a;
    const mouseY = (e.clientY - CTM.f) / CTM.d;

    const newX = mouseX - draggingNode.offsetX;
    const newY = mouseY - draggingNode.offsetY;

    setNodes((prevNodes) =>
      prevNodes.map((n) =>
        n.id === draggingNode.id ? { ...n, x: newX, y: newY } : n
      )
    );
  };

  const handleCanvasMouseUp = () => {
    setDraggingNode(null);
  };

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
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
  };

  const handleNodeDoubleClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setNodes(prevNodes => prevNodes.map(n => 
        n.id === nodeId ? { ...n, isCollapsed: !n.isCollapsed } : n
    ));
  };

  const getChildNodeIds = useCallback((nodeId: string, currentLinks: MindMapLink[]): string[] => {
    const directChildren = currentLinks.filter(l => l.sourceId === nodeId).map(l => l.targetId);
    let allChildren = [...directChildren];
    directChildren.forEach(childId => {
        const node = nodes.find(n => n.id === childId);
        if (node && !node.isCollapsed) {
            allChildren = [...allChildren, ...getChildNodeIds(childId, currentLinks)];
        }
    });
    return allChildren;
  }, [nodes]);

  const visibleNodes = useMemo(() => {
    const hiddenNodeIds = new Set<string>();
    nodes.forEach(node => {
        if (node.isCollapsed) {
            const childrenToHide = getChildNodeIds(node.id, links);
            childrenToHide.forEach(id => hiddenNodeIds.add(id));
        }
    });
    return nodes.filter(n => !hiddenNodeIds.has(n.id));
  }, [nodes, links, getChildNodeIds]);

  const visibleLinks = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    return links.filter(l => visibleNodeIds.has(l.sourceId) && visibleNodeIds.has(l.targetId));
  }, [links, visibleNodes]);

  const handleAddNode = (type: 'folder' | 'canvas') => {
    const newNode: MindMapNode = {
      id: `n-${Date.now()}`,
      x: 100,
      y: 100,
      text: type === 'folder' ? "New Folder" : "New Canvas",
      type: type,
      color: type === 'folder' ? "#f6ad55" : "#a7f3d0",
      width: 150,
      height: 50,
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };
  
  const handleUpdateNode = (id: string, newProps: Partial<MindMapNode>) => {
    setNodes(nodes.map(n => n.id === id ? {...n, ...newProps} : n));
  };

  const handleDeleteNode = () => {
    if (!selectedNodeId) return;
    setNodes(nodes.filter((n) => n.id !== selectedNodeId));
    setLinks(
      links.filter(
        (l) => l.sourceId !== selectedNodeId && l.targetId !== selectedNodeId
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
      height: 50,
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
    const data = JSON.stringify({ nodes, links }, null, 2);
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
    const sourceNode = nodes.find(n => n.id === link.sourceId);
    const targetNode = nodes.find(n => n.id === link.targetId);

    if (!sourceNode || !targetNode) return "";

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
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative bg-grid-slate-100 dark:bg-grid-slate-800/[0.6]">
          <svg
            ref={svgRef}
            className="w-full h-full cursor-grab"
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
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
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" className="fill-muted-foreground/30"></circle>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {visibleLinks.map((link) => (
              <path
                key={link.id}
                d={getLinkPath(link)}
                strokeWidth="2"
                className="stroke-muted-foreground/60 fill-none"
                markerEnd="url(#arrowhead)"
              />
            ))}
            {visibleNodes.map((node) => (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={(e) => handleNodeClick(e, node.id)}
                onDoubleClick={(e) => handleNodeDoubleClick(e, node.id)}
                className="cursor-pointer group"
              >
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
                      : "stroke-black/30 stroke-2",
                    "group-hover:stroke-primary group-hover:stroke-2"
                  )}
                />
                <text
                  x={node.width / 2}
                  y={node.height / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-gray-800 font-semibold pointer-events-none select-none"
                >
                  {node.text}
                </text>
                 {hasChildren(node.id) && (
                    <g transform={`translate(${node.width / 2 - 8}, ${node.height - 20})`}>
                       {node.isCollapsed 
                       ? <ChevronDown className="w-4 h-4 text-gray-800" /> 
                       : <ChevronUp className="w-4 h-4 text-gray-800" />
                       }
                    </g>
                )}
              </g>
            ))}
             {linkingState && nodes.find(n => n.id === linkingState.sourceId) && (
                <path d="" className="stroke-primary stroke-2 stroke-dashed" fill="none" pointerEvents="none" />
             )}
          </svg>
           {linkingState && <div className="absolute top-4 left-4 bg-primary text-primary-foreground rounded-md px-3 py-1 text-sm shadow-lg">Select a target node to create a link. Click background to cancel.</div>}
        </div>

        <aside className="w-80 border-l p-4 flex flex-col gap-6 overflow-y-auto shrink-0">
          {selectedNode ? (
            <Card>
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
                <div className="space-y-2">
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
            <Card className="text-center">
              <CardHeader>
                <CardTitle>Welcome to Mind Weaver</CardTitle>
                <CardDescription>Select a node to see its properties or add a new one to get started.</CardDescription>
              </CardHeader>
            </Card>
          )}

          {selectedNode && (
            <Card>
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
        </aside>
      </main>
    </div>
  );
}
