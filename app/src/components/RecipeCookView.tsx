import { useEffect, useRef, useState } from 'react';
import type { Recipe } from '../types';

interface Props {
  recipe: Recipe;
  onClose: () => void;
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

export function RecipeCookView({ recipe, onClose }: Props) {
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [currentStep, setCurrentStep] = useState<number>(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    let released = false;

    async function acquireWakeLock() {
      if (!('wakeLock' in navigator)) return;
      try {
        wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request(t: 'screen'): Promise<WakeLockSentinel> } }).wakeLock.request('screen');
      } catch {
        // unsupported or permission denied — silently continue
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && !released) acquireWakeLock();
    }

    acquireWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, []);

  function toggleIngredient(index: number) {
    setCheckedIngredients(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  function handleStepTap(index: number) {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
        setCurrentStep(i => Math.min(i, index));
      } else {
        next.add(index);
        setCurrentStep(() => {
          for (let i = index + 1; i < recipe.steps.length; i++) {
            if (!next.has(i)) return i;
          }
          return index;
        });
      }
      return next;
    });
  }

  const totalSteps = recipe.steps.length;
  const allDone = totalSteps > 0 && completedSteps.size === totalSteps;
  const progressText = totalSteps === 0
    ? ''
    : allDone
      ? 'Done!'
      : `Step ${currentStep + 1} of ${totalSteps}`;

  return (
    <div className="cook-overlay">
      <div className="cook-header">
        <button className="cook-exit-btn" onClick={onClose} aria-label="Exit cook mode">
          <BackIcon />
        </button>
        <span className="cook-recipe-title">{recipe.name}</span>
        {progressText && <span className="cook-progress">{progressText}</span>}
      </div>

      <div className="cook-body">
        {recipe.ingredients.length > 0 && (
          <div className="cook-section">
            <div className="cook-section-label">Ingredients</div>
            <div className="cook-ingredient-list">
              {recipe.ingredients.map((ing, i) => (
                <div
                  key={i}
                  className={`cook-ingredient-item${checkedIngredients.has(i) ? ' checked' : ''}`}
                  onClick={() => toggleIngredient(i)}
                >
                  <div className="cook-check-circle">
                    <CheckIcon />
                  </div>
                  <span className="cook-ingredient-name">{ing.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recipe.steps.length > 0 && (
          <div className="cook-section">
            <div className="cook-section-label">Steps</div>
            <div className="cook-step-list">
              {recipe.steps.map((step, i) => {
                const isCompleted = completedSteps.has(i);
                const isCurrent = !isCompleted && i === currentStep;
                return (
                  <div
                    key={i}
                    className={['cook-step-item', isCurrent ? 'current' : '', isCompleted ? 'completed' : ''].filter(Boolean).join(' ')}
                    onClick={() => handleStepTap(i)}
                  >
                    <span className="cook-step-number">{i + 1}</span>
                    <span className="cook-step-text">{step}</span>
                  </div>
                );
              })}
            </div>
            {allDone && <div className="cook-done-banner">Enjoy your meal!</div>}
          </div>
        )}

        {recipe.ingredients.length === 0 && recipe.steps.length === 0 && (
          <p style={{ color: 'var(--text2)', fontSize: 16 }}>No ingredients or steps recorded for this recipe.</p>
        )}
      </div>
    </div>
  );
}
