/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {DataContext} from '@/context';
import {Example} from '@/lib/types';
import {useContext, useState} from 'react';
import {motion} from 'motion/react';
import {Search, Check} from 'lucide-react';

interface ExampleGalleryProps {
  title?: string;
  selectedExample: Example | null;
  onSelectExample: (example: Example) => void;
  isGenerating?: boolean;
}

export default function ExampleGallery({
  title = 'Examples',
  selectedExample,
  onSelectExample,
  isGenerating = false,
}: ExampleGalleryProps) {
  const getThumbnailUrl = (url: string) => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    const videoId = match && match[2].length === 11 ? match[2] : null;
    return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
  };

  const {examples} = useContext(DataContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(6);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setVisibleCount(6);
  };

  const filteredExamples = examples.filter((example) =>
    example.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedExamples = filteredExamples.slice(0, visibleCount);
  const hasMore = visibleCount < filteredExamples.length;

  const loadMore = () => {
    setVisibleCount(prev => prev + 6);
  };

  return (
    <div className="example-gallery">
      <div className="gallery-header">
        <h2 className="gallery-title">{title}</h2>
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search examples..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="gallery-search-input"
          />
        </div>
      </div>
      <div className="gallery-grid">
        {displayedExamples.length > 0 ? (
          displayedExamples.map((example, index) => {
            const isSelected = selectedExample?.url === example.url;
            return (
              <motion.div
                key={example.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  scale: isSelected ? 1.05 : 1,
                  borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border)',
                  boxShadow: isSelected 
                    ? [
                        '0 0 15px rgba(var(--color-accent-rgb), 0.3)',
                        '0 0 25px rgba(var(--color-accent-rgb), 0.5)',
                        '0 0 15px rgba(var(--color-accent-rgb), 0.3)'
                      ] 
                    : 'none'
                }}
                transition={{ 
                  opacity: { delay: index * 0.05 },
                  y: { delay: index * 0.05 },
                  scale: { type: 'spring', stiffness: 300, damping: 15 },
                  boxShadow: isSelected 
                    ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.3 }
                }}
                whileHover={{ 
                  scale: 1.04,
                  borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-accent-glow)',
                }}
                whileTap={{ scale: 0.98 }}
                className={`gallery-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectExample(example)}>
                <div 
                  draggable 
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', example.url);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  style={{ display: 'contents' }}
                >
                  <div className="thumbnail-container">
                  <img
                    src={getThumbnailUrl(example.url)}
                    alt={example.title}
                    className="thumbnail"
                    referrerPolicy="no-referrer"
                  />
                  {isSelected && (
                    <motion.div 
                      className="selected-badge"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      {isGenerating ? (
                        <div className="mini-spinner" />
                      ) : (
                        <Check size={14} className="check-icon" />
                      )}
                    </motion.div>
                  )}
                </div>
                <div className="gallery-item-title">{example.title}</div>
                  </div>
              </motion.div>
            );
          })
        ) : (
          <div className="no-results-container">
            <Search size={32} className="no-results-icon" />
            <p className="no-results-text">
              No examples found matching "<strong>{searchQuery}</strong>"
            </p>
            <button 
              className="button-secondary no-results-clear"
              onClick={() => setSearchQuery('')}
            >
              Clear search
            </button>
          </div>
        )}
      </div>

      {hasMore && (
        <div className="load-more-container">
          <button 
            className="load-more-button"
            onClick={loadMore}
          >
            Load More Results
          </button>
        </div>
      )}

      <style>{`
        .no-results-container {
          grid-column: 1 / -1;
          padding: 3rem 1.5rem;
          text-align: center;
          background: var(--color-background-soft);
          border-radius: var(--radius-lg);
          border: 1px dashed var(--color-border);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .no-results-icon {
          color: var(--color-text-muted);
          opacity: 0.3;
        }

        .no-results-text {
          color: var(--color-text-muted);
          font-size: 0.8125rem;
          margin: 0;
        }

        .no-results-clear {
          font-size: 0.7rem !important;
          padding: 0.4rem 0.8rem !important;
        }

        .example-gallery {
          width: 100%;
        }

        .gallery-header {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .gallery-title {
          color: var(--color-text-muted);
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 0;
          font-family: var(--font-primary);
        }

        .search-wrapper {
          position: relative;
          width: 100%;
        }

        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          pointer-events: none;
          opacity: 0.5;
        }

        .gallery-search-input {
          width: 100%;
          padding: 0.5rem 0.75rem 0.5rem 2.25rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-background-soft);
          color: var(--color-text);
          font-size: 0.8125rem;
          outline: none;
          transition: all 0.2s;
        }

        .gallery-search-input:focus {
          border-color: var(--color-accent);
          background: var(--color-background-elevated);
        }

        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(1, 1fr);
          gap: 0.75rem;
        }

        .gallery-item {
          cursor: pointer;
          border: 1px solid var(--color-border);
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: rgba(var(--color-accent-rgb), 0.02);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .gallery-item::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0%;
          height: 2px;
          background: var(--color-accent);
          transition: width 0.3s ease;
        }

        .gallery-item:hover::after {
          width: 100%;
        }

        .gallery-item:hover {
          border-color: var(--color-accent);
          background: var(--color-background-elevated);
          transform: translateY(-5px);
          box-shadow: 
            0 12px 30px -10px rgba(0, 0, 0, 0.4),
            0 0 20px rgba(var(--color-accent-rgb), 0.15);
        }

        .gallery-item.selected {
          border-color: var(--color-accent);
          background-color: var(--color-background-elevated);
          box-shadow: 0 0 0 2px var(--color-accent-soft), var(--shadow-lg);
          z-index: 10;
        }

        .gallery-item.selected .gallery-item-title {
          color: var(--color-accent);
          font-weight: 700;
        }

        .gallery-item-title {
          background-color: transparent;
          display: flex;
          align-items: center;
          font-size: 0.7rem;
          font-weight: 500;
          line-height: 1.3;
          padding: 0.5rem 0.75rem;
          color: var(--color-text-muted);
          transition: all 0.2s;
          border-top: 1px solid var(--color-border-soft);
        }

        .thumbnail-container {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          background-color: var(--color-background);
          overflow: hidden;
        }

        .thumbnail {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.6;
          transition: opacity 0.3s, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .gallery-item:hover .thumbnail {
          opacity: 1;
          transform: scale(1.05);
        }

        .gallery-item.selected .thumbnail {
          opacity: 1;
        }

        .selected-badge {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          background-color: var(--color-accent);
          color: white;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }

        .check-icon {
          stroke-width: 3;
        }

        .mini-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .load-more-container {
          display: flex;
          justify-content: center;
          margin-top: 1.5rem;
          padding-bottom: 2rem;
        }

        .load-more-button {
          background: var(--color-background-elevated);
          border: 1px solid var(--color-border);
          color: var(--color-text-muted);
          padding: 0.6rem 1.5rem;
          border-radius: var(--radius-md);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .load-more-button:hover {
          background: var(--color-background-soft);
          border-color: var(--color-accent);
          color: var(--color-accent);
          transform: translateY(-1px);
        }

        .load-more-button:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
