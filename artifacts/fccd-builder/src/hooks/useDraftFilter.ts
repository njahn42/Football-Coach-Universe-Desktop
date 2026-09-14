import { useState, useMemo, useCallback } from 'react';
import type { Team, DraftFilters } from '@/types';
import { EMPTY_FILTERS } from '@/types';

export interface DraftFilterOptions {
  states: string[];
  archetypes: string[];
  fanbaseTypes: string[];
}

export interface UseDraftFilterReturn {
  filters: DraftFilters;
  filtered: Team[];
  options: DraftFilterOptions;
  setFilter: <K extends keyof DraftFilters>(key: K, value: DraftFilters[K]) => void;
  cycleFilter: <K extends keyof DraftFilters>(key: K, direction?: 'next' | 'prev') => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

/**
 * Manages filter state for the team pool.
 *
 * @param pool - The undrafted team pool (already excluding drafted teams).
 *               Filter options are derived from this pool so unavailable
 *               options disappear naturally.
 */
export function useDraftFilter(pool: Team[]): UseDraftFilterReturn {
  const [filters, setFilters] = useState<DraftFilters>(EMPTY_FILTERS);

  // Available filter options derived from the current undrafted pool
  const options = useMemo<DraftFilterOptions>(() => ({
    states:       [...new Set(pool.map(t => t.state))].sort(),
    archetypes:   [...new Set(pool.map(t => t.archetype))].sort(),
    fanbaseTypes: [...new Set(pool.map(t => t.fanbaseType))].sort(),
  }), [pool]);

  // AND-filtered pool
  const filtered = useMemo<Team[]>(() => {
    return pool.filter(team => {
      if (filters.division   && team.division   !== filters.division)   return false;
      if (filters.state      && team.state      !== filters.state)      return false;
      if (filters.archetype  && team.archetype  !== filters.archetype)  return false;
      if (filters.fanbaseType && team.fanbaseType !== filters.fanbaseType) return false;
      return true;
    });
  }, [pool, filters]);

  const setFilter = useCallback(<K extends keyof DraftFilters>(key: K, value: DraftFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  /**
   * Cycle through the available options for a filter key.
   * Empty string ('') wraps around as "All" (first/last position).
   */
  const cycleFilter = useCallback(<K extends keyof DraftFilters>(key: K, direction: 'next' | 'prev' = 'next') => {
    setFilters(prev => {
      const current = prev[key] as string;

      if (key === 'division') {
        const vals = ['', 'FBS', 'FCS'] as const;
        const idx = vals.indexOf(current as '' | 'FBS' | 'FCS');
        const next = direction === 'next'
          ? (idx + 1) % vals.length
          : (idx - 1 + vals.length) % vals.length;
        return { ...prev, [key]: vals[next] };
      }

      // For state/archetype/fanbaseType: build list from options (empty string = All at index 0)
      const listMap: Record<string, string[]> = {
        state:       ['', ...options.states],
        archetype:   ['', ...options.archetypes],
        fanbaseType: ['', ...options.fanbaseTypes],
      };
      const list = listMap[key as string] ?? [''];
      const idx = list.indexOf(current);
      const safeIdx = idx === -1 ? 0 : idx;
      const next = direction === 'next'
        ? (safeIdx + 1) % list.length
        : (safeIdx - 1 + list.length) % list.length;
      return { ...prev, [key]: list[next] };
    });
  }, [options]);

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return { filters, filtered, options, setFilter, cycleFilter, clearFilters, hasActiveFilters };
}
