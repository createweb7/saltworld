'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TextAlign } from '@tiptap/extension-text-align';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Youtube } from '@tiptap/extension-youtube';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Undo, Redo,
  Link as LinkIcon, Image as ImageIcon, Table as TableIcon, Youtube as YtIcon,
  AlignLeft, AlignCenter, AlignRight, Minus, Type,
} from 'lucide-react';

/**
 * RichTextEditor — Notion-style Tiptap editor with a floating toolbar.
 * Emits HTML strings via onChange.
 */
export default function RichTextEditor({ value, onChange, placeholder = 'Start writing…', minHeight = 320 }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: {}, link: { openOnClick: false, HTMLAttributes: { class: 'text-brand underline underline-offset-2' } } }),
      Image.configure({ HTMLAttributes: { class: 'rounded-lg my-4 max-w-full h-auto' } }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'rte-table' } }),
      TableRow, TableCell, TableHeader,
      Youtube.configure({ width: 640, height: 360, HTMLAttributes: { class: 'my-4 aspect-video' } }),
    ],
    content: value || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none px-3 py-3 min-h-[240px]',
        style: `min-height:${minHeight}px`,
      },
    },
  });

  useEffect(() => {
    if (editor && value !== undefined && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return <div className="rounded-lg border border-border bg-muted/40 animate-pulse" style={{ minHeight }} />;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL (internal e.g. /journal/foo or external https://…)', previousUrl || '');
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: url.startsWith('http') ? '_blank' : '_self' }).run();
  };
  const addImage = () => {
    const url = window.prompt('Image URL');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };
  const addYoutube = () => {
    const url = window.prompt('YouTube video URL');
    if (url) editor.commands.setYoutubeVideo({ src: url });
  };
  const addTable = () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();

  const btn = (isActive, onClick, Icon, title) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`h-7 w-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted ${isActive ? 'bg-muted text-foreground' : ''}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <div className="flex items-center gap-0.5 flex-wrap border-b border-border bg-muted/30 px-2 py-1.5 sticky top-0 z-10">
        {btn(editor.isActive('bold'),           () => editor.chain().focus().toggleBold().run(),         Bold,          'Bold (⌘B)')}
        {btn(editor.isActive('italic'),         () => editor.chain().focus().toggleItalic().run(),       Italic,        'Italic (⌘I)')}
        {btn(editor.isActive('underline'),      () => editor.chain().focus().toggleUnderline().run(),    UnderlineIcon, 'Underline (⌘U)')}
        {btn(editor.isActive('strike'),         () => editor.chain().focus().toggleStrike().run(),       Strikethrough, 'Strikethrough')}
        {btn(editor.isActive('code'),           () => editor.chain().focus().toggleCode().run(),         Code,          'Inline code')}
        <span className="w-px h-4 bg-border mx-1" />
        {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), Heading1, 'Heading 1')}
        {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2, 'Heading 2')}
        {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), Heading3, 'Heading 3')}
        {btn(editor.isActive('paragraph'),      () => editor.chain().focus().setParagraph().run(), Type, 'Paragraph')}
        <span className="w-px h-4 bg-border mx-1" />
        {btn(editor.isActive('bulletList'),     () => editor.chain().focus().toggleBulletList().run(),   List,       'Bulleted list')}
        {btn(editor.isActive('orderedList'),    () => editor.chain().focus().toggleOrderedList().run(),  ListOrdered,'Numbered list')}
        {btn(editor.isActive('blockquote'),     () => editor.chain().focus().toggleBlockquote().run(),   Quote,      'Quote')}
        {btn(false,                             () => editor.chain().focus().setHorizontalRule().run(),  Minus,      'Divider')}
        <span className="w-px h-4 bg-border mx-1" />
        {btn(editor.isActive({ textAlign: 'left'   }), () => editor.chain().focus().setTextAlign('left').run(),   AlignLeft,   'Align left')}
        {btn(editor.isActive({ textAlign: 'center' }), () => editor.chain().focus().setTextAlign('center').run(), AlignCenter, 'Align center')}
        {btn(editor.isActive({ textAlign: 'right'  }), () => editor.chain().focus().setTextAlign('right').run(),  AlignRight,  'Align right')}
        <span className="w-px h-4 bg-border mx-1" />
        {btn(editor.isActive('link'), setLink,   LinkIcon,  'Link (internal or external)')}
        {btn(false,                    addImage,  ImageIcon, 'Insert image')}
        {btn(false,                    addYoutube,YtIcon,    'Embed YouTube')}
        {btn(false,                    addTable,  TableIcon, 'Insert table')}
        <span className="w-px h-4 bg-border mx-1" />
        {btn(false, () => editor.chain().focus().undo().run(), Undo, 'Undo')}
        {btn(false, () => editor.chain().focus().redo().run(), Redo, 'Redo')}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
