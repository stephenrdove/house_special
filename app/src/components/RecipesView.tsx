import { useState } from 'react';
import { api } from '../api';
import type { ExtractedRecipe, Recipe, RecipeIngredient } from '../types';
import { RecipeCookView } from './RecipeCookView';

type Sheet = 'none' | 'add' | 'preview' | 'detail' | 'delete-confirm' | 'share-link';

const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

function RecipeCard({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  return (
    <div className="card" style={{ padding: 16, cursor: 'pointer' }} onClick={onClick}>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{recipe.name}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>
        {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
        {recipe.source_url && ' · from URL'}
      </div>
      {recipe.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {recipe.tags.map(tag => (
            <span key={tag} className="tag" style={{ fontSize: 11 }}>{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  recipes: Recipe[];
  setRecipes: (fn: (prev: Recipe[]) => Recipe[]) => void;
  showError: (msg: string) => void;
}

export function RecipesView({ recipes, setRecipes, showError }: Props) {
  const [sheet, setSheet] = useState<Sheet>('none');

  // Add sheet state
  const [inputMode, setInputMode] = useState<'url' | 'text' | 'file'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');

  // Preview sheet state
  const [previewName, setPreviewName] = useState('');
  const [previewSourceUrl, setPreviewSourceUrl] = useState('');
  const [previewIngredients, setPreviewIngredients] = useState('');
  const [previewExtractedIngredients, setPreviewExtractedIngredients] = useState<RecipeIngredient[]>([]);
  const [previewSteps, setPreviewSteps] = useState('');
  const [previewNotes, setPreviewNotes] = useState('');
  const [previewTags, setPreviewTags] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail / delete / share state
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [cookRecipe, setCookRecipe] = useState<Recipe | null>(null);

  function openDetail(recipe: Recipe) {
    setActiveRecipe(recipe);
    setSheet('detail');
  }

  function closeSheet() {
    setSheet('none');
    setUrlInput('');
    setTextInput('');
    setSelectedFile(null);
    setExtractError('');
  }

  function populatePreview(extracted: ExtractedRecipe) {
    setPreviewName(extracted.name);
    setPreviewSourceUrl(extracted.source_url ?? '');
    setPreviewExtractedIngredients(extracted.ingredients);
    setPreviewIngredients(extracted.ingredients.map(i => i.name).join('\n'));
    setPreviewSteps(extracted.steps.join('\n'));
    setPreviewNotes(extracted.notes ?? '');
    setPreviewTags(extracted.tags.join(', '));
  }

  async function handleExtract() {
    setExtracting(true);
    setExtractError('');
    try {
      let body: Parameters<typeof api.extractRecipe>[0];
      if (inputMode === 'url') {
        body = { url: urlInput };
      } else if (inputMode === 'text') {
        body = { text: textInput };
      } else {
        if (!selectedFile) throw new Error('No file selected');
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
        body = { file: dataUrl };
      }
      const extracted = await api.extractRecipe(body);
      populatePreview(extracted);
      setSheet('preview');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Extraction failed';
      setExtractError(msg.includes('502') ? 'Could not fetch that URL. Try pasting the recipe text instead.' : 'Extraction failed. Try again.');
    } finally {
      setExtracting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const lines = previewIngredients.split('\n').map(s => s.trim()).filter(Boolean);
      const ingredients = lines.map((name, i) => ({
        name,
        category: previewExtractedIngredients[i]?.category ?? 'Other',
      }));
      const recipe = {
        name: previewName.trim(),
        source_url: previewSourceUrl.trim() || null,
        ingredients,
        steps: previewSteps.split('\n').map(s => s.trim()).filter(Boolean),
        notes: previewNotes.trim(),
        tags: previewTags.split(',').map(s => s.trim()).filter(Boolean),
      };
      const { id } = await api.saveRecipe(recipe);
      const saved: Recipe = { ...recipe, id, created_at: Date.now() };
      setRecipes(prev => [saved, ...prev]);
      closeSheet();
    } catch {
      // keep sheet open
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeRecipe) return;
    setDeleting(true);
    try {
      await api.deleteRecipe(activeRecipe.id);
      setRecipes((prev: Recipe[]) => prev.filter(r => r.id !== activeRecipe.id));
      setSheet('none');
      setActiveRecipe(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't delete recipe.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleShare() {
    if (!activeRecipe) return;
    setSharing(true);
    try {
      const result = await api.shareRecipe(activeRecipe.id);
      setShareUrl(result.url);
      setSheet('share-link');
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't create share link.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Recipes</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setSheet('add')}>+ Add</button>
      </div>

      {recipes.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 60, color: 'var(--text2)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
          <p style={{ fontSize: 14 }}>No recipes yet.</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Add one from a URL, paste text, or upload a photo or PDF.</p>
        </div>
      )}

      {recipes.length > 0 && (
        <div className="stack">
          {recipes.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} onClick={() => openDetail(recipe)} />
          ))}
        </div>
      )}

      {/* ── Add sheet ──────────────────────────────────────────────────────── */}
      {sheet === 'add' && (
        <div className="sheet-overlay" onClick={closeSheet}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">Add Recipe</span>
              <button className="icon-btn" onClick={closeSheet}><CloseIcon /></button>
            </div>
            <div className="sheet-body">
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn btn-sm ${inputMode === 'url' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                  onClick={() => setInputMode('url')}
                >
                  Paste URL
                </button>
                <button
                  className={`btn btn-sm ${inputMode === 'text' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                  onClick={() => setInputMode('text')}
                >
                  Paste text
                </button>
                <button
                  className={`btn btn-sm ${inputMode === 'file' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                  onClick={() => setInputMode('file')}
                >
                  Upload
                </button>
              </div>

              {inputMode === 'url' && (
                <div>
                  <label className="field-label">Recipe URL</label>
                  <input
                    type="url"
                    className="input"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="https://..."
                    autoFocus
                  />
                </div>
              )}
              {inputMode === 'text' && (
                <div>
                  <label className="field-label">Recipe text</label>
                  <textarea
                    className="input"
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    rows={8}
                    placeholder="Paste the recipe here..."
                    autoFocus
                  />
                </div>
              )}
              {inputMode === 'file' && (
                <div>
                  <label className="field-label">Photo or PDF</label>
                  {selectedFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="input" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</div>
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelectedFile(null)}>Clear</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <label style={{ flex: 1, cursor: 'pointer' }}>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          style={{ display: 'none' }}
                          onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                        />
                        <div className="btn btn-ghost" style={{ width: '100%', textAlign: 'center' }}>Choose file</div>
                      </label>
                      {isMobile && (
                        <label style={{ flex: 1, cursor: 'pointer' }}>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                          />
                          <div className="btn btn-ghost" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <CameraIcon /> Take photo
                          </div>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              {extractError && (
                <p style={{ fontSize: 13, color: 'var(--red)' }}>{extractError}</p>
              )}
            </div>
            <div className="sheet-footer">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={closeSheet}>Cancel</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleExtract}
                disabled={extracting || (inputMode === 'url' ? !urlInput.trim() : inputMode === 'text' ? !textInput.trim() : !selectedFile)}
              >
                {extracting ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Extracting…</>
                ) : 'Extract Recipe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview sheet ──────────────────────────────────────────────────── */}
      {sheet === 'preview' && (
        <div className="sheet-overlay">
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">Review Recipe</span>
            </div>
            <div className="sheet-body">
              <p style={{ fontSize: 12, color: 'var(--text2)' }}>Check and edit before saving.</p>

              <div>
                <label className="field-label">Name</label>
                <input className="input" value={previewName} onChange={e => setPreviewName(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Ingredients (one per line)</label>
                <textarea className="input" value={previewIngredients} onChange={e => setPreviewIngredients(e.target.value)} rows={6} />
              </div>
              <div>
                <label className="field-label">Steps (one per line)</label>
                <textarea className="input" value={previewSteps} onChange={e => setPreviewSteps(e.target.value)} rows={6} />
              </div>
              <div>
                <label className="field-label">Notes</label>
                <textarea className="input" value={previewNotes} onChange={e => setPreviewNotes(e.target.value)} rows={2} />
              </div>
              <div>
                <label className="field-label">Tags (comma-separated)</label>
                <input className="input" value={previewTags} onChange={e => setPreviewTags(e.target.value)} placeholder="gluten-free, 30-min, pasta" />
              </div>
            </div>
            <div className="sheet-footer">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSheet('add')}>Back</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleSave}
                disabled={saving || !previewName.trim()}
              >
                {saving ? 'Saving…' : 'Save Recipe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail sheet ───────────────────────────────────────────────────── */}
      {sheet === 'detail' && activeRecipe && (
        <div className="sheet-overlay" onClick={() => setSheet('none')}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">{activeRecipe.name}</span>
              <button className="icon-btn" onClick={() => setSheet('none')}><CloseIcon /></button>
            </div>
            <div className="sheet-body">
              {activeRecipe.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {activeRecipe.tags.map(tag => (
                    <span key={tag} className="tag" style={{ fontSize: 11 }}>{tag}</span>
                  ))}
                </div>
              )}
              {activeRecipe.source_url && (
                <a href={activeRecipe.source_url} target="_blank" rel="noopener noreferrer" className="recipe-source-link">
                  {activeRecipe.source_url}
                </a>
              )}
              <div>
                <div className="section-label" style={{ padding: '0 0 8px' }}>Ingredients</div>
                <ul className="recipe-ingredient-list">
                  {activeRecipe.ingredients.map(ing => <li key={ing.name}>{ing.name}</li>)}
                </ul>
              </div>
              {activeRecipe.steps.length > 0 && (
                <div>
                  <div className="section-label" style={{ padding: '0 0 8px' }}>Steps</div>
                  <ol className="recipe-step-list">
                    {activeRecipe.steps.map((step, i) => <li key={`step-${i}`}>{step}</li>)}
                  </ol>
                </div>
              )}
              {activeRecipe.notes && (
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{activeRecipe.notes}</p>
              )}
            </div>
            <div className="sheet-footer">
              <button className="btn btn-danger btn-sm" onClick={() => setSheet('delete-confirm')}>Delete</button>
              <button
                className="icon-btn"
                title="Share recipe"
                onClick={handleShare}
                disabled={sharing}
                style={{ marginLeft: 'auto' }}
              >
                {sharing ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : <ShareIcon />}
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setCookRecipe(activeRecipe)}>Cook</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm sheet ───────────────────────────────────────────── */}
      {sheet === 'delete-confirm' && activeRecipe && (
        <div className="sheet-overlay" onClick={() => setSheet('detail')}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">Delete Recipe?</span>
            </div>
            <div className="sheet-body">
              <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.6 }}>
                "{activeRecipe.name}" will be permanently removed from your recipe library.
              </p>
            </div>
            <div className="sheet-footer">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSheet('detail')}>Cancel</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share link sheet ────────────────────────────────────────────────── */}
      {sheet === 'share-link' && shareUrl && (
        <div className="sheet-overlay" onClick={() => setSheet('detail')}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">Share Recipe</span>
              <button className="icon-btn" onClick={() => setSheet('detail')}><CloseIcon /></button>
            </div>
            <div className="sheet-body">
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                Send this link to another family. They can preview and add the recipe to their collection. The link expires in 7 days.
              </p>
              <div className="input" style={{ fontSize: 12, wordBreak: 'break-all', color: 'var(--text2)', userSelect: 'all' }}>
                {shareUrl}
              </div>
            </div>
            <div className="sheet-footer">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSheet('detail')}>Close</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => navigator.clipboard.writeText(shareUrl).catch(() => {})}
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {cookRecipe && (
        <RecipeCookView recipe={cookRecipe} onClose={() => setCookRecipe(null)} />
      )}
    </div>
  );
}
