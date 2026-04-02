'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search } from 'lucide-react';
import { RepoPickerItem, type RepoPickerItemData } from './repo-picker-item';
import { useDebounce } from '@/hooks/use-debounce';

interface RepoPickerProps {
  onSelect: (repo: RepoPickerItemData) => void;
}

interface ReposResponse {
  repos: RepoPickerItemData[];
  totalCount: number;
  page: number;
  perPage: number;
  hasNextPage: boolean;
}

interface OrgsResponse {
  orgs: Array<{ login: string; avatarUrl: string }>;
}

export function RepoPicker({ onSelect }: RepoPickerProps) {
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  const { data: orgsData } = useQuery<OrgsResponse>({
    queryKey: ['github-orgs'],
    queryFn: async () => {
      const res = await fetch('/api/github/orgs');
      if (!res.ok) throw new Error('Failed to fetch orgs');
      return res.json();
    },
  });

  const {
    data: reposData,
    isLoading,
    isError,
    error,
  } = useQuery<ReposResponse>({
    queryKey: ['github-repos', debouncedSearch, selectedOrg, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: '30',
        sort: 'pushed',
      });

      if (debouncedSearch) {
        params.set('q', debouncedSearch);
      }

      if (selectedOrg && selectedOrg !== 'all') {
        params.set('org', selectedOrg);
      }

      const res = await fetch(`/api/github/repos?${params}`);
      if (!res.ok) throw new Error('Failed to fetch repos');
      return res.json();
    },
  });

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleOrgChange = useCallback((value: string) => {
    setSelectedOrg(value);
    setPage(1);
  }, []);

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={search}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>

        <Select value={selectedOrg} onValueChange={handleOrgChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {orgsData?.orgs.map((org) => (
              <SelectItem key={org.login} value={org.login}>
                {org.login}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Repo list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading repositories...
            </span>
          </div>
        ) : isError ? (
          <div className="text-center py-8">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : 'Failed to load repositories'}
            </p>
          </div>
        ) : reposData?.repos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              {debouncedSearch
                ? 'No repositories match your search'
                : 'No repositories found'}
            </p>
          </div>
        ) : (
          reposData?.repos.map((repo) => (
            <RepoPickerItem
              key={repo.id}
              repo={repo}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {reposData && (reposData.hasNextPage || page > 1) && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!reposData.hasNextPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
