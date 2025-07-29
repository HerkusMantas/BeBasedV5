export interface MindMapNode {
  id: string;
  x: number;
  y: number;
  text: string;
  type: 'folder' | 'canvas';
  color: string;
  width: number;
  height: number;
  isCollapsed?: boolean;
}

export interface MindMapLink {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}
