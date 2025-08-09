"use client";

import { useState } from "react";
import { FileText, Download, Copy, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { MindMapNode, MindMapLink } from "@/lib/types";

interface ReportDialogProps {
  nodes: MindMapNode[];
  links: MindMapLink[];
}

interface MindMapAnalytics {
  totalNodes: number;
  folderNodes: number;
  canvasNodes: number;
  totalLinks: number;
  maxDepth: number;
  rootNodes: number;
  orphanNodes: number;
  averageNodeTextLength: number;
  nodesWithChildren: number;
  longestBranch: number;
  textStats: {
    totalCharacters: number;
    totalWords: number;
    averageWordsPerNode: number;
  };
}

const generateAnalytics = (nodes: MindMapNode[], links: MindMapLink[]): MindMapAnalytics => {
  const totalNodes = nodes.length;
  const folderNodes = nodes.filter(n => n.type === 'folder').length;
  const canvasNodes = nodes.filter(n => n.type === 'canvas').length;
  const totalLinks = links.length;

  // Find root nodes (nodes with no incoming links)
  const rootNodeIds = nodes.filter(n => !links.some(l => l.targetId === n.id)).map(n => n.id);
  const rootNodes = rootNodeIds.length;

  // Find orphan nodes (nodes with no connections at all)
  const connectedNodeIds = new Set([...links.map(l => l.sourceId), ...links.map(l => l.targetId)]);
  const orphanNodes = nodes.filter(n => !connectedNodeIds.has(n.id)).length;

  // Calculate max depth
  const getNodeDepth = (nodeId: string, visited = new Set<string>()): number => {
    if (visited.has(nodeId)) return 0; // Prevent infinite loops
    visited.add(nodeId);
    
    const children = links.filter(l => l.sourceId === nodeId);
    if (children.length === 0) return 1;
    
    return 1 + Math.max(...children.map(child => getNodeDepth(child.targetId, new Set(visited))));
  };

  const depths = rootNodeIds.map(id => getNodeDepth(id));
  const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;
  const longestBranch = maxDepth;

  // Text statistics
  const allText = nodes.map(n => n.text).join(' ');
  const totalCharacters = allText.length;
  const words = allText.split(/\s+/).filter(word => word.length > 0);
  const totalWords = words.length;
  const averageWordsPerNode = totalNodes > 0 ? totalWords / totalNodes : 0;
  const averageNodeTextLength = totalNodes > 0 ? totalCharacters / totalNodes : 0;

  // Nodes with children
  const nodesWithChildren = nodes.filter(n => links.some(l => l.sourceId === n.id)).length;

  return {
    totalNodes,
    folderNodes,
    canvasNodes,
    totalLinks,
    maxDepth,
    rootNodes,
    orphanNodes,
    averageNodeTextLength,
    nodesWithChildren,
    longestBranch,
    textStats: {
      totalCharacters,
      totalWords,
      averageWordsPerNode,
    }
  };
};

const generateMarkdownReport = (analytics: MindMapAnalytics, nodes: MindMapNode[], links: MindMapLink[]): string => {
  const timestamp = new Date().toLocaleString();
  
  return `# Mind Map Report

**Generated on:** ${timestamp}
**Application:** Mind Weaver

## Summary Statistics

- **Total Nodes:** ${analytics.totalNodes}
  - Folder Nodes: ${analytics.folderNodes}
  - Canvas Nodes: ${analytics.canvasNodes}
- **Total Links:** ${analytics.totalLinks}
- **Root Nodes:** ${analytics.rootNodes}
- **Orphan Nodes:** ${analytics.orphanNodes}

## Structure Analysis

- **Maximum Depth:** ${analytics.maxDepth} levels
- **Longest Branch:** ${analytics.longestBranch} nodes
- **Nodes with Children:** ${analytics.nodesWithChildren}
- **Connectivity Ratio:** ${analytics.totalNodes > 0 ? ((analytics.totalNodes - analytics.orphanNodes) / analytics.totalNodes * 100).toFixed(1) : 0}%

## Content Analysis

- **Total Characters:** ${analytics.textStats.totalCharacters.toLocaleString()}
- **Total Words:** ${analytics.textStats.totalWords.toLocaleString()}
- **Average Words per Node:** ${analytics.textStats.averageWordsPerNode.toFixed(1)}
- **Average Characters per Node:** ${analytics.averageNodeTextLength.toFixed(1)}

## Node Details

### Folder Nodes (${analytics.folderNodes})
${nodes.filter(n => n.type === 'folder').map(n => `- **${n.text}** (ID: ${n.id})`).join('\n') || '- None'}

### Canvas Nodes (${analytics.canvasNodes})
${nodes.filter(n => n.type === 'canvas').map(n => `- **${n.text}** (ID: ${n.id})`).join('\n') || '- None'}

## Connection Map

${links.length > 0 ? links.map(l => {
  const source = nodes.find(n => n.id === l.sourceId);
  const target = nodes.find(n => n.id === l.targetId);
  return `- **${source?.text || 'Unknown'}** → **${target?.text || 'Unknown'}**`;
}).join('\n') : '- No connections found'}

## Recommendations

${analytics.orphanNodes > 0 ? `- Consider connecting ${analytics.orphanNodes} orphan node(s) to improve mind map coherence\n` : ''}${analytics.maxDepth < 2 ? `- Consider adding more hierarchical depth to better organize concepts\n` : ''}${analytics.totalLinks === 0 ? `- Add connections between nodes to show relationships\n` : ''}${analytics.textStats.averageWordsPerNode < 2 ? `- Consider adding more descriptive text to nodes for better clarity\n` : ''}- Mind map structure looks ${analytics.totalLinks > analytics.totalNodes * 0.5 ? 'well-connected' : 'sparse'} with ${(analytics.totalLinks / Math.max(analytics.totalNodes, 1)).toFixed(1)} connections per node on average

---
*Report generated by Mind Weaver on ${timestamp}*`;
};

export function ReportDialog({ nodes, links }: ReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const { toast } = useToast();

  const analytics = generateAnalytics(nodes, links);
  const markdownReport = generateMarkdownReport(analytics, nodes, links);

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(markdownReport);
      setCopiedToClipboard(true);
      toast({
        title: "Copied!",
        description: "Report copied to clipboard successfully.",
      });
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy report to clipboard.",
      });
    }
  };

  const handleDownloadReport = () => {
    const blob = new Blob([markdownReport], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mind-map-report-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded",
      description: "Report downloaded successfully.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Mind Map Report</DialogTitle>
          <DialogDescription>
            Comprehensive analysis and statistics of your current mind map
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Statistics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Nodes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalNodes}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.folderNodes} folders, {analytics.canvasNodes} canvas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Connections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalLinks}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.nodesWithChildren} nodes have children
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Structure</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.maxDepth}</div>
                <p className="text-xs text-muted-foreground">
                  Maximum depth levels
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Content Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Content Analysis</CardTitle>
              <CardDescription>Text and content statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="font-medium">Total Words</div>
                  <div className="text-lg font-bold">{analytics.textStats.totalWords.toLocaleString()}</div>
                </div>
                <div>
                  <div className="font-medium">Total Characters</div>
                  <div className="text-lg font-bold">{analytics.textStats.totalCharacters.toLocaleString()}</div>
                </div>
                <div>
                  <div className="font-medium">Avg Words/Node</div>
                  <div className="text-lg font-bold">{analytics.textStats.averageWordsPerNode.toFixed(1)}</div>
                </div>
                <div>
                  <div className="font-medium">Connectivity</div>
                  <div className="text-lg font-bold">
                    {analytics.totalNodes > 0 ? ((analytics.totalNodes - analytics.orphanNodes) / analytics.totalNodes * 100).toFixed(0) : 0}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Report */}
          <Card>
            <CardHeader>
              <CardTitle>Full Report (Markdown)</CardTitle>
              <CardDescription>
                Complete analysis in markdown format - copy or download
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={markdownReport}
                readOnly
                className="min-h-[300px] font-mono text-xs"
              />
              <div className="flex gap-2 mt-4">
                <Button onClick={handleCopyToClipboard} variant="outline" size="sm">
                  {copiedToClipboard ? (
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copiedToClipboard ? "Copied!" : "Copy to Clipboard"}
                </Button>
                <Button onClick={handleDownloadReport} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download as Markdown
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}