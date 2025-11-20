import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Download, Trash2, Pencil, RefreshCw, Check, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { PhotoData } from '../types';
import { generatePhotoCaption } from '../services/geminiService';

interface PhotoCardProps {
  photo: PhotoData;
  onUpdate: (id: string, updates: Partial<PhotoData>) => void;
  onDelete: (id: string) => void;
  onDragRelease?: (id: string, point: { x: number, y: number }) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  onUpdate,
  onDelete,
  onDragRelease,
  className,
  style
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(photo.caption);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();

  // Handle developing animation locally if needed, but CSS filter transition is easier
  const [visualState, setVisualState] = useState<'developing' | 'developed'>(
    photo.isDeveloping ? 'developing' : 'developed'
  );

  useEffect(() => {
    if (photo.isDeveloping) {
      const timer = setTimeout(() => {
        setVisualState('developed');
        onUpdate(photo.id, { isDeveloping: false });
      }, 3500); // 3.5s developing time
      return () => clearTimeout(timer);
    }
  }, [photo.isDeveloping, photo.id, onUpdate]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2, // Higher quality
      });
      const link = document.createElement('a');
      link.download = `bao-retro-${photo.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Failed to download photo", err);
    }
  };

  const handleRegenerateCaption = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRegenerating(true);
    const newCaption = await generatePhotoCaption(photo.imageData);
    onUpdate(photo.id, { caption: newCaption });
    setEditText(newCaption);
    setIsRegenerating(false);
  };

  const saveEdit = () => {
    onUpdate(photo.id, { caption: editText });
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setEditText(photo.caption);
    setIsEditing(false);
  };

  const handleDragEnd = (event: any, info: any) => {
    if (photo.isStaged && onDragRelease) {
       // Calculate absolute position relative to window
       const rect = cardRef.current?.getBoundingClientRect();
       if (rect) {
         onDragRelease(photo.id, { x: rect.left, y: rect.top });
       }
    } else if (!photo.isStaged) {
        // Update position for free-floating photos
        // We rely on the parent to manage state updates for persistence if needed
        // but for now Framer Motion handles the visual drag. 
        // To strictly persist:
        // onUpdate(photo.id, { position: { x: info.point.x, y: info.point.y } });
    }
  };

  return (
    <motion.div
      ref={cardRef}
      className={`absolute flex flex-col bg-white shadow-xl overflow-hidden select-none ${className}`}
      style={{
        width: '240px', // Fixed width for polaroid
        height: '320px', // 3:4 aspect ratio roughly
        padding: '16px 16px 40px 16px', // Polaroid spacing
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
        cursor: isEditing ? 'default' : 'grab',
        zIndex: isHovering ? 50 : (photo.isStaged ? 10 : 1),
        rotate: photo.rotation,
        ...style
      }}
      initial={photo.isStaged ? { y: 0 } : { x: photo.position.x, y: photo.position.y }}
      animate={photo.isStaged ? { y: -180 } : undefined} // Ejection animation target relative to container
      transition={photo.isStaged ? { duration: 1.5, type: "spring", bounce: 0.2 } : undefined}
      drag
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      whileDrag={{ scale: 1.05, cursor: 'grabbing', zIndex: 100 }}
    >
      {/* Hover Toolbar */}
      {!photo.isStaged && isHovering && !isEditing && (
        <div className="absolute -top-10 left-0 w-full flex justify-center gap-2 p-2">
          <button 
            onClick={handleDownload}
            className="bg-white p-2 rounded-full shadow-md hover:bg-blue-50 text-gray-700 transition-colors"
            title="Download"
          >
            <Download size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
            className="bg-white p-2 rounded-full shadow-md hover:bg-red-50 text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {/* Photo Area */}
      <div className="relative w-full aspect-[3/4] bg-gray-900 overflow-hidden border border-gray-200">
        <img 
          src={photo.imageData} 
          alt="Memory" 
          className="w-full h-full object-cover transition-all duration-[4000ms] ease-out"
          style={{
            filter: visualState === 'developing' ? 'blur(10px) brightness(2)' : 'blur(0px) brightness(1)',
            opacity: visualState === 'developing' ? 0.8 : 1,
            transform: 'scaleX(-1)', // Mirror selfie to normal
          }}
          draggable={false}
        />
      </div>

      {/* Caption Area */}
      <div className="mt-4 font-handwritten text-gray-800 text-center leading-tight relative group min-h-[60px] flex flex-col justify-center items-center">
        
        {isEditing ? (
          <div className="w-full flex flex-col items-center gap-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-yellow-50 border-b border-gray-300 focus:outline-none text-center resize-none p-1 text-sm"
              rows={2}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              onMouseDown={(e) => e.stopPropagation()} // Prevent drag start on input
            />
            <div className="flex gap-2">
               <button onClick={saveEdit} className="text-green-600"><Check size={14} /></button>
               <button onClick={cancelEdit} className="text-red-500"><X size={14} /></button>
            </div>
          </div>
        ) : (
          <>
            <div 
              className="relative w-full"
              onDoubleClick={() => setIsEditing(true)}
            >
              <p className="text-lg text-gray-800 break-words px-1">
                {photo.caption || (isRegenerating ? "Writing..." : "...")}
              </p>
              <p className="text-xs text-gray-400 mt-1 font-sans">{photo.dateString}</p>
              
              {/* Text Interaction Icons */}
              {!photo.isStaged && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pl-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Pencil size={14} />
                  </button>
                  <button 
                    onClick={handleRegenerateCaption}
                    className={`text-gray-400 hover:text-blue-500 ${isRegenerating ? 'animate-spin' : ''}`}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};