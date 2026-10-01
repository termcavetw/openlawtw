import type {ReactNode} from 'react';
import {Popover} from 'radix-ui';
import {MoreHorizontal} from 'lucide-react';
/** Keep the number and one trigger in the reading gutter, regardless of tool count. */
export function ArticleTools({article,children}:{article:string;children:ReactNode}){
 return <Popover.Root><Popover.Trigger asChild><button type="button" className="article-tools-trigger" aria-label={article+'操作'} title="條文操作"><MoreHorizontal size={16}/></button></Popover.Trigger><Popover.Portal><Popover.Content className="article-tools-panel" aria-label={article+'操作'} side="bottom" align="start" sideOffset={5} collisionPadding={12} onInteractOutside={event=>{
  // Capture/share/print dialogs live in a portal. Keep their parent tool alive
  // while focus moves into the dialog; closing it returns to its own trigger.
  if((event.target as HTMLElement)?.closest?.('[role="dialog"]'))event.preventDefault();
 }}>{children}<Popover.Arrow className="article-tools-arrow"/></Popover.Content></Popover.Portal></Popover.Root>;
}
